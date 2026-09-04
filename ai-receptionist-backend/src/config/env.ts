import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback;
    if (!value || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value.trim();
}

function getCsvEnv(name: string, fallback: string): string[] {
    return getEnv(name, fallback)
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
}

const NODE_ENV = process.env.NODE_ENV ?? "development";

if (NODE_ENV === "production") {
    if ((process.env.JWT_SECRET ?? "").length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters in production.");
    }
    if (!process.env.FRONTEND_URL?.startsWith("https://")) {
        throw new Error("FRONTEND_URL must use HTTPS in production.");
    }
    if (!process.env.GOOGLE_REDIRECT_URI?.startsWith("https://")) {
        throw new Error("GOOGLE_REDIRECT_URI must use HTTPS in production.");
    }
    if (!process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
        throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is required in production.");
    }
    if (!process.env.INTERNAL_WEBHOOK_SECRET) {
        throw new Error("INTERNAL_WEBHOOK_SECRET is required in production.");
    }
    if (!process.env.ONBOARDING_TOKEN_SECRET) {
        throw new Error("ONBOARDING_TOKEN_SECRET is required in production.");
    }
    if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 16) {
        throw new Error("CRON_SECRET must be at least 16 characters in production.");
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_WEBHOOK_SECRET) {
        throw new Error("Razorpay credentials are required in production.");
    }
    if (!Number.isInteger(Number(process.env.RAZORPAY_AMOUNT_PAISE)) || Number(process.env.RAZORPAY_AMOUNT_PAISE) <= 0) {
        throw new Error("RAZORPAY_AMOUNT_PAISE must be a positive integer in production.");
    }
}

export const env = {
    PORT: Number(process.env.PORT ?? 8080),
    NODE_ENV,
    FRONTEND_URL: getEnv("FRONTEND_URL", "http://localhost:3000"),
    CORS_ORIGINS: getCsvEnv("CORS_ORIGINS", process.env.FRONTEND_URL ?? "http://localhost:3000"),

    SUPABASE_URL: getEnv("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: getEnv("SUPABASE_SERVICE_ROLE_KEY"),

    JWT_SECRET: getEnv("JWT_SECRET"),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",

    GOOGLE_CLIENT_ID: getEnv("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: getEnv("GOOGLE_CLIENT_SECRET"),
    GOOGLE_REDIRECT_URI: getEnv("GOOGLE_REDIRECT_URI"),
    GOOGLE_OAUTH_STATE_SECRET: getEnv("GOOGLE_OAUTH_STATE_SECRET", process.env.JWT_SECRET),

    GOOGLE_CALENDAR_DEFAULT: process.env.GOOGLE_CALENDAR_DEFAULT ?? "primary",
    GOOGLE_SHEETS_DEFAULT_NAME: process.env.GOOGLE_SHEETS_DEFAULT_NAME ?? "AI Receptionist Bookings",

    PUBLIC_AGENT_BASE_URL: getEnv("PUBLIC_AGENT_BASE_URL", `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/agent`),
    INTERNAL_WEBHOOK_SECRET: process.env.INTERNAL_WEBHOOK_SECRET ?? "",
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "",
    ONBOARDING_TOKEN_SECRET: getEnv("ONBOARDING_TOKEN_SECRET", process.env.JWT_SECRET),
    CRON_SECRET: process.env.CRON_SECRET ?? "",

    RAZORPAY_KEY_ID: getEnv("RAZORPAY_KEY_ID", "rzp_test_placeholder"),
    RAZORPAY_KEY_SECRET: getEnv("RAZORPAY_KEY_SECRET", "development-placeholder"),
    RAZORPAY_WEBHOOK_SECRET: getEnv("RAZORPAY_WEBHOOK_SECRET", "development-webhook-placeholder"),
    RAZORPAY_AMOUNT_PAISE: Number(process.env.RAZORPAY_AMOUNT_PAISE ?? 99900),
    RAZORPAY_CURRENCY: process.env.RAZORPAY_CURRENCY ?? "INR",
    RAZORPAY_DEFAULT_PLAN: process.env.RAZORPAY_DEFAULT_PLAN ?? "Starter",

    RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX ?? 120),
    AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
    PUBLIC_RATE_LIMIT_MAX: Number(process.env.PUBLIC_RATE_LIMIT_MAX ?? 30),
    PAYMENT_RATE_LIMIT_MAX: Number(process.env.PAYMENT_RATE_LIMIT_MAX ?? 20),
} as const;
