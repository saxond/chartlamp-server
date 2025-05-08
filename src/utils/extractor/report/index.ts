// import { StructuredOutputParser } from "@langchain/core/output_parsers";
// import { PromptTemplate } from "@langchain/core/prompts";
// import { RunnableSequence } from "@langchain/core/runnables";
// import { ChatOpenAI } from "@langchain/openai";
// import { ConversationSummaryBufferMemory } from "langchain/memory";
// import { aiService } from "../../../services/ai.service";
// import { MedicalRecordSchema } from "../fhirExtractor/structuredOutputs/global";
// import CustomLangchainMemory from "./customLangchainMemory";

// const modelName = "gpt-3.5-turbo";

// function getMemoryTokenLimit(modelName: string) {
//   if (modelName.includes("gpt-4o")) {
//     return 30000; // gpt-4o allows up to 128K — use a big buffer
//   } else if (modelName.includes("gpt-4-32k")) {
//     return 10000; // gpt-4 32k model
//   } else if (modelName.includes("gpt-4")) {
//     return 3000; // gpt-4 default 8k model
//   } else if (modelName.includes("gpt-3.5")) {
//     return 4000; // gpt-3.5 turbo supports 16k
//   } else {
//     return 2000; // fallback for unknown/smaller models
//   }
// }

// // Set token limit based on model
// const tokenLimit = getMemoryTokenLimit(modelName);

// const memory = new CustomLangchainMemory({
//   memoryKey: "medical_record_history",
//   maxPages: 5,
// });

// const parser = StructuredOutputParser.fromZodSchema(MedicalRecordSchema);
// const formatInstructions = parser.getFormatInstructions();

// const prompt = new PromptTemplate({
//   inputVariables: ["chunk", "medical_record_history", "format_instructions"],
//   template: `
// You are analyzing a patient's medical document page-by-page and extracting structured information in JSON.

// Conversation so far:
// {medical_record_history}

// Current page content:
// {chunk}

// {format_instructions}

// ❗️ Instructions:
// - Ignore any "Yes/No" questions, checkboxes, or form-like fields.
// - Focus on extracting clean structured data.

// Respond ONLY in JSON format.
// `,
// });

// const model = aiService.getPreConfiguredModel("gpt-3.5-turbo");

// const chain = RunnableSequence.from([
//   {
//     chunk: (input) => input.pageText,
//     medical_record_history: async () => {
//       const mem = await memory.loadMemoryVariables({});
//       return mem.medical_record_history || "";
//     },
//     format_instructions: () => formatInstructions,
//   },
//   prompt,
//   model,
//   parser,
// ]);

// // 🔄 Main Function
// export async function extractWithLangchain(
//   pages: {
//     pageText: string;
//     pageNumber: number;
//     _id: string;
//   }[]
// ) {
//   const results = [];

//   for (const page of pages) {
//     try {
//       console.log(
//         "Page number input",
//         page.pageNumber,
//         page.pageText.slice(0, 5)
//       );
//       const response = await chain.invoke({ pageText: page.pageText });

//       // console.log("response 1", JSON.stringify(response, null, 2));

//       // Save this context into memory
//       await memory.saveContext(
//         { input: page.pageText },
//         { output: JSON.stringify(response) }
//       );

//       results.push({
//         ...response,
//         pageId: page._id,
//         pageNumber: page.pageNumber,
//         chunk: page.pageText,
//       });
//       console.log("Page number response", page.pageNumber);
//     } catch (error) {
//       console.log("extractMedicalRecordFromPdf", error);
//     }
//   }

//   return results; // or post-process to merge
// }
