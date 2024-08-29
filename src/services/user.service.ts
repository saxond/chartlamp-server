import bcrypt from 'bcrypt';
import qrcode from 'qrcode';
import speakeasy from 'speakeasy';
import { UserRegistrationInput } from '../interfaces/user';
import { OrganizationModel } from '../models/organization.model';
import { TwoFactorAuthModel } from '../models/twoFactorAuth.model';
import { User, UserModel } from '../models/user.model';
import notificationService from './notification.service'; // Import the instance directly

class UserService {
  private notificationService = notificationService;

  async register(input: UserRegistrationInput) {
    const { name, email, password, organization } = input;

    // Check if the email is already in use
    if (await UserModel.exists({ email })) {
      throw new Error('Email is already in use');
    }

    const userOrganizationName = organization || name;

    // Concurrently create organization and hash password
    const [newOrg, hashedPassword] = await Promise.all([
      OrganizationModel.create({ name: userOrganizationName }),
      bcrypt.hash(password, 10)
    ]);

    const user = new UserModel({
      name,
      email,
      password: hashedPassword,
      organization: newOrg._id,
    });

    await user.save();
    return user;
  }

  async getUserById(id: string) {
    return await UserModel.findById(id).lean();
  }

  async login(email: string, password: string) {
    const user = await UserModel.findOne({ email }).populate('twoFactorAuth').populate('organization').lean();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Invalid email or password');
    }

    if (user.twoFactorAuth) {
      const user2Fa = await TwoFactorAuthModel.findById(user.twoFactorAuth);
      if (!user2Fa) throw new Error('TwoFactorAuth not found');

      const token = speakeasy.totp({
        secret: user2Fa.secret!,
        encoding: 'base32',
      });

      await this.sendTwoFactorToken(user, token);
      
      return {  user:{_id: user._id,
        name: user.name,
        email: user.email,
        organization: user.organization,
        twoFactorAuth: user.twoFactorAuth}, twoFactorRequired: true };
    }

    return { user, twoFactorRequired: false };
  }

  async generateTwoFactorSecret(user: User, method: string, phoneNumber?: string) {
    this.validateTwoFactorMethod(method);

    if (method === 'phone' && !phoneNumber) {
      throw new Error('Phone number is required for phone 2FA');
    }

    const secret = speakeasy.generateSecret({ length: 20 });
    const twoFactorAuth = new TwoFactorAuthModel({
      user: user._id,
      secret: secret.base32,
      method,
      phoneNumber,
    });

    await twoFactorAuth.save();
    await UserModel.findByIdAndUpdate(user._id, { twoFactorAuth: twoFactorAuth._id });

    if (method === 'app') {
      return this.generateAppTwoFactorResponse(secret, user.email);
    }

    return secret.base32;
  }

  async me(id: string) {
    return await UserModel.findById(id).populate('twoFactorAuth').populate('organization').lean();
  }

  private async generateAppTwoFactorResponse(secret: speakeasy.GeneratedSecret, email: string) {
    const appName = process.env.APP_NAME || 'ChartLamp';
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `${appName} (${email})`,
      issuer: appName,
    });

    const qrCode = await qrcode.toDataURL(otpauthUrl);
    return { qrCode, otpauthUrl };
  }

  async sendTwoFactorToken(user: User, token: string) {
    const twoFactorAuth = await TwoFactorAuthModel.findById(user.twoFactorAuth);
    if (!twoFactorAuth) throw new Error('TwoFactorAuth not found');

    const message = `Your 2FA code is ${token}`;

    switch (twoFactorAuth.method) {
      case 'email':
        await this.notificationService.sendEmail(user.email, 'Your 2FA Code', message);
        break;
      case 'sms':
        await this.notificationService.sendSMS(twoFactorAuth.phoneNumber!, message);
        break;
      case 'phone':
        await this.notificationService.sendPhoneCall(twoFactorAuth.phoneNumber!, message);
        break;
      case 'app':
        break;
      default:
        throw new Error('Invalid 2FA method');
    }
  }

  async verifyTwoFactorToken(user: User, token: string): Promise<boolean> {
    const twoFactorAuth = await TwoFactorAuthModel.findById(user.twoFactorAuth);
    if (!twoFactorAuth) throw new Error('TwoFactorAuth not found');

    const verified = speakeasy.totp.verify({
      secret: twoFactorAuth.secret!,
      encoding: 'base32',
      token,
      window: 1, // Allow a window of 1 time step before and after
    });

    if (!verified) {
      console.error('Invalid 2FA token', { userId: user._id, token });
    }

    return verified;
  }

  async disableTwoFactorAuth(user: User) {
    await TwoFactorAuthModel.findByIdAndDelete(user.twoFactorAuth);
    await UserModel.findByIdAndUpdate(user._id, { twoFactorAuth: null });
  }

  async regenerateTwoFactorSecret(user: User, method: string) {
    await this.disableTwoFactorAuth(user);
    return this.generateTwoFactorSecret(user, method);
  }

  private validateTwoFactorMethod(method: string) {
    const validMethods = ['email', 'sms', 'phone', 'app'];
    if (!validMethods.includes(method)) {
      throw new Error('Invalid 2FA method');
    }
  }

  async resendTwoFactorToken(user: User) {
    const twoFactorAuth = await TwoFactorAuthModel.findById(user.twoFactorAuth);
    if (!twoFactorAuth) throw new Error('TwoFactorAuth not found');
    
    const token = speakeasy.totp({
      secret: twoFactorAuth.secret!,
      encoding: 'base32',
    });

    await this.sendTwoFactorToken(user, token);
  }
}

export default UserService;