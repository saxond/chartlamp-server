import { Types } from 'mongoose';
import { CaseModel } from '../models/case.model'; // Ensure this path is correct
import { DocumentModel } from '../models/document.model';
import { UserModel } from '../models/user.model';

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
            const userWithOrganization = await UserModel.findById(data.user).populate('organization').lean();

            if (!userWithOrganization) {
                throw new Error('User not found');
            }

            if (!userWithOrganization.organization) {
                throw new Error('User does not belong to any organization');
            }

            const newCase = new CaseModel({
                ...data,
                organization: userWithOrganization.organization._id,
            });
            await newCase.save({ session });

            // Create documents
            const documentPromises = data.documents.map((doc) =>
                DocumentModel.create(
                    [
                        {
                            case: newCase._id,
                            url: doc,
                            content: '',
                            extractedData: '',
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
        return CaseModel.findById(id).lean();
    }

    // Get all cases
    static async getAllCases() {
        return CaseModel.find().lean();
    }

    // Update a case by ID
    static async updateCase(id: Types.ObjectId, updateData: Partial<typeof CaseModel>) {
        return CaseModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
    }

    // Delete a case by ID
    static async deleteCase(id: Types.ObjectId) {
        return CaseModel.findByIdAndDelete(id).lean();
    }
}