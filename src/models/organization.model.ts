import { getModelForClass, pre, prop } from "@typegoose/typegoose";

@pre<Organization>('save', function(next) {
  const now = new Date();
  if (!this.createdAt) {
    this.createdAt = now;
  }
  this.updatedAt = now;
  next();
})
export class Organization {
  @prop({ required: true })
  public name!: string;

  @prop({ required: false })
  public address?: string;

  @prop({ required: false })
  public phoneNumber?: string;

  @prop({ required: false })
  public email?: string;

  @prop({ required: false })
  public website?: string;

  @prop({ required: false })
  public establishedYear?: number;

  @prop({ default: () => new Date() })
  public createdAt?: Date;

  @prop({ default: () => new Date() })
  public updatedAt?: Date;
}

export const OrganizationModel = getModelForClass(Organization);