import { Case } from "../models/case.model";
import {
  DocumentModel,
  PageVectorStoreModel,
  TempPageDocumentModel,
} from "../models/document.model";
import { fhirExtractorChain } from "../utils/extractor/fhirExtractor/extract";
import { BundelV2 } from "../utils/extractor/fhirExtractor/structuredOutputs";
import { safeLoopPause, updatePercentageCompletion } from "../utils/helpers";
import { AIService } from "./ai.service";
import OpenAIService from "./openai.service";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

class AIVectorService {
  private openAiService: OpenAIService;

  constructor() {
    this.openAiService = new OpenAIService(
      process.env.OPENAI_API_KEY as string
    );
  }

  async storePage(page: any) {
    const embedding = await this.openAiService.createEmbedding(page.pageText);

    await PageVectorStoreModel.create({
      pageNumber: page.pageNumber,
      pageText: page.pageText,
      embedding,
      document: page.document,
    });

    console.log(`Stored Page ${page.pageNumber}`);
  }

  async storePages(documentId: string) {
    const pages = await TempPageDocumentModel.find(
      { documentId: documentId },
      { pageText: 1, pageNumber: 1, document: 1 }
    ).lean();

    for (const page of pages) {
      if (!page.pageText) continue;
      const pageText = page.pageText.trim();

      await this.storePage(page);
    }
  }

  async queryPagesWithContext(queryText: string, topK: number = 5) {
    const queryEmbedding = await this.openAiService.createEmbedding(queryText);

    const results = await PageVectorStoreModel.aggregate([
      {
        $vectorSearch: {
          index: "page_embedding_vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: topK,
        },
      },
      {
        $project: {
          pageNumber: 1,
          pageText: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    return results;
  }

  async extractFhirFromDocument(documentId: string) {
    const pages = await TempPageDocumentModel.find(
      { document: documentId },
      { pageText: 1, pageNumber: 1, _id: 1, totalPages: 1 }
    ).lean();

    const document = await DocumentModel.findById(documentId)
      .lean()
      .populate<{ case: Case }>("case");

    if (!document) throw new Error("Document not found");

    for (const page of pages) {
      if (!page.pageText) continue;
      const queryText = page.pageText;
      const contextPages = await this.queryPagesWithContext(queryText);
      const context = contextPages
        .map((p) => `Page ${p.pageNumber}:\n${p.pageText}`)
        .join("\n\n");

      try {
        const bundle = await fhirExtractorChain.invoke({
          context,
          query:
            "Extract patient, encounter, condition, diagnosticReport, and claims as FHIR resources.",
        });

        // console.log("extractFhirFromDocument", bundle);

        await TempPageDocumentModel.updateOne(
          { _id: page._id },
          { $set: { fhirSummary: bundle } }
        );
        await updatePercentageCompletion(
          document.case._id?.toString() || "",
          page.pageNumber,
          page.totalPages,
          `Page ${page.pageNumber} FHIR has been generated`
        );
        console.log(`Processed page ${page.pageNumber}`);
        await safeLoopPause();
      } catch (err: any) {
        console.warn(`Skipping page ${page.pageNumber}: ${err.message}`);
      }
    }
  }

  async mergeFhirBundles(documentId: string) {
    const pages = await TempPageDocumentModel.find(
      { document: documentId },
      { fhirSummary: 1 }
    ).lean();

    if (pages.length === 0) throw new Error("No FHIR summaries found");

    const patientsMap = new Map<string, any>();
    const conditionsMap = new Map<string, any>();
    const claimsMap = new Map<string, any>();
    const diagnosticMap = new Map<string, any>();
    const encountersMap = new Map<string, any>();

    for (const page of pages) {
      const bundle = page.fhirSummary;
      if (!bundle) continue;

      // Patient
      const patient = bundle.patient;
      const patientKey = patient?.name?.[0]?.family + "|" + patient?.birthDate;
      if (patientKey && !patientsMap.has(patientKey)) {
        patient.id ||= uuidv4();
        patientsMap.set(patientKey, patient);
      }

      // Conditions
      for (const condition of bundle.conditions || []) {
        const code = condition.code?.coding?.[0]?.code;
        if (!code || conditionsMap.has(code)) continue;
        condition.id ||= uuidv4();
        condition.subject = { reference: `Patient/${patient.id}` };
        conditionsMap.set(code, condition);
      }

      // Claims
      for (const claim of bundle.claims || []) {
        const claimHash = JSON.stringify(claim.item?.[0] || {});
        if (!claimHash || claimsMap.has(claimHash)) continue;
        claim.id ||= uuidv4();
        claim.patient = { reference: `Patient/${patient.id}` };
        claimsMap.set(claimHash, claim);
      }

      // DiagnosticReports
      for (const dr of bundle.diagnosticReports || []) {
        const drKey = dr.code?.coding?.[0]?.code + "|" + dr.effectiveDateTime;
        if (!drKey || diagnosticMap.has(drKey)) continue;
        dr.id ||= uuidv4();
        dr.subject = { reference: `Patient/${patient.id}` };
        diagnosticMap.set(drKey, dr);
      }

      // Encounters
      for (const enc of bundle.encounters || []) {
        const encKey = enc.id || JSON.stringify(enc.period);
        if (!encKey || encountersMap.has(encKey)) continue;
        enc.id ||= uuidv4();
        enc.subject = { reference: `Patient/${patient.id}` };
        encountersMap.set(encKey, enc);
      }
    }

    // Final bundle assembly
    const allResources = [
      ...patientsMap.values(),
      ...conditionsMap.values(),
      ...claimsMap.values(),
      ...diagnosticMap.values(),
      ...encountersMap.values(),
    ];

    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: allResources.map((resource) => ({
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
      })),
    };

    fs.writeFileSync(
      "merged-multi.fhir.json",
      JSON.stringify(fhirBundle, null, 2)
    );
    console.log("✅ Merged bundle written to merged-multi.fhir.json");

    return fhirBundle;
  }

  async mergeFhirBundlesArray(caseId: string) {
    const bundlesDocs = await DocumentModel.find(
      { case: caseId },
      { fhir: 1 }
    ).lean();

    const bundles = bundlesDocs.map((doc) => doc.fhir);

    const seen = new Set<string>();
    const mergedResources: any[] = [];

    for (const bundle of bundles) {
      if (!bundle?.entry || !Array.isArray(bundle.entry)) continue;

      for (const entry of bundle.entry) {
        const resource = entry.resource;
        if (!resource || !resource.resourceType || !resource.id) continue;

        const dedupKey = `${resource.resourceType}:${resource.id}`;

        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);

          const id = resource.id || uuidv4();

          mergedResources.push({
            fullUrl: `urn:uuid:${id}`,
            resource: { ...resource, id },
          });

          await safeLoopPause();

          if (mergedResources.length % 100 === 0) {
            console.log(`🔁 Merged ${mergedResources.length} resources...`);
          }
        }
      }
    }

    return {
      resourceType: "Bundle",
      type: "collection",
      entry: mergedResources,
    };
  }
}

export const aiVectorService = new AIVectorService();
