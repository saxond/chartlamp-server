import {
  getModelForClass,
  modelOptions,
  prop,
  Ref,
} from "@typegoose/typegoose";
import { v4 as uuidv4 } from "uuid";
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

  //optional profile picture
  @prop({ required: false })
  public profilePicture?: string;

  //optional profile picture
  @prop({ required: false })
  public phone?: string;

  @prop({
    required: true,
    enum: ["all_access", "view_only"],
    default: "all_access",
  })
  public accessLevel!: string;

  @prop({
    required: true,
    enum: ["deleted", "active"],
    default: "active",
  })
  public status!: string;

  @prop({
    required: true,
    enum: ["admin", "user", "guest", "super_admin"],
    default: "user",
  })
  public role!: string;

  @prop({ ref: () => Organization, required: false })
  public organization?: Ref<Organization> | null;

  @prop({ ref: () => TwoFactorAuth, required: false, default: null })
  public twoFactorAuth?: Ref<TwoFactorAuth> | null;

  @prop()
  public lastViewedCase?: string;

  @prop({ required: false })
  public resetPasswordToken?: string;

  @prop({ required: false })
  public resetPasswordExpires?: Date;

  public createdAt?: Date;
  public updatedAt?: Date;

  // Method to generate password reset token
  public generatePasswordResetToken() {
    this.resetPasswordToken = uuidv4();
    this.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour from now
  }
}

export const UserModel = getModelForClass(User);
