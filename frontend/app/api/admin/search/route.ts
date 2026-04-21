import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-session";
import { searchFeedback } from "@/lib/backend-admin";

export async function POST(req: NextRequest) {
    if (!(await isAdminRequestAuthorized(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
        query?: string;
        k?: number;
    };

    const query = body.query?.trim();
    const k = typeof body.k === "number" ? body.k : 5;

    if (!query) {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const data = await searchFeedback(query, k);
    return NextResponse.json(data);
}