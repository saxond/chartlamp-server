import { pageProcessingQueueName } from "../types";
import { createWorker } from "../worker.factory";
import pageProcessingProcessor from "./processor";
import { redis } from "../../redis";

export async function createPageProcessingWorker() {
  const { worker: pageProcessingWorker } = createWorker(
    pageProcessingQueueName,
    pageProcessingProcessor,
    redis
  );

  await pageProcessingWorker.startStalledCheckTimer();

  return pageProcessingWorker;
}
