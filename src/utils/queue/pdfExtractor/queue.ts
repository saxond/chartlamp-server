import { Queue } from "bullmq";
import { pdfTextExtractorQueueName } from "../types";
import { redis } from "../../redis";

export const createPdfTextExtractorQueue = () => {
  const pdfTextExtractorQueue = new Queue(pdfTextExtractorQueueName, {
    connection: redis,
  });
  return pdfTextExtractorQueue;
};
