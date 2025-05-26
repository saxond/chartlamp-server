import { icdcodeClassificationQueueName } from "../types";
import { createWorker } from "../worker.factory";
import icdcodClassificationProcessor from "./processor";
import { redis } from "../../redis";

export async function createIcdcodClassificationWorker() {
  const { worker: icdcodClassificationWorker } = createWorker(
    icdcodeClassificationQueueName,
    icdcodClassificationProcessor,
    redis
  );

  await icdcodClassificationWorker.startStalledCheckTimer();

  return icdcodClassificationWorker;
}
