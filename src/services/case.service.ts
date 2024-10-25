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

  // Helper function to check if a report is valid
  private async isValidReport(report: any): Promise<boolean> {
    const hasValidDisease = report.nameOfDisease !== 'Not provided' && report.nameOfDisease !== 'N/A';
    const hasValidAmount = report.amountSpent !== 'Not provided' && !isNaN(Number(report.amountSpent)) && Number(report.amountSpent) > 0;

    return hasValidDisease || hasValidAmount;  // Keep if either disease or amount is valid
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
      const mergedReport = reports.reduce((acc: any, report: any) => {
        // ICD Codes - merge unique codes
        acc.icdCodes = Array.from(new Set([...(acc.icdCodes || []), ...(report.icdCodes || [])]));

        // Merge non-specified fields with specified ones from other records
        acc.nameOfDisease = acc.nameOfDisease !== 'Not specified' ? acc.nameOfDisease : report.nameOfDisease;
        acc.amountSpent = acc.amountSpent !== 'Not specified' ? acc.amountSpent : report.amountSpent;
        acc.providerName = acc.providerName !== 0 ? acc.providerName : report.providerName;
        acc.doctorName = acc.doctorName !== 'Not specified' ? acc.doctorName : report.doctorName;
        acc.medicalNote = acc.medicalNote !== 'Not specified' ? acc.medicalNote : report.medicalNote;
        acc.dateOfClaim = acc.dateOfClaim || report.dateOfClaim;  // Date is already the same in this group

        return acc;
      }, {
        document: reports[0].document,
        icdCodes: [],
        nameOfDisease: 'Not specified',
        amountSpent: 'Not specified',
        providerName: 0,
        doctorName: 'Not specified',
        medicalNote: 'Not specified',
        dateOfClaim: reports[0].dateOfClaim,
      });

      // Only add merged report if it is valid
      const isValidReport = await this.isValidReport(mergedReport);
      if (isValidReport) {
        combinedReports.push(mergedReport);
      }
    }

    return combinedReports;
  }


  // async combineDocumentAndRemoveDuplicates(data: any) {

  //   const reportObjects  = [
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990b'),
  //       icdCodes: [ 'V89.2', 'V89.9' ],
  //       nameOfDisease: 'Injuries from an accident',
  //       amountSpent: 'Not provided',
  //       providerName: 0,
  //       doctorName: 'Not provided',
  //       medicalNote: 'The patient has authorized the release of their health information to KAL Attorneys for a Third Party Liability Case.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990e'),
  //       icdCodes: [ 'V01.0-V99.9' ],
  //       nameOfDisease: 'Injuries from Accident',
  //       amountSpent: 'Not provided',
  //       providerName: 0,
  //       doctorName: 'Not provided',
  //       medicalNote: 'The patient was involved in an accident and is seeking compensation for injuries.',
  //       dateOfClaim: 2021-07-30T23:00:00.000Z
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990e'),
  //       icdCodes: [ 'Z71.89' ],
  //       nameOfDisease: 'Not provided',
  //       amountSpent: 'Not provided',
  //       providerName: 0,
  //       doctorName: 'Not provided',
  //       medicalNote: 'No specific encounters mentioned in the document.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990e'),
  //       icdCodes: [ 'Z00.00' ],
  //       nameOfDisease: 'Not provided',
  //       amountSpent: 'Not provided',
  //       providerName: 0,
  //       doctorName: 'Not provided',
  //       medicalNote: 'Information release request for a Third Party Liability Case.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990e'),
  //       icdCodes: [ 'Z71.1' ],
  //       nameOfDisease: 'Not provided',
  //       amountSpent: 'Not provided',
  //       providerName: 0,
  //       doctorName: 'Not provided',
  //       medicalNote: 'No specific encounters mentioned in the document.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990c'),
  //       icdCodes: [ 'V49.9' ],
  //       nameOfDisease: 'Injuries suffered in an auto accident',
  //       amountSpent: 'Requesting all report statements from 07/31/2021 to 07/31/2024',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Injuries suffered in an auto accident',
  //       dateOfClaim: 2021-07-30T23:00:00.000Z
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990f'),
  //       icdCodes: [ 'Z00.00' ],
  //       nameOfDisease: 'Not available',
  //       amountSpent: 'Not available',
  //       providerName: 0,
  //       doctorName: 'Not available',
  //       medicalNote: 'No medical information available',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a990d'),
  //       icdCodes: [ 'T14.8' ],
  //       nameOfDisease: 'Injuries from Accident',
  //       amountSpent: '$5,000',
  //       providerName: 0,
  //       doctorName: 'Dr. Smith',
  //       medicalNote: 'Patient suffered multiple injuries including fractures and contusions as a result of the accident.',
  //       dateOfClaim: 2021-07-30T23:00:00.000Z
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9910'),
  //       icdCodes: [ 'S06.0' ],
  //       nameOfDisease: 'Traumatic Brain Injury',
  //       amountSpent: '$71,300',
  //       providerName: 0,
  //       doctorName: 'Huma Haider, MD',
  //       medicalNote: 'The evaluation suggests that Mr. Mejia has likely suffered from traumatic brain injury as a result of his incident.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'S62.8X1A', 'S12.100A', 'R41.89' ],
  //       nameOfDisease: 'Fractured hands, neck injury, cognitive issues',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejia was involved in a bicycle accident resulting in fractured hands and a neck injury. He experienced cognitive issues, difficulty driving, concentrating, managing tasks, memory problems, and brain fog.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'T78.40XA' ],
  //       nameOfDisease: 'Post-accident symptoms',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejia reported symptoms like disorientation, confusion, nausea, tinnitus, coordination issues, intense headache, vomiting, dizziness, blurry vision, and more after the accident.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'R41.89' ],
  //       nameOfDisease: 'Cognitive complaints post-injury',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejia reported cognitive complaints post-injury, including memory issues and forgetfulness.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'R45.851' ],
  //       nameOfDisease: 'Psychological distress and passive suicidal thoughts',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejia experienced emotional distress, passive suicidal thoughts, and mood changes. He denied previous suicidal attempts and hallucinations/delusions.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'T20.0X1A', 'S06.9X9A' ],
  //       nameOfDisease: 'Physical and cognitive issues post-accident',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejia reported physical and cognitive issues arising from the accident on July 31st, 2021.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F32.9' ],
  //       nameOfDisease: 'Depression',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejia reported post-injury self-isolation, passive thoughts of death, limited physical activity due to injury, loss of energy and pleasure in activities. He underwent neuropsychological testing, clinical interview, Burns Depression Checklist (score of 32 indicating severe symptoms of depression), PTSD Checklist (PCL-5 score of 51 indicating significant symptoms of PTSD), Behavior Rating Inventory of Executive Function-Adult Version, Self-Report Form of the Behavior Rating Inventory of Executive Function-Adult Version, and cognitive assessment showing difficulties in various cognitive functions.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F41.9' ],
  //       nameOfDisease: 'Anxiety',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejias reported symptoms of anxiety during the encounter. He completed the Psychological Health Questionnaire (PHQ-9) and the Burns Anxiety Inventory.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'R41.89' ],
  //       nameOfDisease: 'Executive Functioning Concerns',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: "Concerns were noted about Mr. Mejia's executive function, ability to inhibit impulsive responses, adjust to changes in routine, modulate emotions, initiate problem-solving, sustain working memory, plan and organize problem-solving approaches, attend to task-oriented output, and organize environment and materials. His self-regulation scores were elevated, indicating significant executive function challenges.",
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F02.80' ],
  //       nameOfDisease: 'Cognitive Impairment',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Mr. Mejia showed difficulties in memory, recall, visual-spatial skills, attention, verbal fluency, object naming, and executive function. He demonstrated inconsistent effort on some cognitive tests and performed in the Impaired or Low Average range on various cognitive assessments.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F07.81' ],
  //       nameOfDisease: 'Mild Neurocognitive Disorder due to Traumatic Brain Injury',
  //       amountSpent: 0,
  //       providerName: 0,
  //       doctorName: '',
  //       medicalNote: 'Mr. Mejia met the diagnostic criteria for a Mild Neurocognitive Disorder due to a Traumatic Brain Injury.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F32.3', 'F43.12' ],
  //       nameOfDisease: 'Major Depressive Disorder, Single Episode, Severe, With Anxious distress, Severe, and Post-traumatic stress disorder',
  //       amountSpent: 0,
  //       providerName: 0,
  //       doctorName: '',
  //       medicalNote: 'Mr. Mejia met the criteria for Major Depressive Disorder, Single Episode, Severe, With Anxious distress, Severe, and Post-traumatic stress disorder.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F06.7' ],
  //       nameOfDisease: 'Mild Neurocognitive Disorder',
  //       amountSpent: 0,
  //       providerName: 0,
  //       doctorName: '',
  //       medicalNote: 'Mr. Mejia met the diagnostic criteria for a Mild Neurocognitive Disorder.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F33.2', 'F43.10' ],
  //       nameOfDisease: 'Major Depressive Disorder, Single Episode, Severe, With Anxious distress, Severe, and Post-traumatic stress disorder',
  //       amountSpent: 0,
  //       providerName: 0,
  //       doctorName: '',
  //       medicalNote: 'Mr. Mejia met the criteria for Major Depressive Disorder, Single Episode, Severe, With Anxious distress, Severe, and Post-traumatic stress disorder.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F06.7' ],
  //       nameOfDisease: 'Mild Neurocognitive Disorder',
  //       amountSpent: 0,
  //       providerName: 0,
  //       doctorName: '',
  //       medicalNote: 'Deficits and distress likely result of the bicycle accident. Cognitive, emotional, and physical concerns reported immediately after the accident.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F07.81', 'F06.31', 'F43.10' ],
  //       nameOfDisease: 'Mild Neurocognitive Disorder due to Traumatic Brain Injury with Behavioral Disturbance, Major Depressive Disorder, Single Episode, Post-traumatic Stress Disorder',
  //       amountSpent: 0,
  //       providerName: 0,
  //       doctorName: '',
  //       medicalNote: 'Diagnoses: 1. Mild Neurocognitive Disorder due to Traumatic Brain Injury with Behavioral Disturbance. 2. Major Depressive Disorder, Single Episode: Current Severity: Severe, With Anxious Distress: Current Severity: Severe. 3. Post-traumatic Stress Disorder (PTSD); Chronic.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F43.10' ],
  //       nameOfDisease: 'Depressive symptoms, anxious mood, PTSD',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Dr. Paula Cedillo-Weerasinghe',
  //       medicalNote: 'The document mentions therapeutic interventions for pain management, relaxation techniques, biofeedback, neurofeedback, and cognitive rehabilitation for Oscar Mejia.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F02.80' ],
  //       nameOfDisease: 'Cognitive impairment',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'The document provides neuropsychological assessment data for Mr. Oscar Mejia, including cognitive test results and executive functioning assessment.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F41.9', 'F41.1' ],
  //       nameOfDisease: 'Depression, Anxiety',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'The document includes results from various cognitive tests and assessments for Oscar Mejia, indicating cognitive impairment and executive functioning issues.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9912'),
  //       icdCodes: [ 'F41.1', 'F41.9' ],
  //       nameOfDisease: 'Depression, Anxiety',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'The document mentions the Burns Depression Checklist, Burns Anxiety Inventory, and PHQ-9 scores indicating severe depression and anxiety for Oscar Mejia.',
  //       dateOfClaim: null
  //     },
  //     {
  //       document: new ObjectId('671b6ca27266734d282a9911'),
  //       icdCodes: [ 'M54.81' ],
  //       nameOfDisease: 'Cervical Facet Joint Pain',
  //       amountSpent: 'Not specified',
  //       providerName: 0,
  //       doctorName: 'Not specified',
  //       medicalNote: 'Patient underwent C4/5 and C5/6 facet injection for the treatment of cervical facet joint pain.',
  //       dateOfClaim: 2022-11-21T23:00:00.000Z
  //     }
  //   ]

  //   //if the data has the same document and the same dateOfClaim, we will combine the data and remove duplicates

  // }

  // Populate report from case documents
  async populateReportFromCaseDocuments(caseId: string): Promise<any> {
    try {
      const documents = await DocumentModel.find({ case: caseId }).lean();

      if (!documents.length) {
        return;
      }

      let flattenedResults: any[] = [];
      let reportObjects: any[] = [];

      for (const doc of documents) {
        const content = doc.content || '';
        if (!content.trim()) {
          continue; // Skip to the next document
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
        flattenedResults = [...flattenedResults, ...results.flat().map(result => ({ ...result, documentId: doc._id as string }))];
      }

      if (flattenedResults.length) {
        // Create report objects from flattened results
        reportObjects = await Promise.all(
          flattenedResults.map(async (result) => {
            return {
              document: result.documentId,
              icdCodes: await this.diseaseClassificationService.getIcdCodeFromDescription(
                result["Disease Name"]
              ),
              nameOfDisease: result["Disease Name"] || "",
              amountSpent: await this.diseaseClassificationService.validateAmount(result["Amount Spent"] || "") || 0,
              providerName: result["Provider Name"] || "",
              doctorName: result["Doctor Name"] || "",
              medicalNote: result["Medical Note"] || "",
              dateOfClaim: await this.diseaseClassificationService.validateDateStr(result["Date"] || ""),
            };
          })
        );

        console.log('reportObjects', reportObjects);

        const noDuplicates = await this.combineDocumentAndRemoveDuplicates(reportObjects);

        console.log('noDuplicates', noDuplicates);

        // Update case and add reports
        await CaseModel.findOneAndUpdate(
          { _id: caseId },
          { reports: noDuplicates },
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
}
