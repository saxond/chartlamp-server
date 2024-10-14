import { Types } from "mongoose";
import { CaseModel } from "../models/case.model"; // Ensure this path is correct
import { DocumentModel } from "../models/document.model";
import { Organization } from "../models/organization.model";
import { UserModel } from "../models/user.model";

export class CaseService {
  // Create a new case
  static async createCase(data: {
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
  static async getCaseById(id: Types.ObjectId) {
    const caseData = await CaseModel.findById(id).lean();
    if (!caseData) {
      return null;
    }

    const documents = await DocumentModel.find({ case: id }).lean();
    return { ...caseData, documents };
  }
  // Get all cases
  static async getAllCases() {
    return CaseModel.find().sort({ createdAt: -1 }).lean();
  }

  //get user cases
  static async getUserCases(userId: string) {
    return CaseModel.find({
      user: userId,
      $or: [{ isArchived: false }, { isArchived: null }, { isArchived: { $exists: false } }]
    }).sort({ createdAt: -1 }).lean();
  }

  //get user archived cases
  static async getArchivedCases(userId: string) {
    return CaseModel.find({ user: userId, isArchived: true }).sort({ createdAt: -1 }).lean();
  }

  // Update a case by ID
  static async updateCase(
    id: Types.ObjectId,
    updateData: Partial<typeof CaseModel>
  ) {
    return CaseModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }

  //archive a case
  static async archiveCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndUpdate(id, { isArchived: true }, { new: true }).lean();
  }

  //unarchive a case
  static async unarchiveCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndUpdate(id, { isArchived: false }, { new: true }).lean();
  }

  // Delete a case by ID
  static async deleteCase(id: Types.ObjectId) {
    return CaseModel.findByIdAndDelete(id).lean();
  }

  //get all documents for a case
  static async getDocumentsForCase(caseId: string): Promise<string> {
    try {

      // name of disease
      // amount spent/claim
      // provider name(not important)
      // doctor name(not important)
      // medical note(not important)
      // date of claim

      const documents = await DocumentModel.find({ case: caseId }).lean();

      if (!documents.length) {
        throw new Error("No documents found for the case");
      }
      // Concatenate content efficiently
      const content = documents.map(doc => doc.content).join('');

      return content;
    } catch (error) {
      console.error('Error getting documents for case:', error);
      throw new Error('Failed to get documents for case');
    }
  }
}
