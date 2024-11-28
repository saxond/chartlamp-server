import { getModelForClass, index, prop } from "@typegoose/typegoose";

@index({ fileName: "text" })
export class BodyPartToImage {
  @prop({ required: true })
  public fileName!: string;
}

export const BodyPartToImageModel = getModelForClass(BodyPartToImage);


