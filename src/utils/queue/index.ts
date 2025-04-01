import { redisOptions as redisOptionsI } from "../redis/config";
import { createIcdcodClassificationWorker } from "./icdcodeClassification/worker";
import { createOcrExtractionWorker } from "./ocrExtraction/worker";
import { createOcrExtractionStatusWorker } from "./ocrExtractionStatus/worker";
import { createOcrPageExtractorWorker } from "./ocrPageExtractor/worker";

export async function startBackgroundJobs() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const ocrExtractionWorker = await createOcrExtractionWorker();
  const ocrExtractionStatusWorker = await createOcrExtractionStatusWorker();
  const icdcodClassificationWorker = await createIcdcodClassificationWorker();
  const ocrPageExtractorWorker = await createOcrPageExtractorWorker();

  const shutdown = async () => {
    await ocrExtractionWorker.close();
    await ocrExtractionStatusWorker.close();
    await icdcodClassificationWorker.close();
    await ocrPageExtractorWorker.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
