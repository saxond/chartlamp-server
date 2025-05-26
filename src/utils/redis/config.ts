import {RedisOptions} from "ioredis";

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
    ? parseInt(process.env.REDIS_PORT, 10)
    : undefined,
  username: process.env.REDIS_USER,
  password: process.env.REDIS_PASSWORD,
};

const enableTls = process.env.NODE_ENV !== "local" && process.env.REDIS_TLS !== "false";

function getRedisOptions() : RedisOptions {
  return {
    ...(process.env.NODE_ENV !== "local" && {
      ...redisOptions,
    }),
    ...(enableTls && {
      tls: {},
    }),
    maxRetriesPerRequest: null,
  };
}

export { getRedisOptions };
