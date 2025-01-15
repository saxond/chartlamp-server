export const redisOptions = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
    ? parseInt(process.env.REDIS_PORT, 10)
    : undefined,
  password: process.env.REDIS_PASSWORD,
};
