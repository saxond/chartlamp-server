import bcrypt from "bcrypt";
import qrcode from "qrcode";
import speakeasy from "speakeasy";
import { UserRegistrationInput } from "../interfaces/user";
import { Organization, OrganizationModel } from "../models/organization.model";
import {
  TwoFactorAuth,
  TwoFactorAuthModel,
} from "../models/twoFactorAuth.model";
import { User, UserModel } from "../models/user.model";
import { signJwt } from "../utils/jwt";
import notificationService from "./notification.service"; // Import the instance directly

class UserService {
  private notificationService = notificationService;

  // Register a new user
  async register(input: UserRegistrationInput) {
    const { name, email, password, organization } = input;

    // Check if the email is already in use
    if (await UserModel.exists({ email })) {
      throw new Error("Email is already in use");
    }

    const userOrganizationName = organization || name;

    // Concurrently create organization and hash password
    const [newOrg, hashedPassword] = await Promise.all([
      OrganizationModel.create({ name: userOrganizationName }),
      bcrypt.hash(password, 10),
    ]);

    const user = new UserModel({
      name,
      email,
      password: hashedPassword,
      organization: newOrg._id,
    });

    await user.save();
    // Subscribe user to 2FA
    await this.generateTwoFactorSecret(user, "email");

    return user;
  }

  // Get user by ID
  async getUserById(id: string) {
    return await UserModel.findById(id).lean();
  }
  
  // User login
  async login(email: string, password: string) {
    const user = await UserModel.findOne({ email })
      .populate("twoFactorAuth")
      .populate("organization")
      .lean();
  
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Invalid email or password");
    }
  
    const authToken = await signJwt({ id: user._id, email: user.email });
  
    if (user.twoFactorAuth) {
      const user2Fa = await TwoFactorAuthModel.findByIdAndUpdate(
        (user.twoFactorAuth as TwoFactorAuth)._id,
        { isEnabled: false }
      );
      if (!user2Fa) throw new Error("TwoFactorAuth not found");
  
      const token = speakeasy.totp({
        secret: user2Fa.secret!,
        encoding: "base32",
        step: 300, // 5 minutes
      });
  
      await this.sendTwoFactorToken(user, token);
  
      return {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          organization: user.organization,
          twoFactorAuth:
            typeof user.twoFactorAuth === "object"
              ? {
                  isEnabled: (user.twoFactorAuth as TwoFactorAuth).isEnabled,
                  method: (user.twoFactorAuth as TwoFactorAuth).method,
                }
              : null,
        },
        twoFactorRequired: true,
        authToken,
      };
    }
  
    return { user, twoFactorRequired: false, authToken };
  }
  // Send password reset email
  async sendResetEmail(email: string) {
    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new Error("User not found");
    }

    user.generatePasswordResetToken();

    await user.save();

    const mailOptions = {
      to: user.email,
      subject: "Password Reset",
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
             Please click on the following link, or paste this into your browser to complete the process:\n\n
             http://${process.env.HOST}/reset/${user.resetPasswordToken}\n\n
             If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await this.notificationService.sendEmail(
      user.email,
      mailOptions.subject,
      mailOptions.text
    );

    return user.resetPasswordToken;
  }

  // Reset password
  static async resetPassword(token: string, newPassword: string) {
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new Error("Password reset token is invalid or has expired");
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
  }

  // Generate two-factor authentication secret
  async generateTwoFactorSecret(
    user: User,
    method: string,
    phoneNumber?: string
  ) {
    this.validateTwoFactorMethod(method);

    if (method === "phone" && !phoneNumber) {
      throw new Error("Phone number is required for phone 2FA");
    }

    const secret = speakeasy.generateSecret({ length: 20 });
    const twoFactorAuth = new TwoFactorAuthModel({
      user: user._id,
      secret: secret.base32,
      method,
      phoneNumber,
    });

    await twoFactorAuth.save();

    await UserModel.findByIdAndUpdate(user._id, {
      twoFactorAuth: twoFactorAuth._id,
    });

    if (method === "app") {
      return this.generateAppTwoFactorResponse(secret, user.email);
    }

    return secret.base32;
  }

  // Get current user details
  async me(id: string) {
    const user = await UserModel.findById(id)
      .populate("twoFactorAuth")
      .populate("organization")
      .lean();

    if (!user) {
      return null;
    }

    const { _id, name, email, organization, twoFactorAuth } = user;

    return {
      _id,
      name,
      email,
      organization,
      twoFactorAuth: twoFactorAuth
        ? {
            isEnabled: (twoFactorAuth as TwoFactorAuth).isEnabled,
            method: (twoFactorAuth as TwoFactorAuth).method,
          }
        : null,
    };
  }

  // Get team members
  async getTeamMembers(userId: string) {
    // Get user organization
    const user = await UserModel.findById(userId)
      .populate("organization")
      .lean();

    if (!user?.organization) {
      throw new Error("User not found");
    }
    return await UserModel.find({
      organization: (user.organization as Organization)._id,
    }).lean();
  }

  // Generate app two-factor response
  private async generateAppTwoFactorResponse(
    secret: speakeasy.GeneratedSecret,
    email: string
  ) {
    const appName = process.env.APP_NAME || "ChartLamp";
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `${appName} (${email})`,
      issuer: appName,
    });

    const qrCode = await qrcode.toDataURL(otpauthUrl);
    return { qrCode, otpauthUrl };
  }

  // Send two-factor token
  async sendTwoFactorToken(user: User, token: string) {
    const twoFactorAuth = await TwoFactorAuthModel.findById(user.twoFactorAuth);
    if (!twoFactorAuth) throw new Error("TwoFactorAuth not found");

    const message = `Your 2FA code is ${token}`;

    switch (twoFactorAuth.method) {
      case "email":
        await this.notificationService.sendEmail(
          user.email,
          "Your 2FA Code",
          message
        );
        break;
      case "sms":
        await this.notificationService.sendSMS(
          twoFactorAuth.phoneNumber!,
          message
        );
        break;
      case "phone":
        await this.notificationService.sendPhoneCall(
          twoFactorAuth.phoneNumber!,
          message
        );
        break;
      case "app":
        break;
      default:
        throw new Error("Invalid 2FA method");
    }
  }

  // Verify two-factor token
  async verifyTwoFactorToken(user: User, token: string): Promise<boolean> {
    const twoFactorAuth = await TwoFactorAuthModel.findById(user.twoFactorAuth);
    if (!twoFactorAuth) throw new Error("TwoFactorAuth not found");

    const verified = speakeasy.totp.verify({
      secret: twoFactorAuth.secret!,
      encoding: "base32",
      token,
      step: 300, // Ensure the step value matches the generation step
      window: 1, // Allow a window of 1 time step before and after
    });

    // Update user 2FA status
    if (verified) {
      await TwoFactorAuthModel.findByIdAndUpdate(user.twoFactorAuth, {
        isEnabled: true,
      });
    }

    if (!verified) {
      console.error("Invalid 2FA token", { userId: user._id, token });
    }

    return verified;
  }

  // Disable two-factor authentication
  async disableTwoFactorAuth(user: User) {
    await TwoFactorAuthModel.findByIdAndDelete(user.twoFactorAuth);
    await UserModel.findByIdAndUpdate(user._id, { twoFactorAuth: null });
  }

  // Regenerate two-factor secret
  async regenerateTwoFactorSecret(user: User, method: string) {
    await this.disableTwoFactorAuth(user);
    return this.generateTwoFactorSecret(user, method);
  }

  // Validate two-factor method
  private validateTwoFactorMethod(method: string) {
    const validMethods = ["email", "sms", "phone", "app"];
    if (!validMethods.includes(method)) {
      throw new Error("Invalid 2FA method");
    }
  }

  // Resend two-factor token
  async resendTwoFactorToken(user: User) {
    const twoFactorAuth = await TwoFactorAuthModel.findById(user.twoFactorAuth);
    if (!twoFactorAuth) throw new Error("TwoFactorAuth not found");

    const token = speakeasy.totp({
      secret: twoFactorAuth.secret!,
      encoding: "base32",
      step: 300, // 5 minutes
    });

    await this.sendTwoFactorToken(user, token);
  }

  // Get recently joined users
  async getRecentlyJoinedUsers(organizationId: string, userId: string) {
    return await UserModel.find({
      _id: { $ne: userId },
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
  }
}

export default UserService;