import { Queue } from "bullmq";
import { redis } from "../redis";

export async function clearQueue(queueName: string) {
  const queue = new Queue(queueName, { connection: redis });

  await queue.drain(true); // true => also removes delayed jobs
  console.log(`Queue ${queueName} drained!`);

  await queue.clean(0, 0, "completed");
  await queue.clean(0, 0, "failed");
  await queue.clean(0, 0, "delayed");
  await queue.clean(0, 0, "wait");
  await queue.clean(0, 0, "active");

  console.log(`Queue ${queueName} cleaned!`);
}
