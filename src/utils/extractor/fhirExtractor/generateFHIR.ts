import { PromptTemplate } from "@langchain/core/prompts";
import { aiService } from "../../../services/ai.service";

const model = aiService.getPreConfiguredModel("gpt-3.5-turbo");

const fhirPrompt = new PromptTemplate({
  template: `
Convert this structured medical summary into a valid FHIR JSON object:

{summary}

FHIR Output:
  `.trim(),
  inputVariables: ["summary"],
});

const generateFHIRObject = async (summaryData: any) => {
  const input = JSON.stringify(summaryData, null, 2);
  const prompt = await fhirPrompt.format({ summary: input });
  const response: any = await model.invoke(prompt);
  return response?.kwargs?.content;
};

export { generateFHIRObject };
