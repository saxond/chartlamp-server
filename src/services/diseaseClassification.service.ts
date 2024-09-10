import fs from 'fs';
import { Types } from 'mongoose';
import { DiseaseClassification, DiseaseClassificationModel } from '../models/diseaseClassification.model'; // Ensure this path is correct
import { parseDiseaseClassificationCSV } from '../utils/parseDiseaseClassificationCSV';

export class DiseaseClassificationService {
  // Create a new disease classification
  static async createDiseaseClassification(icdCode: string, description: string, affectedBodyPart: string) {
    const diseaseClassification = new DiseaseClassificationModel({
      icdCode,
      description,
      affectedBodyPart,
    });

    await diseaseClassification.save();
    return diseaseClassification;
  }

  // Get a disease classification by ID
  static async getDiseaseClassificationById(id: Types.ObjectId) {
    return DiseaseClassificationModel.findById(id).lean();
  }

  // Get all disease classifications
  static async getAllDiseaseClassifications(page: number, limit: number) {
    //paginate
    const skip = page * limit;
    return DiseaseClassificationModel.find().select(
      'icdCode description affectedBodyPart'
    ).skip(skip).limit(limit).lean();
  }

  // Update a disease classification by ID
  static async updateDiseaseClassification(id: Types.ObjectId, updateData: Partial<DiseaseClassification>) {
    return DiseaseClassificationModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }

  // Delete a disease classification by ID
  static async deleteDiseaseClassification(id: Types.ObjectId) {
    return DiseaseClassificationModel.findByIdAndDelete(id).lean();
  }

  //seed data from csv
  static async seedData() {
    const csvData = fs.readFileSync('icd-10-medical-diagnosis-codes.csv', 'utf-8');
    const diseaseClassifications = parseDiseaseClassificationCSV(csvData);
    return await DiseaseClassificationModel.insertMany(diseaseClassifications);
  }
}