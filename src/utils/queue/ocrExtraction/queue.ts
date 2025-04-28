import { Queue } from "bullmq";
import { ocrQueueName } from "../types";
import { redis } from "../../redis";

export const createOcrQueue = () => {
  const ocrExtractionQueue = new Queue(ocrQueueName, {
    connection: redis,
  });
  return ocrExtractionQueue;
};
