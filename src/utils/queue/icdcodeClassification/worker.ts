import IORedis from "ioredis";
import { redisOptions as redisOptionsI } from "../../redis/config";
import { icdcodeClassificationQueueName } from "../types";
import { createWorker } from "../worker.factory";
import icdcodClassificationProcessor from "./processor";

export async function createIcdcodClassificationWorker() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const { worker: icdcodClassificationWorker } = createWorker(
    icdcodeClassificationQueueName,
    icdcodClassificationProcessor,
    new IORedis(redisOptions)
  );

  await icdcodClassificationWorker.startStalledCheckTimer();

  return icdcodClassificationWorker;
}
