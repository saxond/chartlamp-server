import { getModelForClass, modelOptions, prop, Ref } from "@typegoose/typegoose";
import { v4 as uuidv4 } from 'uuid';
import { Organization } from "./organization.model"; // Ensure this path is correct
import { TwoFactorAuth } from "./twoFactorAuth.model"; // Ensure this path is correct

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class User {
  // Add _id field
  public _id?: string;

  @prop({ required: true })
  public name!: string;

  @prop({ required: true, unique: true })
  public email!: string;

  @prop({ required: true })
  public password!: string;

  @prop({ required: true, enum: ["admin", "user", "guest"], default: "admin" })
  public role!: string;

  @prop({ ref: () => Organization, required: false })
  public organization?: Ref<Organization> | null;

  @prop({ ref: () => TwoFactorAuth, required: false, default: null })
  public twoFactorAuth?: Ref<TwoFactorAuth> | null;

  @prop({ required: false })
  public resetPasswordToken?: string;

  @prop({ required: false })
  public resetPasswordExpires?: Date;

  // Method to generate password reset token
  public generatePasswordResetToken() {
    this.resetPasswordToken = uuidv4();
    this.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour from now
  }
}

export const UserModel = getModelForClass(User);