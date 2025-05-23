import {signJwt, verifyJwt} from "./jwt";
import { describe, expect, it } from '@jest/globals';

interface AuthToken {
    id: string;
    iat: number
    email: string;
}

const payload = { id: "123", email: "test@example.com" };

describe("signJwt", () => {
    it("should sign a JWT with the given user and default options", () => {

        const authToken = signJwt(payload);

        expect(authToken).toMatch("eyJhbGciOiJQUzI1NiIsInR5cCI6IkpXVCJ9");

        const { email, id, iat } = verifyJwt(authToken) as AuthToken;
        expect(email).toMatch("test@example.com");
        expect(id).toMatch("123");
        expect(iat).toBeDefined();
        expect(iat).toBeGreaterThan(0);
    });
});