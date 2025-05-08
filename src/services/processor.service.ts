import {
  FeatureType,
  StartDocumentAnalysisCommand,
  StartDocumentTextDetectionCommand,
  StartDocumentTextDetectionCommandOutput,
} from "@aws-sdk/client-textract";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
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
import { deleteFromS3, uploadToS3 } from "../utils/aws/s3";
import { updatePercentageCompletion } from "../utils/helpers";
import {
  addOcrPageExtractorBackgroundJob,
  clearQueue,
} from "../utils/queue/producer";
import { ocrPageExtractorQueueName } from "../utils/queue/types";
import { textractClient } from "../utils/textract";
import { aiVectorService } from "./ai.vector.service";
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

  // async extractContentFromDocumentUsingTextract(s3ObjectKey: string) {
  //   try {
  //     const startDocumentAnalysisCommand = new StartDocumentAnalysisCommand({
  //       DocumentLocation: {
  //         S3Object: {
  //           Bucket: (process.env.AWS_BUCKET_NAME as string) || "chartlamp",
  //           Name: s3ObjectKey!,
  //         },
  //       },
  //       FeatureTypes: [
  //         FeatureType.TABLES,
  //         FeatureType.FORMS,
  //         FeatureType.SIGNATURES,
  //       ],
  //     });

  //     const { JobId } = await textractClient.send(startDocumentAnalysisCommand);

  //     return JobId || "";
  //   } catch (error: any) {
  //     appErrorLogger(
  //       `Textract error details: ${JSON.stringify(error?.message, null, 2)}`
  //     );
  //   }
  // }

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
        let hasOcr = false;

        // for (let i = 0; i < numberOfPages; i++) {
        //   const subDocument = await PDFDocument.create();
        //   const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
        //   subDocument.addPage(copiedPage);
        //   const subPdfBytes = await subDocument.save();
        //   const pdfCon1 = new Uint8Array(subPdfBytes);
        //   const processedText = await this.preProcessPage(pdfCon1);
        //   const savedDoc = await TempPageDocumentModel.create({
        //     document: documentId,
        //     pageNumber: i + 1,
        //     totalPages: numberOfPages,
        //     pageRawData: Buffer.from(subPdfBytes),
        //     pageText: processedText,
        //     env: process.env.NODE_ENV,
        //   });
        //   if (!processedText) {
        //     const pdfS3Key = await uploadToS3(
        //       documentId,
        //       savedDoc._id,
        //       subPdfBytes
        //     );
        //     console.log("pdfS3Key", pdfS3Key);
        //     if (!pdfS3Key) continue;
        //     const jobId = await this.extractContentFromDocumentUsingTextract(
        //       pdfS3Key
        //     );
        //     savedDoc.jobId = jobId;
        //     savedDoc.pdfS3Key = pdfS3Key;
        //     if (jobId) await addOcrPageExtractorBackgroundJob(jobId);
        //     await updatePercentageCompletion(
        //       caseId,
        //       i + 1,
        //       numberOfPages,
        //       `Page ${i + 1} (OCR) text is being extracted`
        //     );
        //     hasOcr = true;
        //     appLogger(
        //       `Page ${i + 1} ocr has been added to queue for ${documentUrl}`
        //     );
        //   } else {
        //     savedDoc.isCompleted = true;
        //     appLogger(
        //       `Page ${i + 1} normal text been extracted for ${documentUrl}`
        //     );
        //     await aiVectorService.storePage(savedDoc);
        //   }
        //   await updatePercentageCompletion(
        //     caseId,
        //     i + 1,
        //     numberOfPages,
        //     `Page ${i + 1} (Normal) text is extracted`
        //   );
        //   await savedDoc.save();
        // }

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
            env: process.env.NODE_ENV,
          });

          let extractionNote = "";

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
            extractionNote = `Page ${i + 1} (OCR) text is being extracted`;
            appLogger(`Page ${i + 1} OCR queued for ${documentUrl}`);
          } else {
            savedDoc.isCompleted = true;
            extractionNote = `Page ${i + 1} (Normal) text is extracted`;
            appLogger(`Page ${i + 1} normal text extracted for ${documentUrl}`);
            await aiVectorService.storePage(savedDoc);
          }

          await savedDoc.save();

          // ✅ Single call for updating percentage — safe and isolated
          await updatePercentageCompletion(
            caseId,
            i + 1,
            numberOfPages,
            extractionNote
          );
        }

        if (!hasOcr) {
          const tempDoc = await TempPageDocumentModel.findOne({
            document: documentId,
          })
            .lean()
            .populate<{
              document: Document;
            }>("document");
          if (tempDoc) {
            await this.processDocument(tempDoc.document);
          }
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

      await this.processDocument(updatedDoc.document);
    }
  }

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
      }
    }
  }

  private async handleProcessingCompletedV2(document: Document, fhirDoc: any) {
    appLogger(`No Pending Pages found`);
    await clearQueue(ocrPageExtractorQueueName);
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
