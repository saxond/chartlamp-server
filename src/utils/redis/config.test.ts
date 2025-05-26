import {describe, expect, it} from '@jest/globals';
import Redis from "ioredis";
import {getRedisOptions} from "./config";

describe('getRedisOptions', () => {
    it('should define tls with no config', async () => {
        const options = getRedisOptions({});

        expect(options.host).toBeUndefined();
        expect(options.tls).toBeDefined();
        expect(options.maxRetriesPerRequest).toBeNull();
    });

    it('should not define tls when disabled', async () => {
        const options = getRedisOptions({REDIS_TLS: 'false'});

        expect(options.tls).toBeUndefined();
    });

    it('should not define tls when node env is local', async () => {
        const options = getRedisOptions({NODE_ENV: 'local'});

        expect(options.tls).toBeUndefined();
    });

    it('should have host and port', async () => {
        const options = getRedisOptions({REDIS_HOST: 'localhost', REDIS_PORT: '6379'});

        expect(options.host).toEqual('localhost');
        expect(options.port).toEqual(6379);
        expect(options.username).toBeUndefined();
        expect(options.password).toBeUndefined();
    });

    it('should parse bad port as NaN', async () => {
        const options = getRedisOptions({REDIS_HOST: 'localhost', REDIS_PORT: 'bad'});

        expect(options.host).toEqual('localhost');
        expect(options.port).toEqual(NaN);
    });
});

describe('connectToRedis', () => {
    it('should connect with redis config', async () => {
        const redis = new Redis(getRedisOptions({REDIS_TLS: 'false'}));

        expect(redis.status).toBe("connecting");
        const result = await redis.call('INCR', 'test');
        expect(result).toBeGreaterThan(0);
        expect(redis.status).toBe("ready");

        redis.disconnect();
        //expect(redis.status).toBe("end");
    });
});