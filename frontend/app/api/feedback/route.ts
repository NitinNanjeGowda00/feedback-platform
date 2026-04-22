import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl } from "@/lib/backend-admin";

export async function POST(req: NextRequest) {
    try {
        const json = await req.json();

        const response = await fetch(`${backendBaseUrl()}/feedback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(json),
            cache: "no-store",
        });

        const data = await response.json();

        return NextResponse.json(data, {
            status: response.status,
        });
    } catch (err) {
        console.error("Feedback error:", err);
        return NextResponse.json(
            { message: "Failed to submit feedback." },
            { status: 500 }
        );
    }
}