import express from "express";
import authRouter from "./routes/auth.route.js";
import cookieParser from "cookie-parser";
import chatRouter from "./routes/chat.route.js";
import cors from "cors";
import config from "./config/config.js";

const app = express();

// Required behind Render/Railway/Nginx so req.ip and rate limiting see the real client IP
if (config.TRUST_PROXY) app.set("trust proxy", config.TRUST_PROXY);

const allowedOrigins = config.CLIENT_URL.split(",")
  .map((o) => o.trim().replace(/\/$/, "")) // origins never have a trailing slash
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);

export default app;
