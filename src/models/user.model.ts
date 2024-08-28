import { getModelForClass, modelOptions, prop, Ref } from "@typegoose/typegoose";
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

  @prop({ required: true, enum: ["admin", "user", "manager"], default: "admin" })
  public role!: string;

  @prop({ ref: () => Organization, required: false })
  public organization?: Ref<Organization> | null;

  @prop({ ref: () => TwoFactorAuth, required: false, default: null })
  public twoFactorAuth?: Ref<TwoFactorAuth> | null;
}

export const UserModel = getModelForClass(User);
