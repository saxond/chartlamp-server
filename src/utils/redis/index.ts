import Redis from "ioredis";
import { redisOptions } from "./config";

const redis = new Redis(redisOptions);

// Log connection events
redis.on("connect", () => console.log("Connected to Redis"));
redis.on("error", (err) => console.error("Redis connection error:", err));

export { redis };
