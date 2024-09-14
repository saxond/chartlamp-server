import { Request, Response } from 'express';
import { Session } from 'express-session';
import { User } from '../models/user.model';
import UserService from '../services/user.service';
import { formatResponse } from '../utils/helpers';

export interface CustomSession extends Session {
    user: {
        id: string;
        email: string;
    };
}

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    private getSessionUser(req: Request): { id: string; email: string } | null {
        return (req.session as CustomSession).user || null;
    }

    private async handleUserNotFound(res: Response, userId: string): Promise<User | null> {
        const appUser = await this.userService.getUserById(userId);
        if (!appUser) {
            res.status(404).json(formatResponse(false, 'User not found'));
            return null;
        }
        return appUser;
    }

    //forgot password
    public async forgotPassword(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.body;
            await this.userService.sendResetEmail(email);
            res.status(200).json(formatResponse(true, 'Password reset email sent'));
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }

    public async register(req: Request, res: Response): Promise<void> {
        try {
            const { name, organization, email, password } = req.body;
            const user = await this.userService.register({ name, email, organization, password });
            res.status(201).json(formatResponse(true, 'User registered successfully', { user }));
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }

    public async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;
            const { user, twoFactorRequired } = await this.userService.login(email, password);
            
            // Set session user
            (req.session as CustomSession).user = { id: user._id, email: user.email };
            
            // Set session expiration to 30 minutes
            req.session.cookie.maxAge = 30 * 60 * 1000; 
    
            // Set cookie with session ID
            res.cookie('sessionId', req.sessionID, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Ensure this matches your environment
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Adjust based on your needs
                maxAge: 30 * 60 * 1000 
            });
    
            res.status(200).json(formatResponse(true, 'Login successful', { user, twoFactorRequired }));
        } catch (error) {
            res.status(401).json(formatResponse(false, (error as Error).message));
        }
    }

    public async logout(req: Request, res: Response): Promise<void> {
        req.session.destroy((err) => {
            if (err) {
                res.status(400).json(formatResponse(false, 'Failed to logout'));
                return;
            }
            res.clearCookie('sessionId');
            res.status(200).json(formatResponse(true, 'Logout successful'));
        });
    }

    public async me(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getSessionUser(req);
            if (!user) {
                res.status(401).json(formatResponse(false, 'Unauthorized'));
                return;
            }
            const authUser = await this.userService.me(user.id);
            
            if (authUser) {
                res.status(200).json(formatResponse(true, 'User retrieved successfully', { user: authUser}));
            } else {
                res.status(404).json(formatResponse(false, 'User not found'));
            }
         
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }

    public async enableTwoFactorAuth(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getSessionUser(req);
            if (!user) {
                res.status(401).json(formatResponse(false, 'Unauthorized'));
                return;
            }
            const { method } = req.body;
            const appUser = await this.handleUserNotFound(res, user.id);
            if (!appUser) return;

            const result = await this.userService.generateTwoFactorSecret(appUser, method);
            res.status(200).json(formatResponse(true, '2FA enabled', { result }));
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }

    public async disableTwoFactorAuth(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getSessionUser(req);
            if (!user) {
                res.status(401).json(formatResponse(false, 'Unauthorized'));
                return;
            }
            const appUser = await this.handleUserNotFound(res, user.id);
            if (!appUser) return;

            await this.userService.disableTwoFactorAuth(appUser);
            res.status(200).json(formatResponse(true, '2FA disabled'));
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }

    public async regenerateTwoFactorSecret(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getSessionUser(req);
            if (!user) {
                res.status(401).json(formatResponse(false, 'Unauthorized'));
                return;
            }
            const { method } = req.body;
            const appUser = await this.handleUserNotFound(res, user.id);
            if (!appUser) return;

            const result = await this.userService.regenerateTwoFactorSecret(appUser, method);
            res.status(200).json(formatResponse(true, '2FA secret regenerated', { result }));
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }

    public async resendTwoFactorToken(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getSessionUser(req);
            if (!user) {
                res.status(401).json(formatResponse(false, 'Unauthorized'));
                return;
            }
            const appUser = await this.handleUserNotFound(res, user.id);
            if (!appUser) return;
    
            const result = await this.userService.resendTwoFactorToken(appUser);
            res.status(200).json(formatResponse(true, '2FA token resent', { result }));
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }

    public async verifyTwoFactorToken(req: Request, res: Response): Promise<void> {
        try {
            const user = this.getSessionUser(req);
            if (!user) {
                res.status(401).json(formatResponse(false, 'Unauthorized'));
                return;
            }
            const { token } = req.body;
            const appUser = await this.handleUserNotFound(res, user.id);
            if (!appUser) return;

            const isValid = await this.userService.verifyTwoFactorToken(appUser, token);
            if (isValid) {
                res.status(200).json(formatResponse(true, '2FA token verified'));
            } else {
                res.status(401).json(formatResponse(false, 'Invalid 2FA token'));
            }
        } catch (error) {
            res.status(400).json(formatResponse(false, (error as Error).message));
        }
    }
}