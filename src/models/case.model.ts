import {
  getModelForClass,
  index,
  modelOptions,
  prop,
  Ref,
} from "@typegoose/typegoose";
import { DiseaseClassification } from "./diseaseClassification.model";
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

export class NameOfDiseaseByIcdCode {
  @prop()
  public icdCode!: string;

  @prop()
  public nameOfDisease!: string;

  @prop()
  public summary?: string;

  @prop()
  public chunk?: string;

  @prop()
  public pageNumber?: number;
}

class Report {
  public _id?: string;

  @prop({ type: () => [String], default: [] })
  public icdCodes?: string[];

  @prop()
  public nameOfDisease?: string;

  @prop({ required: false })
  public nameOfDiseaseByIcdCode?: NameOfDiseaseByIcdCode[];

  @prop()
  public icdCode?: string;

  @prop()
  public chunk?: string;

  @prop()
  public amountSpent?: string;

  @prop()
  public providerName?: string;

  @prop()
  public doctorName?: string;

  // @prop()
  // public comments?: Comment[];

  @prop()
  public medicalNote?: string;

  @prop()
  public dateOfClaim?: Date | null;

  @prop({ default: [] })
  public tags?: string[];

  @prop()
  public document?: string;
}

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
class Comment {
  @prop({ ref: () => User, required: true })
  public user!: Ref<User>;

  @prop({ ref: () => Report, required: true })
  public report!: Ref<Report>;

  @prop()
  public comment!: string;

  @prop({ default: false })
  public isEdited!: boolean;

  @prop()
  public createdAt?: Date;
}

export const CommentModel = getModelForClass(Comment);

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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
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

  @prop({
    required: true,
    enum: ["Pre Litigation", "New", "Litigated"],
    default: "New",
  })
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

  @prop({
    required: true,
    enum: ["local", "development", "production"],
    default: "production",
  })
  public env!: string;

  @prop({ default: false })
  public isArchived?: boolean;

  @prop({ default: false })
  public isFavorite!: boolean;

  @prop({ type: () => [Report], default: [] })
  public reports!: Report[];

  // @prop({
  //   ref: () => CaseTag,
  //   foreignField: "case",
  //   localField: "_id",
  // })
  // public tags!: Ref<CaseTag>[];

  //Viewed on last date that the case was viewed
  @prop({ default: Date.now })
  public lastViewed?: Date;

  @prop()
  public lastCachedAt?: Date;

  @prop({ required: false, enum: CronStatus, default: CronStatus.Pending })
  public cronStatus?: CronStatus;

  // Timestamps will be automatically added by mongoose
  public createdAt?: Date;
  public updatedAt?: Date;
}

export const CaseModel = getModelForClass(Case);

class CaseTag {
  @prop({ ref: () => Case, required: true })
  public case?: Ref<Case>;

  @prop()
  public tagName!: string;
}

export const CaseTagModel = getModelForClass(CaseTag);

class DiseaseClassificationTagMapping {
  @prop({ ref: () => CaseTag, required: true })
  public caseTag!: Ref<CaseTag>;

  @prop({ ref: () => Report, required: true })
  public report!: Ref<Report>;

  @prop({ ref: () => DiseaseClassification, required: false })
  public dc?: Ref<DiseaseClassification>;

  @prop({ required: false })
  public icdCode?: string;

  @prop()
  public case!: string;
}

export const DiseaseClassificationTagMappingModel = getModelForClass(
  DiseaseClassificationTagMapping
);

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
class CaseNote {
  @prop({ ref: () => Case, required: true })
  public case!: Ref<Case>;

  @prop({ ref: () => User, required: true })
  public user!: Ref<User>;

  @prop()
  public note!: string;
}

export const CaseNoteModel = getModelForClass(CaseNote);

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
