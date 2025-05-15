import { Queue } from "bullmq";
import { pageProcessingQueueName } from "../types";
import { redis } from "../../redis";

export const createPageProcessingQueue = () => {
  const pageProcessingQueue = new Queue(pageProcessingQueueName, {
    connection: redis,
  });
  return pageProcessingQueue;
};
