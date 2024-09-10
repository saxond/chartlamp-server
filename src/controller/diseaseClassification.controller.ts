import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DiseaseClassificationService } from '../services/diseaseClassification.service'; // Ensure this path is correct
import { formatResponse } from '../utils/helpers';

export class DiseaseClassificationController {
  static async create(req: Request, res: Response) {
    try {
      const { icdCode, description, affectedBodyPart } = req.body;
      const diseaseClassification = await DiseaseClassificationService.createDiseaseClassification(icdCode, description, affectedBodyPart);
      res.status(201).json(diseaseClassification);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const diseaseClassification = await DiseaseClassificationService.getDiseaseClassificationById(new Types.ObjectId(id));
      if (!diseaseClassification) {
        return res.status(404).json({ message: 'Disease classification not found' });
      }
      res.status(200).json(diseaseClassification);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const { page, limit } = req.query;
      const diseaseClassifications = await DiseaseClassificationService.getAllDiseaseClassifications(
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
      const diseaseClassification = await DiseaseClassificationService.updateDiseaseClassification(new Types.ObjectId(id), updateData);
      if (!diseaseClassification) {
        return res.status(404).json({ message: 'Disease classification not found' });
      }
      res.status(200).json(diseaseClassification);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const diseaseClassification = await DiseaseClassificationService.deleteDiseaseClassification(new Types.ObjectId(id));
      if (!diseaseClassification) {
        return res.status(404).json({ message: 'Disease classification not found' });
      }
      res.status(200).json({ message: 'Disease classification deleted successfully' });
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  //seed data from csv
  static async seedData(req: Request, res: Response) {
    try {
      await DiseaseClassificationService.seedData();
      res.status(200).json({ message: 'Data seeded successfully' });
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }
}