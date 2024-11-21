import mongoose, { Types } from "mongoose";
import {
  CaseInvitationModel,
  CaseInvitationStatus,
  CaseModel,
  CronStatus,
} from "../models/case.model"; // Ensure this path is correct
import { Document, DocumentModel, ExtractionStatus } from "../models/document.model";
import { Organization } from "../models/organization.model";
import { UserModel } from "../models/user.model";
import { DiseaseClassificationService } from "./diseaseClassification.service";
import { DocumentService } from "./document.service";
import notificationService from "./notification.service";
import OpenAIService from "./openai.service";

const MAX_TOKENS = 16385;

export class CaseService {
  private openAiService: OpenAIService;
  private documentService: DocumentService;
  private diseaseClassificationService: DiseaseClassificationService;
  private notificationService = notificationService;
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
            async (code: string) => await dcService.getImagesByIcdCode(code)
          )
        );
        return { ...report, classification: bodyParts };
      })
    );
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
  async getUserCases({
    userId,
    query,
  }: {
    userId: string;
    query?: {
      claimStatus?: string;
    };
  }) {
    const invitedCases = await CaseInvitationModel.find({
      invitedUser: userId,
      // status: CaseInvitationStatus.ACCEPTED,
    }).lean();
    let invitedCaseIds = invitedCases.map((inv) => inv.case);
    const casesQuery: mongoose.FilterQuery<any> = {
      $and: [
        {
          $or: [{ user: userId }, { _id: { $in: invitedCaseIds } }],
        },
        {
          $or: [{ isArchived: false }, { isArchived: { $exists: false } }],
        },
      ],
    };

    if (query?.claimStatus) {
      casesQuery["claimStatus"] = query.claimStatus;
    }

    return CaseModel.find(casesQuery).sort({ createdAt: -1 }).lean();
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
    try {
      const jsonString = response.replace(/```json|```/g, "").trim();
      // IS THIS A VALID JSON STRING?
      return JSON.parse(jsonString);
     
    } catch (error) {
      console.log("Error parsing response:", error);
      
      return [];
    }
  }


  // Helper function to check if a report is valid
  private async isValidReport(report: any): Promise<boolean> {
    const hasValidDisease =
      report.nameOfDisease !== "Not provided" && report.nameOfDisease !== "N/A";
    const hasValidAmount =
      report.amountSpent !== "Not provided" &&
      !isNaN(Number(report.amountSpent)) &&
      Number(report.amountSpent) > 0;

    return hasValidDisease || hasValidAmount; // Keep if either disease or amount is valid
  }

  async combineDocumentAndRemoveDuplicates(data: any) {
    const combinedReports: any[] = [];

    // Group by document and dateOfClaim
    const groupedReports = data.reduce((acc: any, report: any) => {
      const key = `${report.document}-${report.dateOfClaim}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(report);
      return acc;
    }, {});

    // Process each group to merge entries
    for (const key in groupedReports) {
      const reports = groupedReports[key];

      // Only one report for this document-dateOfClaim pair, push it as is
      if (reports.length === 1) {
        const isValidReport = await this.isValidReport(reports[0]);
        if (isValidReport) {
          combinedReports.push(reports[0]);
        }
        continue;
      }

      // Merge multiple reports
      const mergedReport = reports.reduce(
        (acc: any, report: any) => {
          // ICD Codes - merge unique codes
          acc.icdCodes = Array.from(
            new Set([...(acc.icdCodes || []), ...(report.icdCodes || [])])
          );

          // Merge non-specified fields with specified ones from other records
          acc.nameOfDisease =
            acc.nameOfDisease !== "Not specified"
              ? acc.nameOfDisease
              : report.nameOfDisease;
          acc.amountSpent =
            acc.amountSpent !== "Not specified"
              ? acc.amountSpent
              : report.amountSpent;
          acc.providerName =
            acc.providerName !== 0 ? acc.providerName : report.providerName;
          acc.doctorName =
            acc.doctorName !== "Not specified"
              ? acc.doctorName
              : report.doctorName;
          acc.medicalNote =
            acc.medicalNote !== "Not specified"
              ? acc.medicalNote
              : report.medicalNote;
          acc.dateOfClaim = acc.dateOfClaim || report.dateOfClaim; // Date is already the same in this group

          return acc;
        },
        {
          document: reports[0].document,
          icdCodes: [],
          nameOfDisease: "Not specified",
          amountSpent: "Not specified",
          providerName: 0,
          doctorName: "Not specified",
          medicalNote: "Not specified",
          dateOfClaim: reports[0].dateOfClaim,
        }
      );

      // Only add merged report if it is valid
      const isValidReport = await this.isValidReport(mergedReport);
      if (isValidReport) {
        combinedReports.push(mergedReport);
      }
    }

    return combinedReports;
  }
  //create report from document 
  async generateReportForDocument(doc: Document) {
    const content = doc.content || "";
    if (!content.trim()) {
      return []; // Skip to the next document
    }

    const contentChunks = this.splitContent(content, MAX_TOKENS / 2); // Split content into smaller chunks

    const results = await Promise.all(
      contentChunks.map(async (chunk) => {
        const prompt = `Extract the following information from the document: Disease Name, Amount Spent, Provider Name, Doctor Name, Medical Note, Date in an array of object [{}] from the document content: ${chunk}`;

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
    return results
      .flat()
      .map((result) => ({ ...result, documentId: doc._id as string }))

  }

  // Update case reports
  async updateCaseReports(caseId: string, flattenedResults: any[]) {
    let reportObjects: any[] = [];
    if (flattenedResults.length) {
      // Create report objects from flattened results
      reportObjects = await Promise.all(
        flattenedResults.map(async (result) => {
          return {
            document: result.documentId,
            icdCodes:
              await this.diseaseClassificationService.getIcdCodeFromDescription(
                result["Disease Name"] + " " + result["Medical Note"]
              ),
            nameOfDisease: result["Disease Name"] || "",
            amountSpent:
              (await this.diseaseClassificationService.validateAmount(
                result["Amount Spent"] || ""
              )) || 0,
            providerName: result["Provider Name"] || "",
            doctorName: result["Doctor Name"] || "",
            medicalNote: result["Medical Note"] || "",
            dateOfClaim:
              await this.diseaseClassificationService.validateDateStr(
                result["Date"] || ""
              ),
          };
        })
      );

      // const noDuplicates = await this.combineDocumentAndRemoveDuplicates(
      //   reportObjects
      // );

      // Fetch existing reports
      const caseData = await CaseModel.findById(caseId).lean();
      const existingReports = caseData?.reports || [];

      // Combine existing reports with new reports
      const combinedReports = [...existingReports, ...reportObjects];

      // Update case and add reports
      await CaseModel.findOneAndUpdate(
        { _id: caseId },
        { reports: combinedReports },
        { new: true }
      ).lean();
    }
  }

  // Populate report from case documents
  async populateReportFromCaseDocuments(caseId: string): Promise<any> {
    try {
      const documents = await DocumentModel.find({ case: caseId }).lean();

      if (!documents.length) {
        return;
      }

      let flattenedResults: any[] = [];

      for (const doc of documents) {
        const results = await this.generateReportForDocument(doc);

        if (results.length) {
          flattenedResults = [
            ...flattenedResults,
            ...results
          ];
        }
        // Flatten the array of arrays into a single array
      }

      await this.updateCaseReports(caseId, flattenedResults);

      return flattenedResults;

    } catch (error) {
      console.log(error);
      throw new Error("Failed to populate report from case documents");
    }
  }

  //process case
  async processCase(caseId: string) {
    try {
      const extractCaseDocumentData =  await this.documentService.extractCaseDocumentData(caseId);
      console.log("extractCaseDocumentData", extractCaseDocumentData);
      const extractCaseDocumentWithoutContent = await this.documentService.extractCaseDocumentWithoutContent(caseId);
      console.log("extractCaseDocumentWithoutContent", extractCaseDocumentWithoutContent);
      const populateReportFromCaseDocuments = await this.populateReportFromCaseDocuments(caseId);
      console.log("populateReportFromCaseDocuments", populateReportFromCaseDocuments);
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

    console.log(`Processing case: ${caseItem?._id}`);

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
        { cronStatus: CronStatus.Processed },
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

  async shareCaseWithUsers({
    caseId,
    userIds,
  }: {
    caseId: string;
    userIds: string[];
  }) {
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const caseItem = await CaseModel.findById(caseId).lean();
    if (!caseItem) {
      throw new Error("Case not found");
    }

    for (const user of users) {
      const invitedAlready = await CaseInvitationModel.findOne({
        case: caseId,
        user: user._id,
      }).lean();
      if (!invitedAlready) {
        await CaseInvitationModel.create({
          case: caseId,
          invitedUser: user._id,
          caseNumber: caseItem.caseNumber,
        });
      } else {
        // if (invitedAlready.status !== CaseInvitationStatus.Accepted) {
        await CaseInvitationModel.findByIdAndUpdate(invitedAlready._id, {
          status: CaseInvitationStatus.Pending,
        });
        // } else continue;
      }
      const url = `${process.env.FRONTEND_URL}/dashboard/case/${caseId}/medicalHistory?view=detailsView`;
      await this.notificationService.sendEmail(
        user.email,
        "You have been invited to a case",
        "tht",
        `
  <p>Dear ${user.name},</p>
  <p>You have been invited to participate in a case with case number: <strong>${caseItem.caseNumber}</strong>.</p>
  <p>To view the case details and accept the invitation, please click the link below:</p>
  <p><a href="${url}" style="color: #007bff; text-decoration: none;">View Case</a></p>
  <p>Thank you,</p>
  <p>Chartlamp</p>
  `
      );
    }
  }

  //run ocr document extraction
  async runOcrDocumentExtraction() {
    try {
      // Find document with jobId and status PENDING
      const document = await DocumentModel.findOne({
        jobId: { $ne: null },
        status: ExtractionStatus.PENDING,
      }).lean();

      if (!document) {
        return [];
      }

      // Extract content from the document
      const content = await this.documentService.getCombinedDocumentContent(document.jobId!);

      // Update document with extracted content and status
      await DocumentModel.findByIdAndUpdate(document._id, {
        content,
        status: ExtractionStatus.SUCCESS,
      });

      // Generate report for the document
      const results = await this.generateReportForDocument(document);

      // Update case reports with the generated results
      await this.updateCaseReports(document.case as string, results);

      return results;
    } catch (error) {
      console.error("Error running OCR document extraction:", error);
      throw new Error("Failed to run OCR document extraction");
    }
  }
}
