import 'dotenv/config';
import { NextFunction, Request, Response } from 'express';
import OpenAIService from '../services/openai.service';

// Create an instance of OpenAIService
const openAIService = new OpenAIService(process.env.OPENAI_API_KEY!);

export const completeChatController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { context, prompt, model, temperature } = req.body;
        const response = await openAIService.completeChat({ context, prompt, model, temperature });
        res.status(200).json({ response });
    } catch (error) {
        return next(error);
    }
}

export const uploadFineTunedDataController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {trainingData, baseModel} = req.body;    
        const response = await openAIService.uploadFineTunedData(trainingData, baseModel);
        res.status(200).json({ response });
    } catch (error) {
        return next(error);
    }
}

export const trainModelController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { trainingFile, model } = req.body;
        const response = await openAIService.trainModel(trainingFile, model);
        res.status(200).json({ response });
    } catch (error) {
        return next(error);
    }
}

export const listFineTuningJobsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const response = await openAIService.listFineTuningJobs();
        res.status(200).json({ response });
    } catch (error) {
        return next(error);
    }
}

export const cancelFineTuningJobController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { jobId } = req.params;
        const response = await openAIService.cancelFineTuningJob(jobId);
        res.status(200).json({ response });
    } catch (error) {
        return next(error);
    }
}

export const listFineTuningEventsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { jobId } = req.params;
        const response = await openAIService.listFineTuningEvents(jobId);
        res.status(200).json({ response });
    } catch (error) {
        return next(error);
    }
}

export const deleteFineTunedModelController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { model } = req.params;
        const response = await openAIService.deleteFineTunedModel(model);
        res.status(200).json({ response });
    } catch (error) {
        return next(error);
    }
}
