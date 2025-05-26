import {RedisOptions} from "ioredis";

export interface RedisEnv {
  REDIS_HOST?: string
  REDIS_PORT?: string
  REDIS_USER?: string
  REDIS_PASSWORD?: string
  NODE_ENV?: string
  // treated as boolean, used to disable tls for local testing
  REDIS_TLS?: string
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends RedisEnv { }
  }
}

function getRedisOptions(env: RedisEnv) : RedisOptions {
  const redisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT
        ? parseInt(env.REDIS_PORT, 10)
        : undefined,
    username: env.REDIS_USER,
    password: env.REDIS_PASSWORD,
  };

  const enableTls = env.NODE_ENV !== "local" && env.REDIS_TLS !== "false";

  return {
    ...(env.NODE_ENV !== "local" && {
      ...redisOptions,
    }),
    ...(enableTls && {
      tls: {},
    }),
    maxRetriesPerRequest: null,
  };
}

export { getRedisOptions };
