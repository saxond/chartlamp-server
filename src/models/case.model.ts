import { getModelForClass, modelOptions, prop, Ref } from "@typegoose/typegoose";
import { Organization } from "./organization.model"; // Ensure this path is correct
import { User } from "./user.model"; // Ensure this path is correct

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class Case {
  @prop({ required: true, unique: true })
  public caseNumber!: string;

  @prop({ required: true })
  public plaintiff!: string;

  @prop({ required: true })
  public dateOfClaim!: Date;

  @prop({ required: true, enum: ["In Progress", "New"], default: "New" })
  public claimStatus!: string;

  @prop({ required: true })
  public actionRequired!: string;

  @prop({ required: true })
  public targetCompletion!: Date;

  @prop({ ref: () => Organization, required: true })
  public organization!: Ref<Organization>;

  @prop({ ref: () => User, required: true })
  public user!: Ref<User>;

  // Timestamps will be automatically added by mongoose
  public createdAt?: Date;
  public updatedAt?: Date;
}

export const CaseModel = getModelForClass(Case);