import IORedis from "ioredis";
import { redisOptions as redisOptionsI } from "../../redis/config";
import { ocrStatusQueueName } from "../types";
import { createWorker } from "../worker.factory";
import ocrExtractionStatusProcessor from "./processor";

export async function createOcrExtractionStatusWorker() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const { worker: ocrExtractionStatusWorker } = createWorker(
    ocrStatusQueueName,
    ocrExtractionStatusProcessor,
    new IORedis(redisOptions)
  );

  await ocrExtractionStatusWorker.startStalledCheckTimer();

  return ocrExtractionStatusWorker;
}
