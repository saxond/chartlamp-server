import {
  StartDocumentTextDetectionCommand,
  StartDocumentTextDetectionCommandOutput,
} from "@aws-sdk/client-textract";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import textract from "textract";
import { CaseModel, CronStatus } from "../models/case.model";
import {
  Document,
  DocumentModel,
  ExtractionStatus,
  PageVectorStoreModel,
  TempPageDocumentModel,
} from "../models/document.model";
import {
  appErrorLogger,
  appLogger,
  fetchPdfFromUrl,
  loadPdfJs,
} from "../utils";
import { deleteFromS3 } from "../utils/aws/s3";
import { safeLoopPause, updatePercentageCompletion } from "../utils/helpers";
import { addPageProcessingBackgroundJob } from "../utils/queue/pageProcessing/producer";
import {
  addPdfTextExtractorBackgroundJob,
  cancelPdfTextExtractorPolling,
} from "../utils/queue/pdfExtractor/producer";
import { ocrPageExtractorQueueName } from "../utils/queue/types";
import { clearQueue } from "../utils/queue/utils";
import { textractClient } from "../utils/textract";
import { aiVectorService } from "./ai.vector.service";
import { CaseService } from "./case.service";
import { DocumentService } from "./document.service";
import OpenAIService from "./openai.service";
import { ocrPdfWithTesseract } from "../utils/tesseract";

export class ProcessorService {
  private openAiService: OpenAIService;
  private documentService: DocumentService;
  private caseService: CaseService;

  constructor() {
    this.documentService = new DocumentService();
    this.caseService = new CaseService();

    this.openAiService = new OpenAIService(
      process.env.OPENAI_API_KEY as string
    );
  }

  async extractContentFromDocumentUsingTextract(s3ObjectKey: string) {
    try {
      const command = new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: process.env.AWS_BUCKET_NAME || "chartlamp",
            Name: s3ObjectKey,
          },
        },
      });

      const response: StartDocumentTextDetectionCommandOutput =
        await textractClient.send(command);

      return response.JobId || "";
    } catch (error: any) {
      appErrorLogger(
        `Textract text detection error details: ${JSON.stringify(
          error?.message,
          null,
          2
        )}`
      );
      throw new Error("Failed to start Textract text detection job");
    }
  }

  async splitPdfToMultiplePages(
    documentUrl: string,
    documentId: string,
    caseId: string
  ) {
    try {
      const isTiffDoc =
        documentUrl.includes(".tiff") || documentUrl.includes(".tif");

      const pdfBytes = await fetchPdfFromUrl(documentUrl);
      if (isTiffDoc) {
        // await this.splitTiffToMultiplePages(pdfBytes);
      } else {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const numberOfPages = pdfDoc.getPages().length;
        // const numberOfPages = pdfDoc.getPages().slice(0, 2).length;

        for (let i = 0; i < numberOfPages; i++) {
          console.log("Page number", i + 1);
          // const subDocument = await PDFDocument.create();
          // const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
          // subDocument.addPage(copiedPage);
          // const subPdfBytes = await subDocument.save();

          await addPageProcessingBackgroundJob({
            pageNumber: i,
            totalPages: numberOfPages,
            // pageBytes: Buffer.from(subPdfBytes),
            documentId,
            caseId,
            documentUrl,
          });
        }
      }
    } catch (error: any) {
      console.log("error", error);
      // appErrorLogger(`Error splitting PDF: ${error?.message}`);
    }
  }

  async splitTiffToMultiplePages(fileBytes: any) {
    try {
      const metadata = await sharp(fileBytes).metadata();
      const pageCount = metadata.pages || 1;
      for (let i = 0; i < pageCount; i++) {
        await sharp(fileBytes, { page: i })
          .tiff()
          .toFile(`page-${i + 1}.tiff`);
        console.log(`Saved page ${i + 1} as TIFF.`);
      }
    } catch (error) {
      console.error("Error processing TIFF file:", error);
    }
  }

  async processPage({
    pageNumber,
    totalPages,
    documentId,
    caseId,
    documentUrl,
  }: {
    pageNumber: number;
    totalPages: number;
    documentId: string;
    caseId: string;
    documentUrl: string;
  }) {
    try {
      console.log("Processing page", pageNumber);
      const pdfBytes = await fetchPdfFromUrl(documentUrl);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const subDocument = await PDFDocument.create();
      const [copiedPage] = await subDocument.copyPages(pdfDoc, [pageNumber]);
      subDocument.addPage(copiedPage);
      const pageBytes = await subDocument.save();

      const byteArray = new Uint8Array(pageBytes);
      const pageBuffer = Buffer.from(pageBytes);
      const processedText = await this.getPageText(byteArray);

      const savedDoc = await TempPageDocumentModel.create({
        document: documentId,
        pageNumber: pageNumber + 1,
        totalPages,
        pageRawData: pageBuffer,
        pageText: processedText,
        env: process.env.NODE_ENV,
      });

      let extractionNote = "";

      if (!processedText) {
        // const pdfS3Key = await uploadToS3(documentId, savedDoc._id, pageBytes);
        // if (!pdfS3Key) return;

        // const jobId = await this.extractContentFromDocumentUsingTextract(
        //   pdfS3Key
        // );
        // savedDoc.jobId = jobId;
        // savedDoc.pdfS3Key = pdfS3Key;

        // if (jobId) await addOcrPageExtractorBackgroundJob(jobId);
        await addPdfTextExtractorBackgroundJob(savedDoc._id);
        extractionNote = `Page ${pageNumber} (OCR) text is being extracted`;
      } else {
        savedDoc.isCompleted = true;
        extractionNote = `Page ${pageNumber} (Normal) text is extracted`;
        await aiVectorService.storePage(savedDoc);
      }

      await savedDoc.save();

      const document = await DocumentModel.findById(documentId).lean();

      if (document) await this.processDocument(document);

      await updatePercentageCompletion(
        caseId,
        pageNumber,
        totalPages,
        extractionNote
      );
    } catch (error) {
      appErrorLogger(`Error processing page ${pageNumber}: ${error}`);
    }
  }

  async processTesseractJob(pageId: string): Promise<boolean> {
    try {
      const pageDoc = await TempPageDocumentModel.findById(pageId).populate<{
        document: Document;
      }>("document");
      if (!pageDoc) throw new Error("Page document not found");

      const pageBuffer = pageDoc.pageRawData;

      const text = await ocrPdfWithTesseract(
        pageBuffer,
        `${pageId}-${pageDoc.pageNumber}`
      );

      pageDoc.pageText = text;
      pageDoc.isCompleted = true;
      await pageDoc.save();

      if (text) await aiVectorService.storePage(pageDoc);

      appLogger(
        `processTextractJob - Page ${pageDoc.pageNumber} => text = ${text.slice(
          0,
          20
        )}`
      );

      await cancelPdfTextExtractorPolling(pageId);
      await this.processDocument(pageDoc.document);

      return true;
    } catch (error) {
      appErrorLogger(`Error processing textract job: ${error}`);
      throw new Error("Failed to process textract job");
    }
  }

  async getPageText(pdfCon1: Uint8Array) {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: pdfCon1 });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");

    if (pageText) {
      return pageText;
    } else {
      return null;
    }
  }

  async processOcrPage(jobId: string) {
    const tempPageDoc = await TempPageDocumentModel.findOne({
      jobId,
      env: process.env.NODE_ENV,
    }).lean();
    if (!tempPageDoc) throw new Error("Environment does not match");
    const pageText = await this.documentService.processOcrJob(jobId!);

    appLogger(
      `Page ${tempPageDoc.pageNumber} => text = ${pageText.slice(0, 20)}`
    );

    const updatedDoc = await TempPageDocumentModel.findOneAndUpdate(
      { jobId },
      {
        pageText,
      },
      {
        new: true,
      }
    ).populate<{ document: Document }>("document");

    if (updatedDoc) {
      if (pageText) await aiVectorService.storePage(updatedDoc);
      if (updatedDoc.pdfS3Key) {
        await deleteFromS3(updatedDoc.pdfS3Key);
        updatedDoc.pdfS3Key = "";
        updatedDoc.isCompleted = true;
        await updatedDoc.save();
      }

      // await this.processDocument(updatedDoc.document);
    }
  }

  // done
  private async handleProcessCaseReports(document: Document) {
    const completedPageDocs = await TempPageDocumentModel.find({
      document: document._id,
      isCompleted: true,
    }).lean();

    if (completedPageDocs.length) {
      for (const pageDoc of completedPageDocs) {
        if (!pageDoc.fhirSummary) continue;

        const report = await this.documentService.processReportFromFhir(
          pageDoc.fhirSummary
        );

        await this.caseService.updateCaseReports(document.case as string, [
          {
            ...report[0],
            pageNumber: pageDoc.pageNumber,
            document: document._id,
          },
        ]);

        appLogger(
          `Page ${pageDoc.pageNumber} report has been generated ${document.url}`
        );

        await updatePercentageCompletion(
          document.case.toString(),
          pageDoc.pageNumber,
          pageDoc.totalPages,
          `Page ${pageDoc.pageNumber} report has been generated ${document.url}`
        );

        await TempPageDocumentModel.findByIdAndUpdate(
          pageDoc._id,
          {
            report: report,
          },
          { new: true }
        ).lean();

        await safeLoopPause();

        if (pageDoc.pageNumber % 10 === 0) {
          appLogger(`🔁 Processed ${pageDoc.pageNumber} pages so far...`);
        }
      }
    }
  }

  // done
  private async handleProcessingCompletedV2(document: Document, fhirDoc: any) {
    appLogger(`No Pending Pages found`);
    // await clearQueue(ocrPageExtractorQueueName);
    await DocumentModel.findByIdAndUpdate(
      document._id,
      {
        isCompleted: true,
        status: ExtractionStatus.SUCCESS,
        fhir: fhirDoc,
      },
      { new: true }
    );
    const pendingDocs = await DocumentModel.find({
      case: document.case,
      isCompleted: false,
      status: ExtractionStatus.PENDING,
    });
    if (!pendingDocs.length) {
      appLogger(`No Pending case document found for ${document.url}`);
      const mergedFhirDoc = await aiVectorService.mergeFhirBundlesArray(
        document.case as string
      );
      const updatedCase = await CaseModel.findByIdAndUpdate(
        document.case,
        {
          fhir: mergedFhirDoc,
        },
        { new: true }
      );
      if (!updatedCase) throw new Error("Case not found");
      const alldocs = await DocumentModel.find({
        case: document.case,
      }).lean();
      const alldocIds = alldocs.map((item) => item._id);

      // await TempPageDocumentModel.deleteMany({
      //   document: { $in: alldocIds },
      // });
      await PageVectorStoreModel.deleteMany({ document: { $in: alldocIds } });

      updatedCase.percentageCompletion = 100;
      updatedCase.cronStatus = CronStatus.Processed;
      await updatedCase?.save();

      appLogger(`All temp page document deleted for case ${document.case}`);
    } else {
      appLogger(`${pendingDocs.length} Pending Documment for ${document.url}`);
    }
  }

  async processDocument(document: Document) {
    const pendingPageDocs = await TempPageDocumentModel.find({
      document: document._id,
      isCompleted: false,
    }).lean();

    console.log("pendingPageDocs", pendingPageDocs.length);

    if (pendingPageDocs.length) {
      appLogger(`${pendingPageDocs.length} Pending Pages for ${document.url}`);
    }

    if (!pendingPageDocs.length) {
      appLogger(`No Pending Pages found`);
      await aiVectorService.extractFhirFromDocument(document._id as string);
      const fhirDoc = await aiVectorService.mergeFhirBundles(
        document._id as string
      );
      await this.handleProcessCaseReports(document);
      await this.handleProcessingCompletedV2(document, fhirDoc);
    } else {
      appLogger(`${pendingPageDocs.length} Pending Pages for ${document.url}`);
    }
  }

  async processCase() {
    const caseItem = await CaseModel.findOne({
      $or: [
        { cronStatus: CronStatus.Pending },
        { cronStatus: "" },
        { cronStatus: { $exists: false } },
      ],
      env: process.env.NODE_ENV,
    });

    if (!caseItem) {
      appLogger("no case to process");
      return null;
    }

    try {
      // Process the case
      caseItem.cronStatus = CronStatus.Processing;
      await caseItem.save();
      await this.processCaseDocuments(caseItem._id);
      // appLogger(`Processed case: ${caseItem?._id}`);
    } catch (error: any) {
      await CaseModel.findByIdAndUpdate(
        caseItem._id,
        { cronStatus: CronStatus.Pending },
        { new: true }
      );
      appErrorLogger(`Error processing case: ${error?.message}`);
    }
  }

  async processCaseDocuments(caseId: string): Promise<any> {
    try {
      const documents = await DocumentModel.find({ case: caseId }).lean();

      if (!documents.length) {
        return [];
      }

      await Promise.all(
        documents.map((doc) =>
          this.splitPdfToMultiplePages(doc.url, doc._id, caseId)
        )
      );
    } catch (error: any) {
      appErrorLogger(
        `Error populating report from case documents: ${error?.message}`
      );
      throw new Error("Failed to populate report from case documents");
    }
  }
}
