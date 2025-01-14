import Redis from "ioredis";

// const client = createClient({
//     username: 'default',
//     password: 'XTcoDFP8PW4kmLwRw9wMG1S4aX7wL4rQ',
//     socket: {
//         host: 'redis-12789.c11.us-east-1-2.ec2.redns.redis-cloud.com',
//         port: 12789
//     }
// });

// Create a Redis client instance
const redis = new Redis({
  host: "redis-12789.c11.us-east-1-2.ec2.redns.redis-cloud.com", // Replace with your Redis host
  port: 12789, // Replace with your Redis port
  password: "XTcoDFP8PW4kmLwRw9wMG1S4aX7wL4rQ", // Add password if required
  // db: 12815730, // Specify the Redis database number (default is 0)
});

// Log connection events
redis.on("connect", () => console.log("Connected to Redis"));
redis.on("error", (err) => console.error("Redis connection error:", err));

export { redis };
