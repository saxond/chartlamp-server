import bcrypt from "bcrypt";
import { parse } from "csv-parse/sync";
import fs from "fs";
import qrcode from "qrcode";
import speakeasy from "speakeasy";
import { UserRegistrationInput } from "../interfaces/user";
import { BodyPartToImageModel } from "../models/bodyPartToImage.model";
import { Organization, OrganizationModel } from "../models/organization.model";
import { User, UserModel } from "../models/user.model";
import {
  TwoFactorAuth,
  TwoFactorAuthModel,
} from "../models/twoFactorAuth.model";
import { signJwt } from "../utils/jwt";
import notificationService from "./notification.service";

export interface UserServiceEnv {
  ENABLE_TWO_FACTOR_AUTH?: string;
}

declare global {
    namespace NodeJS {
        interface ProcessEnv extends UserServiceEnv { }
    }
}

class UserService {
  private notificationService = notificationService;
  private env: UserServiceEnv;

  constructor(env: UserServiceEnv) {
    this.env = env;
  }

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
    
    const enableTwoFactorAuth = this.env.ENABLE_TWO_FACTOR_AUTH !== "false";
    const method = enableTwoFactorAuth ? "email" : "app";

    // Subscribe user to 2FA
    await this.generateTwoFactorSecret({ user, method: method, isEnabled: enableTwoFactorAuth });

    await this.sendNewUserMailToAdmin(name, userOrganizationName);
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

      if (user2Fa.isEnabled) {
        const token = speakeasy.totp({
          secret: user2Fa.secret!,
          encoding: "base32",
          step: 300, // 5 minutes
        });

        await this.sendTwoFactorToken(user, token);
      }

      return {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          organization: user.organization,
          profilePicture: user.profilePicture,
          phone: user.phone,
          twoFactorAuth:
            typeof user.twoFactorAuth === "object"
              ? {
                  isEnabled: (user.twoFactorAuth as TwoFactorAuth).isEnabled,
                  method: (user.twoFactorAuth as TwoFactorAuth).method,
                  phoneNumber: (user.twoFactorAuth as TwoFactorAuth)
                    .phoneNumber,
                }
              : null,
        },
        twoFactorRequired: (user.twoFactorAuth as TwoFactorAuth).isEnabled,
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
             ${process.env.FRONTEND_URL}/auth/reset-password?token=${user.resetPasswordToken}\n\n
             If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await this.notificationService.sendEmail(
      user.email,
      mailOptions.subject,
      mailOptions.text
    );

    return user.resetPasswordToken;
  }

  async sendNewUserMailToAdmin(userName: string, OrganizationName: string) {
    const mailOptions = {
      to: "justin@chartlamp.com",
      // to: "veyrondavids@gmail.com",
      subject: "Chartlamp - New user Alert",
      text: `
      Hello,\n
      A new user ${userName} has been added to ${OrganizationName} organization.\n\n
      `,
    };
    await this.notificationService.sendEmail(
      mailOptions.to,
      mailOptions.subject,
      mailOptions.text
    );
  }

  // Reset password
  async resetPassword({
    token,
    newPassword,
  }: {
    token: string;
    newPassword: string;
  }) {
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new Error("Password reset token is invalid or has expired");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
  }

  // Generate two-factor authentication secret
  async generateTwoFactorSecret({
    user,
    method,
    phoneNumber,
    existingAuthId,
    isEnabled,
  }: {
    user: User;
    method: string;
    phoneNumber?: string;
    existingAuthId?: string;
    isEnabled?: boolean;
  }) {
    this.validateTwoFactorMethod(method);

    if (method === "phone" && !phoneNumber) {
      throw new Error("Phone number is required for phone 2FA");
    }
    console.log("existingAuthId", existingAuthId);
    if (existingAuthId) {
      const updatedDoc = await TwoFactorAuthModel.findByIdAndUpdate(
        existingAuthId,
        {
          method,
          isEnabled,
        }
      );
      if (phoneNumber && updatedDoc) {
        updatedDoc.phoneNumber = phoneNumber;
        await updatedDoc.save();
      }
    } else {
      const secret = speakeasy.generateSecret({ length: 20 });
      const twoFactorAuth = new TwoFactorAuthModel({
        user: user._id,
        secret: secret.base32,
        method,
        phoneNumber,
        isEnabled: isEnabled
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

    const {
      _id,
      name,
      email,
      organization,
      twoFactorAuth,
      profilePicture,
      phone,
    } = user;

    return {
      _id,
      name,
      email,
      organization,
      profilePicture,
      phone,
      twoFactorAuth: twoFactorAuth
        ? {
            isEnabled: (twoFactorAuth as TwoFactorAuth).isEnabled,
            method: (twoFactorAuth as TwoFactorAuth).method,
            phoneNumber: (twoFactorAuth as TwoFactorAuth).phoneNumber,
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

    if (user.role === "admin") {
      return await UserModel.find({}).lean();
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
    return this.generateTwoFactorSecret({ user, method });
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
    console.log("organizationId", organizationId);
    return await UserModel.find({
      _id: { $ne: userId },
      organization: organizationId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
  }

  async updateUser(input: {
    userId: string;
    name?: string;
    email?: string;
    profilePicture?: string;
    phone?: string;
  }) {
    const { userId, ...fieldsToUpdate } = input;

    const updateFields = Object.fromEntries(
      Object.entries(fieldsToUpdate).filter(
        ([_, value]) => value !== undefined && value !== ""
      )
    );

    if (Object.keys(updateFields).length === 0) {
      throw new Error("No fields to update");
    }

    const result = await UserModel.updateOne(
      { _id: userId },
      { $set: updateFields }
    );

    return result;
  }

  async updateUserPassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const { userId, currentPassword, newPassword } = input;

    const user = await UserModel.findById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new Error("Invalid email or password");
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return user;
  }

  async updateUserTwo(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const { userId, currentPassword, newPassword } = input;

    const user = await UserModel.findById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new Error("Invalid email or password");
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return user;
  }

  async toggleUser2FA(input: {
    userId: string;
    isEnabled: boolean;
    howToGetCode: string;
  }) {
    // await this.seedTwo();
    const { userId, isEnabled, howToGetCode } = input;
    const user = await UserModel.findById(userId).populate<{
      twoFactorAuth: TwoFactorAuth;
    }>("twoFactorAuth");
    if (!user) throw new Error("User not found");
    if (
      isEnabled &&
      user.twoFactorAuth &&
      user.twoFactorAuth.method == howToGetCode &&
      user.twoFactorAuth.isEnabled === isEnabled
    ) {
      throw new Error("2FA is already enabled");
    }
    return this.generateTwoFactorSecret({
      user: user as unknown as User,
      method: howToGetCode,
      existingAuthId: user?.twoFactorAuth?._id?.toString(),
      isEnabled,
    });
  }

  async update2faPhoneNumber(input: {
    userId: string;
    phoneNumber: string;
    howToGetCode: string;
  }) {
    const { userId, phoneNumber, howToGetCode } = input;
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.twoFactorAuth) {
      await this.generateTwoFactorSecret({
        user: user as unknown as User,
        method: howToGetCode,
        phoneNumber,
      });
    } else {
      await TwoFactorAuthModel.findByIdAndUpdate(user.twoFactorAuth, {
        phoneNumber,
        // method: howToGetCode,
      });
    }
    return "Phone number updated";
  }

  async updateUserAccessLevel(input: { userId: string; accessLevel: string }) {
    const { userId, accessLevel } = input;
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        accessLevel,
      },
      { new: true }
    );
    if (!user) throw new Error("User not found");
    return user;
  }

  async seedTwo() {
    const csvData = fs.readFileSync("abiolaexcel3.csv", "utf-8");
    const records = parse(csvData, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
    });
    // const data = records.slice(50000, 71486);
    // const res = await Promise.all(
    //   data.map((item: any) => {
    //     const code = item[0];
    //     const part = item[5];
    //     console.log(code, part);
    //     // return DiseaseClassificationModel.findOneAndUpdate(
    //     //   {
    //     //     icdCode: code,
    //     //   },
    //     //   {
    //     //     affectedBodyPartD: part,
    //     //   }
    //     // );
    //   })
    // );
    const data = records.slice(1, 775);
    const res = await Promise.all(
      data.map((item: any) => {
        const fileName = item[0].toString().split(",").join("").toLowerCase();
        const categoryName = item[1].toLowerCase();
        console.log(fileName, categoryName);
        return BodyPartToImageModel.findOneAndUpdate(
          {
            fileName,
          },
          {
            categoryName,
          }
        );
      })
    );

    return null;
  }

  async deleteUser(input: { userId: string }) {
    const { userId } = input;
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        status: "deleted",
      },
      { new: true }
    );
    if (!user) throw new Error("User not found");
    return user;
  }
}

export default UserService;
