import { Request, Response } from "express";
import { DocumentService } from "../services/document.service"; // Ensure this path is correct

const documentService = new DocumentService();

const handleError = (res: Response, error: any) => {
  console.error("Error:", error);
  res.status(500).json({ message: error.message });
};

export class DocumentController {
  
  //runOcrDocumentExtraction
  async extractDocumentContent(req: Request, res: Response) {
    try {
      const { documentUrl } = req.body;

      if (!documentUrl) {
        res.status(400).json({ message: "Document URL is required" });
        return;
      }

      const response = await documentService.extractReportFromDocument(documentUrl);
      res.status(200).json(response);
    } catch (error) {
      handleError(res, error);
    }
  }

  //extractReportFromDocumentOCRJobId
  async extractReportFromDocumentOCRJobId(req: Request, res: Response) {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        res.status(400).json({ message: "OCR Job ID is required" });
        return;
      }

      // const response = await documentService.extractReportFromDocumentOCRJobId(jobId);
      res.status(200).json({ message: "Document content extracted successfully" });
    } catch (error) {
      handleError(res, error);
    }
  }

  async extractDocumentContentTest(req: Request, res: Response) {
    try {
        res.status(200).json({ message: "Document content extracted successfully" });
        
    } catch (error) {
      handleError(res, error);
    }
  }


}
