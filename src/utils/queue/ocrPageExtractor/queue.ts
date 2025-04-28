import { Queue } from "bullmq";
import { redis } from "../../redis";
import { ocrPageExtractorQueueName } from "../types";

export const createOcrPageExtractorQueue = () => {
  const ocrPageExtractorQueue = new Queue(ocrPageExtractorQueueName, {
    connection: redis,
  });
  return ocrPageExtractorQueue;
};
