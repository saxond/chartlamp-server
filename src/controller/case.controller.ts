import { Request, Response } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/isAuth";
import { CaseModel } from "../models/case.model";
import { UserModel } from "../models/user.model";
import { CaseService } from "../services/case.service"; // Ensure this path is correct
import { DocumentService } from "../services/document.service";
import { ProcessorService } from "../services/processor.service";

const caseService = new CaseService();
const processorService = new ProcessorService();
const documentService = new DocumentService();

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
      const caseData = await caseService.getCaseById(new Types.ObjectId(id));
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      res.status(200).json(caseData);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getCaseExtractionStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const caseData = await caseService.getCaseExtractionStatus(id);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      res.status(200).json(caseData);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getCaseByIdWithBodyParts(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const caseData = await caseService.getCaseByIdWithBodyParts(id);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      if (req?.user?.id) {
        await UserModel.findByIdAndUpdate(req?.user?.id, {
          lastViewedCase: id,
        });
      }
      res.status(200).json(caseData);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateCaseDetails(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!req?.user?.id) {
        throw new Error("User not found");
      }
      const caseData = await caseService.updateCaseDetails({
        caseId: id,
        user: req?.user?.id,
        ...req.body,
      });
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
      // const cases = await caseService.processCases();
      await processorService.processCase();
      res.status(200).json([]);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getUserCases(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const cases = await caseService.getUserCases({
        userId: req?.user?.id,
        query: req.query as any,
      });
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

  async deleteNote(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const deletedCase = await caseService.deleteNote({
        caseId: req.params.id,
        noteId: req.params.noteId,
        userId: req?.user?.id,
      });
      if (!deletedCase) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.status(200).json({ message: "Note deleted successfully" });
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

      const userDoc = await UserModel.findById(
        req?.user?.id,
        "lastViewedCase"
      ).lean();

      if (!userDoc) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (userDoc?.lastViewedCase) {
        const caseData = await caseService.getCaseByIdWithBodyParts(
          userDoc.lastViewedCase
        );
        return res.status(200).json(caseData);
      } else {
        const userCases = await CaseModel.find({ user: req?.user?.id }, "_id")
          .lean()
          .sort({ lastViewed: -1 });
        if (userCases.length) {
          const caseData = await caseService.getCaseByIdWithBodyParts(
            userCases[0]._id
          );
          return res.status(200).json(caseData);
        }
      }
      return res.status(200).json(null);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateCaseReportTags(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateCaseReportTags({
        ...req.body,
        caseId: req.params.id,
        reportId: req.params.reportId,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateCaseReportMultipleTags(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateCaseReportMultipleTags(req.body);
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateCaseNote(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateCaseNote({
        ...req.body,
        caseId: req.params.id,
        noteId: req.params.noteId,
        user: req?.user?.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async addComment(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.addComment({
        ...req.body,
        caseId: req.params.id,
        reportId: req.params.reportId,
        userId: req?.user?.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateTargetCompletion(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateTargetCompletion({
        caseId: req.params.id,
        ...req.body,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateFavoriteStatus(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateFavoriteStatus({
        ...req.body,
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getAllFavoriteCases(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getAllFavoriteCases(req?.user?.id);
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateArchiveStatus(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateArchiveStatus({
        ...req.body,
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateClaimStatus(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateClaimStatus({
        ...req.body,
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getCaseTags(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getCaseTags({
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getDcTagMapping(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getDcTagMapping({
        reportId: req.params.reportId,
        caseId: req.params.id,
        ...req.body,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getCaseDcTagMapping(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getCaseDcTagMapping({
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getReportsByDcTagMapping(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getReportsByDcTagMapping({
        ...req.body,
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getReportsByTagMapping(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getReportsByTagMapping({
        ...req.body,
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getCaseNotes(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getCaseNotes({
        caseId: req.params.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getReportComments(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getReportComments({
        caseId: req.params.id,
        reportId: req.params.reportId,
        userId: req?.user?.id,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateComment(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.updateComment({
        commentId: req.params.commentId,
        ...req.body,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async deleteReportFile(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await documentService.deleteDocument(
        req.params.documentId
      );
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async addDocumentToCase(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await documentService.addDocumentToCase(
        req.params.caseId,
        req.body
      );
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async createCaseTag(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.createCaseTag({
        caseId: req.params.id,
        ...req.body,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async createCaseNote(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.createCaseNote({
        caseId: req.params.id,
        userId: req?.user?.id,
        ...req.body,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async shareCaseWithUsers(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.shareCaseWithUsers({
        caseId: req.params.id,
        userIds: req.body.userIds,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getStreamlinedDiseaseName(req: AuthRequest, res: Response) {
    try {
      if (!req?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const response = await caseService.getStreamlinedDiseaseName({
        ...req.body,
      });
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  //runOcrDocumentExtraction
  async runOcrDocumentExtraction(req: Request, res: Response) {
    try {
      // const doc = await caseService.getOcrDocumentToProcess();
      // if (doc) addBackgroundJob("extractOcr", { documentId: doc._id });
      // if (doc) addBackgroundJob("extractOcr", { documentId: '123' });
      // const result = await caseService.runOcrDocumentExtraction2();
      res.status(200).json({});
    } catch (error) {
      handleError(res, error);
    }
  }
}
