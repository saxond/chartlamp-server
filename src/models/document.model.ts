import {
  getModelForClass,
  modelOptions,
  prop,
  Ref,
} from "@typegoose/typegoose";
import { Case } from "./case.model"; // Ensure this path is correct
import {
  BundelV2,
  Bundle,
} from "../utils/extractor/fhirExtractor/structuredOutputs";

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

  @prop({ default: null })
  public fhir?: Bundle;

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

  @prop({
    required: true,
    enum: ["local", "development", "production"],
    default: "production",
  })
  public env!: string;

  @prop()
  public report?: Object[];

  @prop()
  public fhirSummary?: BundelV2;

  public createdAt?: Date;
}

export const TempPageDocumentModel = getModelForClass(TempPageDocument);

export class PageVectorStore {
  public _id?: string;

  @prop({ default: null })
  public document!: string;

  @prop({ default: null })
  public pageNumber!: number;

  @prop({ default: null })
  public pageText!: string;

  @prop({ default: null })
  public embedding!: number[];
}

export const PageVectorStoreModel = getModelForClass(PageVectorStore);
