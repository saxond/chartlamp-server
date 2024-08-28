import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";
// import { User } from "./user.model"; // Ensure this path is correct

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class TwoFactorAuth {
  // @prop({ ref: () => User, required: true })
  // public user!: Ref<User>;

  @prop()
  public secret?: string;

  @prop({ default: false })
  public isEnabled?: boolean;

  @prop({ enum: ["email", "sms", "phone", "app"], default: "email" })
  public method?: string;

  @prop()
  public phoneNumber?: string;
}

export const TwoFactorAuthModel = getModelForClass(TwoFactorAuth);