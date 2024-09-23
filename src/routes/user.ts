import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { isAuthenticated } from '../middleware/isAuth';

const router = Router();
const userController = new UserController();

// Define routes for user registration and login
router.post('/register', (req, res) => userController.register(req, res));
router.post('/login', (req, res) => userController.login(req, res));
router.post('/forgot-password', (req, res) => userController.forgotPassword(req, res));
router.post('/logout', isAuthenticated, (req, res) => userController.logout(req, res));
router.get('/me', isAuthenticated, (req, res) => userController.me(req, res));

// Define routes for two-factor authentication
router.post('/enable-2fa', isAuthenticated, (req, res) => userController.enableTwoFactorAuth(req, res));
router.post('/disable-2fa', isAuthenticated, (req, res) => userController.disableTwoFactorAuth(req, res));
router.post('/verify-2fa', isAuthenticated, (req, res) => userController.verifyTwoFactorToken(req, res));
router.get('/resend-2fa', isAuthenticated, (req, res) => userController.resendTwoFactorToken(req, res));

// Export the router
export default router;