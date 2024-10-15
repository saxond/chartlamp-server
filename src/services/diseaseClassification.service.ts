import { createObjectCsvStringifier } from "csv-writer";
import fs from "fs";
import axios from "axios";
import { Types } from "mongoose";
import { pipeline } from "stream";
import { promisify } from "util";
import { BodyPartToImageModel } from "../models/bodyPartToImage.model";
import {
  DiseaseClassification,
  DiseaseClassificationModel,
} from "../models/diseaseClassification.model"; // Ensure this path is correct
import { bodyParts, excludeWords } from "../scripts/constants";
import { parseDiseaseClassificationCSV } from "../utils/parseDiseaseClassificationCSV";
import OpenAIService from "./openai.service";

const pipelineAsync = promisify(pipeline);

export class DiseaseClassificationService {
  private openAiService: OpenAIService;
  constructor() {
    this.openAiService = new OpenAIService(
      (process.env.OPENAI_API_KEY as string)
    );
  }

  // Create a new disease classification
  async createDiseaseClassification(
    icdCode: string,
    description: string,
    affectedBodyPart: string
  ) {
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

  //get a disease classification by icdCode
  async getDiseaseClassificationByIcdCode(icdCode: string) {
    // return DiseaseClassificationModel.findOne({ icdCode }).lean();
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

    return diseaseC;
  }

  // Get affected body parts by icdCode
  async getAffectedBodyPartsByIcdCode(icdCode: string) {
    try {

      let diseaseC = await this.getDiseaseClassificationByIcdCode(icdCode);

      if (!diseaseC) {
        throw new Error('Disease classification not found');
      }

      return [diseaseC.affectedBodyPartB];

    } catch (error) {

      throw new Error('Failed to get affected body parts');
    }
  }

  //get a disease classification by icdCode
  async getByIcdCodes(icdCodes: string[]) {
    return DiseaseClassificationModel.findOne({
      icdCode: {
        $in: icdCodes,
      },
    }).lean();
  }

  // Get all disease classifications
  async getAllDiseaseClassifications(page: number, limit: number) {
    //paginate
    const skip = page * limit;
    return DiseaseClassificationModel.find()
      .select("icdCode description affectedBodyPart affectedBodyPartB")
      .skip(skip)
      .limit(limit)
      .lean();
  }

  //export disease classifications to csv
 
  async exportDiseaseClassificationsToCSV() {
    try {
      const diseaseClassifications = await DiseaseClassificationModel.find().lean().cursor();
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'icdCode', title: 'ICD Code' },
          { id: 'description', title: 'Description' },
          { id: 'affectedBodyPart', title: 'Affected Body Part' },
        ],
      });

      const writeStream = fs.createWriteStream('diseaseClassifications.csv');
      writeStream.write(csvStringifier.getHeaderString());

      await pipelineAsync(
        diseaseClassifications,
        async function* (source) {
          for await (const diseaseClassification of source) {
            yield csvStringifier.stringifyRecords([diseaseClassification]);
          }
        },
        writeStream
      );

      return 'Disease classifications exported successfully';
    } catch (error) {
      console.error('Error exporting disease classifications to CSV:', error);
      throw new Error('Failed to export disease classifications');
    }
  }

  // Update a disease classification by ID
  async updateDiseaseClassification(
    id: Types.ObjectId,
    updateData: Partial<DiseaseClassification>
  ) {
    return DiseaseClassificationModel.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean();
  }

  // Delete a disease classification by ID
  async deleteDiseaseClassification(id: Types.ObjectId) {
    return DiseaseClassificationModel.findByIdAndDelete(id).lean();
  }

  //seed data from csv
  async seedData() {
    const csvData = fs.readFileSync(
      "icd-10-medical-diagnosis-codes.csv",
      "utf-8"
    );
    const diseaseClassifications = parseDiseaseClassificationCSV(csvData);
    return await DiseaseClassificationModel.insertMany(diseaseClassifications);
  }

  //update disease classification records by using OpenAI
  async updateDiseaseClassificationRecords() {
    const diseaseClassifications = await DiseaseClassificationModel.find({
      affectedBodyPartB: { $in: [null, ""] },
    })
      .limit(1000)
      .lean();

    if (!diseaseClassifications.length) {
      return "No records to update";
    }

    const updatePromises = diseaseClassifications.map(
      async (diseaseClassification) => {
        const prompt = `Provide me the body part affected by ${diseaseClassification.description}. If it affects joints or muscles or bones, give me the specific type of the Joints (e.g., knees, hips, shoulders), Bones(Tibia, Femur, Humerus, Pelvis, Ribs, Skull, Spine (vertebrae)) or Muscle (Biceps (upper arm, Triceps, Deltoids, e.t.c) . The response should be just the body part no added sentence before or after. For example, if the affected body part is the heart, the response should be Heart.`;
        try {
          if (diseaseClassification?.description && diseaseClassification?.description !=='') {
            const response = await this.openAiService.completeChat({
              context:
                "Update the affected body part for the following disease classification",
              prompt,
              model: "gpt-3.5-turbo",
              temperature: 0.4,
            });
            await DiseaseClassificationModel.findByIdAndUpdate(
              diseaseClassification._id,
              { affectedBodyPartB: response }
            );
          }

          return "Record updated successfully";
      
        } catch (error) {
          console.error(
            `Failed to update disease classification with ID ${diseaseClassification._id}:`,
            error
          );
        }
      }
    );

    await Promise.all(updatePromises);

    return "Records updated successfully";
  }

  //get distinct affected body parts
  async getDistinctAffectedBodyParts() {
    return DiseaseClassificationModel.distinct("affectedBodyPartB").lean();
  }

  async loadImageNames() {
    await BodyPartToImageModel.deleteMany({});
    const data = bodyParts.map((part) => ({
      fileName: part,
    }));
    return BodyPartToImageModel.insertMany(data);
  }

  async getImagesByIcdCode(icdCode: string) {

    const affectedBodyPart = await this.getDiseaseClassificationByIcdCode(icdCode);

    if (!affectedBodyPart?.affectedBodyPartB) {
      return [];
    }
   
    const results = await this.searchDocumentsWithExclusions(
      affectedBodyPart.affectedBodyPartB,
      affectedBodyPart.description
    );
    return results;

  }

  async getImagesByIcdCodes(icdCodes: string) {

    const diseaseClassification = await DiseaseClassificationModel.find({
      icdCode: {
        $in: icdCodes,
      },
    }).lean();

    if (!diseaseClassification) {
      return [];
    } else {
      const affectedBodyParts: string[] = [];
      diseaseClassification.map((disease) => {
        if (disease.affectedBodyPart) {
          affectedBodyParts.push(disease.affectedBodyPart);
        }
      });
      const results = await this.searchDocumentsWithExclusions(
        affectedBodyParts
      );
      return results;
    }
  }

  async searchDocumentsWithExclusions(searchString: string | string[], description?: string) {
    try {
      // Create a text search string with exclusions
      const parsedSearchString = Array.isArray(searchString)
        ? searchString.join(" ")
        : searchString;
      const excludeString = excludeWords.map((word) => `-${word}`).join(" ");
      const textSearchQuery = `${parsedSearchString} ${excludeString}`.trim();

      const results = await BodyPartToImageModel.find(
        { $text: { $search: textSearchQuery } },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } });

      return {
        images: results,
        bodyParts: searchString,
        description,
      }

    } catch (err) {
      console.error("Error performing search:", err);
      throw err;
    }
  }

  async searchByDisease(terms: string) {
  try {
    const response = await axios.get(
      `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${terms}`
    );
    console.log("searchByDisease", response.data);
    return response.data;
  } catch (error) {
    console.error("getProperty - Error", error);
  }
}
}