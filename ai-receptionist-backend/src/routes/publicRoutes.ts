import { Router } from "express";
import { PublicController } from "../controllers/publicController";
import { rateLimit } from "../middlewares/rateLimitMiddleware";
import { env } from "../config/env";

const router = Router();

router.post(
  "/feedback",
  rateLimit({ windowMs: 60_000, max: env.PUBLIC_RATE_LIMIT_MAX }),
  PublicController.submitFeedback,
);

export default router;
