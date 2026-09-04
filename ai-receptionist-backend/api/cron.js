const { timingSafeEqual } = require("node:crypto");
const { env } = require("../dist/config/env");
const { RazorpayService } = require("../dist/services/razorpayService");

function matchesCronSecret(value) {
  if (!value || !env.CRON_SECRET) return false;

  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const received = Buffer.from(value);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// Vercel Cron invokes this endpoint with Authorization: Bearer $CRON_SECRET.
// The queue's database claim operation makes retries and overlapping invocations
// safe across serverless instances.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, message: "Method not allowed." });
    return;
  }

  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;

  if (!matchesCronSecret(authorization)) {
    sendJson(res, 401, { success: false, message: "Unauthorized." });
    return;
  }

  try {
    await RazorpayService.processWebhookQueue();
    sendJson(res, 200, { success: true, processed: true });
  } catch (error) {
    console.error("Razorpay webhook cron failed:", error);
    sendJson(res, 500, { success: false, message: "Webhook processing failed." });
  }
};
