import { Queue } from "bullmq";
import { ocrStatusQueueName } from "../types";
import { redis } from "../../redis";

export const createOcrStatusQueue = () => {
  const ocrExtractionStatusQueue = new Queue(ocrStatusQueueName, {
    connection: redis,
  });
  return ocrExtractionStatusQueue;
};
