import {
  AnalyzeDocumentCommand,
  FeatureType,
  GetDocumentAnalysisCommand,
  GetDocumentAnalysisCommandOutput,
  JobStatus,
  StartDocumentAnalysisCommand,
} from "@aws-sdk/client-textract";
import axios from "axios";
import fs from "fs";
import mongoose from "mongoose";
import { zodResponseFormat } from "openai/helpers/zod";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { dynamicImport } from "tsimportlib";
import { z } from "zod";
import { CaseModel, NameOfDiseaseByIcdCode } from "../models/case.model";
import {
  Document,
  DocumentModel,
  ExtractionStatus,
  TempPageDocument,
  TempPageDocumentModel,
} from "../models/document.model";
import {
  addOcrExtractionBackgroundJob,
  addOcrExtractionStatusPollingJob,
  addOcrPageExtractorBackgroundJob,
  cancelOcrPageExtractorPolling,
} from "../utils/queue/producer";
import { textractClient } from "../utils/textract";
import OpenAIService from "./openai.service";

const MAX_TOKENS = 16385;

export class DocumentService {
  private openAiService: OpenAIService;

  constructor() {
    this.openAiService = new OpenAIService(
      process.env.OPENAI_API_KEY as string
    );
  }

  // Split content into chunks
  private splitContent(content: string, maxTokens: number): string[] {
    const chunks = [];
    let currentChunk = "";

    for (const word of content.split(" ")) {
      if ((currentChunk + word).length > maxTokens) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        currentChunk += ` ${word}`;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Clean and parse the response from OpenAI
  private cleanResponse(response: string): any[] {
    try {
      const jsonString = response.replace(/```json|```/g, "").trim();
      // IS THIS A VALID JSON STRING?
      return JSON.parse(jsonString);
    } catch (error) {
      return [];
    }
  }

  async validateAmount(amount: string): Promise<number> {
    console.log("Amount:", amount);

    // If the string is empty, return 0
    if (!amount?.trim()) {
      return 0;
    }

    // If the amount contains "Not provided" or "N/A", return 0
    if (amount.includes("Not provided") || amount.includes("N/A")) {
      return 0;
    }

    // Remove currency symbols and commas
    amount = amount.replace(/[$,]/g, "");

    // Extract the number from the string
    const numberMatch = amount.match(/\d+(\.\d+)?/);

    // If a number is found, return it
    if (numberMatch) {
      return Number(numberMatch[0]);
    }

    // If no number is found, return 0
    return 0;
  }

  async validateDateStr(dateStr: string): Promise<Date | null> {
    // If the string is empty, return null
    if (!dateStr?.trim()) {
      return null;
    }

    // Attempt to parse the date string
    const date = new Date(dateStr);

    // If the date is invalid, return null
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  async getBase64FromUrl(url: string): Promise<string> {
    try {
      // Download PDF from URL
      const response = await axios.get(url, {
        responseType: "arraybuffer",
      });

      // Convert PDF buffer to Base64
      const base64 = Buffer.from(response.data).toString("base64");

      return base64;
    } catch (error) {
      console.error("Error converting PDF to Base64:", error);
      throw new Error("Failed to convert PDF to Base64");
    }
  }

  // Get ICD code from description
  async getIcdCodeFromDescription(description: string): Promise<string[]> {
    const prompt = `Get the ICD 10 code for the following description: ${description}. 
    Give the exact code no any added text after the ICD 10 code. For example, if the 
    description is "Acute bronchitis due to coxsackievirus", the response should be J20.0.
    If there are multiple codes, provide all of them separated by commas. Do not fabricate the codes,
    nly provide the exact codes. if none return empty string.`;

    // If the description contains the word "not provided" or "N/A", return an empty array
    if (
      description.toLowerCase().includes("not provided") ||
      description.toLowerCase().includes("n/a")
    ) {
      return [];
    }

    try {
      const response = await this.openAiService.completeChat({
        context: "Get the ICD 10 code for the following description",
        prompt,
        model: "gpt-4o",
        temperature: 0.4,
      });

      if (response) {
        const lowerResponse = response.toLowerCase();

        if (
          ["not", "n/a", "no", "none", "icd-10", "description"].includes(
            lowerResponse
          )
        ) {
          return [];
        }

        // Split by commas, clean up whitespace
        const codes = response
          .split(",")
          .map((code: string) => code.trim())
          .filter((code: string) => code);

        // New Check: Are the codes valid-looking ICD codes?
        const icdCodePattern = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/i;

        const validIcdCodes = codes.filter((code: string) =>
          icdCodePattern.test(code)
        );

        // If we find no valid ICD codes, assume it's just a long text
        if (validIcdCodes.length === 0) {
          return [];
        }

        return Array.from(new Set(validIcdCodes));
      }

      return [];
    } catch (error) {
      console.log(
        `Failed to get the ICD codes for the description: ${description}:`,
        error
      );
      return [];
    }
  }

  private async processContentChunk(chunk: string): Promise<any[]> {
    const MedicalRecord = z.object({
      diseaseName: z.union([z.string(), z.array(z.string())]),
      diagnosis: z.union([z.string(), z.array(z.string())]),
      amountSpent: z.string(),
      providerName: z.string(),
      doctorName: z.string(),
      medicalNote: z.string(),
      date: z.string(),
    });

    // const prompt = `Here's the extracted document of a patient's medical record: ${chunk} I want you to process this text and provide me the information.
    //  please ignore any questionnaire like content`;

    const prompt = `
You are processing a patient's medical document. Extract the following structured data:
- Disease name(s)
- Diagnosis(es)
- Amount spent
- Provider name
- Doctor's name
- Medical notes
- Date

❗️ Important Instructions:
- Ignore any questionnaire-like content, such as sections with "Yes/No" questions, checkboxes, or form-style fields.
- Do NOT extract sections like:
  - "Do you smoke? Yes/No"
  - "Are you taking medication? Yes/No"
  - "What surgeries have you had?"
  - Lists of conditions with checkboxes.

Extracted document:
"${chunk}"
`;

    const response = await this.openAiService.completeChat({
      context: "Extract the patient report from the document",
      prompt,
      model: "gpt-4o",
      temperature: 0.4,
      response_format: zodResponseFormat(MedicalRecord, "report"),
    });

    // console.log("processContentChunk", response);
    return { ...response, chunk };
  }

  private getDiseaseName(
    name: string | string[],
    diagnosis: string | string[]
  ) {
    const nameArr = Array.isArray(name) ? name : name.split(",");
    const diagnosisArr = Array.isArray(diagnosis)
      ? diagnosis
      : diagnosis.split(",");
    const nameSet = new Set(nameArr.concat(diagnosisArr));
    return Array.from(nameSet).join(",");
  }

  async processDocumentContent(content: string): Promise<any[]> {
    try {
      // Split content into smaller chunks
      const contentChunks = this.splitContent(content, MAX_TOKENS / 2);

      // Process content chunks
      const results = await Promise.all(
        contentChunks.map((chunk) => this.processContentChunk(chunk))
      );

      // Define the type of result
      type ResultType = {
        amountSpent: string;
        date: string;
        diseaseName: string | string[];
        diagnosis: string | string[];
        providerName: string;
        doctorName: string;
        medicalNote: string;
        chunk: string;
      };

      // Flatten the results array
      const flattenedResults = results.flat();

      // Create report objects from flattened results
      const reportObjects = await Promise.all(
        flattenedResults.flatMap(async (result: ResultType) => {
          const amountSpent = await this.validateAmount(
            result.amountSpent || ""
          );
          const dateOfClaim = await this.validateDateStr(result.date || "");

          const nameOfDisease = this.getDiseaseName(
            result.diseaseName,
            result.diagnosis
          );

          if (!nameOfDisease) return [];

          // typeof result.diseaseName === "string"
          //   ? result.diseaseName
          //   : Array.isArray(result.diseaseName)
          //   ? result.diseaseName.join(",")
          //   : "";

          const icdCodes = await this.getIcdCodeFromDescription(
            nameOfDisease + " " + result.medicalNote
          );

          if (!icdCodes.length) return [];

          const diseaseNameByIcdCode = await this.getStreamlinedDiseaseName({
            icdCodes,
            diseaseNames: nameOfDisease,
            note: nameOfDisease + " " + result.medicalNote,
            chunk: result.chunk,
          });

          //check to make sure

          if (nameOfDisease.toLowerCase() === "not specified") return [];

          return [
            {
              icdCodes,
              nameOfDisease: nameOfDisease || "",
              amountSpent: amountSpent || 0,
              providerName: result.providerName || "",
              doctorName: result.doctorName || "",
              medicalNote: result.medicalNote || "",
              dateOfClaim,
              nameOfDiseaseByIcdCode: diseaseNameByIcdCode,
              chunk: result.chunk,
            },
          ];
        })
      );

      return reportObjects.flat();
    } catch (error) {
      console.log("Error processing document content:", error);
      return [];
    }
  }

  async getStreamlinedDiseaseName({
    icdCodes,
    diseaseNames,
    note,
    chunk,
  }: {
    icdCodes: string[];
    diseaseNames: string;
    chunk: string;
    note?: string;
  }): Promise<NameOfDiseaseByIcdCode[]> {
    if (!icdCodes.length || !/[a-zA-Z0-9]/.test(icdCodes.join(""))) return [];

    const IcdCodesToDiseaseName = z.object({
      data: z.array(
        z.object({
          icdCode: z.string(),
          nameOfDisease: z.string(),
          summary: z.string(),
          excerpt: z.string(),
        })
      ),
    });

    const basePrompt = `
Your strict task:

1. From the given list of disease names: ${diseaseNames}, find only exact or highly relevant matches to the following ICD codes: ${icdCodes.join(
      ","
    )}.
   
2. Use ONLY the provided text below for matching (no assumptions, no hallucination):
\n${chunk}\n

Strict Matching Rules:
- Only assign an ICD code if the disease name, symptom, or condition is **explicitly** mentioned in the text, or if the description strongly matches it.
- Pay close attention to **anatomical regions** (e.g., thorax vs head vs abdomen) to avoid misclassification.
- DO NOT guess or infer based on general symptoms unless the anatomical location is clearly aligned with the disease name.

For each matched ICD code, extract the following:
- An **excerpt**: include the exact sentence or line where the match occurs, plus 10 words before and 10 words after if available.
- A **brief explanation**: explain why this ICD code was matched, including reference to specific phrases or anatomical clues from the text.

Important:
- If no match is found for a particular ICD code, simply omit it from the output.
- Focus strictly on matches where the disease or symptom description explicitly corresponds to the ICD meaning.
- Prioritize anatomical accuracy over broad symptom similarity.
`;

    const prompt = `${basePrompt}`.trim();

    const response = await this.openAiService.completeChat({
      context: "Match icd codes with disease names",
      prompt,
      model: "gpt-4o",
      temperature: 0.4,
      response_format: zodResponseFormat(IcdCodesToDiseaseName, "report"),
    });

    if (!response?.data) return [];
    const diseaseNameByIcdCode: NameOfDiseaseByIcdCode[] = response.data.map(
      (item: any) => ({
        icdCode: item.icdCode,
        nameOfDisease: item.nameOfDisease,
        summary: item.summary,
        excerpt: item.excerpt,
        pageNumber: item.pageNumber,
      })
    );
    return diseaseNameByIcdCode;
  }

  // Create report from document
  async generateReportForTempPageDocument(
    doc: TempPageDocument
  ): Promise<any[]> {
    try {
      const content = doc.pageText?.trim();
      if (!content) {
        return []; // Skip to the next document
      }

      const results = await this.processDocumentContent(content);

      // console.log("generateReportForDocument", results);

      // Add document ID to each result
      return results.map((result) => ({
        ...result,
        document: doc.document as string,
      }));
    } catch (error) {
      console.log("Error generating report for document:", error);
      return [];
    }
  }

  // Create report from document
  async generateReportForDocument(doc: Document): Promise<any[]> {
    try {
      const content = doc.content?.trim();
      if (!content) {
        return []; // Skip to the next document
      }

      const results = await this.processDocumentContent(content);

      // console.log("generateReportForDocument", results);

      // Add document ID to each result
      return results.map((result) => ({
        ...result,
        document: doc._id as string,
      }));
    } catch (error) {
      console.log("Error generating report for document:", error);
      return [];
    }
  }

  async extractContentFromDocumentUsingTextract(
    documentUrl: string
  ): Promise<string> {
    try {
      // Ensure the documentUrl is the S3 object key, not the full URL
      const s3ObjectKey = documentUrl.split("/").pop();

      // Call Amazon Textract to extract text from the PDF
      const params = {
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
      };

      //start document analysis
      // const startDocumentAnalysisCommand = new StartDocumentAnalysisCommand(
      //   params
      // );
      const startDocumentAnalysisCommand = new StartDocumentAnalysisCommand(
        params
      );

      const { JobId } = await textractClient.send(startDocumentAnalysisCommand);

      return JobId || "";
    } catch (error) {
      // Log more detailed error information for debugging
      console.error("Textract error details:", JSON.stringify(error, null, 2));

      // Handle specific Textract exceptions
      if ((error as any).__type === "UnsupportedDocumentException") {
        console.error("Unsupported document type:", error);
        throw new Error("Unsupported document type");
      } else {
        console.error(
          "Error extracting content from document using Textract:",
          error
        );
        throw new Error(
          "Failed to extract content from document using Textract"
        );
      }
    }
  }

  // //get document analysis output
  async getDocumentAnalysisOutput(
    jobId: string,
    nextToken?: string
  ): Promise<GetDocumentAnalysisCommandOutput> {
    try {
      // console.log("getDocumentAnalysisOutput", jobId);
      const params = {
        JobId: jobId,
        MaxResults: 1000,
        NextToken: nextToken,
      };

      //get document analysis output
      // const startDocumentAnalysisCommand = new GetDocumentAnalysisCommand(
      //   params
      // );
      const startDocumentAnalysisCommand = new GetDocumentAnalysisCommand(
        params
      );
      AnalyzeDocumentCommand;
      const response = await textractClient.send(startDocumentAnalysisCommand);

      return response;
    } catch (error) {
      console.error("Error getting document analysis output:", error);
      throw new Error("Failed to get document analysis output");
    }
  }

  async fetchPdfFromUrl(documentUrl: string) {
    try {
      const response = await axios.get(documentUrl, {
        responseType: "arraybuffer", // Important to get binary data
      });
      return response.data;
    } catch (err) {
      console.error("Error fetching PDF from URL:", err);
      throw err;
    }
  }

  async writePdfBytesToFile(fileName: string, pdfBytes: any) {
    await fs.promises.writeFile(fileName, pdfBytes);
    console.log(`Saved: ${fileName}`);
  }

  async splitPdfV2(documentUrl: string) {
    try {
      // Fetch PDF from the URL
      const pdfBytes = await this.fetchPdfFromUrl(documentUrl);

      // Load the PDFDocument from bytes
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const numberOfPages = pdfDoc.getPages().length;
      console.log(`Number of pages: ${numberOfPages}`);

      for (let i = 0; i < numberOfPages; i++) {
        // Create a new "sub" document
        const subDocument = await PDFDocument.create();
        // Copy the page at the current index
        const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
        subDocument.addPage(copiedPage);
        const subPdfBytes = await subDocument.save();

        // Save the split page as a separate file
        await this.writePdfBytesToFile(`file-${i + 1}.pdf`, subPdfBytes);
      }
    } catch (err) {
      console.error("Error splitting PDF:", err);
    }
  }

  async loadPdfJs() {
    const pdfjsLib = await dynamicImport(
      "pdfjs-dist/legacy/build/pdf.mjs",
      module
    );
    return pdfjsLib;
  }

  async splitPdf(pdfBuffer: Uint8Array) {
    try {
      const pdfjsLib = await this.loadPdfJs();
      const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
      const pdf = await loadingTask.promise;
      const numberOfPages = pdf.numPages;

      const pageContents: Record<string, string> = {}; // Store page text

      for (let i = 0; i < numberOfPages; i++) {
        const page = await pdf.getPage(i + 1); // pdfjs-dist uses 1-based indexing
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");

        if (pageText) {
          pageContents[i + 1] = pageText;
        } else {
          console.log("==============>Contains OCR ==============>", i + 1);
          throw new Error("contains ocr");
        }
      }

      if (Object.keys(pageContents).length === 0) {
        console.log(`pageContents is empty`, pageContents);
        throw new Error("pageContents is empty");
      }

      return pageContents;
    } catch (error) {
      console.log(`Cannot split this pdf`, error);
      return null;
    }
  }

  // Extract content from the document that is in PDF format
  async extractContentFromDocument(
    documentUrl: string,
    documentId?: string
  ): Promise<string> {
    try {
      console.log("Document URL:", documentUrl);

      const isTiffDoc =
        documentUrl.includes(".tiff") || documentUrl.includes(".tif");

      if (isTiffDoc) {
        throw new Error("Failed to extract content from document");
      }

      // Download PDF from URL (S3 URL)
      const response = await axios.get(documentUrl, {
        responseType: "arraybuffer",
      });

      const pdfBuffer = new Uint8Array(response.data);
      const pageContents = await this.splitPdf(pdfBuffer);
      console.log("pageContents", pageContents);
      if (!pageContents) throw new Error("");
      // Combine all pages into a single string with page headers
      this.processPageContents(pageContents, "document_output.txt");

      const filteredPages = await this.filterQuestionPages(pageContents);

      // console.log("filteredPages", filteredPages);

      // Write filtered content to file
      let content = this.processPageContents(
        filteredPages,
        "filtered_in_document_output.txt"
      );

      // // Remove empty lines and trim
      // content = content
      //   .split("\n")
      //   .map((line) => line.trim())
      //   .filter((line) => line)
      //   .join("\n");

      // If the content is empty, try to extract using Textract
      if (!content) {
        throw new Error("Failed to extract content from document");
      }

      // Return content
      return content;
    } catch (error) {
      console.error("Error extracting content from document:", error);
      let content =
        (await this.extractContentFromDocumentUsingTextract(documentUrl)) || "";
      // If documentId is provided, update the document with the jobId
      if (documentId) {
        const doc = await DocumentModel.findByIdAndUpdate(documentId, {
          jobId: content,
        });
        if (doc) {
          await addOcrExtractionBackgroundJob("extractOcr", {
            documentId: doc._id,
            isSinglePage: true,
          });
          await addOcrExtractionStatusPollingJob(content);
        }
      }
      content = "";
      return "";
    }
  }

  async getTextractJobStatus(jobId: string): Promise<JobStatus | undefined> {
    try {
      const command = new GetDocumentAnalysisCommand({ JobId: jobId });
      const response: GetDocumentAnalysisCommandOutput =
        await textractClient.send(command);

      console.log(`ℹ️ Textract Job ${jobId} Status:`, response.JobStatus);

      return response.JobStatus;
    } catch (error) {
      console.error(
        `❌ Error fetching Textract job status for ${jobId}:`,
        error
      );
      throw new Error("Failed to get Textract job status");
    }
  }

  async checkIfPageIsQuestionnaire(pageText: string) {
    const prompt = `
    You are an assistant that classifies pages of a document.

    Analyze the following page text and determine if it looks like:
    - A page containing a list of questions, quiz questions, interview questions, survey forms, or any questionnaire-like content.
    - Or if it is a normal page with paragraphs, explanations, or general content.

    Respond with "QUESTION" if the page is primarily question-like.
    Respond with "CONTENT" if the page is normal content.

    Page Text:
    ${pageText}

    Response (just "QUESTION" or "CONTENT", nothing else):
    `;

    const response = await this.openAiService.completeChat({
      context: "You classify document pages.",
      prompt,
      model: "gpt-4o",
      temperature: 0.4,
    });

    // console.log("checkIfPageIsQuestion", response);
    const result = response;

    return result === "QUESTION";
  }

  async filterQuestionPages(pageContents: { [key: string]: string }) {
    const filteredPages: any = {};

    for (const [page, content] of Object.entries(pageContents)) {
      const isQuestionPage = await this.checkIfPageIsQuestionnaire(content);
      if (!isQuestionPage) {
        filteredPages[page] = content;
      } else {
        // console.log(`Page ${page} looks like a question page and was skipped.`);
        let contentOut = "";
        contentOut += `--- Page ${page} ---\n`;
        contentOut += content + "\n";
        fs.appendFileSync(
          path.join(__dirname, "filtered_out_document_output.txt"),
          contentOut
        );
      }
    }

    return filteredPages;
  }

  processPageContents(
    pageContents: { [key: string]: string },
    pathurl: string
  ) {
    let fileContent = "";
    for (const [page, content] of Object.entries(pageContents)) {
      fileContent += `--- Page ${page} ---\n`;
      fileContent += content + "\n";
    }

    fs.writeFileSync(path.join(__dirname, pathurl), fileContent);
    return fileContent;
  }

  async getCombinedDocumentContent(jobId: string): Promise<string> {
    try {
      let nextToken: string | undefined = undefined;
      console.log("Fetching combined document content for job:", jobId);

      // 1️⃣ Check if Textract job is still running before fetching results
      const jobStatus = await this.getTextractJobStatus(jobId);
      if (!jobStatus) return "";
      if (jobStatus === "IN_PROGRESS") {
        console.log("⏳ Textract job still processing...");
        return ""; // Exit early since the job isn't done
      }
      if (jobStatus === "SUCCEEDED") {
        console.log("✅ Textract job completed successfully");
        await cancelOcrPageExtractorPolling(jobId);
        // cancelOcrExtractionPolling(jobId);
      }

      console.log("⏳ Running loop to get ocr content");

      // // 2️⃣ Fetch document content in pages

      const pageContents: any = {}; // Keyed by page number
      do {
        const response = await this.getDocumentAnalysisOutput(jobId, nextToken);

        if (response.Blocks) {
          const selectionElements = response.Blocks.filter(
            (b) => b.BlockType === "SELECTION_ELEMENT"
            // &&
            // b.SelectionStatus === SelectionStatus.NOT_SELECTED
          );

          // Example: build a set of page numbers that have checkboxes
          const pagesWithCheckboxes = new Set(
            selectionElements.map((b) => b.Page)
          );

          // console.log("pagesWithCheckboxes", pagesWithCheckboxes);
          for (const block of response.Blocks) {
            // console.log("selection elements", JSON.stringify(block));
            if (pagesWithCheckboxes.has(block.Page)) {
              continue;
            }
            if (block.BlockType === "LINE") {
              const pageNumber = block.Page || 1; // Defaults to page 1 if no page (shouldn't happen with PDFs)

              if (!pageContents[pageNumber]) {
                pageContents[pageNumber] = ""; // Initialize for each page
              }

              pageContents[pageNumber] += block.Text + "\n";
            }
          }
        }

        nextToken = response.NextToken; // Move to next set of blocks
      } while (nextToken);

      // Combine all pages into a single string with page headers
      this.processPageContents(pageContents, "document_output.txt");

      const filteredPages = await this.filterQuestionPages(pageContents);

      // Write filtered content to file
      const filteredFileContent = this.processPageContents(
        filteredPages,
        "filtered_in_document_output.txt"
      );

      return filteredFileContent || "";
    } catch (error) {
      console.log("❌ Error getting combined document content:", error);
      throw new Error("Failed to get combined document content");
    }
  }

  // Get all documents that do not have content extracted
  async getDocumentsWithoutExtractedData(limit: number = 1): Promise<any[]> {
    try {
      // Get documents from the database that do not have content extracted
      const documents = await DocumentModel.find({
        $or: [{ extractedData: null }, { extractedData: "" }],
      })
        .limit(limit)
        .lean();

      if (!documents.length) {
        return [];
      }

      // Extract content from each document
      const updatePromises = documents.map(async (document) => {
        const content = await this.extractContentFromDocument(
          document.url,
          document._id
        );
        await DocumentModel.findByIdAndUpdate(document._id, {
          extractedData: content,
        });
        return { ...document, extractedData: content };
      });

      // Wait for all updates to complete
      const updatedDocuments = await Promise.all(updatePromises);

      // Return updated documents
      return updatedDocuments;
    } catch (error) {
      throw new Error("Failed to get documents without content");
    }
  }

  async extractCaseDocumentData(
    caseId: string,
    updateProgressFn: (caseId: string) => Promise<void>
  ) {
    try {
      // Get documents from the database that do not have content extracted
      const documents = await DocumentModel.find({
        $or: [{ extractedData: null }, { extractedData: "" }],
        case: caseId,
      }).lean();

      if (!documents.length) return null;

      let hasError = true;

      // Extract content from each document
      const updatePromises = documents.map(async (document) => {
        const content = await this.extractContentFromDocument(
          document.url,
          document._id
        );
        if (content) {
          hasError = false;
          await DocumentModel.findByIdAndUpdate(document._id, {
            extractedData: content,
          });
          await updateProgressFn(caseId);
        }
        return { ...document, extractedData: content };
      });

      // Wait for all updates to complete
      const updatedDocuments = await Promise.all(updatePromises);
      await updateProgressFn(caseId);
      // Return updated documents
      return { extractCaseDocumentData: updatedDocuments, hasError };
    } catch (error) {
      throw new Error("Failed to get documents without content");
    }
  }

  // Pass the extractedData from the document to get the content in the above structure

  async getContentFromDocument(extractedData: string): Promise<string> {
    try {
      // Trim the extractedData and remove any empty strings
      extractedData = extractedData?.trim();

      if (!extractedData) {
        return "";
      }

      const MAX_TOKENS = 4096; // Example token limit for GPT-3.5-turbo
      const CHUNK_SIZE = 1000; // Adjust chunk size as needed

      // Function to split text into chunks
      const splitTextIntoChunks = (text: string, size: number): string[] => {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
          const chunk = text.slice(i, i + size).trim();
          if (chunk) {
            chunks.push(chunk);
          }
        }
        return chunks;
      };

      // Split extractedData if it exceeds the token limit
      const chunks =
        extractedData.length > MAX_TOKENS
          ? splitTextIntoChunks(extractedData, CHUNK_SIZE)
          : [extractedData];

      // Process each chunk and collect responses
      const responses = await Promise.all(
        chunks.map(async (chunk) => {
          const prompt = `Extract the patient details, encounters, and claims from the document below from each page and group them by page: ${chunk}`;
          const response = await this.openAiService.completeChat({
            context:
              "Extract the patient details, encounters, and claims from the document below:",
            prompt,
            model: "gpt-4o",
            temperature: 0.4,
          });
          return response;
        })
      );

      // Merge responses
      const mergedResponse = responses.join(" ");

      // Return merged content
      return mergedResponse;
    } catch (error) {
      throw new Error("Failed to get content from document");
    }
  }

  async getDocumentWithoutContent(limit: number = 1): Promise<any> {
    try {
      // Get document from the database that do not have content
      const documents = await DocumentModel.find({
        $or: [{ content: null }, { content: "" }],
        extractedData: { $ne: "" },
      })
        .limit(limit)
        .lean();

      if (!documents?.length) {
        return [];
      }

      // Extract content from each document
      const updatePromises = documents.map(async (document) => {
        const content = await this.getContentFromDocument(
          document.extractedData || ""
        );
        await DocumentModel.findByIdAndUpdate(document._id, {
          content: content,
        });
        return { ...document, content };
      });

      // Wait for all updates to complete
      const updatedDocuments = await Promise.all(updatePromises);

      // Return updated documents
      return updatedDocuments;
    } catch (error) {
      throw new Error("Failed to get document without content");
    }
  }

  async extractCaseDocumentWithoutContent(
    caseId: string,
    updateProgressFn: (caseId: string) => Promise<void>
  ): Promise<any> {
    try {
      // Get document from the database that do not have content
      const documents = await DocumentModel.find({
        $or: [{ content: null }, { content: "" }],
        extractedData: { $ne: "" },
        case: caseId,
      }).lean();

      if (!documents?.length) {
        return [];
      }

      // Extract content from each document
      const updatePromises = documents.map(async (document) => {
        const content = await this.getContentFromDocument(
          document.extractedData || ""
        );
        await DocumentModel.findByIdAndUpdate(document._id, {
          content: content,
          status: ExtractionStatus.SUCCESS,
          isCompleted: true,
        });
        await updateProgressFn(caseId);
        return { ...document, content };
      });

      // Wait for all updates to complete
      const updatedDocuments = await Promise.all(updatePromises);

      await updateProgressFn(caseId);

      // Return updated documents
      return updatedDocuments;
    } catch (error) {
      console.log("Error extracting case document without content:", error);
      return [];
    }
  }

  //delete document and related reports
  async deleteDocument(documentId: string): Promise<Document | null> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const deletedDocument = await DocumentModel.findByIdAndDelete(
        documentId,
        { session }
      ).lean();

      if (!deletedDocument) {
        throw new Error("Document not found");
      }

      // Delete related report cases
      const documentCase = await CaseModel.findById(
        deletedDocument.case as string
      ).lean();

      if (documentCase) {
        const updatedReports = documentCase.reports.filter(
          (rp) => rp.document !== deletedDocument._id
        );

        // Update case
        await CaseModel.findOneAndUpdate(
          { _id: deletedDocument.case },
          { reports: updatedReports },
          { new: true, session }
        ).lean();
      }

      await session.commitTransaction();
      session.endSession();

      return deletedDocument;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error deleting document:", error);
      throw new Error("Failed to delete document");
    }
  }

  //add document to case
  async addDocumentToCase(caseId: string, docs: string[]) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create a mutltiple document

      const results = await DocumentModel.insertMany(
        docs.map((doc) => ({ case: caseId, url: doc })),
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return results;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error adding document to case:", error);
      throw new Error("Failed to add document to case");
    }
  }

  async extractReportFromDocumentOCRJobId(jobId: string) {
    try {
      // Get combined document content
      const content = await this.getCombinedDocumentContent(jobId);

      if (!content) {
        throw new Error("No content extracted from document");
      }

      // Clean content with keywords
      const contentExtracts = await this.getContentFromDocument(content);

      if (!contentExtracts) {
        throw new Error("No content extracted from document");
      }

      return await this.processDocumentContent(contentExtracts);
    } catch (error) {
      console.log("Error extracting report from document:", error);
      return [];
    }
  }

  //extract report from document using document url
  async extractReportFromDocument(docUrl: string) {
    try {
      // Content of the document
      const content = await this.extractContentFromDocument(docUrl);

      if (!content) {
        throw new Error("No content extracted from document");
      }

      // Clean content with keywords
      const contentExtracts = await this.getContentFromDocument(content);

      if (!contentExtracts) {
        throw new Error("No content extracted from document");
      }

      const results = await this.processDocumentContent(contentExtracts);

      console.log(results);

      // Flatten the array of arrays into a single array
      return results;
    } catch (error) {
      console.error("Error extracting report from document:", error);
      throw new Error("Failed to extract report from document");
    }
  }

  async deleteAllCaseDocument(caseId: string) {
    const alldocs = await DocumentModel.find({ case: caseId }).lean();
    const alldocIds = alldocs.map((item) => item._id);
    await DocumentModel.deleteMany({ case: caseId });
    await TempPageDocumentModel.deleteMany({ document: { $in: alldocIds } });
    return true;
  }
}
