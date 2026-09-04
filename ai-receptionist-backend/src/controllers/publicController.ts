import { Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { supabase } from "../config/supabase";
import { asyncHandler } from "../middlewares/asyncHandler";

function optionalText(value: unknown, maxLength: number): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.length > maxLength) {
    throw new AppError(`Value must not exceed ${maxLength} characters.`, 400);
  }
  return text;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  const text = optionalText(value, maxLength);
  if (!text) throw new AppError(`${field} is required.`, 400);
  return text;
}

export class PublicController {
  static submitFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const message = requiredText(req.body?.message, "Feedback message", 2_000);
    const ratingValue = req.body?.rating;
    const rating = ratingValue === null || ratingValue === undefined || ratingValue === ""
      ? null
      : Number(ratingValue);

    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      throw new AppError("Rating must be a whole number between 1 and 5.", 400);
    }

    const { error } = await supabase.from("website_feedback").insert({
      name: optionalText(req.body?.name, 100),
      email: optionalText(req.body?.email, 254)?.toLowerCase() ?? null,
      rating,
      message,
      page_context: optionalText(req.body?.page_context, 120),
    });

    if (error) throw new AppError("Unable to save feedback. Please try again.", 503);
    res.status(201).json({ success: true, message: "Feedback received." });
  });
}
