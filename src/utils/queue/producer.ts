import { Queue } from "bullmq";
import { redisOptions } from "../redis/config";
import { caseQueueName } from "./types";

const casePopulationQueue = new Queue(caseQueueName, {
  connection: redisOptions,
});

export async function addBackgroundJob(jobName: string, caseId: string) {
  console.log("adding job to backgrounds...", { jobName, caseId });
  try {
    const existingJob = await casePopulationQueue.getJob(caseId);
    if (existingJob) {
      console.log(`Job with caseId ${caseId} is already in the queue.`);
      return;
    }

    if (jobName === "populateCase") {
      await casePopulationQueue.add(jobName, caseId, {
        jobId: caseId,
      });
      // await casePopulationQueue.close();
    }
  } catch (error) {
    console.error("Error adding job to background:", error);
    throw error;
  }
}

export const closeQueues = async () => {
  await casePopulationQueue.close();
};

process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);
