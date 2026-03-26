import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
    const response = NextResponse.json({ success: true });

    response.cookies.set("admin_session", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 0,
    });

    return response;
}