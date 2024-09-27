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
    try {
      const diseaseClassification = new DiseaseClassificationModel({
        icdCode,
        description,
        affectedBodyPart,
      });

      await diseaseClassification.save();
      return diseaseClassification;
    } catch (error) {
      console.error('Error creating disease classification:', error);
      throw new Error('Failed to create disease classification');
    }
  }

  // Get a disease classification by ID
  async getDiseaseClassificationById(id: Types.ObjectId) {
    try {
      return await DiseaseClassificationModel.findById(id).lean();
    } catch (error) {
      console.error('Error fetching disease classification by ID:', error);
      throw new Error('Failed to fetch disease classification');
    }
  }

  // Get a disease classification by icdCode
  async getDiseaseClassificationByIcdCode(icdCode: string) {
    try {
      return await DiseaseClassificationModel.findOne({ icdCode }).lean();
    } catch (error) {
      console.error('Error fetching disease classification by icdCode:', error);
      throw new Error('Failed to fetch disease classification');
    }
  }

  // Get all disease classifications with pagination
  async getAllDiseaseClassifications(page: number, limit: number) {
    try {
      const skip = page * limit;
      return await DiseaseClassificationModel.find()
        .select('icdCode description affectedBodyPart')
        .skip(skip)
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error fetching all disease classifications:', error);
      throw new Error('Failed to fetch disease classifications');
    }
  }

  // Update a disease classification by ID
  async updateDiseaseClassification(id: Types.ObjectId, updateData: Partial<DiseaseClassification>) {
    try {
      return await DiseaseClassificationModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
    } catch (error) {
      console.error('Error updating disease classification:', error);
      throw new Error('Failed to update disease classification');
    }
  }

  // Delete a disease classification by ID
  async deleteDiseaseClassification(id: Types.ObjectId) {
    try {
      return await DiseaseClassificationModel.findByIdAndDelete(id).lean();
    } catch (error) {
      console.error('Error deleting disease classification:', error);
      throw new Error('Failed to delete disease classification');
    }
  }

  // Seed data from CSV
  async seedData() {
    try {
      const csvData = fs.readFileSync('icd-10-medical-diagnosis-codes.csv', 'utf-8');
      const diseaseClassifications = parseDiseaseClassificationCSV(csvData);
      return await DiseaseClassificationModel.insertMany(diseaseClassifications);
    } catch (error) {
      console.error('Error seeding data:', error);
      throw new Error('Failed to seed data');
    }
  }

  // Extract affected body parts from CSV
  async extractAffectedBodyParts() {
    try {
      const data = fs.readFileSync('ICDgraphicsSheet1.csv', 'utf-8');
      const lines = data.trim().split('\n');
      const result: { [key: string]: string[] } = {};

      lines.forEach(line => {
        const [key, ...values] = line.split(',');
        const trimmedValues = values.map(value => value.trim()).filter(value => value !== '');
        result[key.trim()] = trimmedValues.length > 0 ? trimmedValues : [key.trim()];
      });

      return result;
    } catch (error) {
      console.error('Error extracting affected body parts:', error);
      throw new Error('Failed to extract affected body parts');
    }
  }

  // Get affected body parts by icdCode
  async getAffectedBodyPartsByIcdCode(icdCode: string) {
    try {
      icdCode = icdCode.replace(/\./g, '').toUpperCase();

      let diseaseC = await DiseaseClassificationModel.findOne({ icdCode }).lean();

      if (!diseaseC) {
        diseaseC = await DiseaseClassificationModel.findOne({ icdCode: new RegExp(`^${icdCode}`) }).lean();
      }

      if (!diseaseC) {
        diseaseC = await DiseaseClassificationModel.findOne({ icdCode: new RegExp(`${icdCode}$`) }).lean();
      }

      if (!diseaseC) {
        diseaseC = await DiseaseClassificationModel.findOne({ icdCode: icdCode.slice(0, -1) }).lean();
      }

      if (!diseaseC) {
        diseaseC = await DiseaseClassificationModel.findOne({ icdCode: icdCode.slice(0, -2) }).lean();
      }

      if (!diseaseC) {
        throw new Error('Disease classification not found');
      }

      const bodyPartsMap = await this.extractAffectedBodyParts();

      if (diseaseC.affectedBodyPart && bodyPartsMap[diseaseC.affectedBodyPart]) {
        return bodyPartsMap[diseaseC.affectedBodyPart];
      }

      return [diseaseC.affectedBodyPart];
    } catch (error) {
      console.error('Error getting affected body parts by icdCode:', error);
      throw new Error('Failed to get affected body parts');
    }
  }

  // Update disease classification records using OpenAI
  async updateDiseaseClassificationRecords() {
    try {
      const diseaseClassifications = await DiseaseClassificationModel.find({
        affectedBodyPart: { $in: [null, ''] }
      }).limit(1000).lean();

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
          return await DiseaseClassificationModel.findByIdAndUpdate(diseaseClassification._id, { affectedBodyPart: response });
        } catch (error) {
          console.error('Error updating disease classification record:', error);
          throw new Error('Failed to update records');
        }
      });

      return await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating disease classification records:', error);
      throw new Error('Failed to update disease classification records');
    }
  }

  // Get distinct affected body parts
  async getDistinctAffectedBodyParts() {
    try {
      return await DiseaseClassificationModel.distinct('affectedBodyPart').lean();
    } catch (error) {
      console.error('Error getting distinct affected body parts:', error);
      throw new Error('Failed to get distinct affected body parts');
    }
  }
}