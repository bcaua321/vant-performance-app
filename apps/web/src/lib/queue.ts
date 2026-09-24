import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis-connection";

export const ANALYSES_QUEUE = "analyses";

const globalForQueue = globalThis as unknown as { analysesQueue?: Queue };

export function getAnalysesQueue(): Queue {
  if (!globalForQueue.analysesQueue) {
    globalForQueue.analysesQueue = new Queue(ANALYSES_QUEUE, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
  }
  return globalForQueue.analysesQueue;
}
