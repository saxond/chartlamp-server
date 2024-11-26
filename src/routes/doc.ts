import express from "express";
import { DocumentController } from "../controller/document.controller"; // Ensure this path is correct

const router = express.Router();
const docController = new DocumentController();

router.get("/extract", docController.extractDocumentContentTest);

router.post("/extract", docController.extractDocumentContent);

//extractReportFromDocumentOCRJobId
router.post("/ocr", docController.extractReportFromDocumentOCRJobId);

export default router;
