import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class TwoFactorAuth {
  public _id?: string;

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