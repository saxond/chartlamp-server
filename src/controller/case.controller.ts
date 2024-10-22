import { Request, Response } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/isAuth";
import { CaseService } from "../services/case.service"; // Ensure this path is correct

const caseService = new CaseService();

const handleError = (res: Response, error: any) => {
  console.error("Error:", error);
  res.status(500).json({ message: error.message });
};

export class CaseController {
  async create(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const {
        caseNumber,
        plaintiff,
        dateOfClaim,
        claimStatus,
        actionRequired,
        targetCompletion,
        documents,
      } = req.body;
      const newCase = await caseService.createCase({
        caseNumber,
        plaintiff,
        dateOfClaim: new Date(dateOfClaim),
        claimStatus,
        actionRequired,
        targetCompletion: new Date(targetCompletion),
        documents,
        user: req?.user?.id,
      });
      res.status(201).json(newCase);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const caseData = await caseService.getCaseById(id);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      res.status(200).json(caseData);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const cases = await caseService.getAllCases();
      res.status(200).json(cases);
    } catch (error) {
      handleError(res, error);
    }
  }

  async processCases(req: Request, res: Response) {
    try {
      const cases = await caseService.processCases();
      res.status(200).json(cases);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getUserCases(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const cases = await caseService.getUserCases(req?.user?.id);
      res.status(200).json(cases);
    } catch (error) {
      handleError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedCase = await caseService.updateCase(
        new Types.ObjectId(id),
        updateData
      );
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      res.status(200).json(updatedCase);
    } catch (error) {
      handleError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deletedCase = await caseService.deleteCase(new Types.ObjectId(id));
      if (!deletedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      res.status(200).json({ message: "Case deleted successfully" });
    } catch (error) {
      handleError(res, error);
    }
  }

  async getUserStats(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const cases = await caseService.getUserStats(req?.user?.id);
      res.status(200).json(cases);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getClaimRelatedReports(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const cases = await caseService.getClaimRelatedReports(req?.user?.id);
      res.status(200).json(cases);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getMostVisitedCasesByUser(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const cases = await caseService.getMostVisitedCasesByUser(req?.user?.id);
      res.status(200).json(cases);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getLastViewedCaseByUser(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const lastViewed = await caseService.getLastViewedCaseByUser(req?.user?.id);
      res.status(200).json(lastViewed);
    } catch (error) {
      handleError(res, error);
    }
  }

  // async populateReportFromCaseDocuments(req: Request, res: Response) {
  //   try {
  //     const { caseId } = req.params;
  //     const report = await caseService.populateReportFromCaseDocuments(caseId);
  //     res.status(200).json(report);
  //   } catch (error) {
  //     handleError(res, error);
  //   }
  // }
}
