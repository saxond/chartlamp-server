import axios from "axios";
import { createObjectCsvStringifier } from "csv-writer";
import fs from "fs";
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
      process.env.OPENAI_API_KEY as string
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
      const data = fs.readFileSync("ICDbodypartsmapping.csv", "utf-8");
      const lines = data.trim().split("\n");
      const result: { [key: string]: string[] } = {};
  
      lines.forEach((line) => {
        const [key, ...values] = line.split(",");
        const cleanedKey = key.replace(/[^a-zA-Z0-9\s]/g, "").trim();
        const cleanedValues = values
          .map((value) => value.replace(/[^a-zA-Z0-9\s]/g, "").trim())
          .filter((value) => value !== "");
        result[cleanedKey] = cleanedValues.length > 0 ? cleanedValues : [cleanedKey];
      });
  
      return result;
    } catch (error) {
      console.error("Error extracting affected body parts:", error);
      throw new Error("Failed to extract affected body parts");
    }
  }

  
  async getDiseaseClassificationMappingByExtractedBodyParts() {
    try {
      // Get all disease classifications
      const diseaseClassifications = await DiseaseClassificationModel.find().lean();
  
      // Extract affected body parts
      const affectedBodyParts = await this.extractAffectedBodyParts();
  
      // Map disease classifications to affected body parts
      const result = diseaseClassifications.map((diseaseClassification) => {
        const affectedBodyPartB = diseaseClassification.affectedBodyPartB;
        const affectedBodyPartMapping = affectedBodyPartB ? affectedBodyParts[affectedBodyPartB] || [] : [];
  
        return {
          ...diseaseClassification,
          affectedBodyPartMapping,
          affectedBodyPartB,
        };
      });
  
      // Save result to CSV
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: "icdCode", title: "ICD Code" },
          { id: "description", title: "Description" },
          { id: "affectedBodyPart", title: "Affected Body Part" },
          { id: "affectedBodyPartB", title: "Affected Body Part B" },
          { id: "affectedBodyPartMapping", title: "Affected Body Part Mapping" },
        ],
      });
  
      const writeStream = fs.createWriteStream("diseaseClassificationMapping.csv");
      writeStream.write(csvStringifier.getHeaderString());
  
      await pipelineAsync(
        async function* () {
          for (const diseaseClassification of result) {
            yield csvStringifier.stringifyRecords([diseaseClassification]);
          }
        },
        writeStream
      );
  
      return result;
    } catch (error) {
      console.error("Error extracting disease classification mapping:", error);
      throw new Error("Failed to extract disease classification mapping");
    }
  }
  //get a disease classification by icdCode
  async getDiseaseClassificationByIcdCode(icdCode: string) {
    // return DiseaseClassificationModel.findOne({ icdCode }).lean();
    icdCode = icdCode.replace(/\./g, "").toUpperCase();

    let diseaseC = await DiseaseClassificationModel.findOne({ icdCode }).lean();

    if (!diseaseC) {
      diseaseC = await DiseaseClassificationModel.findOne({
        icdCode: new RegExp(`^${icdCode}`),
      }).lean();
    }

    if (!diseaseC) {
      diseaseC = await DiseaseClassificationModel.findOne({
        icdCode: new RegExp(`${icdCode}$`),
      }).lean();
    }

    if (!diseaseC) {
      diseaseC = await DiseaseClassificationModel.findOne({
        icdCode: icdCode.slice(0, -1),
      }).lean();
    }

    if (!diseaseC) {
      diseaseC = await DiseaseClassificationModel.findOne({
        icdCode: icdCode.slice(0, -2),
      }).lean();
    }

    return diseaseC;
  }

  // Get affected body parts by icdCode
  async getAffectedBodyPartsByIcdCode(icdCode: string) {
    try {
      let diseaseC = await this.getDiseaseClassificationByIcdCode(icdCode);

      if (!diseaseC) {
        throw new Error("Disease classification not found");
      }

      return [diseaseC.affectedBodyPartB];
    } catch (error) {
      throw new Error("Failed to get affected body parts");
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
      const diseaseClassifications = await DiseaseClassificationModel.find()
        .lean()
        .cursor();
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: "icdCode", title: "ICD Code" },
          { id: "description", title: "Description" },
          { id: "affectedBodyPart", title: "Affected Body Part" },
        ],
      });

      const writeStream = fs.createWriteStream("diseaseClassifications.csv");
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

      return "Disease classifications exported successfully";
    } catch (error) {
      console.error("Error exporting disease classifications to CSV:", error);
      throw new Error("Failed to export disease classifications");
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
          if (
            diseaseClassification?.description &&
            diseaseClassification?.description !== ""
          ) {
            const response = await this.openAiService.completeChat({
              context:
                "Update the affected body part for the following disease classification",
              prompt,
              model: "gpt-4o",
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
    const affectedBodyPart = await this.getDiseaseClassificationByIcdCode(
      icdCode
    );

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
    console.log("getImagesByIcdCodes", icdCodes);
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

  async searchDocumentsWithExclusions(
    searchString: string | string[],
    description?: string
  ) {
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
      };
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

  //get icd code from description
  async getIcdCodeFromDescription(description: string): Promise<string[]> {
    const prompt = `Get the ICD 10 code for the following description: ${description}. Give the exact code no any added text after the ICD 10 code. For example, if the description is "Acute bronchitis due to coxsackievirus", the response should be J20.0. If there are multiple codes, provide all of them separated by commas. Do not fabricate the codes, only provide the exact codes. if none return empty string.`;
    try {
      //if the description contains the word "not provided" or "N/A", return an empty array make everything lowercase before checking
      if (
        description.toLowerCase().includes("not provided") ||
        description.toLowerCase().includes("n/a")
      ) {
        return [];
      }
      
      const response = await this.openAiService.completeChat({
        context: "Get the ICD 10 code for the following description",
        prompt,
        model: "gpt-4o",
        temperature: 0.4,
      });

      if (response) {
          return Array.from(new Set(response.split(",").map((code: string) => code.trim()).filter((code: string) => code))) || [];
      }

      return [];
    } catch (error) {
      console.error(
        `Failed to get the ICD codes for the description: ${description}:`,
        error
      );
      return [];
    }
  }

  async validateAmount(amount: string): Promise<number> {
    // If the string is empty, return 0
    if (!amount?.trim()) {
      return 0;
    }
  
    // If the amount contains "Not provided" or "N/A", return 0
    if (amount.includes("Not provided") || amount.includes("N/A")) {
      return 0;
    }
  
    // Remove currency symbols and commas
    amount = amount.replace(/[$,]/g, "");
  
    // Extract the number from the string
    const numberMatch = amount.match(/\d+(\.\d+)?/);
  
    // If a number is found, return it
    if (numberMatch) {
      return Number(numberMatch[0]);
    }
  
    // If no number is found, return 0
    return 0;
  }

  async validateDateStr(dateStr: string): Promise<Date | null> {
    // If the string is empty, return null
    if (!dateStr?.trim()) {
      return null;
    }

    // Attempt to parse the date string
    const date = new Date(dateStr);

    // If the date is invalid, return null
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }
}
