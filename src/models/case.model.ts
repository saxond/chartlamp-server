import {
  getModelForClass,
  index,
  modelOptions,
  prop,
  Ref,
} from "@typegoose/typegoose";
import { Organization } from "./organization.model"; // Ensure this path is correct
import { User } from "./user.model"; // Ensure this path is correct

export interface CaseWithDocuments {
  _id: string;
  caseNumber: string;
  plaintiff: string;
  dateOfClaim: Date;
  claimStatus: string;
  actionRequired: string;
  targetCompletion: Date;
  organization: string;
  user: string;
  isArchived?: boolean;
  reports: any[];
  createdAt?: Date;
  updatedAt?: Date;
  documents: any[];
}
export enum TagsType {
  CLAIM_RELATED = "claim_related",
  PRIVILEGED = "privileged",
  NOT_DECIDED = "yet_to_be_decided",
}

class Comment {
  @prop({ ref: () => User, required: true })
  public user!: Ref<User>;

  @prop()
  public comment!: string;
}

class Report {
  @prop({ type: () => [String], default: [] })
  public icdCodes?: string[];

  @prop()
  public nameOfDisease?: string;

  @prop()
  public icdCode?: string;

  @prop()
  public amountSpent?: string;

  @prop()
  public providerName?: string;

  @prop()
  public doctorName?: string;

  @prop()
  public comments?: Comment[];

  @prop()
  public medicalNote?: string;

  @prop()
  public dateOfClaim?: Date | null;

  @prop({ default: [TagsType.NOT_DECIDED] })
  public tags?: string[];

  @prop()
  public document?: string;
}

export enum CronStatus {
  Pending = "pending",
  Processing = "processing",
  Processed = "processed",
}

@index({ plaintiff: 1 })
@index({ dateOfClaim: 1 })
@index({ claimStatus: 1 })
@index({ organization: 1 })
@index({ user: 1 })
@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class Case {
  public _id?: string;

  @prop({ required: true })
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

  @prop({ required: false, default: 0 })
  public viewCount!: number;

  @prop({ default: false })
  public isArchived?: boolean;

  @prop({ type: () => [Report], default: [] })
  public reports!: Report[];

  //Viewed on last date that the case was viewed
  @prop({ default: Date.now })
  public lastViewed?: Date;

  @prop({ required: false, enum: CronStatus, default: CronStatus.Pending })
  public cronStatus?: CronStatus;

  // Timestamps will be automatically added by mongoose
  public createdAt?: Date;
  public updatedAt?: Date;
}

export const CaseModel = getModelForClass(Case);

export enum CaseInvitationStatus {
  Pending = "pending",
  Accepted = "accepted",
  Declined = "declined",
}

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class CaseInvitation {
  public _id?: string;

  @prop({ ref: () => Case, required: true })
  public case!: Ref<Case>;

  @prop({ ref: () => User, required: true })
  public invitedUser!: Ref<User>;

  @prop({ required: true })
  public caseNumber!: string;

  // @prop({
  //   required: true,
  //   enum: [
  //     CaseInvitationStatus.Pending,
  //     CaseInvitationStatus.Accepted,
  //     CaseInvitationStatus.Declined,
  //   ],
  //   default: CaseInvitationStatus.Pending,
  // })
  // public status!: string;

  public createdAt?: Date;
  public updatedAt?: Date;
}

export const CaseInvitationModel = getModelForClass(CaseInvitation);
