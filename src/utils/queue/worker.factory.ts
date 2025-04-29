import { ConnectionOptions, Processor, Worker } from "bullmq";

export function createWorker(
  name: string,
  processor: string | Processor,
  connection: ConnectionOptions,
  concurrency = 3
) {
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
