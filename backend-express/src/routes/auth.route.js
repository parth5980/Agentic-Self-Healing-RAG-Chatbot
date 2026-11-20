import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  authLimiter,
  guessLimiter,
  sendCodeIpLimiter,
  sendCodeEmailLimiter,
} from "../middlewares/rateLimit.middleware.js";

const authRouter = Router();
authRouter.use(authLimiter);

/**
 * POST /api/auth/register
 */
authRouter.post(
  "/register",
  sendCodeIpLimiter,
  sendCodeEmailLimiter,
  authController.register,
);

/**
 * POST /api/auth/login
 */
authRouter.post("/login", guessLimiter, authController.login);

/**
 * GET /api/auth/get-me
 */
authRouter.get("/get-me", authController.getMe);

/**
 * GET /api/auth/refresh-token
 */
authRouter.get("/refresh-token", authController.refreshToken);

/**
 * GET /api/auth/logout
 */
authRouter.get("/logout", authController.logout);

/**
 * GET /api/auth/logout-all
 */
authRouter.get("/logout-all", authController.logoutAll);

/**
 * GET /api/auth/verify-email
 */
authRouter.post("/verify-email", guessLimiter, authController.verifyEmail);

/**
 * POST /api/auth/resend-otp
 */
authRouter.post(
  "/resend-otp",
  sendCodeIpLimiter,
  sendCodeEmailLimiter,
  authController.resendOtp,
);

/**
 * POST /api/auth/forgot-password
 */
authRouter.post(
  "/forgot-password",
  sendCodeIpLimiter,
  sendCodeEmailLimiter,
  authController.forgotPassword,
);

/**
 * POST /api/auth/update-password
 */
authRouter.post(
  "/update-password",
  guessLimiter,
  authController.updatePassword,
);

/**
 * POST /api/auth/update-profile
 */
authRouter.post("/update-profile", requireAuth, authController.updateProfile);

export default authRouter;
