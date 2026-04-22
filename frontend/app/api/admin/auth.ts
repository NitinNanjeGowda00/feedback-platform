import crypto from "crypto";
import { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getSessionSecret() {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
        throw new Error("ADMIN_SESSION_SECRET is not set");
    }
    return secret;
}

export function createSessionToken() {
    const issuedAt = Math.floor(Date.now() / 1000).toString();
    const payload = `${issuedAt}.${SESSION_TTL_SECONDS}`;
    const signature = crypto
        .createHmac("sha256", getSessionSecret())
        .update(payload)
        .digest("base64url");

    return `${payload}.${signature}`;
}

export function verifySessionToken(token?: string | null) {
    if (!token) return false;

    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const [issuedAtStr, ttlStr, signature] = parts;
    const payload = `${issuedAtStr}.${ttlStr}`;
    const expected = crypto
        .createHmac("sha256", getSessionSecret())
        .update(payload)
        .digest("base64url");

    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

    const issuedAt = Number(issuedAtStr);
    const ttl = Number(ttlStr);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(ttl)) return false;

    const age = Math.floor(Date.now() / 1000) - issuedAt;
    return age >= 0 && age <= ttl;
}

export function isAuthenticated(req: NextRequest) {
    return verifySessionToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value);
}

export function backendBaseUrl() {
    const url = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!url) {
        throw new Error("BACKEND_API_BASE_URL is not configured");
    }
    return url.replace(/\/$/, "");
}

export function backendAdminKey() {
    const key = process.env.ADMIN_API_KEY;
    if (!key) {
        throw new Error("ADMIN_API_KEY is not configured");
    }
    return key;
}