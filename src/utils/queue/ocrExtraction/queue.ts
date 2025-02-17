import { Queue } from "bullmq";
import { redisOptions } from "../../redis/config";
import { ocrQueueName } from "../types";

export const createOcrQueue = () => {
  const ocrExtractionQueue = new Queue(ocrQueueName, {
    connection: redisOptions,
  });
  return ocrExtractionQueue;
};
