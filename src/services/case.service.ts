import mongoose, { Types } from "mongoose";
import {
  CaseInvitationModel,
  CaseInvitationStatus,
  CaseModel,
  CaseNoteModel,
  CaseTagModel,
  CommentModel,
  CronStatus,
  DiseaseClassificationTagMappingModel,
} from "../models/case.model"; // Ensure this path is correct
import { DocumentModel, ExtractionStatus } from "../models/document.model";
import { Organization } from "../models/organization.model";
import { UserModel } from "../models/user.model";
// import { redis } from "../utils/redis";
import { addIcdcodeClassificationBackgroundJob } from "../utils/queue/producer";
import { DiseaseClassificationService } from "./diseaseClassification.service";
import { DocumentService } from "./document.service";
import notificationService from "./notification.service";
import OpenAIService from "./openai.service";

export class CaseService {
  private documentService: DocumentService;
  private dcService: DiseaseClassificationService;
  private notificationService = notificationService;
  private openAiService: OpenAIService;

  constructor() {
    this.documentService = new DocumentService();
    this.dcService = new DiseaseClassificationService();
    this.openAiService = new OpenAIService(
      process.env.OPENAI_API_KEY as string
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
        env: process.env.NODE_ENV,
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
    const caseData = await CaseModel.findById(id, { "reports.chunk": 0 })
      .lean()
      .populate("user", "email name role profilePicture");
    // .populate("tags");
    if (!caseData) {
      return null;
    }
    if (!caseData.reports?.length) {
      await this.populateReportFromCaseDocuments(id.toString());
    }

    const documents = await DocumentModel.find(
      { case: id },
      "case url createdAt"
    ).lean();

    return { ...caseData, documents };
  }

  async getCaseByIdWithBodyParts(caseId: string) {
    const caseResponse = await this.getCaseById(new Types.ObjectId(caseId));
    if (!caseResponse?.reports) return null;

    // Filter out reports without icdCodes before mapping
    const reportsWithIcdCodes = caseResponse.reports.filter(
      (report: any) => report.icdCodes && report.icdCodes.length > 0
    );

    const newReports = await Promise.all(
      reportsWithIcdCodes.map(async (report: any) => {
        const bodyParts = await this.dcService.getImagesByIcdCodesTwo(
          report.icdCodes,
          report._id
        );
        // console.log("bodyParts", bodyParts);

        // Flatten the array if needed, and ensure we keep the structure
        return {
          ...report,
          classification: bodyParts.flat(), // Flatten to avoid nested arrays
        };
      })
    );

    return { ...caseResponse, reports: newReports };
  }

  async cacheCaseData(caseId: string) {
    const response = await this.getCaseByIdWithBodyParts(caseId);
    // await redis.set(caseId, JSON.stringify(response), "EX", CACHE_TTL);
    // console.log(`case ${caseId} has been cached successfully`);
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

  async getUserCases({
    userId,
    query,
  }: {
    userId: string;
    query?: {
      claimStatus?: string;
    };
  }) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new Error("User not found");
    console.log("role", user.role);
    if (user.role === "admin") {
      const adminQuery: mongoose.FilterQuery<any> = {};

      if (query?.claimStatus) {
        adminQuery["claimStatus"] = query.claimStatus;
      }

      return CaseModel.find(
        adminQuery,
        "caseNumber plaintiff dateOfClaim claimStatus actionRequired targetCompletion viewCount user isArchived isFavorite cronStatus"
      )
        .populate("user", "name profilePicture")
        .sort({ createdAt: -1 })
        .lean();
    } else {
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
        ],
      };

      if (query?.claimStatus) {
        casesQuery["claimStatus"] = query.claimStatus;
      }

      return CaseModel.find(casesQuery).sort({ createdAt: -1 }).lean();
    }
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
    await CaseModel.findByIdAndDelete(id).lean();
    await this.documentService.deleteAllCaseDocument(id.toString());
    return true;
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

  //remove duplicates based on icdcodes and combine reports
  async removeDuplicateReports(data: any) {
    // If all the items in icdCodes are the same, then remove the duplicate
    const uniqueReports = data.filter(
      (report: any, index: number, self: any) => {
        if (!report.icdCodes) return false;
        const icdCodes = report.icdCodes.sort().toString();
        const foundIndex = self.findIndex(
          (r: any) => r.icdCodes.sort().toString() === icdCodes
        );
        return foundIndex === index;
      }
    );

    return uniqueReports;
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

  // Update case reports
  async updateCaseReports(caseId: string, flattenedResults: any[]) {
    if (flattenedResults.length) {
      // Fetch existing reports
      const caseData = await CaseModel.findById(caseId).lean();
      const existingReports = caseData?.reports || [];

      // Combine existing reports with new reports
      const combinedReports = [...existingReports, ...flattenedResults];

      const distinctReports = await this.removeDuplicateReports(
        combinedReports
      );

      // Update case and add reports
      await CaseModel.findOneAndUpdate(
        { _id: caseId },
        { reports: distinctReports },
        { new: true }
      ).lean();
      return distinctReports;
    }
  }

  // Populate report from case documents
  async populateReportFromCaseDocuments(caseId: string): Promise<any> {
    try {
      const documents = await DocumentModel.find({ case: caseId }).lean();

      if (!documents.length) {
        return [];
      }

      const flattenedResults = (
        await Promise.all(
          documents.map((doc) =>
            this.documentService.generateReportForDocument(doc)
          )
        )
      ).flat();

      if (flattenedResults.length) {
        await this.updateCaseReports(caseId, flattenedResults);
      }

      return flattenedResults;
    } catch (error) {
      console.error("Error populating report from case documents:", error);
      throw new Error("Failed to populate report from case documents");
    }
  }

  //process case
  async processCase(caseId: string) {
    try {
      console.log("processCase... ⌛");
      const reponse = await this.documentService.extractCaseDocumentData(
        caseId
      );
      console.log("extractCaseDocumentData... ✅");
      await this.documentService.extractCaseDocumentWithoutContent(caseId);
      console.log("extractCaseDocumentWithoutContent... ✅");
      await this.populateReportFromCaseDocuments(caseId);
      console.log("populateReportFromCaseDocuments... ✅");
      return reponse?.hasError || false;
    } catch (error) {
      console.error("Error processing case:", error);
    }
  }

  async processCases() {
    const caseItem = await CaseModel.findOne({
      $or: [
        { cronStatus: CronStatus.Pending },
        { cronStatus: "" },
        { cronStatus: { $exists: false } },
      ],
      env: process.env.NODE_ENV,
    });

    if (!caseItem) {
      console.log("no case to process");
      return null;
    }

    console.log(`Processing case: ${caseItem?._id}`);

    try {
      // Process the case
      caseItem.cronStatus = CronStatus.Processing;
      await caseItem.save();
      const hasError = await this.processCase(caseItem._id);
      console.log(`Processed case: ${caseItem?._id}`, { hasError });
      if (!hasError) {
        const pendingOcrDoc = await this.getPendingDocumentToProcess(
          caseItem?._id
        );
        if (!pendingOcrDoc) {
          // Update to processed
          await CaseModel.findByIdAndUpdate(
            caseItem._id,
            { cronStatus: CronStatus.Processed },
            { new: true }
          );
        }
      }
    } catch (error) {
      // Handle error and revert status to pending if needed
      await CaseModel.findByIdAndUpdate(
        caseItem._id,
        { cronStatus: CronStatus.Pending },
        { new: true }
      );
      console.log("Error processing case:", error);
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
    const claimTag = await CaseTagModel.findOne({
      case: { $exists: false },
      tagName: "Claim Related",
    }).lean();
    console.log("getClaimRelatedReports", claimTag);
    if (!claimTag) {
      return [];
    }
    return DiseaseClassificationTagMappingModel.aggregate([
      {
        $match: {
          caseTag: claimTag._id, // Match only claim-related cases
        },
      },
      {
        $lookup: {
          from: "cases",
          let: { caseId: { $toObjectId: "$case" }, reportId: "$report" }, // Pass case ID & report ID
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$caseId"] }, // Match case ID
                    { $eq: ["$user", new Types.ObjectId(userId)] }, // Match user ID
                  ],
                },
              },
            },
            { $project: { _id: 1, caseNumber: 1, reports: 1 } }, // Keep only required fields
            { $unwind: "$reports" }, // Unwind reports array to process each report separately
            {
              $match: {
                $expr: { $eq: ["$reports._id", "$$reportId"] }, // Match report ID
              },
            },
          ],
          as: "caseDetails",
        },
      },
      {
        $unwind: {
          path: "$caseDetails",
          preserveNullAndEmptyArrays: true, // Retain cases even if they have no matching reports
        },
      },
      {
        $project: {
          case: "$caseDetails._id",
          caseNumber: "$caseDetails.caseNumber",
          report: "$caseDetails.reports._id",
          nameOfDisease: "$caseDetails.reports.nameOfDisease",
          amountSpent: "$caseDetails.reports.amountSpent",
          icdCode: 1,
          // providerName: "$caseDetails.reports.providerName",
          // doctorName: "$caseDetails.reports.doctorName",
          // medicalNote: "$caseDetails.reports.medicalNote",
          // dateOfClaim: "$caseDetails.reports.dateOfClaim",
          // icdCodes: "$caseDetails.reports.icdCodes",
          // document: "$caseDetails.reports.document",
        },
      },
      {
        $match: {
          caseNumber: { $exists: true, $ne: "" }, // Ensure caseNumber is not null or empty
        },
      },
      {
        $sample: { size: 3 }, // Randomly pick 1 document
      },
    ]);
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
    caseTagId,
    isRemove,
    ...rest
  }: {
    caseId: string;
    reportId: string;
    caseTagId: string;
    isRemove: boolean;
    dc?: string;
    icdCode?: string;
  }) {
    if (!isRemove) {
      return DiseaseClassificationTagMappingModel.findOneAndUpdate(
        {
          caseTag: caseTagId,
          report: reportId,
          case: caseId,
          ...(rest.dc && { dc: rest.dc }),
          ...(rest.icdCode && { icdCode: rest.icdCode }),
        },
        {},
        { upsert: true }
      );
    } else {
      return DiseaseClassificationTagMappingModel.findOneAndDelete({
        caseTag: caseTagId,
        report: reportId,
        case: caseId,
        ...(rest.dc && { dc: rest.dc }),
        ...(rest.icdCode && { icdCode: rest.icdCode }),
      }).lean();
    }
  }

  async updateCaseReportMultipleTags(
    inputData: {
      case: string;
      report: string;
      caseTag: string;
      isRemove: boolean;
      dc?: string;
      icdCode?: string;
    }[]
  ) {
    await Promise.all(
      inputData.map(async (input) => {
        if (!input.isRemove) {
          return DiseaseClassificationTagMappingModel.findOneAndUpdate(
            {
              caseTag: input.caseTag,
              report: input.report,
              case: input.case,
              ...(input.dc && { dc: input.dc }),
              ...(input.icdCode && { icdCode: input.icdCode }),
            },
            {},
            { upsert: true }
          );
        } else {
          return DiseaseClassificationTagMappingModel.findOneAndDelete({
            caseTag: input.caseTag,
            report: input.report,
            case: input.case,
            ...(input.dc && { dc: input.dc }),
            ...(input.icdCode && { icdCode: input.icdCode }),
          }).lean();
        }
      })
    );
    return true;
  }

  async getDcTagMapping({
    reportId,
    caseId,
    ...rest
  }: {
    reportId: string;
    caseId: string;
    dc?: string;
    icdCode?: string;
  }) {
    console.log("test", {
      report: reportId,
      case: caseId,
      ...(rest.dc && { dc: rest.dc }),
      ...(rest.icdCode && { icdCode: rest }),
    });
    return DiseaseClassificationTagMappingModel.find({
      report: reportId,
      case: caseId,
      ...(rest.dc && { dc: rest.dc }),
      ...(rest.icdCode && { icdCode: rest.icdCode }),
    }).lean();
  }

  async getCaseDcTagMapping({ caseId }: { caseId: string }) {
    return DiseaseClassificationTagMappingModel.find({
      case: caseId,
    }).lean();
  }

  async getReportsByDcTagMapping({
    caseTagId,
    dc,
    caseId,
  }: {
    caseTagId: string;
    dc: string;
    caseId: string;
  }) {
    return DiseaseClassificationTagMappingModel.find(
      {
        caseTag: caseTagId,
        case: caseId,
        dc,
      },
      "report"
    ).lean();
  }

  async getReportsByTagMapping({
    caseTagId,
    caseId,
  }: {
    caseTagId: string;
    caseId: string;
  }) {
    return DiseaseClassificationTagMappingModel.find({
      caseTag: caseTagId,
      case: caseId,
    }).lean();
  }

  async updateCaseNote({
    caseId,
    noteId,
    userId,
    note,
  }: {
    caseId: string;
    noteId: string;
    userId: string;
    note: string;
  }) {
    return CaseNoteModel.findOneAndUpdate(
      {
        case: caseId,
        user: userId,
        _id: noteId,
      },
      {
        note,
      },
      { new: true }
    );
  }

  async deleteNote({
    caseId,
    noteId,
    userId,
  }: {
    caseId: string;
    noteId: string;
    userId: string;
  }) {
    return CaseNoteModel.findOneAndDelete({
      case: caseId,
      user: userId,
      _id: noteId,
    }).lean();
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
    return CommentModel.create({
      user: userId,
      comment,
      report: reportId,
    });

    // return CaseModel.findByIdAndUpdate(
    //   caseId,
    //   {
    //     $push: {
    //       "reports.$[report].comments": {
    //         user: userId,
    //         comment,
    //         createdAt: new Date()
    //       },
    //     },
    //   },
    //   {
    //     arrayFilters: [{ "report._id": reportId }],
    //     new: true,
    //   }
    // ).lean();
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
    return CommentModel.find({
      report: reportId,
      user: userId,
    })
      .lean()
      .populate("user", "profilePicture");
    // return CaseModel.aggregate([
    //   {
    //     $match: {
    //       _id: new Types.ObjectId(caseId),
    //     },
    //   },
    //   {
    //     $project: {
    //       reports: 1,
    //     },
    //   },
    //   {
    //     $unwind: "$reports",
    //   },
    //   {
    //     $match: {
    //       "reports._id": new Types.ObjectId(reportId),
    //     },
    //   },
    //   {
    //     $project: {
    //       comments: {
    //         $filter: {
    //           input: "$reports.comments",
    //           as: "comment",
    //           cond: { $eq: ["$$comment.user", userId] },
    //         },
    //       },
    //     },
    //   },
    // ]);
  }

  async updateComment({
    commentId,
    comment,
  }: {
    commentId: string;
    comment: string;
  }) {
    return CommentModel.findByIdAndUpdate(commentId, {
      comment,
      isEdited: true,
    });
  }

  async updateFavoriteStatus({
    caseId,
    isFavorite,
  }: {
    caseId: string;
    isFavorite: boolean;
  }) {
    return CaseModel.findByIdAndUpdate(
      caseId,
      {
        isFavorite,
      },
      { new: true }
    );
  }

  async getAllFavoriteCases(userId: string) {
    const favoriteCases = await CaseModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          // isFavorite: true,
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
        $sort: { updatedAt: -1 },
      },
      {
        $project: {
          _id: 1,
          caseNumber: 1, // Project caseNumber
          "userDetails.name": 1, // Project user details
          "userDetails._id": 1,
          "userDetails.profilePicture": 1,
          reports: 1,
        },
      },

      {
        $limit: 3, // Get the most visited case
      },
      {
        $project: {
          _id: 1, // Exclude the case ID
          userDetails: 1, // Return user details
          reports: 1,
          caseNumber: 1, // Return case number
        },
      },
    ]);
    // console.log("favoriteCases", favoriteCases);

    return favoriteCases;
  }

  async updateArchiveStatus({
    caseId,
    isArchived,
  }: {
    caseId: string;
    isArchived: boolean;
  }) {
    return CaseModel.findByIdAndUpdate(
      caseId,
      {
        isArchived,
      },
      { new: true }
    );
  }

  async updateClaimStatus({
    caseId,
    claimStatus,
  }: {
    caseId: string;
    claimStatus: boolean;
  }) {
    return CaseModel.findByIdAndUpdate(
      caseId,
      {
        claimStatus,
      },
      { new: true }
    );
  }

  async updateTargetCompletion({
    caseId,
    targetCompletion,
  }: {
    caseId: string;
    targetCompletion: Date;
  }) {
    return CaseModel.findByIdAndUpdate(
      caseId,
      {
        targetCompletion,
      },
      { new: true }
    );
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
        `<p>Dear ${user.name},</p>
          <p>You have been invited to participate in a case with case number: <strong>${caseItem.caseNumber}</strong>.</p>
          <p>To view the case details and accept the invitation, please click the link below:</p>
          <p><a href="${url}" style="color: #007bff; text-decoration: none;">View Case</a></p>
          <p>Thank you,</p>
          <p>Chartlamp</p>
        `
      );
    }
  }

  async getPendingDocumentToProcess(caseId: string) {
    try {
      const document = await DocumentModel.findOne({
        $or: [
          {
            status: ExtractionStatus.PENDING,
          },
          {
            content: null,
          },
          {
            content: "",
          },
          {
            isCompleted: false,
          },
        ],
        case: caseId,
      }).lean();

      if (!document) {
        console.log("No document found for OCR extraction");
        return null;
      }
      return document;
    } catch (e) {
      return null;
    }
  }

  async checkOcrExtractionStatus(jobId: string) {
    const document = await DocumentModel.findOne({ jobId }).lean();
    if (!document) return null;
    // Extract content from the document
    console.log("getCombinedDocumentContent...");
    const content = await this.documentService.getCombinedDocumentContent(
      document.jobId!
    );

    if (!content) {
      console.log("No ocr content...");

      return null;
    }

    // Update document with extracted content and status
    const updatedDoc = await DocumentModel.findByIdAndUpdate(
      document._id,
      {
        content,
        status: ExtractionStatus.SUCCESS,
      },
      {
        new: true,
      }
    );

    if (!updatedDoc) return null;

    // Generate report for the document and update case reports
    console.log("generateReportForDocument...");
    const results = await this.documentService.generateReportForDocument(
      updatedDoc
    );

    if (results.length) {
      updatedDoc.isCompleted = true;
      await updatedDoc.save();
    }

    console.log("updateCaseReports...");
    await this.updateCaseReports(document.case as string, results);

    const pendingCaseDoc = await this.getPendingDocumentToProcess(
      document.case as string
    );

    if (!pendingCaseDoc) {
      const updatedCase = await CaseModel.findByIdAndUpdate(
        document.case,
        {
          cronStatus: CronStatus.Processed,
        },
        { new: true }
      );
      console.log("Ocr Case Extraction Reports =>", updatedCase?.reports);
    }
    return results;
  }

  //run ocr document extraction
  async runOcrDocumentExtraction(docId: string) {
    try {
      // Find document with jobId and status PENDING
      const document = await DocumentModel.findById(docId).lean();

      if (!document) {
        console.log("No document found for OCR extraction");
        return [];
      }

      console.log(
        "Running OCR document extraction for document:",
        document._id
      );

      // Extract content from the document
      const results = await this.checkOcrExtractionStatus(document.jobId!);

      return results;
    } catch (error) {
      console.error("Error running OCR document extraction:", error);
      throw new Error("Failed to run OCR document extraction");
    }
  }

  async queueIcdcodeCls({
    icdCodes,
    diseaseNames,
    caseId,
    reportId,
  }: {
    icdCodes: string[];
    diseaseNames: string;
    caseId: string;
    reportId: string;
  }) {
    await addIcdcodeClassificationBackgroundJob("icdcode-cls", {
      caseId,
      reportId,
      icdCodes,
      diseaseNames,
    });
    return true;
  }

  async getStreamlinedDiseaseName({
    icdCodes,
    diseaseNames,
    caseId,
    reportId,
  }: {
    icdCodes: string[];
    diseaseNames: string;
    caseId: string;
    reportId: string;
  }) {
    const caseList = await CaseModel.findById(caseId);
    if (!caseList) return null;
    const reportToUpdateIndex = caseList.reports.findIndex(
      (report: any) => report?._id.toString() === reportId
    );
    console.log("reportToUpdateIndex", reportToUpdateIndex);

    if (reportToUpdateIndex < 0) return null;
    const report = caseList.reports[reportToUpdateIndex];
    if (!report) return null;

    console.log("reportToUpdateIndex 2", report?._id);

    const diseaseNameByIcdCode =
      await this.documentService.getStreamlinedDiseaseName({
        icdCodes: icdCodes.reverse(),
        diseaseNames,
        chunk: report?.chunk || "",
      });

    console.log("reportToUpdateIndex 3", diseaseNameByIcdCode);
    const nameOfDiseaseByIcdCode = report.nameOfDiseaseByIcdCode || [];

    const existingIcdCodes = new Set(
      nameOfDiseaseByIcdCode.map((d) => d.icdCode)
    );

    // Merge and filter so that only new items with unique icdCodes are added
    const mergedDiseaseNameByIcdCode = [
      ...nameOfDiseaseByIcdCode,
      ...diseaseNameByIcdCode.filter(
        (newItem) => !existingIcdCodes.has(newItem.icdCode)
      ),
    ];

    caseList.reports[reportToUpdateIndex].nameOfDiseaseByIcdCode =
      mergedDiseaseNameByIcdCode;
    await caseList.save();

    return mergedDiseaseNameByIcdCode;
  }

  async createCaseTag({
    caseId,
    tagName,
  }: {
    caseId: string;
    tagName: string;
  }) {
    return CaseTagModel.findOneAndUpdate(
      { tagName, case: caseId },
      {},
      { upsert: true }
    );
  }

  async createCaseNote({
    caseId,
    userId,
    note,
  }: {
    caseId: string;
    userId: string;
    note: string;
  }) {
    return CaseNoteModel.findOneAndUpdate(
      { note, case: caseId, user: userId },
      {},
      { upsert: true }
    );
  }

  async getCaseTags({ caseId }: { caseId: string }) {
    return CaseTagModel.find({
      $or: [
        { case: caseId },
        {
          case: { $exists: false },
        },
      ],
    }).lean();
  }

  async getCaseNotes({ caseId }: { caseId: string }) {
    return CaseNoteModel.find({ case: caseId })
      .lean()
      .populate("user", "_id name profilePicture")
      .sort({ updatedAt: -1 });
  }
}
