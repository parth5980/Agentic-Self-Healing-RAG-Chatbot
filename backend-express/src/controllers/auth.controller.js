import userModel from "../models/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import sessionModel from "../models/session.model.js";
import { sendEmail } from "../services/email.service.js";
import { createOtp, verifyOtp } from "../services/otp.service.js";
import { generateOtp, getOtpHtml } from "../utils/utils.js";
import otpModel from "../models/otp.model.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

export async function register(req, res) {
  const { username, email, password } = req.body;

  if (!password || password.length < 8 || password.length > 72) {
    return res
      .status(400)
      .json({ message: "Password must be 8-72 characters" });
  }

  const isAlreadyRegistered = await userModel.findOne({
    $or: [{ username }, { email }],
  });

  if (isAlreadyRegistered) {
    return res.status(409).json({
      message: "Username or email already exists",
    });
  }

  const hashedPassword = await hashPassword(password);
  // const hashedPassword = crypto
  //   .createHash("sha256")
  //   .update(password)
  //   .digest("hex");

  const user = await userModel.create({
    username,
    email,
    password: hashedPassword,
  });

  const otp = await createOtp({
    email,
    user: user._id,
    purpose: "verify-email",
  });

  await sendEmail(
    email,
    "OTP Verification",
    `Your OTP code is ${otp}. It expires in 10 minutes.`,
    getOtpHtml(otp),
  );

  res.status(201).json({
    message: "User registered successfully",
    user: {
      username: user.username,
      email: user.email,
      verified: user.verified,
    },
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }

  if (!user.verified) {
    return res.status(401).json({
      message: "Email not verified",
    });
  }

  // const hashedPassword = crypto
  //   .createHash("sha256")
  //   .update(password)
  //   .digest("hex");

  // const isPasswordValid = hashedPassword === user.password;

  // if (!isPasswordValid) {
  //   return res.status(401).json({
  //     message: "Invalid email or password",
  //   });
  // }
  const { valid, needsRehash } = await verifyPassword(password, user.password);

  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // One-time lazy migration: upgrade old SHA-256 hashes on successful login
  if (needsRehash) {
    user.password = await hashPassword(password);
    await user.save();
  }

  const refreshToken = jwt.sign(
    {
      id: user._id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.create({
    user: user._id,
    refreshTokenHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const accessToken = jwt.sign(
    {
      id: user._id,
      sessionId: session._id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(200).json({
    message: "Logged in successfully",
    user: {
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    },
    accessToken,
  });
}

export async function getMe(req, res) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "token not found",
      header: req.headers,
    });
  }

  const decoded = jwt.verify(token, config.JWT_SECRET);

  const user = await userModel.findById(decoded.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  res.status(200).json({
    message: "user fetched successfully",
    user: {
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
}

export async function refreshToken(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: "Refresh token not found",
    });
  }

  const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.findOne({
    refreshTokenHash,
    revoked: false,
  });

  if (!session) {
    return res.status(401).json({
      message: "Invalid refresh token",
    });
  }

  const accessToken = jwt.sign(
    {
      id: decoded.id,
      sessionId: session._id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  const newRefreshToken = jwt.sign(
    {
      id: decoded.id,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const newRefreshTokenHash = crypto
    .createHash("sha256")
    .update(newRefreshToken)
    .digest("hex");

  session.refreshTokenHash = newRefreshTokenHash;
  await session.save();

  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(200).json({
    message: "Access token refreshed successfully",
    accessToken,
  });
}

export async function logout(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token not found",
      cookies: req.cookies,
    });
  }

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.findOne({
    refreshTokenHash,
    revoked: false,
  });

  if (!session) {
    return res.status(400).json({
      message: "Invalid refresh token",
    });
  }

  session.revoked = true;
  await session.save();

  res.clearCookie("refreshToken");

  res.status(200).json({
    message: "Logged out successfully",
  });
}

export async function logoutAll(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token not found",
    });
  }

  const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

  await sessionModel.updateMany(
    {
      user: decoded.id,
      revoked: false,
    },
    {
      revoked: true,
    },
  );

  res.clearCookie("refreshToken");

  res.status(200).json({
    message: "Logged out from all devices successfully",
  });
}

export async function verifyEmail(req, res) {
  const { otp, email } = req.body;

  const result = await verifyOtp({ email, otp, purpose: "verify-email" });
  if (!result.ok) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  const user = await userModel.findByIdAndUpdate(
    result.userId,
    { verified: true },
    { new: true }, // original returned the pre-update doc, so it reported verified: false
  );
  if (!user) return res.status(404).json({ message: "User not found" });

  await otpModel.deleteMany({ user: result.userId });

  return res.status(200).json({
    message: "Email verified successfully",
    user: {
      username: user.username,
      email: user.email,
      verified: user.verified,
    },
  });
}

export async function resendOtp(req, res) {
  const { email } = req.body;
  if (typeof email !== "string" || !email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await userModel.findOne({ email });
  if (!user)
    return res.status(404).json({ message: "No account found for this email" });
  if (user.verified)
    return res.status(400).json({ message: "Email is already verified" });

  const otp = await createOtp({
    email,
    user: user._id,
    purpose: "verify-email",
  });
  await sendEmail(
    email,
    "OTP Verification",
    `Your OTP code is ${otp}. It expires in 10 minutes.`,
    getOtpHtml(otp),
  );

  res.status(200).json({ message: "OTP resent successfully" });
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  if (typeof email !== "string" || !email)
    return res.status(400).json({ message: "Email is required" });

  const user = await userModel.findOne({ email });

  // Same response whether or not the account exists, so this can't be used
  // to enumerate registered emails.
  const genericResponse = {
    message: "If an account exists for this email, a reset code has been sent.",
  };

  if (!user || !user.verified) {
    return res.status(200).json(genericResponse);
  }

  await otpModel.deleteMany({ user: user._id, purpose: "reset-password" });

  const otp = await createOtp({
    email,
    user: user._id,
    purpose: "reset-password",
  });
  await sendEmail(
    email,
    "Password Reset Code",
    `Your password reset code is ${otp}. It expires in 10 minutes.`,
    getOtpHtml(otp),
  );

  res.status(200).json(genericResponse);
}

export async function updatePassword(req, res) {
  const { newPassword, currentPassword, email, otp } = req.body;

  if (!newPassword || newPassword.length < 8 || newPassword.length > 72) {
    return res
      .status(400)
      .json({ message: "New password must be between 8 and 72 characters" });
  }

  let user;
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    // Settings flow: logged in, verify the current password
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({ message: "Invalid or expired access token" });
    }

    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    user = await userModel.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // const currentHash = crypto
    //   .createHash("sha256")
    //   .update(currentPassword)
    //   .digest("hex");
    // if (currentHash !== user.password) {
    //   return res.status(401).json({ message: "Current password is incorrect" });
    // }
    const { valid } = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
  } else {
    // Forgot-password flow: no token, verify the OTP instead
    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email and reset code are required" });
    }

    const result = await verifyOtp({ email, otp, purpose: "reset-password" });
    if (!result.ok) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    user = await userModel.findById(result.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    await otpModel.deleteMany({ user: user._id, purpose: "reset-password" });
  }

  // user.password = crypto.createHash("sha256").update(newPassword).digest("hex");
  user.password = await hashPassword(newPassword);
  await user.save();

  // A changed password should kill every existing session — otherwise a
  // stolen refresh token from before the change would still work.
  await sessionModel.updateMany(
    { user: user._id, revoked: false },
    { revoked: true },
  );

  res.status(200).json({ message: "Password updated successfully" });
}

export async function updateProfile(req, res) {
  const { username } = req.body;
  if (!username?.trim())
    return res.status(400).json({ message: "Username is required" });

  const existing = await userModel.findOne({
    username,
    _id: { $ne: req.user.id },
  });
  if (existing)
    return res.status(409).json({ message: "Username already taken" });

  const user = await userModel.findByIdAndUpdate(
    req.user.id,
    { username: username.trim() },
    { new: true },
  );
  if (!user) return res.status(404).json({ message: "User not found" });

  res.status(200).json({
    message: "Profile updated successfully",
    user: {
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
}
