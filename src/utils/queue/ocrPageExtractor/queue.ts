import { Queue } from "bullmq";
import { redisOptions } from "../../redis/config";
import { ocrPageExtractorQueueName } from "../types";

export const createOcrPageExtractorQueue = () => {
  const ocrPageExtractorQueue = new Queue(ocrPageExtractorQueueName, {
    connection: redisOptions,
  });
  return ocrPageExtractorQueue;
};
