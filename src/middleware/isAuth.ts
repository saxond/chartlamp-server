import { NextFunction, Request, Response } from 'express';
import { Session } from 'express-session';

export interface CustomSession extends Session {
  user?: {
    id: string;
    email: string;
  };
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction): void {
  const sessionUser = (req.session as CustomSession).user;
  if (sessionUser) {
    //get user user information from db 
    req.user = sessionUser;
    return next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}