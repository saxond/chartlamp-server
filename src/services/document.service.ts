import { FeatureType, GetDocumentAnalysisCommand, StartDocumentAnalysisCommand, TextractClient } from '@aws-sdk/client-textract';
import axios from "axios";
import mongoose from "mongoose";
import pdf from "pdf-parse";
import { CaseModel } from "../models/case.model";
import { Document, DocumentModel } from "../models/document.model";
import OpenAIService from "./openai.service";

const textractClient = new TextractClient({
  region: process.env.AWS_REGION as string || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string || "AKIAZ4JCCD46ATB2SB2V",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string || "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",
  },
});

export class DocumentService {
  private openAiService: OpenAIService;

  constructor() {
    this.openAiService = new OpenAIService(
      process.env.OPENAI_API_KEY as string
    );
  }


  async getBase64FromUrl(url: string): Promise<string> {
    try {
      // Download PDF from URL
      const response = await axios.get(url, {
        responseType: "arraybuffer",
      });

      // Convert PDF buffer to Base64
      const base64 = Buffer.from(response.data).toString('base64');

      return base64;
    } catch (error) {
      console.error("Error converting PDF to Base64:", error);
      throw new Error("Failed to convert PDF to Base64");
    }
  }


  async extractContentFromDocumentUsingTextract(documentUrl: string): Promise<string> {
    try {
      // Ensure the documentUrl is the S3 object key, not the full URL
      const s3ObjectKey = documentUrl.split('/').pop();

      // Call Amazon Textract to extract text from the PDF
      const params = {
        DocumentLocation: {
          S3Object: {
            Bucket: process.env.AWS_BUCKET_NAME as string || "chartlamp",
            Name: s3ObjectKey!,
          },
        },
        FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS, FeatureType.SIGNATURES],
      };

      //start document analysis
      const startDocumentAnalysisCommand = new StartDocumentAnalysisCommand(params);

      const { JobId } = await textractClient.send(startDocumentAnalysisCommand);

      return JobId || '';

    } catch (error) {
      // Log more detailed error information for debugging
      console.error("Textract error details:", JSON.stringify(error, null, 2));

      // Handle specific Textract exceptions
      if ((error as any).__type === 'UnsupportedDocumentException') {
        console.error("Unsupported document type:", error);
        throw new Error("Unsupported document type");
      } else {
        console.error("Error extracting content from document using Textract:", error);
        throw new Error("Failed to extract content from document using Textract");
      }
    }
  }

  //get document analysis output 
  async getDocumentAnalysisOutput(jobId: string, nextToken?: string): Promise<any> {
    try {
      const params = {
        JobId: jobId,
        MaxResults: 1000,
        NextToken: nextToken,
      };

      //get document analysis output
      const startDocumentAnalysisCommand = new GetDocumentAnalysisCommand(params);

      const response = await textractClient.send(startDocumentAnalysisCommand);

      return response;

    } catch (error) {
      console.error("Error getting document analysis output:", error);
      throw new Error("Failed to get document analysis output");
    }
  }

  // Extract content from the document that is in PDF format
  async extractContentFromDocument(documentUrl: string, documentId?: string): Promise<string> {
    try {
      // Download PDF from URL (S3 URL)
      const response = await axios.get(documentUrl, {
        responseType: "arraybuffer",
      });
      const pdfBuffer = response.data;

      // Extract content from PDF
      const data = await pdf(pdfBuffer);
      let content = data.text;

      //remove empty lines and trim
      content = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)
        .join("\n");

      //if the content is empty, try to extract using Textract
      if (!content) {
        content = await this.extractContentFromDocumentUsingTextract(documentUrl);
        // if documentId is provided, update the document with the jobId
        if (documentId) {
          await DocumentModel.findByIdAndUpdate(documentId, {
            jobId: content,
          });

          content = "";
        }
      }

      // Return content
      return content;
    } catch (error) {
      console.log("Error extracting content from document:", error);
      let content = await this.extractContentFromDocumentUsingTextract(documentUrl) || "";
      // if documentId is provided, update the document with the jobId
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
      let combinedContent = '';

      do {
        const response = await this.getDocumentAnalysisOutput(jobId, nextToken);
        const blocks = response.Blocks;

        if (blocks) {
          for (const block of blocks) {
            if (block.BlockType === 'LINE') {
              combinedContent += block.Text + '\n';
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
        const content = await this.extractContentFromDocument(document.url, document._id);
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

  async extractCaseDocumentData(caseId: string): Promise<any[]> {
    try {
      // Get documents from the database that do not have content extracted
      const documents = await DocumentModel.find({
        $or: [{ extractedData: null }, { extractedData: "" }],
        case: caseId,
      }).lean();

      if (!documents.length) {
        return [];
      }

      // Extract content from each document
      const updatePromises = documents.map(async (document) => {
        const content = await this.extractContentFromDocument(document.url);
        await DocumentModel.findByIdAndUpdate(document._id, {
          extractedData: content,
        });
        return { ...document, extractedData: content };
      });

      // Wait for all updates to complete
      const updatedDocuments = await Promise.all(updatePromises);

      console.log("extractCaseDocumentData");
      // Return updated documents
      return updatedDocuments;
    } catch (error) {
      throw new Error("Failed to get documents without content");
    }
  }

  // Pass the extractedData from the document to get the content in the above structure

  async getContentFromDocument(extractedData: string): Promise<any> {
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
      throw new Error("Failed to get document without content");
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
  async addDocumentToCase(
    caseId: string,
    docs: string[]
  ) {
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


}
