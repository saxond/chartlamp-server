import express from "express";
import { CaseController } from "../controller/case.controller"; // Ensure this path is correct
import { isAuthenticated } from "../middleware/isAuth";

const router = express.Router();
const caseController = new CaseController();

// Case routes
router.post("/", isAuthenticated, caseController.create);
router.patch("/:id", isAuthenticated, caseController.updateCaseDetails);
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
router.get("/favorites", isAuthenticated, caseController.getAllFavoriteCases);
router.get(
  "/:id/detail",
  isAuthenticated,
  caseController.getCaseByIdWithBodyParts
);
router.get(
  "/:id/status",
  isAuthenticated,
  caseController.getCaseExtractionStatus
);
router.post("/:id/share", isAuthenticated, caseController.shareCaseWithUsers);
router.get("/user", isAuthenticated, caseController.getUserCases);
router.get("/:id", isAuthenticated, caseController.getById);
router.put("/:id", isAuthenticated, caseController.update);

router.get("/:id/tags", isAuthenticated, caseController.getCaseTags);

router.post(
  "/:id/reports/:reportId/dc/tags",
  isAuthenticated,
  caseController.getDcTagMapping
);

router.get(
  "/:id/dcId/tags",
  isAuthenticated,
  caseController.getCaseDcTagMapping
);

router.post(
  "/:id/dc/addRemove",
  isAuthenticated,
  caseController.updateCaseReportMultipleTags
);

router.post(
  "/:id/reports/filter-by-dc",
  isAuthenticated,
  caseController.getReportsByDcTagMapping
);

router.post(
  "/:id/reports/filter-by-tags",
  isAuthenticated,
  caseController.getReportsByTagMapping
);

router.post("/:id/tags", isAuthenticated, caseController.createCaseTag);

router.patch(
  "/:id/reports/:reportId",
  isAuthenticated,
  caseController.updateCaseReportTags
);

router.get("/:id/notes", isAuthenticated, caseController.getCaseNotes);
router.post("/:id/notes", isAuthenticated, caseController.createCaseNote);
router.patch(
  "/:id/notes/:noteId",
  isAuthenticated,
  caseController.updateCaseNote
);
router.delete("/:id/notes/:noteId", isAuthenticated, caseController.deleteNote);

router.patch(
  "/:commentId/comment",
  isAuthenticated,
  caseController.updateComment
);

router.patch(
  "/:id/update-favorite",
  isAuthenticated,
  caseController.updateFavoriteStatus
);

router.patch(
  "/:id/update-claim-status",
  isAuthenticated,
  caseController.updateClaimStatus
);

router.patch(
  "/:id/archive",
  isAuthenticated,
  caseController.updateArchiveStatus
);

router.patch(
  "/:id/update-target-completion",
  isAuthenticated,
  caseController.updateTargetCompletion
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
