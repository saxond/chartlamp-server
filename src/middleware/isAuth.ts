import { NextFunction, Request, Response } from 'express';
import { Session } from 'express-session';

interface CustomSession extends Session {
  user?: {
    id: string;
    email: string;
  };
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if ((req.session as CustomSession).user) {
    return next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}