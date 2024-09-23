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
  codeRange!: string;

  @prop({ required: true, unique: true })
  section!: string;

  @prop({ required: true, unique: true })
  affectedBodyPart!: string;
}

export const DiseaseClassificationModel = getModelForClass(DiseaseClassification);
