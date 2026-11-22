import express from "express";
import authRouter from "./routes/auth.route.js";
import cookieParser from "cookie-parser";
import chatRouter from "./routes/chat.route.js";
import cors from "cors";
import config from "./config/config.js";

const allowedOrigins = config.CLIENT_URL.split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

const app = express();
if (config.TRUST_PROXY) app.set("trust proxy", config.TRUST_PROXY);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.set("trust proxy", 1);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);

export default app;
