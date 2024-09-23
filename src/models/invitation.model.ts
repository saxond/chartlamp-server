import { getModelForClass, modelOptions, prop, Ref } from "@typegoose/typegoose";
import { Organization } from "./organization.model"; // Ensure this path is correct
import { User } from "./user.model"; // Ensure this path is correct

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class Invitation {
  // Add _id field
  public _id?: string;

  @prop({ required: true, ref: () => User })
  public invitedBy!: Ref<User>;

  @prop({ required: true, ref: () => Organization })
  public organization!: Ref<Organization>;

  @prop({ required: true, unique: true })
  public email!: string;

  @prop({ required: true, enum: ["admin", "user", "guest"], default: "user" })
  public role!: string;

  @prop({ required: true })
  public token!: string;

  @prop({ required: true })
  public expiresAt!: Date;

  @prop({ required: true, enum: ["pending", "accepted", "declined"], default: "pending" })
  public status!: string;
}

export const InvitationModel = getModelForClass(Invitation);