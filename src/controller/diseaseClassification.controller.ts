import { Request, Response } from "express";
import { Types } from "mongoose";
import { DiseaseClassificationService } from "../services/diseaseClassification.service"; // Ensure this path is correct
// import { DocumentService } from "../services/document.service";
import { DocumentService } from "../services/document.service";
import { formatResponse } from "../utils/helpers";

const diseaseClassificationService = new DiseaseClassificationService();
const documentService = new DocumentService();

export class DiseaseClassificationController {
  static async create(req: Request, res: Response) {
    try {
      const { icdCode, description, affectedBodyPart } = req.body;
      const diseaseClassification =
        await diseaseClassificationService.createDiseaseClassification(
          icdCode,
          description,
          affectedBodyPart
        );
      res.status(201).json(diseaseClassification);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const diseaseClassification =
        await diseaseClassificationService.getDiseaseClassificationById(
          new Types.ObjectId(id)
        );
      if (!diseaseClassification) {
        return res
          .status(404)
          .json({ message: "Disease classification not found" });
      }
      res.status(200).json(diseaseClassification);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  //get a disease classification by icdCode
  static async getByIcdCode(req: Request, res: Response) {
    try {
      const { icdCode } = req.params;
      const diseaseClassification =
        await diseaseClassificationService.getDiseaseClassificationByIcdCode(
          icdCode
        );
      if (!diseaseClassification) {
        return res
          .status(404)
          .json({ message: "Disease classification not found" });
      }
      res.status(200).json(diseaseClassification);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async getImagesByIcdCode(req: Request, res: Response) {
    try {
      const { icdCode } = req.params;

      const images = await diseaseClassificationService.getImagesByIcdCode(
        icdCode
      );
      res.status(200).json(images);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async getImagesByIcdCodes(req: Request, res: Response) {
    try {
      const icdCodes = req.body.icdCodes;
      const images = await diseaseClassificationService.getImagesByIcdCodes(
        icdCodes
      );
      res.status(200).json(images);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit } = req.query;
      const diseaseClassifications =
        await diseaseClassificationService.getAllDiseaseClassifications(
          parseInt(page as string, 10),
          parseInt(limit as string)
        );
      res.status(200).json(diseaseClassifications);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const diseaseClassification =
        await diseaseClassificationService.updateDiseaseClassification(
          new Types.ObjectId(id),
          updateData
        );
      if (!diseaseClassification) {
        return res
          .status(404)
          .json({ message: "Disease classification not found" });
      }
      res.status(200).json(diseaseClassification);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const diseaseClassification =
        await diseaseClassificationService.deleteDiseaseClassification(
          new Types.ObjectId(id)
        );
      if (!diseaseClassification) {
        return res
          .status(404)
          .json({ message: "Disease classification not found" });
      }
      res
        .status(200)
        .json({ message: "Disease classification deleted successfully" });
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  //seed data from csv
  static async seedData(req: Request, res: Response) {
    try {

      // await diseaseClassificationService.seedData();
      // await diseaseClassificationService.updateDiseaseClassificationRecords();
       await diseaseClassificationService.exportDiseaseClassificationsToCSV();
      // const data = await documentService.extractContentFromDocumentUsingTextract('https://chartlamp.s3.amazonaws.com/1732300016420-11%20med%20-%20Oscar%20Mejia.pdf');
      // const data = await documentService.getCombinedDocumentContent('68c4a092b10997ecc21cea4ebc82700bf403a5fb77fb752c24188c42cf939dd7');
      // console.log(data);
      
      //log 10 affected body parts
      res.status(200).json({ message: "Data seeded successfully" });
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

}