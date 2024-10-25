import axios from 'axios';
import mongoose from 'mongoose';
import pdf from 'pdf-parse';
import { CaseModel } from '../models/case.model';
import { Document, DocumentModel } from '../models/document.model';
import OpenAIService from './openai.service';


export class DocumentService {
  private openAiService: OpenAIService;

  constructor() {
    this.openAiService = new OpenAIService(
      process.env.OPENAI_API_KEY as string
    );
  }
  // Extract content from the document that is in PDF format
  async extractContentFromDocument(documentUrl: string): Promise<string> {
    try {
      // Download PDF from URL (S3 URL)
      const response = await axios.get(documentUrl, {
        responseType: "arraybuffer",
      });
      const pdfBuffer = response.data;

      // Extract content from PDF
      const data = await pdf(pdfBuffer);
      const content = data.text;

      // Return content
      return content;
    } catch (error) {
      throw new Error("Failed to extract content from document");
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
        const content = await this.extractContentFromDocument(document.url);
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
            model: "gpt-3.5-turbo",
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

      console.log("extractCaseDocumentWithoutContent");

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
    doc: string
  ): Promise<Document | null> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create a new document
      const newDocument = new DocumentModel({
        url: doc,
        case: caseId,
      });

      await newDocument.save({ session });

      await session.commitTransaction();
      session.endSession();

      return newDocument;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error adding document to case:", error);
      throw new Error("Failed to add document to case");
    }
  }
}