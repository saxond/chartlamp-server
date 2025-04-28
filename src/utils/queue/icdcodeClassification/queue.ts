import { Queue } from "bullmq";
import { redis } from "../../redis";
import { icdcodeClassificationQueueName } from "../types";

export const createIcdcodeClassificationQueue = () => {
  const icdcodeClassificationQueue = new Queue(icdcodeClassificationQueueName, {
    connection: redis,
  });
  return icdcodeClassificationQueue;
};
