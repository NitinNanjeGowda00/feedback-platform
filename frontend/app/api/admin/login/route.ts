import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
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

        response.cookies.set("admin_session", "true", {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/",
            maxAge: 60 * 60 * 8,
        });

        return response;
    } catch {
        return NextResponse.json(
            { message: "Invalid request." },
            { status: 400 }
        );
    }
}