import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

import routes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { requestIdMiddleware } from "./middlewares/requestId";
import { env } from "./config/env";
import { supabase } from "./config/supabase";
import { RazorpayController } from "./controllers/razorpayController";
import { rateLimit } from "./middlewares/rateLimitMiddleware";

const app: Application = express();

app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);
app.disable("x-powered-by");

app.use(requestIdMiddleware);

/* ---------------- Security ---------------- */

app.use(
  helmet({
    // The marketing site intentionally uses a small amount of inline UI code.
    // Keep the allowed third parties explicit so Helmet does not either break the
    // site in production or silently fall back to an unrestricted policy.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://accounts.google.com",
          "https://checkout.razorpay.com",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://checkout.razorpay.com",
          "https://api.razorpay.com",
        ],
        frameSrc: ["'self'", "https://accounts.google.com", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: env.NODE_ENV === "production" ? undefined : false,
  })
);

/* ---------------- CORS ---------------- */

app.use(
  cors({
    origin(origin, callback) {
      // Server-to-server probes and same-origin browser traffic omit Origin.
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
    maxAge: 86_400,
  })
);

/* ---------------- Razorpay Webhook ---------------- */

app.post(
  "/api/payments/razorpay/webhook",
  express.raw({
    type: "application/json",
    limit: "512kb",
  }),
  RazorpayController.webhook
);

/* ---------------- Body Parser ---------------- */

app.use(express.json({ limit: "2mb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

/* ---------------- Logger ---------------- */

morgan.token("request-id", (_req, res) =>
  String(res.getHeader("x-request-id") ?? "-")
);

app.use(
  morgan(
    env.NODE_ENV === "production"
      ? ":request-id :method :url :status :response-time ms"
      : "[:request-id] :method :url :status :response-time ms"
  )
);

/* ---------------- Health ---------------- */

app.get("/health/live", (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "live",
  });
});

// The public site uses this lightweight endpoint to determine whether its
// same-origin API is available. Keep the established operational health
// endpoints above for infrastructure probes.
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "healthy",
  });
});

app.get("/health/ready", async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from("clients")
      .select("id")
      .limit(1);

    if (error) throw error;

    res.json({
      success: true,
      status: "ready",
    });
  } catch {
    res.status(503).json({
      success: false,
      status: "not_ready",
    });
  }
});

/* ---------------- API ---------------- */

// A broad outer limit protects routes which do not need a stricter, endpoint
// specific policy. Auth, payments, and public forms retain their lower limits.
app.use("/api", rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX }));
app.use("/api", routes);

/* ---------------- Frontend ---------------- */

// OAuth client IDs are public browser identifiers (unlike client secrets).
// Supplying this tiny runtime config keeps the deployed HTML free of
// environment-specific values while allowing Google Identity Services to run.
app.get("/runtime-config.js", (_req: Request, res: Response) => {
  res
    .type("application/javascript")
    .set("Cache-Control", "no-store")
    .send(
      `window.NINE_MERIDIAN_RUNTIME_CONFIG=Object.freeze({googleClientId:${JSON.stringify(env.GOOGLE_CLIENT_ID)}});`
    );
});

const websitePath = path.join(process.cwd(), "9-meridian-website");

app.use(
  express.static(websitePath, {
    index: "index.html",
    extensions: ["html"],
    maxAge: env.NODE_ENV === "production" ? "1h" : 0,
    etag: true,
  })
);

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(websitePath, "index.html"));
});

/* SPA Fallback */

app.get(/^(?!\/api|\/health).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(websitePath, "index.html"));
});

/* ---------------- 404 ---------------- */

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    request_id: res.locals.requestId,
  });
});

/* ---------------- Error Handler ---------------- */

app.use(
  (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    errorHandler(error, req, res, next);
  }
);

export { app };
export default app;
