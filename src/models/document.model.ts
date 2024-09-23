import { getModelForClass, modelOptions, prop, Ref } from "@typegoose/typegoose";
import { Case } from "./case.model"; // Ensure this path is correct

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class Document {
  @prop({ ref: () => Case, required: true })
  public case!: Ref<Case>;

  @prop({ required: true })
  public url!: string;

  @prop({ required: true })
  public content!: string;

  @prop({ required: true })
  public extractedData!: string;

  // Timestamps will be automatically added by mongoose
  public createdAt?: Date;
}

export const DocumentModel = getModelForClass(Document);