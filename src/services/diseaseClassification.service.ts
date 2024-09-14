import fs from 'fs';
import { Types } from 'mongoose';
import { DiseaseClassification, DiseaseClassificationModel } from '../models/diseaseClassification.model'; // Ensure this path is correct
import { parseDiseaseClassificationCSV } from '../utils/parseDiseaseClassificationCSV';
import OpenAIService from './openai.service';

export class DiseaseClassificationService {
  private openAiService: OpenAIService;
  constructor() {
    this.openAiService = new OpenAIService(process.env.OPENAI_API_KEY as string || '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');
  }

  // Create a new disease classification
   async createDiseaseClassification(icdCode: string, description: string, affectedBodyPart: string) {
    const diseaseClassification = new DiseaseClassificationModel({
      icdCode,
      description,
      affectedBodyPart,
    });

    await diseaseClassification.save();
    return diseaseClassification;
  }

  // Get a disease classification by ID
   async getDiseaseClassificationById(id: Types.ObjectId) {
    return DiseaseClassificationModel.findById(id).lean();
  }

  //get a disease classification by icdCode
  async getDiseaseClassificationByIcdCode(icdCode: string) {
    return DiseaseClassificationModel.findOne
    ({ icdCode }).lean();
  }

  // Get all disease classifications
   async getAllDiseaseClassifications(page: number, limit: number) {
    //paginate
    const skip = page * limit;
    return DiseaseClassificationModel.find().select(
      'icdCode description affectedBodyPart'
    ).skip(skip).limit(limit).lean();
  }

  // Update a disease classification by ID
   async updateDiseaseClassification(id: Types.ObjectId, updateData: Partial<DiseaseClassification>) {
    return DiseaseClassificationModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }

  // Delete a disease classification by ID
   async deleteDiseaseClassification(id: Types.ObjectId) {
    return DiseaseClassificationModel.findByIdAndDelete(id).lean();
  }

  //seed data from csv
   async seedData() {
    const csvData = fs.readFileSync('icd-10-medical-diagnosis-codes.csv', 'utf-8');
    const diseaseClassifications = parseDiseaseClassificationCSV(csvData);
    return await DiseaseClassificationModel.insertMany(diseaseClassifications);
  }

  //update disease classification records by using OpenAI
  async updateDiseaseClassificationRecords() {
    const diseaseClassifications = await DiseaseClassificationModel.find(
      { affectedBodyPart: { $in: [null, ''] } }
    ).limit(1000).lean();

    if (!diseaseClassifications.length) {
      return 'No records to update';
    }

    const updatePromises = diseaseClassifications.map(async (diseaseClassification) => {
      const prompt = `Provide the affected body part for the following disease classification: ${diseaseClassification.description} ICDCODE: ${diseaseClassification.icdCode}. The body part should be in one of the categories: Intestine, Brain and spinal cord, Heart, Lungs, Joints, Bones, Varies depending on the complication, Bloodstream, Varies depending on the location of the infection, Kidneys, or Varies depending on the specific infection. The response should be just the category no added sentence before or after. For example, if the affected body part is the heart, the response should be Heart.`;

      try {
        const response = await this.openAiService.completeChat({
          context: 'Update the affected body part for the following disease classification',
          prompt,
          model: 'gpt-3.5-turbo',
          temperature: 0.3,
        });
        await DiseaseClassificationModel.findByIdAndUpdate(diseaseClassification._id, { affectedBodyPart: response });
      } catch (error) {
        console.error(`Failed to update disease classification with ID ${diseaseClassification._id}:`, error);
      }
    });

    await Promise.all(updatePromises);

    return 'Records updated successfully';
  }

  //get distinct affected body parts
    async getDistinctAffectedBodyParts() {
      return DiseaseClassificationModel.distinct('affectedBodyPart').lean();
    }
}