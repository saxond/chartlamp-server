import IORedis from "ioredis";
import { redisOptions as redisOptionsI } from "../../redis/config";
import { icdcodeClassificationQueueName } from "../types";
import { createWorker } from "../worker.factory";
import icdcodClassificationProcessor from "./processor";
import { redis } from "../../redis";

export async function createIcdcodClassificationWorker() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const { worker: icdcodClassificationWorker } = createWorker(
    icdcodeClassificationQueueName,
    icdcodClassificationProcessor,
    redis
  );

  await icdcodClassificationWorker.startStalledCheckTimer();

  return icdcodClassificationWorker;
}
