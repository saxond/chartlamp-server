import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { aiService } from "../../../services/ai.service";
import CustomLangchainMemory from "../report/customLangchainMemory";
import { PageFhirDataSchema } from "./structuredOutputs/global";

const modelName = "gpt-3.5-turbo";

const parser = StructuredOutputParser.fromZodSchema(PageFhirDataSchema);
const formatInstructions = parser.getFormatInstructions();

const memory = new CustomLangchainMemory({
  memoryKey: "medical_record_history",
  maxPages: 3,
  inputKey: "pageText",
  returnMessages: true,
});

const pageSummaryPrompt = new PromptTemplate({
  template: `
You are processing a patient's medical record. Extract structured data in JSON format.

Instructions:
- Identify all diagnosed conditions mentioned in the text.
- For each diagnosis, include the most appropriate ICD-10 code. Use your internal knowledge of ICD-10 mappings even if the code is not explicitly written in the text.
- If a diagnosis is listed without a known ICD-10 code, leave \`icdCode\` as empty string.
- If any ICD-10 codes appear in the text without a clear diagnosis label, include them with a "name" of "Unknown" or leave it blank.

Text:
{pageText}

`.trim(),
  inputVariables: ["pageText"],
});

const model = aiService.getPreConfiguredModel(modelName);

const extractFhirPageData = async (pageText: string) => {
  const chain = RunnableSequence.from([
    {
      pageText: () => pageText,
      // medical_record_history: async () => {
      //   const mem = await memory.loadMemoryVariables({});
      //   return mem.medical_record_history || "";
      // },
      format_instructions: () => formatInstructions,
    },
    pageSummaryPrompt,
    model,
    parser,
  ]);

  const pageRecord = await chain.invoke({ pageText });

  // await memory.saveContext(
  //   { pageText },
  //   { output: JSON.stringify(pageRecord) }
  // );

  try {
    // const validated = PageFhirDataSchema.parse(pageRecord);
    return pageRecord;
  } catch (e) {
    console.error("Invalid structure on page:", e);
    return null;
  }
};

export { extractFhirPageData };
