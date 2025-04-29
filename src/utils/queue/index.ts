import { createIcdcodClassificationWorker } from "./icdcodeClassification/worker";
import { createOcrPageExtractorWorker } from "./ocrPageExtractor/worker";

export async function startBackgroundJobs() {
  console.log("Creating worker environments for background jobs...");
  const icdcodClassificationWorker = await createIcdcodClassificationWorker();
  const ocrPageExtractorWorker = await createOcrPageExtractorWorker();

  let isShuttingDown = false; 

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("Shutdown signal received. Closing workers...");

    try {
      await icdcodClassificationWorker.close();
      await ocrPageExtractorWorker.close();
      console.log("Worker environments for background jobs closed.");
    } catch (err) {
      console.error("Error during shutdown:", err);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
