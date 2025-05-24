import {connectToMongo} from './mongo';
import { describe, expect, it, jest } from '@jest/globals';

describe('connectToMongo', () => {

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