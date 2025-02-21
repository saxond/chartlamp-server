import { redisOptions as redisOptionsI } from "../redis/config";
import { createOcrExtractionWorker } from "./ocrExtraction/worker";
import { createOcrExtractionStatusWorker } from "./ocrExtractionStatus/worker";

export async function startBackgroundJobs() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const ocrExtractionWorker = await createOcrExtractionWorker();
  const ocrExtractionStatusWorker = await createOcrExtractionStatusWorker();

  const shutdown = async () => {
    await ocrExtractionWorker.close();
    await ocrExtractionStatusWorker.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
