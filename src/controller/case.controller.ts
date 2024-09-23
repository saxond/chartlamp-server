import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/isAuth';
import { CaseService } from '../services/case.service'; // Ensure this path is correct

export class CaseController {
  static async create(req: AuthRequest, res: Response) {
    try {
    
      if (!req?.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const data = req.body;
      const newCase = await CaseService.createCase({
        caseNumber: data.caseNumber,
        plaintiff: data.plaintiff,
        dateOfClaim: new Date(data.dateOfClaim),
        claimStatus: data.claimStatus,
        actionRequired: data.actionRequired,
        targetCompletion: new Date(data.targetCompletion),
        documents: data.documents,
        user:  req?.user?.id,
      });
      res.status(201).json(newCase);
    } catch (error) {
      res.status(500).json({ message: (error as any).message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const caseData = await CaseService.getCaseById(new Types.ObjectId(id));
      if (!caseData) {
        return res.status(404).json({ message: 'Case not found' });
      }
      res.status(200).json(caseData);
    } catch (error) {
      res.status(500).json({ message: (error as any).message });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const cases = await CaseService.getAllCases();
      res.status(200).json(cases);
    } catch (error) {
      res.status(500).json({ message: (error as any).message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedCase = await CaseService.updateCase(new Types.ObjectId(id), updateData);
      if (!updatedCase) {
        return res.status(404).json({ message: 'Case not found' });
      }
      res.status(200).json(updatedCase);
    } catch (error) {
      res.status(500).json({ message: (error as any).message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deletedCase = await CaseService.deleteCase(new Types.ObjectId(id));
      if (!deletedCase) {
        return res.status(404).json({ message: 'Case not found' });
      }
      res.status(200).json({ message: 'Case deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: (error as any).message });
    }
  }
}