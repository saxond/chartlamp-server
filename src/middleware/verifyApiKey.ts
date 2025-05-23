//this is a middle ware to verify api key, the apikey will be passed in the header of the request api key is process.env.API_KEY

import { NextFunction, Request, Response } from 'express';
import createHttpError from 'http-errors';

export const verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
  return next(createHttpError(401, 'Unauthorized'));
  const apiKey = req.headers['api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return next(createHttpError(401, 'Unauthorized'));
  }

  next();
};