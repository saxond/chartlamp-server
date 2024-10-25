import mongoose, { Types } from "mongoose";
import { CaseModel, CronStatus } from "../models/case.model"; // Ensure this path is correct
import { DocumentModel } from "../models/document.model";
import { Organization } from "../models/organization.model";
import { UserModel } from "../models/user.model";
import { DiseaseClassificationService } from "./diseaseClassification.service";
import { DocumentService } from "./document.service";
import OpenAIService from "./openai.service";

const MAX_TOKENS = 16385;

export class CaseService {
  private openAiService: OpenAIService;
  private documentService: DocumentService;
  private diseaseClassificationService: DiseaseClassificationService;
  constructor() {
    this.openAiService = new OpenAIService(
      process.env.OPENAI_API_KEY as string
    );
    this.documentService = new DocumentService();
    this.diseaseClassificationService = new DiseaseClassificationService();
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
    const caseData = await CaseModel.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 }, lastViewed: new Date() },
      { new: true }
    )
      .populate("user", "email name role profilePicture")
      .lean();
    if (!caseData) {
      return null;
    }
    if (!caseData.reports?.length) {
      await this.populateReportFromCaseDocuments(id.toString());
    }

    const documents = await DocumentModel.find({ case: id }).lean();

    return { ...caseData, documents };
  }

  async getCaseByIdWithBodyParts(caseId: string) {
    const caseResponse = await this.getCaseById(new Types.ObjectId(caseId));
    if (!caseResponse?.reports) return null;

    const dcService = new DiseaseClassificationService();

    // Filter out reports without icdCodes before mapping
    const reportsWithIcdCodes = caseResponse.reports.filter(
      (report: any) => report.icdCodes && report.icdCodes.length > 0
    );

    // Use Promise.all to handle the async mapping for the filtered reports
    const newReports = await Promise.all(
      reportsWithIcdCodes.map(async (report: any) => {
        const bodyParts = await Promise.all(
          report.icdCodes.map(
            async (code: string) => await dcService.getImagesByIcdCodes(code)
          )
        );
        return { ...report, classification: bodyParts };
      })
    );

    console.log("getCaseByIdWithBodyParts", newReports);
    return { ...caseResponse, reports: newReports };
  }

  // Get all cases
  async getAllCases() {
    return CaseModel.find().sort({ createdAt: -1 }).lean();
  }

  async getUserStats(userId: string) {
    const response = await CaseModel.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $facet: {
          totalCases: [
            {
              $match: {
                claimStatus: "New",
              },
            },
            {
              $count: "total",
            },
          ],
          totalArchivedCases: [
            {
              $match: {
                isArchived: true,
              },
            },
            {
              $count: "total",
            },
          ],
          totalActiveCases: [
            {
              $match: {
                $or: [
                  { isArchived: false },
                  { isArchived: null },
                  { isArchived: { $exists: false } },
                ],
              },
            },
            {
              $count: "total",
            },
          ],
        },
      },
      {
        // Use $project to ensure that if no count is found, we return 0
        $project: {
          totalCases: {
            $ifNull: [{ $arrayElemAt: ["$totalCases.total", 0] }, 0], // Get the total count or default to 0
          },
          totalArchivedCases: {
            $ifNull: [{ $arrayElemAt: ["$totalArchivedCases.total", 0] }, 0],
          },
          totalActiveCases: {
            $ifNull: [{ $arrayElemAt: ["$totalActiveCases.total", 0] }, 0],
          },
        },
      },
    ]);
    return response[0];
  }

  // async getICD10Codes(description: string) promise<string[]> {

  //   const prompt = `Get the ICD-10 codes as a comma seperated string for the following description: ${description}. do not include the description in the response. just give the codes. e.g A00.0, B00.1`;

  //   const response = await this.openAiService.completeChat({
  //     context: "Get ICD-10 codes from description",
  //     prompt,
  //     model: "gpt-3.5-turbo",
  //     temperature: 0.4,
  //   });

  //   const jsonString = response.replace(/```json|```/g, "").trim();
  // }
  //get user cases
  async getUserCases(userId: string) {
    return CaseModel.find({
      user: userId,
      $or: [
        { isArchived: false },
        { isArchived: null },
        { isArchived: { $exists: false } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  //get user archived cases
  async getArchivedCases(userId: string) {
    return CaseModel.find({ user: userId, isArchived: true })
      .sort({ createdAt: -1 })
      .lean();
  }

  // Update a case by ID
  async updateCase(id: Types.ObjectId, updateData: Partial<typeof CaseModel>) {
    return CaseModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }

  //archive a case
  async archiveCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true }
    ).lean();
  }

  //unarchive a case
  async unarchiveCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndUpdate(
      id,
      { isArchived: false },
      { new: true }
    ).lean();
  }

  // Delete a case by ID
  async deleteCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndDelete(id).lean();
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
    const jsonString = response.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonString);
  }

  // Populate report from case documents
  async populateReportFromCaseDocuments(caseId: string): Promise<any> {
    try {
      const documents = await DocumentModel.find({ case: caseId }).lean();

      if (!documents.length) {
        return;
      }

      const content = documents.map((doc) => doc.content).join(" ");

      //remove empty strings and check if content is empty

      if (!content?.trim()) {
        return [];
      }

      const contentChunks = this.splitContent(content, MAX_TOKENS / 2); // Split content into smaller chunks

      const results = await Promise.all(
        contentChunks.map(async (chunk) => {
          const prompt = `Extract the following information from the document: Disease Name, Amount Spent, Provider Name, Doctor Name, Medical Note, Date of Claim in an array of object [{}] from the document content: ${chunk}`;

          const response = await this.openAiService.completeChat({
            context: "Extract the patient report from the document",
            prompt,
            model: "gpt-3.5-turbo",
            temperature: 0.4,
          });

          return this.cleanResponse(response);
        })
      );

      // Flatten the array of arrays into a single array
      const flattenedResults = results.flat();

      if (flattenedResults.length) {
        //create report objects from flattened results
        const reportObjects = flattenedResults.map(async (result) => {
          return {
            icdCodes:
              await this.diseaseClassificationService.getIcdCodeFromDescription(
                result["Disease Name"]
              ),
            nameOfDisease: result["Disease Name"] || "",
            amountSpent: result["Amount Spent"] || 0,
            providerName: result["Provider Name"] || "",
            doctorName: result["Doctor Name"] || "",
            medicalNote: result["Medical Note"] || "",
            dateOfClaim: result["Date of Claim"] || "",
          };
        });
        //update case and add reports
        await CaseModel.findOneAndUpdate(
          { _id: caseId },
          { reports: reportObjects },
          { new: true }
        ).lean();
      }
      return flattenedResults;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to populate report from case documents");
    }
  }

  //process case
  async processCase(caseId: string) {
    try {
      await this.documentService.extractCaseDocumentData(caseId);
      await this.documentService.extractCaseDocumentWithoutContent(caseId);
      await this.populateReportFromCaseDocuments(caseId);
    } catch (error) {
      console.error("Error processing case:", error);
    }
  }

  async processCases() {
    const caseItem = await CaseModel.findOneAndUpdate(
      {
        $or: [
          { cronStatus: CronStatus.Pending },
          { cronStatus: "" },
          { cronStatus: { $exists: false } }, // Matches undefined (i.e., field does not exist)
        ],
      },
      { cronStatus: CronStatus.Processing },
      { new: true }
    ).lean();

    if (!caseItem) {
      return;
    }

    try {
      // Process the case
      await this.processCase(caseItem._id);

      // Update to processed
      await CaseModel.findByIdAndUpdate(
        caseItem._id,
        { cronStatus: CronStatus.Processed },
        { new: true }
      );
    } catch (error) {
      // Handle error and revert status to pending if needed
      await CaseModel.findByIdAndUpdate(
        caseItem._id,
        { cronStatus: CronStatus.Pending },
        { new: true }
      );
      console.error("Error processing case:", error);
    }
  }

  async getReportsByUser(userId: string) {
    const reports = await CaseModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
        },
      },
      {
        $project: {
          reports: 1,
        },
      },
      {
        $unwind: "$reports",
      },
      {
        $replaceRoot: { newRoot: "$reports" },
      },
    ]);

    return reports;
  }

  // just return sample reports for now .. adjust later
  async getClaimRelatedReports(userId: string) {
    const reports = await CaseModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId), // Match cases by user ID
        },
      },
      {
        $project: {
          _id: 1, // Include the case ID in the projection
          caseNumber: 1, // Include caseNumber in the projection
          reports: 1, // Also include the reports array
        },
      },
      {
        $unwind: "$reports", // Unwind the reports array
      },
      {
        $addFields: {
          "reports.caseId": "$_id", // Add the original case ID to each report
          "reports.caseNumber": "$caseNumber", // Add the caseNumber to each report
        },
      },
      {
        $replaceRoot: { newRoot: "$reports" }, // Replace the root with the report object
      },
    ]);
    return reports;
  }

  async getMostVisitedCasesByUser(userId: string) {
    const mostVisitedCases = await CaseModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          caseNumber: 1, // Project caseNumber
          viewCount: 1, // Project viewCount for sorting
          "userDetails.name": 1, // Project user details
          "userDetails._id": 1,
          "userDetails.profilePicture": 1,
          reports: 1,
        },
      },
      {
        $sort: { viewCount: -1 }, // Sort by most visited (viewCount)
      },
      {
        $limit: 3, // Get the most visited case
      },
      {
        $project: {
          _id: 0, // Exclude the case ID
          userDetails: 1, // Return user details
          reports: 1,
          caseNumber: 1, // Return case number
        },
      },
    ]);

    return mostVisitedCases;
  }

  async getLastViewedCaseByUser(userId: string) {
    const lastViewedCase = await CaseModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          caseNumber: 1, // Project caseNumber
          lastViewed: 1, // Project lastViewed for sorting
          "userDetails.name": 1, // Project user details
          "userDetails._id": 1,
          "userDetails.profilePicture": 1,
          reports: 1,
        },
      },
      {
        $sort: { lastViewed: -1 }, // Sort by last viewed
      },
      {
        $limit: 1, // Get the last viewed case
      },
      {
        $project: {
          _id: 1,
          userDetails: 1,
          caseNumber: 1,
          reports: {
            $filter: {
              input: "$reports",
              as: "report",
              cond: { $gt: [{ $size: "$$report.icdCodes" }, 0] },
            },
          },
        },
      },
    ]);

    const allIcdCodes = lastViewedCase[0]?.reports
      ?.map((report: any) => report.icdCodes)
      ?.flat();
    const dcService = new DiseaseClassificationService();
    const classification = await dcService.getImagesByIcdCodes(allIcdCodes);

    return { ...lastViewedCase[0], classification };
  }

  async updateCaseReportTags({
    caseId,
    reportId,
    tags,
    isRemove,
  }: {
    caseId: string;
    reportId: string;
    tags: string[];
    isRemove: boolean;
  }) {
    if (!isRemove) {
      return CaseModel.findByIdAndUpdate(
        caseId,
        {
          $addToSet: {
            "reports.$[report].tags": { $each: tags },
          },
        },
        {
          arrayFilters: [{ "report._id": reportId }],
          new: true,
        }
      ).lean();
    } else {
      return CaseModel.findByIdAndUpdate(
        caseId,
        {
          $pull: {
            "reports.$[report].tags": { $in: tags },
          },
        },
        {
          arrayFilters: [{ "report._id": reportId }],
          new: true,
        }
      ).lean();
    }
  }

  async addComment({
    userId,
    caseId,
    reportId,
    comment,
  }: {
    caseId: string;
    reportId: string;
    userId: string;
    comment: string;
  }) {
    return CaseModel.findByIdAndUpdate(
      caseId,
      {
        $push: {
          "reports.$[report].comments": {
            user: userId,
            comment,
          },
        },
      },
      {
        arrayFilters: [{ "report._id": reportId }],
        new: true,
      }
    ).lean();
  }

  async getReportComments({
    userId,
    caseId,
    reportId,
  }: {
    caseId: string;
    reportId: string;
    userId: string;
  }) {
    return CaseModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(caseId),
        },
      },
      {
        $project: {
          reports: 1,
        },
      },
      {
        $unwind: "$reports",
      },
      {
        $match: {
          "reports._id": new Types.ObjectId(reportId),
        },
      },
      {
        $project: {
          comments: {
            $filter: {
              input: "$reports.comments",
              as: "comment",
              cond: { $eq: ["$$comment.user", userId] },
            },
          },
        },
      },
    ]);
  }

  async deleteReportFile(documentId: string) {
    return DocumentModel.findByIdAndDelete(documentId).lean();
  }
}
