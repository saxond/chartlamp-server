import {
  getModelForClass,
  modelOptions,
  prop,
  Ref,
} from "@typegoose/typegoose";
import { Case } from "./case.model"; // Ensure this path is correct

export enum ExtractionStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
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
  public content?: string;

  @prop({ default: null })
  public extractedData?: string;

  @prop({ default: false })
  public isCompleted!: boolean;

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

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class TempPageDocument {
  public _id?: string;

  @prop({ ref: () => Document, required: true })
  public document!: Ref<Document>;

  @prop({ default: null })
  public pageNumber!: number;

  @prop({ default: null })
  public totalPages!: number;

  @prop({ default: null })
  public pageRawData!: Buffer;

  @prop({ default: null })
  public pageText?: string;

  @prop()
  public pdfS3Key?: string;

  @prop({ default: false })
  public isCompleted!: boolean;

  @prop({ default: null })
  public jobId?: string;

  @prop()
  public report?: Object[];

  public createdAt?: Date;
}

export const TempPageDocumentModel = getModelForClass(TempPageDocument);
