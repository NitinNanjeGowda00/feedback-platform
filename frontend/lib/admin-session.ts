import { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

type AdminSessionPayload = {
    v: 1;
    iat: number;
    exp: number;
    nonce: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array) {
    return Buffer.from(bytes)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
    const base64 =
        input.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (input.length % 4)) % 4);
    return new Uint8Array(Buffer.from(base64, "base64"));
}

function timingSafeEqual(a: string, b: string) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i += 1) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

async function importHmacKey(secret: string) {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
}

async function signHmac(data: string, secret: string) {
    const key = await importHmacKey(secret);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return base64UrlEncode(new Uint8Array(signature));
}

export async function createAdminSessionToken(secret: string) {
    const now = Date.now();
    const random = crypto.getRandomValues(new Uint8Array(16));
    const nonce = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join(
        "",
    );

    const payload: AdminSessionPayload = {
        v: 1,
        iat: now,
        exp: now + ADMIN_SESSION_TTL_SECONDS * 1000,
        nonce,
    };

    const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const signature = await signHmac(payloadB64, secret);

    return `${payloadB64}.${signature}`;
}

export async function verifyAdminSessionToken(token: string, secret: string) {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return false;

    const expectedSignature = await signHmac(payloadB64, secret);
    if (!timingSafeEqual(signature, expectedSignature)) return false;

    try {
        const payloadJson = decoder.decode(base64UrlDecode(payloadB64));
        const payload = JSON.parse(payloadJson) as AdminSessionPayload;

        if (!payload || payload.v !== 1) return false;
        if (typeof payload.exp !== "number") return false;
        if (Date.now() > payload.exp) return false;

        return true;
    } catch {
        return false;
    }
}

export async function isAdminRequestAuthorized(req: NextRequest) {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) return false;

    const token = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    if (!token) return false;

    return verifyAdminSessionToken(token, secret);
}