import IORedis from "ioredis";
import { redisOptions as redisOptionsI } from "../../redis/config";
import { ocrPageExtractorQueueName } from "../types";
import { createWorker } from "../worker.factory";
import processor from "./processor";

export async function createOcrPageExtractorWorker() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const { worker } = createWorker(
    ocrPageExtractorQueueName,
    processor,
    new IORedis(redisOptions)
  );

  await worker.startStalledCheckTimer();

  return worker;
}
