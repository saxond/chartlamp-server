import express from "express";
import { CaseController } from "../controller/case.controller"; // Ensure this path is correct
import { isAuthenticated } from "../middleware/isAuth";

const router = express.Router();
const caseController = new CaseController();

// Case routes
router.post("/", isAuthenticated, caseController.create);
router.get("/", isAuthenticated, caseController.getAll);
router.get("/process", caseController.processCases);
//ocr runOcrDocumentExtraction
router.get("/ocr", caseController.runOcrDocumentExtraction);
router.get("/stats", isAuthenticated, caseController.getUserStats);
router.get(
  "/reports/claim-related",
  isAuthenticated,
  caseController.getClaimRelatedReports
);
router.get(
  "/most-visited",
  isAuthenticated,
  caseController.getMostVisitedCasesByUser
);
router.get(
  "/last-viewed",
  isAuthenticated,
  caseController.getLastViewedCaseByUser
);
router.get(
  "/:id/detail",
  isAuthenticated,
  caseController.getCaseByIdWithBodyParts
);
router.post("/:id/share", isAuthenticated, caseController.shareCaseWithUsers);
router.post("/:id/tags", isAuthenticated, caseController.createCaseTag);
router.get("/user", isAuthenticated, caseController.getUserCases);
router.get("/:id", isAuthenticated, caseController.getById);
router.put("/:id", isAuthenticated, caseController.update);
router.patch(
  "/:id/reports/:reportId",
  isAuthenticated,
  caseController.updateCaseReportTags
);
router.patch(
  "/:commentId/comment",
  isAuthenticated,
  caseController.updateComment
);

router.post(
  "/:id/reports/:reportId/comment",
  isAuthenticated,
  caseController.addComment
);
router.get(
  "/:id/reports/:reportId/comment",
  isAuthenticated,
  caseController.getReportComments
);
router.post(
  "/disease-name",
  isAuthenticated,
  caseController.getStreamlinedDiseaseName
);

router.delete("/:id", isAuthenticated, caseController.delete);

router.delete(
  "/document/:documentId",
  isAuthenticated,
  caseController.deleteReportFile
);

router.patch(
  "/:caseId/add-document",
  isAuthenticated,
  caseController.addDocumentToCase
);

export default router;
