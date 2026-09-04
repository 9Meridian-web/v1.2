import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { RazorpayService } from "../services/razorpayService";

function requiredString(
  value: unknown,
  field: string,
  min = 1,
  max = 200
): string {
  const result = String(value ?? "").trim();

  if (result.length < min || result.length > max) {
    throw new AppError(
      `${field} is required and must be between ${min} and ${max} characters.`,
      400
    );
  }

  return result;
}

export class RazorpayController {
  /* ==========================================================
     CREATE ORDER
  ========================================================== */

  static async createOrder(req: Request, res: Response): Promise<void> {
    const business_name = requiredString(
      req.body.business_name,
      "Business name",
      2,
      100
    );

    const owner_name = requiredString(
      req.body.owner_name,
      "Owner name",
      2,
      100
    );

    const email = requiredString(
      req.body.email,
      "Email",
      5,
      254
    ).toLowerCase();

    const phone = requiredString(
      req.body.phone,
      "Phone",
      7,
      30
    );

    const industry = req.body.industry
      ? requiredString(req.body.industry, "Industry", 2, 80)
      : undefined;

    const plan = req.body.plan
      ? requiredString(req.body.plan, "Plan", 2, 40)
      : "Dual Bot Pack";

    const result = await RazorpayService.createOrder({
      business_name,
      owner_name,
      email,
      phone,
      industry,
      plan,
    });

    res.status(201).json({
      success: true,
      message: "Razorpay order created.",
      data: result,
    });
  }

  /* ==========================================================
     VERIFY PAYMENT
  ========================================================== */

  static async verify(req: Request, res: Response): Promise<void> {
    const orderId = requiredString(
      req.body.razorpay_order_id,
      "razorpay_order_id",
      5,
      100
    );

    const paymentId = requiredString(
      req.body.razorpay_payment_id,
      "razorpay_payment_id",
      5,
      100
    );

    const signature = requiredString(
      req.body.razorpay_signature,
      "razorpay_signature",
      20,
      200
    );

    const result = await RazorpayService.verifyAndFulfilCheckout({
      orderId,
      paymentId,
      signature,
    });

    res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      data: {
        client_id: result.client_id,
        setup_token: result.setup_token,
      },
    });
  }

  /* ==========================================================
     ORDER / PAYMENT STATUS (polling fallback)
  ========================================================== */

  static async status(req: Request, res: Response): Promise<void> {
    const orderId = requiredString(
      req.params.orderId,
      "orderId",
      5,
      100
    );

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");

    const result = await RazorpayService.getOrderStatus(orderId);

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /* ==========================================================
     WEBHOOK
  ========================================================== */

  static async webhook(req: Request, res: Response): Promise<void> {
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError("Webhook raw body is required.", 400);
    }

    const signature = String(
      req.headers["x-razorpay-signature"] ?? ""
    ).trim();

    if (!signature) {
      throw new AppError(
        "Missing Razorpay webhook signature.",
        400
      );
    }

    const eventId = String(
      req.headers["x-razorpay-event-id"] ?? ""
    ).trim();

    await RazorpayService.enqueueWebhook(
      req.body,
      signature,
      eventId
    );

    // Vercel Hobby has no frequent Cron jobs. Process the newly persisted event
    // during this webhook request instead of relying on a long-running worker.
    // The queue's database claim logic still makes duplicate provider retries
    // and concurrent function instances safe.
    await RazorpayService.processWebhookQueue();

    res.status(200).json({
      success: true,
      received: true,
      processed: true,
    });
  }
}
