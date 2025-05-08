// chains/fhirExtractor.ts
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StructuredOutputParser } from "langchain/output_parsers";
import { aiService } from "../../../services/ai.service";
import { BundleSchemaV2 } from "./structuredOutputs";

const modelName = "gpt-4o";

const parser = StructuredOutputParser.fromZodSchema(BundleSchemaV2);
const formatInstructions = parser.getFormatInstructions();

const model = aiService.getPreConfiguredModel(modelName);

const prompt = new PromptTemplate({
  template: `
You are a medical assistant converting unstructured clinical notes into a valid FHIR bundle with the following structure:

{format_instructions}

Use the context below to extract only what is explicitly mentioned on the current page. Do not assume or invent information not directly stated in the text.

Extract the following resources:

- **Patient**: Only if patient-identifying information is clearly present on the current page.
- **Conditions**: Extract all diagnoses explicitly mentioned.
  - If an ICD-10 code is provided in the text, use it.
  - If no ICD-10 code is present, assign the most appropriate one using your medical knowledge.
  - If a diagnosis cannot be reliably matched to a code, leave code.coding[0].code as an empty string.
  - Do not skip any diagnosis mentioned, even if it:
    - Appears only once
    - Lacks a code, claim, or supporting details
- **ICD-10 Codes**: If any ICD-10 code is mentioned without a clear diagnosis label, include it with the name set to "Unknown" or leave it blank.
- **Claims**: Only extract if clearly described on the page (e.g., includes service, provider, and cost).
- **Encounters**: Extract if a visit, consultation, or admission is specifically mentioned.
- **DiagnosticReports**: Extract if test results or investigations (e.g., scans, labs) are directly referenced.

❗ When assigning ICD-10 codes, use this FHIR structure for the code field inside each Condition resource:

"code": {{
  "coding": [
    {{
      "system": "http://hl7.org/fhir/sid/icd-10",
      "code": "<ICD-10 Code>",
      "display": "<Diagnosis Name>"
    }}
  ],
  "text": "<Diagnosis Name>"
}}

Context:
{context}

Query:
{query}
`,
  inputVariables: ["context", "query"],
  partialVariables: { format_instructions: formatInstructions },
});


export const fhirExtractorChain = RunnableSequence.from([
  prompt,
  model,
  parser,
]);
