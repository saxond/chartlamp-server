import fs from "fs";
import { OpenAI } from "openai";
import { ChatInput, TrainingDataItem } from "../interfaces";

class OpenAIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key for OpenAI is required");
    }
    this.openai = new OpenAI({ apiKey });
  }

  async completeChat(input: ChatInput): Promise<any> {
    const { context, prompt, model, temperature, response_format } = input;
    try {
      if (response_format) {
        const response = await this.openai.beta.chat.completions.parse({
          model,
          temperature: temperature ?? undefined,
          response_format: response_format ?? undefined,
          messages: [
            {
              role: "system",
              content: context,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        return response.choices[0].message.parsed;
      }
      const response = await this.openai.chat.completions.create({
        model,
        temperature: temperature ?? undefined,
        response_format: response_format ?? undefined,
        messages: [
          // {
          //   role: "system",
          //   content: context,
          // },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const apiResponseData = response.choices[0];
      // console.log(apiResponseData);

      return apiResponseData?.message?.content || "";
    } catch (err) {
      console.error(err);
      throw new Error("Failed to complete chat");
    }
  }

  async uploadFineTunedData(
    trainingData: TrainingDataItem[],
    baseModel: string
  ): Promise<string> {
    try {
      const trainingDataFormatted = trainingData.map((item) => ({
        messages: [
          { role: "system", content: item.preContext },
          { role: "user", content: item.objection },
          { role: "assistant", content: item.response },
        ],
      }));

      // Combine the two arrays
      const combinedData = [...trainingDataFormatted];
      //create a jsonl file from training data formatted
      fs.writeFileSync(
        "mydata.jsonl",
        combinedData.map((data) => JSON.stringify(data)).join("\n")
      );
      const response = await this.openai.files.create({
        file: fs.createReadStream("mydata.jsonl"),
        purpose: "fine-tune",
      });
      if (response?.id) {
        await this.trainModel(response?.id, baseModel || "gpt-4o");
      }
      return response?.status || "uploaded";
    } catch (err) {
      console.error(err);
      throw new Error("Failed to upload fine-tuned data");
    }
  }

  async trainModel(trainingFile: string, model: string): Promise<string> {
    try {
      const fineTune = await this.openai.fineTuning.jobs.create({
        training_file: trainingFile,
        model,
      });
      return fineTune.status || "failed";
    } catch (err) {
      console.error(err);
      throw new Error("Failed to train model");
    }
  }

  async listFineTuningJobs(): Promise<OpenAI.FineTuning.FineTuningJob[]> {
    try {
      const results = await this.openai.fineTuning.jobs.list({ limit: 10 });
      return results.data || [];
    } catch (err) {
      console.error(err);
      throw new Error("Failed to list fine-tuning jobs");
    }
  }

  async cancelFineTuningJob(jobId: string): Promise<any> {
    try {
      return await this.openai.fineTuning.jobs.cancel(jobId);
    } catch (err) {
      console.error(err);
      throw new Error("Failed to cancel fine-tuning job");
    }
  }

  async listFineTuningEvents(
    jobId: string
  ): Promise<OpenAI.FineTuning.FineTuningJobEvent[]> {
    try {
      const response = await this.openai.fineTuning.jobs.listEvents(jobId, {
        limit: 10,
      });
      return response.data || [];
    } catch (err) {
      console.error(err);
      throw new Error("Failed to list fine-tuning events");
    }
  }

  async deleteFineTunedModel(model: string): Promise<any> {
    try {
      return await this.openai.models.del(model);
    } catch (err) {
      console.error(err);
      throw new Error("Failed to delete fine-tuned model");
    }
  }

  async createEmbedding(text: string): Promise<any> {
    try {
      const embedding = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return embedding.data[0].embedding;
    } catch (err: any) {
      console.log("createEmbedding", err.message);
      throw new Error("Failed to create embedding");
    }
  }
}

export default OpenAIService;
