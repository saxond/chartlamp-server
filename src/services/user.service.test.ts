import {describe, expect, it, jest, afterEach, beforeEach} from '@jest/globals';
import UserService from './user.service';
import {UserRegistrationInput} from "../interfaces/user";
import {connectToMongo} from "../utils/mongo";
import mongoose from "mongoose";
import {Organization, OrganizationModel} from "../models/organization.model";
import {User, UserModel} from "../models/user.model";
import {TwoFactorAuthModel} from "../models/twoFactorAuth.model";

jest.mock('twilio', () => {
    return jest.fn().mockImplementation(() => {
        return {};
    });
});

const dummyUser: UserRegistrationInput = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    organization: 'Example Organization',
};

async function initializeMongo ()  {
    await connectToMongo();
    if (mongoose.connection.db) {
        await mongoose.connection.db.dropDatabase();
    }
}

describe('UserService - register', () => {
    let userService: UserService;

    beforeEach(async () => {
        userService = new UserService({});
        jest.spyOn(userService, 'sendNewUserMailToAdmin').mockImplementation(() => Promise.resolve());
        await initializeMongo();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await mongoose.disconnect();
    });

    it('should register a new user and organization successfully', async () => {
        const result = await userService.register(dummyUser);

        expect(result).toBeDefined();
        expect(result.name).toMatch(dummyUser.name);
        expect(result.email).toMatch(dummyUser.email);

        // we return the hashed password stored in the database :notsureif
        expect(result.password).toBeDefined();
        expect(result.password).not.toMatch(dummyUser.password);
        expect(result.organization).toBeDefined();
    });

    it('should throw an error if email is already in use', async () => {
        const result = await userService.register(dummyUser);

        expect(result).toBeDefined();

        await expect(userService.register(dummyUser)).rejects.toThrow('Email is already in use');
    });

    it('should create new organization when user names are equal', async () => {
        const user1: UserRegistrationInput = {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'password123'
        };

        const result = await userService.register(user1);

        expect(result).toBeDefined();

        const user2: UserRegistrationInput = {
            name: 'John Doe',
            email: 'john.bob@example.com',
            password: 'password123'
        };

        const user2Result = await userService.register(user2);

        expect(user2Result).toBeDefined();
        expect(user2Result.organization).not.toEqual(result.organization);

        const org1 = await OrganizationModel.findById(result.organization).lean().exec() as Organization;
        const org2 = await OrganizationModel.findById(user2Result.organization).lean().exec() as Organization;

        expect(org1.name).toMatch(user1.name);

        // different organizations, same name
        expect(org1.name).toMatch(org2.name);
    });
});

describe('UserService - login', () => {
    let userService: UserService;
    let user: User;

    beforeEach(async () => {
        userService = new UserService({ENABLE_TWO_FACTOR_AUTH: "false"});
        jest.spyOn(userService, 'sendNewUserMailToAdmin').mockImplementation(() => Promise.resolve());
        await initializeMongo();

        user = await userService.register(dummyUser);

        jest.clearAllMocks();
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await mongoose.disconnect();
    });

    it("should throw if user isn't registered", async () => {
        await expect(userService.login('dude@example.com', dummyUser.password)).rejects.toThrow('Invalid email or password');
    });

    it("should throw if password is incorrect", async () => {
        await expect(userService.login(dummyUser.email, 'just-guessing')).rejects.toThrow('Invalid email or password');
    });

    it('should login successfully', async () => {
        expect(user).toBeDefined();
        expect(user).not.toBeNull();

        const result = await userService.login(dummyUser.email, dummyUser.password);
        expect(result).toBeDefined();

        expect(result.authToken).toBeDefined();
        expect(result.twoFactorRequired).toEqual(false);
        expect(result.user.name).toMatch('John Doe');
        expect(result.user.email).toMatch(dummyUser.email);
    });
});

describe('UserService - logged in', () => {
    let userService: UserService;
    let user: User;
    let authToken: string;

    beforeEach(async () => {
        userService = new UserService({ENABLE_TWO_FACTOR_AUTH: "false"});
        jest.spyOn(userService, 'sendNewUserMailToAdmin').mockImplementation(() => Promise.resolve());
        await initializeMongo();

        user = await userService.register(dummyUser);
        const login = await userService.login(dummyUser.email, dummyUser.password);
        authToken = login.authToken;

        jest.clearAllMocks();
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await mongoose.disconnect();
    });

    it("should be able to call me", async () => {
       const me = await userService.me(user._id!);
       expect(me).toBeDefined();
       expect(me?.email).toMatch(user.email);
    });

    it("should fail to reset password with bad token", async () => {
        const input = {token: authToken, newPassword: '84y!-kegh'};
        await expect(userService.resetPassword(input)).rejects.toThrow('Password reset token is invalid or has expired');
    });

    it("should reset password", async () => {

        const foundUser = await UserModel.findOne({ email: dummyUser.email });

        foundUser!.generatePasswordResetToken();
        expect(foundUser!.resetPasswordToken).toBeDefined();
        expect(foundUser!.resetPasswordExpires).toBeDefined();
        await foundUser!.save();

        const input = {token: foundUser!.resetPasswordToken!, newPassword: '84y!-kegh'};
        await userService.resetPassword(input);

        const afterSave = await UserModel.findById(user._id).exec() as User;
        expect(afterSave.resetPasswordToken).not.toBeDefined();
        expect(afterSave.resetPasswordExpires).not.toBeDefined();

        // password has changed
        expect(afterSave.password).not.toEqual(foundUser!.password);
    });

    it("should fail to reset password with expired token", async () => {

        const foundUser = await UserModel.findOne({ email: dummyUser.email });

        foundUser!.generatePasswordResetToken();
        // token expires in the past
        foundUser!.resetPasswordExpires = new Date(Date.now() - 666);
        await foundUser!.save();

        const input = {token: foundUser!.resetPasswordToken!, newPassword: '84y!-kegh'};
        await expect(userService.resetPassword(input)).rejects.toThrow('Password reset token is invalid or has expired');
    });
});