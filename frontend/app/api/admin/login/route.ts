import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, ADMIN_COOKIE_NAME, SESSION_TTL_SECONDS } from "../_auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const password = String(body?.password ?? "");

        if (!process.env.ADMIN_PASSWORD) {
            return NextResponse.json(
                { message: "Server admin password is not configured." },
                { status: 500 }
            );
        }

        if (password !== process.env.ADMIN_PASSWORD) {
            return NextResponse.json(
                { message: "Invalid admin password." },
                { status: 401 }
            );
        }

        const response = NextResponse.json({ authenticated: true });
        response.cookies.set(ADMIN_COOKIE_NAME, createSessionToken(), {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: SESSION_TTL_SECONDS,
        });

        return response;
    } catch {
        return NextResponse.json({ message: "Invalid request." }, { status: 400 });
    }
}