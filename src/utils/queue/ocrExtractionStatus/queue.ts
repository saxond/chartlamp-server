import { Queue } from "bullmq";
import { redisOptions } from "../../redis/config";
import { ocrStatusQueueName } from "../types";

export const createOcrStatusQueue = () => {
  const ocrExtractionStatusQueue = new Queue(ocrStatusQueueName, {
    connection: redisOptions,
  });
  return ocrExtractionStatusQueue;
};
