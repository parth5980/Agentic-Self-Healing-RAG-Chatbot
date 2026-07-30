import userModel from "../models/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import sessionModel from "../models/session.model.js";
import { sendEmail } from "../services/email.service.js";
import { generateOtp, getOtpHtml } from "../utils/utils.js";
import otpModel from "../models/otp.model.js";

export async function register(req, res) {
  const { username, email, password } = req.body;

  const isAlreadyRegistered = await userModel.findOne({
    $or: [{ username }, { email }],
  });

  if (isAlreadyRegistered) {
    return res.status(409).json({
      message: "Username or email already exists",
    });
  }

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const user = await userModel.create({
    username,
    email,
    password: hashedPassword,
  });

  const otp = generateOtp();
  const html = getOtpHtml(otp);

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  await otpModel.create({
    email,
    user: user._id,
    otpHash,
  });

  await sendEmail(email, "OTP Verification", `Your OTP code is ${otp}`, html);

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

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const isPasswordValid = hashedPassword === user.password;

  if (!isPasswordValid) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
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

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  const otpDoc = await otpModel.findOne({
    email,
    otpHash,
  });

  if (!otpDoc) {
    return res.status(400).json({
      message: "Invalid OTP",
    });
  }

  const user = await userModel.findByIdAndUpdate(otpDoc.user, {
    verified: true,
  });

  await otpModel.deleteMany({
    user: otpDoc.user,
  });

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
  const user = await userModel.findOne({ email });

  if (!user)
    return res.status(404).json({ message: "No account found for this email" });
  if (user.verified)
    return res.status(400).json({ message: "Email is already verified" });

  await otpModel.deleteMany({ user: user._id });

  const otp = generateOtp();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  await otpModel.create({ email, user: user._id, otpHash });
  await sendEmail(
    email,
    "OTP Verification",
    `Your OTP code is ${otp}`,
    getOtpHtml(otp),
  );

  res.status(200).json({ message: "OTP resent successfully" });
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

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

  const otp = generateOtp();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  await otpModel.create({
    email,
    user: user._id,
    otpHash,
    purpose: "reset-password",
  });
  await sendEmail(
    email,
    "Password Reset Code",
    `Your password reset code is ${otp}`,
    getOtpHtml(otp),
  );

  res.status(200).json(genericResponse);
}

export async function updatePassword(req, res) {
  const { newPassword, currentPassword, email, otp } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters" });
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

    const currentHash = crypto
      .createHash("sha256")
      .update(currentPassword)
      .digest("hex");
    if (currentHash !== user.password) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
  } else {
    // Forgot-password flow: no token, verify the OTP instead
    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email and reset code are required" });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpDoc = await otpModel.findOne({
      email,
      otpHash,
      purpose: "reset-password",
    });
    if (!otpDoc)
      return res.status(400).json({ message: "Invalid or expired reset code" });

    user = await userModel.findById(otpDoc.user);
    if (!user) return res.status(404).json({ message: "User not found" });

    await otpModel.deleteMany({ user: user._id, purpose: "reset-password" });
  }

  user.password = crypto.createHash("sha256").update(newPassword).digest("hex");
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
