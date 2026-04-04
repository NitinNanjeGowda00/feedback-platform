import { NextRequest, NextResponse } from "next/server";
import { backendAdminKey, backendBaseUrl, isAuthenticated } from "../_auth";

export async function POST(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.text();
        const response = await fetch(`${backendBaseUrl()}/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Key": backendAdminKey(),
            },
            body,
            cache: "no-store",
        });

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: {
                "Content-Type": response.headers.get("content-type") || "application/json",
            },
        });
    } catch {
        return NextResponse.json(
            { message: "Failed to search feedback." },
            { status: 500 }
        );
    }
}