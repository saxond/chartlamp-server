import {connectToMongo} from './mongo';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import mongoose from "mongoose";

describe('connectToMongo', () => {

    afterEach (async () => {
        await mongoose.disconnect();
    });

    it('should log success message if connection is successful', async () => {
        const consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {
        });
        const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        await connectToMongo();

        expect(consoleLogMock).toHaveBeenCalledWith('Successfully connected to MongoDB.');
        expect(consoleErrorMock).not.toHaveBeenCalled();

        consoleLogMock.mockRestore();
        consoleErrorMock.mockRestore();
    });
});