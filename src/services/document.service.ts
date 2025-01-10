import {
  FeatureType,
  GetDocumentAnalysisCommand,
  StartDocumentAnalysisCommand,
} from "@aws-sdk/client-textract";
import axios from "axios";
import mongoose from "mongoose";
import { zodResponseFormat } from "openai/helpers/zod";
import pdf from "pdf-parse";
import { z } from "zod";
import { CaseModel } from "../models/case.model";
import { Document, DocumentModel } from "../models/document.model";
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
    const prompt = `Get the ICD 10 code for the following description: ${description}. Give the exact code no any added text after the ICD 10 code. For example, if the description is "Acute bronchitis due to coxsackievirus", the response should be J20.0. If there are multiple codes, provide all of them separated by commas. Do not fabricate the codes, only provide the exact codes. if none return empty string.`;

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
        return Array.from(
          new Set(
            response
              .split(",")
              .map((code: string) => code.trim())
              .filter((code: string) => code)
          )
        );
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
      amountSpent: z.string(),
      providerName: z.string(),
      doctorName: z.string(),
      medicalNote: z.string(),
      date: z.string(),
    });

    const prompt = `Here's the extracted document of a patient's medical record: ${chunk} I want you to process this text and provide me the information`;

    const response = await this.openAiService.completeChat({
      context: "Extract the patient report from the document",
      prompt,
      model: "gpt-4o",
      temperature: 0.4,
      response_format: zodResponseFormat(MedicalRecord, "report"),
    });

    return response;
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
        providerName: string;
        doctorName: string;
        medicalNote: string;
      };

      // Flatten the results array
      const flattenedResults = results.flat();

      // Create report objects from flattened results
      const reportObjects = await Promise.all(
        flattenedResults.map(async (result: ResultType) => {
          const amountSpent = await this.validateAmount(
            result.amountSpent || ""
          );
          const dateOfClaim = await this.validateDateStr(result.date || "");
          const nameOfDisease =
            typeof result.diseaseName === "string"
              ? result.diseaseName
              : Array.isArray(result.diseaseName)
              ? result.diseaseName.join(",")
              : "";
          const icdCodes = await this.getIcdCodeFromDescription(
            nameOfDisease + " " + result.medicalNote
          );

          const diseaseNameByIcdCode = await this.getStreamlinedDiseaseName({
            icdCodes,
            diseaseNames: nameOfDisease,
          });

          //check to make sure

          return {
            icdCodes,
            nameOfDisease: nameOfDisease || "",
            amountSpent: amountSpent || 0,
            providerName: result.providerName || "",
            doctorName: result.doctorName || "",
            medicalNote: result.medicalNote || "",
            dateOfClaim,
            nameOfDiseaseByIcdCode: diseaseNameByIcdCode,
          };
        })
      );

      return reportObjects;
    } catch (error) {
      console.log("Error processing document content:", error);
      return [];
    }
  }

  async getStreamlinedDiseaseName({
    icdCodes,
    diseaseNames,
  }: {
    icdCodes: string[];
    diseaseNames: string;
  }): Promise<
    {
      icdCode: string;
      nameOfDisease: string;
    }[]
  > {
    const IcdCodesToDiseaseName = z.object({
      data: z.array(
        z.object({
          icdCode: z.string(),
          nameOfDisease: z.string(),
        })
      ),
    });

    const prompt = `From this list of disease names: ${diseaseNames}, please match these disease names to their respective ICD codes: ${icdCodes.join(
      ","
    )}`;

    const response = await this.openAiService.completeChat({
      context: "Match icd codes with disease names",
      prompt,
      model: "gpt-4o",
      temperature: 0.4,
      response_format: zodResponseFormat(IcdCodesToDiseaseName, "report"),
    });

    if (!response?.data) return [];
    const diseaseNameByIcdCode = response.data.map((item: any) => ({
      icdCode: item.icdCode,
      nameOfDisease: item.nameOfDisease,
    }));
    return diseaseNameByIcdCode;
  }

  // Create report from document
  async generateReportForDocument(doc: Document): Promise<any[]> {
    try {
      const content = doc.content?.trim();
      if (!content) {
        return []; // Skip to the next document
      }

      const results = await this.processDocumentContent(content);

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

  //get document analysis output
  async getDocumentAnalysisOutput(
    jobId: string,
    nextToken?: string
  ): Promise<any> {
    try {
      const params = {
        JobId: jobId,
        MaxResults: 1000,
        NextToken: nextToken,
      };

      //get document analysis output
      const startDocumentAnalysisCommand = new GetDocumentAnalysisCommand(
        params
      );

      const response = await textractClient.send(startDocumentAnalysisCommand);

      return response;
    } catch (error) {
      console.error("Error getting document analysis output:", error);
      throw new Error("Failed to get document analysis output");
    }
  }

  // Extract content from the document that is in PDF format
  async extractContentFromDocument(
    documentUrl: string,
    documentId?: string
  ): Promise<string> {
    try {
      console.log("Document URL:", documentUrl);

      // Download PDF from URL (S3 URL)
      const response = await axios.get(documentUrl, {
        responseType: "arraybuffer",
      });
      const pdfBuffer = response.data;

      // Extract content from PDF
      const data = await pdf(pdfBuffer);
      let content = data.text;

      // Remove empty lines and trim
      content = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)
        .join("\n");

      // If the content is empty, try to extract using Textract
      if (!content) {
        content = await this.extractContentFromDocumentUsingTextract(
          documentUrl
        );
        // If documentId is provided, update the document with the jobId
        if (documentId) {
          await DocumentModel.findByIdAndUpdate(documentId, {
            jobId: content,
          });
          content = "";
        }
      }

      console.log("Content:", content);

      // Return content
      return content;
    } catch (error) {
      console.error("Error extracting content from document:", error);
      let content =
        (await this.extractContentFromDocumentUsingTextract(documentUrl)) || "";
      // If documentId is provided, update the document with the jobId
      if (documentId) {
        await DocumentModel.findByIdAndUpdate(documentId, {
          jobId: content,
        });
        content = "";
      }
      return content;
    }
  }

  //get combine document content using jobId
  async getCombinedDocumentContent(jobId: string): Promise<string> {
    try {
      let nextToken;
      let combinedContent = "";

      do {
        const response = await this.getDocumentAnalysisOutput(jobId, nextToken);
        const blocks = response.Blocks;

        if (blocks) {
          for (const block of blocks) {
            if (block.BlockType === "LINE") {
              combinedContent += block.Text + "\n";
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);

      return combinedContent;
    } catch (error) {
      console.error("Error getting combined document content:", error);
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

  async extractCaseDocumentData(caseId: string): Promise<any> {
    try {
      // Get documents from the database that do not have content extracted
      const documents = await DocumentModel.find({
        $or: [{ extractedData: null }, { extractedData: "" }],
        case: caseId,
      }).lean();

      if (!documents.length) {
        return [];
      }

      let hasError = false;

      // Extract content from each document
      const updatePromises = documents.map(async (document) => {
        const content = await this.extractContentFromDocument(
          document.url,
          document._id
        );
        if (!content) {
          hasError = true;
        }
        await DocumentModel.findByIdAndUpdate(document._id, {
          extractedData: content,
        });
        return { ...document, extractedData: content };
      });

      // Wait for all updates to complete
      const updatedDocuments = await Promise.all(updatePromises);
      // Return updated documents
      return {extractCaseDocumentData: updatedDocuments, hasError};
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
          const prompt = `Extract the patient details, encounters, and claims from the document below: ${chunk}`;
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

  async extractCaseDocumentWithoutContent(caseId: string): Promise<any> {
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
        });
        return { ...document, content };
      });

      // Wait for all updates to complete
      const updatedDocuments = await Promise.all(updatePromises);

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
}
