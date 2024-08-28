import { ErrorRequestHandler, NextFunction, Response } from 'express';
import { ErrorResponse } from '../../interfaces';

export const errorHandlerMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res: Response<ErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  
  res?.status(statusCode).send({
    data: null,
    success: false,
    error: true,
    message: error.message || 'Internal Server Error',
    status: statusCode,
    stack: process.env.NODE_ENV === 'production' ? '' : error.stack,
  });
};

export default errorHandlerMiddleware;
