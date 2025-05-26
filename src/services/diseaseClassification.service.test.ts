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
        if (mongoose.connection.db) {
            await mongoose.connection.db.dropDatabase();
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
});

describe('DiseaseClassificationService - seeded', () => {
    let service: DiseaseClassificationService;

    beforeEach(async () => {
        await connectToMongo();
        if (mongoose.connection.db) {
            await mongoose.connection.db.dropDatabase();
        }
        service = new DiseaseClassificationService();
        await service.seedData();
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await mongoose.disconnect();
    });

    it('should fetch all disease classifications with pagination options', async () => {
        const result = await service.getAllDiseaseClassifications(0, 999999);

        expect(result).toHaveLength(71486);
    }, 10000);
});