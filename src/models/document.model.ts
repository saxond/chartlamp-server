import { getModelForClass, modelOptions, prop, Ref } from "@typegoose/typegoose";
import { Case } from "./case.model"; // Ensure this path is correct

export enum ExtractionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}


@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class Document {
  public _id?: string;
  
  @prop({ ref: () => Case, required: true })
  public case!: Ref<Case>;

  @prop({ required: true })
  public url!: string;

  @prop({ default: null })
  public patientRecord?: Object[];

  @prop({ default: null })
  public content?: string;

  @prop({ default: null })
  public extractedData?: string;

  //job Id from the document processing service
  @prop({ default: null })
  public jobId?: string;

  //extraction status default PENDING
  @prop({ enum: ExtractionStatus, default: ExtractionStatus.PENDING })
  public status?: ExtractionStatus;

  // Timestamps will be automatically added by mongoose
  public createdAt?: Date;
}

export const DocumentModel = getModelForClass(Document);