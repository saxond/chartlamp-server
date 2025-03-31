import {
  FeatureType,
  StartDocumentAnalysisCommand,
} from "@aws-sdk/client-textract";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { CaseModel, CronStatus } from "../models/case.model";
import {
  Document,
  DocumentModel,
  ExtractionStatus,
  TempPageDocumentModel,
} from "../models/document.model";
import {
  appErrorLogger,
  appLogger,
  fetchPdfFromUrl,
  loadPdfJs,
} from "../utils";
import { deleteFromS3, uploadToS3 } from "../utils/aws/s3";
import { addOcrPageExtractorBackgroundJob } from "../utils/queue/producer";
import { textractClient } from "../utils/textract";
import { CaseService } from "./case.service";
import { DocumentService } from "./document.service";
import OpenAIService from "./openai.service";

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

  async updatePercentageCompletion(
    caseId: string,
    pageNumber: number,
    totalPages: number
  ) {
    try {
      if (totalPages === 0) throw new Error("Total pages cannot be zero");

      let newContribution: number;

      // Calculate the contribution as half of the page's value
      const pageContribution = 100 / totalPages;
      newContribution = pageContribution / 2;

      // Fetch the current completion percentage from the database
      const currentCase = await CaseModel.findById(caseId);
      if (!currentCase) {
        throw new Error(`Case with ID ${caseId} not found`);
      }

      // Accumulate the new percentage with the existing one
      const currentPercentage = currentCase.percentageCompletion || 0;
      let accumulatedPercentage = currentPercentage + newContribution;

      // Ensure it does not exceed 100%
      accumulatedPercentage = Math.min(Math.round(accumulatedPercentage), 100);

      // Update the accumulated percentage
      const updatedCase = await CaseModel.findByIdAndUpdate(
        caseId,
        { percentageCompletion: accumulatedPercentage },
        { new: true }
      );

      appLogger(
        `Updated case ${caseId} with accumulated completion percentage: ${accumulatedPercentage}%`
      );
      return updatedCase;
    } catch (error: any) {
      appErrorLogger(
        `Error updating completion percentage for case ${caseId}: ${error?.message}`
      );
      throw error;
    }
  }

  async extractContentFromDocumentUsingTextract(s3ObjectKey: string) {
    try {
      const startDocumentAnalysisCommand = new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: (process.env.AWS_BUCKET_NAME as string) || "chartlamp",
            Name: s3ObjectKey!,
          },
        },
        FeatureTypes: [
          FeatureType.TABLES,
          FeatureType.FORMS,
          FeatureType.SIGNATURES,
        ],
      });

      const { JobId } = await textractClient.send(startDocumentAnalysisCommand);

      return JobId || "";
    } catch (error: any) {
      appErrorLogger(
        `Textract error details: ${JSON.stringify(error?.message, null, 2)}`
      );
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
        // const numberOfPages = pdfDoc.getPages().length;
        const numberOfPages = pdfDoc.getPages().slice(0, 10).length;
        let hasOcr = false;
        for (let i = 0; i < numberOfPages; i++) {
          const subDocument = await PDFDocument.create();
          const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
          subDocument.addPage(copiedPage);
          const subPdfBytes = await subDocument.save();
          const pdfCon1 = new Uint8Array(subPdfBytes);
          const processedText = await this.preProcessPage(pdfCon1);
          const savedDoc = await TempPageDocumentModel.create({
            document: documentId,
            pageNumber: i + 1,
            totalPages: numberOfPages,
            pageRawData: Buffer.from(subPdfBytes),
            pageText: processedText,
          });
          if (!processedText) {
            const pdfS3Key = await uploadToS3(
              documentId,
              savedDoc._id,
              subPdfBytes
            );
            if (!pdfS3Key) continue;
            const jobId = await this.extractContentFromDocumentUsingTextract(
              pdfS3Key
            );
            savedDoc.jobId = jobId;
            savedDoc.pdfS3Key = pdfS3Key;
            if (jobId) await addOcrPageExtractorBackgroundJob(jobId);
            hasOcr = true;
            appLogger(
              `Page ${i + 1} ocr has been added to queue for ${documentUrl}`
            );
          } else {
            savedDoc.isCompleted = true;
            appLogger(
              `Page ${i + 1} normal text been extracted for ${documentUrl}`
            );
          }
          await this.updatePercentageCompletion(caseId, i + 1, numberOfPages);
          await savedDoc.save();
        }
        if (!hasOcr) {
          const document = await DocumentModel.findById(documentId).lean();
          if (document) await this.processReport(document);
        }
      }
    } catch (error: any) {
      appErrorLogger(`Error splitting PDF: ${error?.message}`);
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

  async preProcessPage(pdfCon1: Uint8Array) {
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
    const pageText = await this.documentService.getCombinedDocumentContent(
      jobId!
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
      if (updatedDoc.pdfS3Key) {
        await deleteFromS3(updatedDoc.pdfS3Key);
        updatedDoc.pdfS3Key = "";
        updatedDoc.isCompleted = true;
        await updatedDoc.save();
        appLogger(
          `Page ${updatedDoc.pageNumber} => job ${jobId} has been processed for ${updatedDoc.document.url}`
        );
      }

      await this.processReport(updatedDoc.document);
    }
  }

  async processReport(document: Document) {
    const completedDocs = await TempPageDocumentModel.find({
      isCompleted: true,
      document: document._id,
      report: [],
    }).lean();

    for (const doc of completedDocs) {
      const pageReport =
        await this.documentService.generateReportForTempPageDocument(doc);
      const document = await DocumentModel.findById(doc.document).lean();
      if (document && pageReport.length && document.case) {
        await this.caseService.updateCaseReports(document.case.toString(), [
          {
            ...pageReport[0],
            pageNumber: doc.pageNumber,
          },
        ]);
        appLogger(
          `Page ${doc.pageNumber} report has been generated ${document.url}`
        );
        await this.updatePercentageCompletion(
          document.case.toString(),
          doc.pageNumber,
          doc.totalPages
        );
      }
      await TempPageDocumentModel.findByIdAndUpdate(
        doc._id,
        {
          report: pageReport,
        },
        { new: true }
      );
    }

    const pendingPageDocs = await TempPageDocumentModel.find({
      document: document._id,
      isCompleted: false,
    }).lean();

    if (!pendingPageDocs.length) {
      appLogger(`No Pending Pages found`);
      await DocumentModel.findByIdAndUpdate(
        document._id,
        {
          isCompleted: true,
          status: ExtractionStatus.SUCCESS,
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
        await CaseModel.findByIdAndUpdate(
          document.case,
          {
            cronStatus: CronStatus.Processed,
            percentageCompletion: 100,
          },
          { new: true }
        );
        const alldocs = await DocumentModel.find({
          case: document.case,
        }).lean();
        const alldocIds = alldocs.map((item) => item._id);
        await TempPageDocumentModel.deleteMany({
          document: { $in: alldocIds },
        });
        appLogger(`All temp page document deleted for case ${document.case}`);
      } else {
        appLogger(
          `${pendingDocs.length} Pending Documment for ${document.url}`
        );
      }
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
      appLogger(`Processed case: ${caseItem?._id}`);
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
