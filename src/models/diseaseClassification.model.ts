import {
  getModelForClass,
  modelOptions,
  prop
} from "@typegoose/typegoose";
@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})

export class DiseaseClassification {
  _id?: string;

  @prop({ required: true })
  icdCode!: string;

  @prop({ required: false })
  description?: string;
  
  @prop({ required: false })
  public affectedBodyPart?: string;
}

export const DiseaseClassificationModel = getModelForClass(DiseaseClassification);