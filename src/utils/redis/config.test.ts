import {describe, expect, it} from '@jest/globals';
import Redis from "ioredis";
import {getRedisOptions} from "./config";

describe('connectToRedis', () => {
    it('should connect with redis config', async () => {
        const redis = new Redis(getRedisOptions());

        expect(redis.status).toBe("connecting");
        const result = await redis.call('INCR', 'test');
        expect(result).toBeGreaterThan(0);
        expect(redis.status).toBe("ready");

        redis.disconnect();
        //expect(redis.status).toBe("end");
    });
});