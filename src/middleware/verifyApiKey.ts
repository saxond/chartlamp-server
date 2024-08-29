//this is a middle ware to verify api key, the apikey will be passed in the header of the request api key is process.env.API_KEY

import { NextFunction, Request, Response } from 'express';
import createHttpError from 'http-errors';

export const verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['api-key'];
  console.log('API_KEY:', apiKey); // Log the API key to verify
  

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return next(createHttpError(401, 'Unauthorized'));
  }

  next();
};