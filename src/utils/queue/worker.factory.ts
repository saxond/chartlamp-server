import { ConnectionOptions, Processor, Worker } from "bullmq";
import os from "os";

function getOptimalConcurrency({
  minConcurrency = 1,
  maxConcurrency = 10,
  memoryPerJobMb = 50,
} = {}) {
  const totalMemoryMb = os.totalmem() / (1024 * 1024); // in MB
  const freeMemoryMb = os.freemem() / (1024 * 1024); // in MB

  const availableForJobs = Math.max(freeMemoryMb * 0.8, 0); // reserve 20% for system
  const estimatedJobs = Math.floor(availableForJobs / memoryPerJobMb);

  const concurrency = Math.max(
    minConcurrency,
    Math.min(maxConcurrency, estimatedJobs)
  );

  console.log(
    `Total Memory: ${totalMemoryMb.toFixed(0)}MB | Free: ${freeMemoryMb.toFixed(
      0
    )}MB`
  );
  console.log(
    `Estimated concurrency based on ${memoryPerJobMb}MB/job: ${concurrency}`
  );

  return concurrency;
}

export function createWorker(
  name: string,
  processor: string | Processor,
  connection: ConnectionOptions
) {
  const concurrency = getOptimalConcurrency();
  console.log("concurrency", concurrency);
  const worker = new Worker(name, processor, {
    connection,
    concurrency,
  });

  worker.on("completed", (_job: any, _err: any) => {
    console.log(`Completed job on queue ${name}`);
  });

  worker.on("failed", (_job: any, err: any) => {
    console.log(`Faille job on queue ${name}`, err);
  });

  return { worker };
}
