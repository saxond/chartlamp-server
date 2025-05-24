import {DiseaseClassificationService} from './diseaseClassification.service';
import {describe, expect, it, jest, afterEach, beforeEach} from '@jest/globals';
import mongoose from "mongoose";
import {connectToMongo} from "../utils/mongo";

jest.mock('./openai.service', () => {
    return jest.fn().mockImplementation(() => {
        return {};
    });
});

describe('DiseaseClassificationService - seedData', () => {
    let service: DiseaseClassificationService;

    beforeEach(async () => {
        await connectToMongo();
        const collections = await mongoose.connection.db.collections();
        for (const collection of collections) {
            await collection.deleteMany({});
        }
        service = new DiseaseClassificationService();
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await mongoose.disconnect();
    });

    it('should seed data successfully', async () => {
        const result = await service.seedData();
        expect(result).toHaveLength(71486);
    });

    it('should fetch all disease classifications with pagination options', async () => {
        await service.seedData();
        const result = await service.getAllDiseaseClassifications(0, 999999);

        expect(result).toHaveLength(71486);
    }, 10000);
});