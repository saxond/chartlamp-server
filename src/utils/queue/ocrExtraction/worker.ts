import IORedis from "ioredis";
import { redisOptions as redisOptionsI } from "../../redis/config";
import { ocrQueueName } from "../types";
import { createWorker } from "../worker.factory";
import ocrExtractionProcessor from "./processor";
import { redis } from "../../redis";

export async function createOcrExtractionWorker() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const { worker: ocrExtractionWorker } = createWorker(
    ocrQueueName,
    ocrExtractionProcessor,
    redis
  );

  await ocrExtractionWorker.startStalledCheckTimer();

  return ocrExtractionWorker;
}
