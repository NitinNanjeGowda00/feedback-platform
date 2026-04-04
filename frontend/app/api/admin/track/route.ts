import { NextRequest, NextResponse } from "next/server";
import { backendBaseUrl } from "../admin/_auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const response = await fetch(`${backendBaseUrl()}/track`, {
            method: "POST",
            headers: {
                "Content-Type": req.headers.get("content-type") || "application/json",
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
        return NextResponse.json({ tracked: false }, { status: 500 });
    }
}