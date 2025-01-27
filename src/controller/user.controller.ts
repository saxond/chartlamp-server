import { Request, Response } from "express";
import { Session } from "express-session";
import { AuthRequest, AuthUser } from "../middleware/isAuth";
import { User } from "../models/user.model";
import UserService from "../services/user.service";
import { formatResponse } from "../utils/helpers";

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

  private getSessionUser(
    req: AuthRequest
  ): { id: string; email: string } | null {
    return req?.user as AuthUser;
  }

  private async handleUserNotFound(
    res: Response,
    userId: string
  ): Promise<User | null> {
    const appUser = await this.userService.getUserById(userId);
    if (!appUser) {
      res.status(404).json(formatResponse(false, "User not found"));
      return null;
    }
    return appUser;
  }

  //forgot password
  public async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      await this.userService.sendResetEmail(email);
      res.status(200).json(formatResponse(true, "Password reset email sent"));
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  //reset password
  public async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      await this.userService.resetPassword({
        ...req.body,
      });
      res.status(200).json(formatResponse(true, "Password reset successful"));
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, organization, email, password } = req.body;
      const user = await this.userService.register({
        name,
        email,
        organization,
        password,
      });
      res
        .status(201)
        .json(formatResponse(true, "User registered successfully", { user }));
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const { user, twoFactorRequired, authToken } =
        await this.userService.login(email, password);
      // Set session expiration to 24 hours
      // Set cookie with auth token
      res.cookie("authToken", authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "local", // Ensure this matches your environment
        sameSite: process.env.NODE_ENV !== "local" ? "none" : "lax", // Adjust based on your needs
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res
        .status(200)
        .json(
          formatResponse(true, "Login successful", { user, twoFactorRequired })
        );
    } catch (error) {
      res.status(401).json(formatResponse(false, (error as Error).message));
    }
  }

  public async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.status(200).json(formatResponse(true, "Logout successful"));
  }

  public async me(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const authUser = await this.userService.me(user.id);

      if (authUser) {
        res.status(200).json(
          formatResponse(true, "User retrieved successfully", {
            user: authUser,
          })
        );
      } else {
        res.status(404).json(formatResponse(false, "User not found"));
      }
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  //get team members
  public async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }

      const teamMembers = await this.userService.getTeamMembers(user.id);
      res.status(200).json(
        formatResponse(true, "Team members retrieved successfully", {
          teamMembers,
        })
      );
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async enableTwoFactorAuth(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const { method } = req.body;
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) return;

      const result = await this.userService.generateTwoFactorSecret({
        user: appUser,
        method,
      });
      res.status(200).json(formatResponse(true, "2FA enabled", { result }));
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async disableTwoFactorAuth(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) return;

      await this.userService.disableTwoFactorAuth(appUser);
      res.status(200).json(formatResponse(true, "2FA disabled"));
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async regenerateTwoFactorSecret(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const { method } = req.body;
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) return;

      const result = await this.userService.regenerateTwoFactorSecret(
        appUser,
        method
      );
      res
        .status(200)
        .json(formatResponse(true, "2FA secret regenerated", { result }));
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async resendTwoFactorToken(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) return;

      const result = await this.userService.resendTwoFactorToken(appUser);
      res
        .status(200)
        .json(formatResponse(true, "2FA token resent", { result }));
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async verifyTwoFactorToken(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const { token } = req.body;
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) return;

      const isValid = await this.userService.verifyTwoFactorToken(
        appUser,
        token
      );
      if (isValid) {
        res.status(200).json(formatResponse(true, "2FA token verified"));
      } else {
        res.status(400).json(formatResponse(false, "Invalid 2FA token"));
      }
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async getRecentlyJoinedUsers(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) return;

      const recentlyJoined = await this.userService.getRecentlyJoinedUsers(
        appUser.organization?.toString() || "",
        appUser._id || ""
      );
      res.status(200).json(recentlyJoined);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) {
        res.status(404).json(formatResponse(false, "User not found"));
      }

      if (req.params.id !== appUser?._id?.toString()) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }

      const updatedUser = await this.userService.updateUser({
        userId: appUser?._id || "",
        ...req.body,
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async updateUserAccessLevel(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) {
        res.status(404).json(formatResponse(false, "User not found"));
        return;
      }

      if (appUser.role !== "admin" || appUser.accessLevel !== "all_access") {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }

      const updatedUser = await this.userService.updateUserAccessLevel({
        userId: req.params.id,
        ...req.body,
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) {
        res.status(404).json(formatResponse(false, "User not found"));
        return;
      }

      if (appUser.role !== "admin" || appUser.accessLevel !== "all_access") {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }

      const updatedUser = await this.userService.deleteUser({
        userId: req.params.id,
        ...req.body,
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async updateUserPassword(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) {
        res.status(404).json(formatResponse(false, "User not found"));
      }

      if (req.params.id !== appUser?._id?.toString()) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }

      const updatedUser = await this.userService.updateUserPassword({
        userId: appUser?._id || "",
        ...req.body,
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async toggleUser2FA(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) {
        res.status(404).json(formatResponse(false, "User not found"));
      }

      if (req.params.id !== appUser?._id?.toString()) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }

      const updatedUser = await this.userService.toggleUser2FA({
        userId: appUser?._id || "",
        ...req.body,
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  public async update2faPhoneNumber(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = this.getSessionUser(req);
      if (!user) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }
      const appUser = await this.handleUserNotFound(res, user.id);
      if (!appUser) {
        res.status(404).json(formatResponse(false, "User not found"));
      }

      if (req.params.id !== appUser?._id?.toString()) {
        res.status(401).json(formatResponse(false, "Unauthorized"));
        return;
      }

      const updatedUser = await this.userService.update2faPhoneNumber({
        userId: appUser?._id || "",
        ...req.body,
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }
}
