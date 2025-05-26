import Redis from "ioredis";
import { getRedisOptions } from "./config";

const redis = new Redis(getRedisOptions());

// Log connection events
redis.on("connect", () => console.log("✅ Connected to Redis"));
redis.on("ready", () => console.log("🚀 Redis connection is ready"));
redis.on("error", (err) => console.error("❌ Redis error:", err));
redis.on("close", () => console.warn("⚠️ Redis connection closed"));
redis.on("reconnecting", () => console.log("♻️ Reconnecting to Redis..."));

export { redis };
