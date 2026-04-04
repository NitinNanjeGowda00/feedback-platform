import { NextRequest, NextResponse } from "next/server";
import { backendAdminKey, backendBaseUrl, isAuthenticated } from "../_auth";

export async function GET(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const response = await fetch(`${backendBaseUrl()}/analytics/summary`, {
            method: "GET",
            headers: {
                "X-Admin-Key": backendAdminKey(),
            },
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
            { message: "Failed to load analytics." },
            { status: 500 }
        );
    }
}