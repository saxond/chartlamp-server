import { Queue } from "bullmq";
import { redisOptions } from "../../redis/config";
import { icdcodeClassificationQueueName } from "../types";

export const createIcdcodeClassificationQueue = () => {
  const icdcodeClassificationQueue = new Queue(icdcodeClassificationQueueName, {
    connection: redisOptions,
  });
  return icdcodeClassificationQueue;
};
