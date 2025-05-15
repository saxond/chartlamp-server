import dotenv from "dotenv-safe";
dotenv.config();

import { createIcdcodClassificationWorker } from "./icdcodeClassification/worker";
import { createOcrPageExtractorWorker } from "./ocrPageExtractor/worker";
import { createPageProcessingWorker } from "./pageProcessing/worker";
import { connectToMongo } from "../mongo";
import { Queue } from "bullmq";
import { pageProcessingQueue } from "./pageProcessing/producer";
import { icdcodeClassificationQueue } from "./icdcodeClassification/producer";
import { ocrPageExtractorQueue } from "./ocrPageExtractor/producer";

async function startWorkers() {
  console.log("🚀 Starting background workers...");

  await connectToMongo();

  const workers = await Promise.all([
    createPageProcessingWorker(),
    createOcrPageExtractorWorker(),
    createIcdcodClassificationWorker(),
  ]);

  console.log("✅ Workers are now running.");

  // Handle graceful shutdown
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("🛑 Shutdown signal received. Closing workers...");

    for (const worker of workers) {
      await worker.close();
    }

    console.log("✅ Workers shut down successfully.");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startWorkers().catch((err) => {
  console.error("❌ Failed to start workers:", err);
  process.exit(1);
});

export const allQueues: Queue[] = [
  icdcodeClassificationQueue,
  ocrPageExtractorQueue,
  pageProcessingQueue,
];
