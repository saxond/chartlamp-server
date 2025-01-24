import { Router } from "express";
import { UserController } from "../controller/user.controller";
import { isAuthenticated } from "../middleware/isAuth";

const router = Router();
const userController = new UserController();

// Define routes for user registration and login
router.post("/register", (req, res) => userController.register(req, res));
router.post("/login", (req, res) => userController.login(req, res));
router.post("/forgot-password", (req, res) =>
  userController.forgotPassword(req, res)
);
router.post("/reset-password", (req, res) =>
  userController.resetPassword(req, res)
);
router.post("/logout", isAuthenticated, (req, res) =>
  userController.logout(req, res)
);
router.get("/me", isAuthenticated, (req, res) => userController.me(req, res));

router.patch("/:id", isAuthenticated, (req, res) =>
  userController.updateUser(req, res)
);

router.patch("/:id/access-level", isAuthenticated, (req, res) =>
  userController.updateUserAccessLevel(req, res)
);

router.patch("/:id/delete", isAuthenticated, (req, res) =>
  userController.deleteUser(req, res)
);

router.get("/team-members", isAuthenticated, (req, res) =>
  userController.getTeamMembers(req, res)
);

router.patch("/:id/password", isAuthenticated, (req, res) =>
  userController.updateUserPassword(req, res)
);

router.patch("/:id/2fa-toggle", isAuthenticated, (req, res) =>
  userController.toggleUser2FA(req, res)
);

router.patch("/:id/2fa-update", isAuthenticated, (req, res) =>
  userController.update2faPhoneNumber(req, res)
);

// Define routes for two-factor authentication
router.post("/enable-2fa", isAuthenticated, (req, res) =>
  userController.enableTwoFactorAuth(req, res)
);
router.post("/disable-2fa", isAuthenticated, (req, res) =>
  userController.disableTwoFactorAuth(req, res)
);
router.post("/verify-2fa", isAuthenticated, (req, res) =>
  userController.verifyTwoFactorToken(req, res)
);
router.get("/resend-2fa", isAuthenticated, (req, res) =>
  userController.resendTwoFactorToken(req, res)
);
router.get("/recently-joined", isAuthenticated, (req, res) =>
  userController.getRecentlyJoinedUsers(req, res)
);

// Export the router
export default router;
