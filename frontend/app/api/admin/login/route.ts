import { NextResponse } from "next/server";
import {
    ADMIN_SESSION_COOKIE_NAME,
    ADMIN_SESSION_TTL_SECONDS,
    createAdminSessionToken,
} from "@/lib/admin-session";

export async function POST(req: Request) {
    try {
        const body = (await req.json().catch(() => ({}))) as { key?: string };
        const key = body.key?.trim();

        if (!key || key !== process.env.ADMIN_API_KEY) {
            return NextResponse.json(
                { success: false, error: "Invalid admin key" },
                { status: 401 },
            );
        }

        const sessionSecret = process.env.ADMIN_SESSION_SECRET;
        if (!sessionSecret) {
            return NextResponse.json(
                { success: false, error: "ADMIN_SESSION_SECRET is missing" },
                { status: 500 },
            );
        }

        const token = await createAdminSessionToken(sessionSecret);

        const response = NextResponse.json({ success: true });
        response.cookies.set({
            name: ADMIN_SESSION_COOKIE_NAME,
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: ADMIN_SESSION_TTL_SECONDS,
        });

        return response;
    } catch {
        return NextResponse.json(
            { success: false, error: "Login failed" },
            { status: 500 },
        );
    }
}