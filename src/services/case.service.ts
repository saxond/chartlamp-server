import { Types } from "mongoose";
import { CaseModel } from "../models/case.model"; // Ensure this path is correct
import { DocumentModel } from "../models/document.model";
import { Organization } from "../models/organization.model";
import { UserModel } from "../models/user.model";
import OpenAIService from "./openai.service";

const MAX_TOKENS = 16385;

export class CaseService {

  private openAiService: OpenAIService;
  constructor() {
    this.openAiService = new OpenAIService(
      (process.env.OPENAI_API_KEY as string)
    );
  }

  // Create a new case
  async createCase(data: {
    caseNumber: string;
    plaintiff: string;
    dateOfClaim: Date;
    claimStatus: string;
    actionRequired: string;
    targetCompletion: Date;
    documents: string[];
    user: string;
  }) {
    const session = await CaseModel.startSession();
    session.startTransaction();
    try {
      const userWithOrganization = await UserModel.findById(data.user)
        .populate("organization")
        .lean();

      if (!userWithOrganization) {
        throw new Error("User not found");
      }

      if (!(userWithOrganization?.organization as Organization)?._id) {
        throw new Error("User does not belong to any organization");
      }

      const newCase = new CaseModel({
        ...data,
        organization: (userWithOrganization.organization as Organization)._id,
      });
      await newCase.save({ session });

      // Create documents
      const documentPromises = data.documents.map((doc) =>
        DocumentModel.create(
          [
            {
              case: newCase._id,
              url: doc,
            },
          ],
          { session }
        )
      );

      await Promise.all(documentPromises);

      await session.commitTransaction();
      return newCase;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Get a case by ID
  async getCaseById(id: Types.ObjectId) {

    const caseData = await CaseModel.findById(id)
      .populate('user', 'email name role profilePicture')
      .lean();

    if (!caseData) {
      return null;
    }

    if (!caseData.reports?.length) {
      await this.populateReportFromCaseDocuments(id);
    }

    const documents = await DocumentModel.find({ case: id }).lean();

    return { ...caseData, documents };
  }
  // Get all cases
  async getAllCases() {
    return CaseModel.find().sort({ createdAt: -1 }).lean();
  }

  //get user cases
  async getUserCases(userId: string) {
    return CaseModel.find({
      user: userId,
      $or: [{ isArchived: false }, { isArchived: null }, { isArchived: { $exists: false } }]
    }).sort({ createdAt: -1 }).lean();
  }

  //get user archived cases
  async getArchivedCases(userId: string) {
    return CaseModel.find({ user: userId, isArchived: true }).sort({ createdAt: -1 }).lean();
  }

  // Update a case by ID
  async updateCase(
    id: Types.ObjectId,
    updateData: Partial<typeof CaseModel>
  ) {
    return CaseModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }

  //archive a case
  async archiveCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndUpdate(id, { isArchived: true }, { new: true }).lean();
  }

  //unarchive a case
  async unarchiveCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndUpdate(id, { isArchived: false }, { new: true }).lean();
  }

  // Delete a case by ID
  async deleteCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndDelete(id).lean();
  }


  // Split content into chunks
  private splitContent(content: string, maxTokens: number): string[] {
    const chunks = [];
    let currentChunk = '';

    for (const word of content.split(' ')) {
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
    const jsonString = response.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
  }

  // Populate report from case documents
  async populateReportFromCaseDocuments(caseId: Types.ObjectId): Promise<any> {
    try {
      const documents = await DocumentModel.find({ case: caseId }).lean();

      if (!documents.length) {
        throw new Error("No documents found for the case");
      }

      const content = documents.map(doc => doc.content).join(' ');

      //remove empty strings and check if content is empty

      if (!content?.trim()) {
        return [];
      }

      const contentChunks = this.splitContent(content, MAX_TOKENS / 2); // Split content into smaller chunks

      const results = await Promise.all(contentChunks.map(async (chunk) => {
        const prompt = `Extract the following information from the document: Disease Name, Amount Spent, Provider Name, Doctor Name, Medical Note, Date of Claim in an array of object [{}] from the document content: ${chunk}`;

        const response = await this.openAiService.completeChat({
          context: "Extract the patient report from the document",
          prompt,
          model: "gpt-3.5-turbo",
          temperature: 0.4,
        });

        return this.cleanResponse(response);

      }));

      // Flatten the array of arrays into a single array
      const flattenedResults = results.flat();

      if (flattenedResults.length) {

        //create report objects from flattened results
        const reportObjects = flattenedResults.map((result) => {
          return {
            nameOfDisease: result['Disease Name'] || '',
            amountSpent: result['Amount Spent'] || 0,
            providerName: result['Provider Name'] || '',
            doctorName: result['Doctor Name'] || '',
            medicalNote: result['Medical Note'] || '',
            dateOfClaim: new Date(result['Date of Claim'])
          }
        });
        //update case and add reports
        await CaseModel.findOneAndUpdate({ _id: caseId }, { reports: reportObjects }, { new: true }).lean();
      }
      return flattenedResults;

    } catch (error) {
      throw new Error('Failed to populate report from case documents');
    }
  }
}
