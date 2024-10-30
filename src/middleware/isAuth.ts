import { NextFunction, Request, Response } from 'express';
import { Session } from 'express-session';
import { formatResponse } from '../utils/helpers';
import { verifyJwt } from '../utils/jwt';

export interface CustomSession extends Session {
  user?: {
    id: string;
    email: string;
  };
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authToken = req.cookies.authToken;

    if (!authToken) {
       res.status(401).json(formatResponse(false, 'User is not authenticated'));
       return;
    }

    const user = verifyJwt<AuthUser>(authToken);
    
    if (user) {
      req.user = user;
      return next();
    } else {
      res.status(401).json(formatResponse(false, 'User is not authenticated'));
      return;
    }
  } catch (error) {
      res.status(500).json(formatResponse(false, 'Internal server error'));
      return;
  }
}