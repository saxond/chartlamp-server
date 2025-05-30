import { getModelForClass, index, prop } from "@typegoose/typegoose";

@index({ fileName: "text" })
export class BodyPartToImage {
  @prop({ required: true })
  public fileName!: string;

  @prop({ required: false })
  public categoryName!: string;

  @prop({ required: false })
  public svg!: string;
}

export const BodyPartToImageModel = getModelForClass(BodyPartToImage);
