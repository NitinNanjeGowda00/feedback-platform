import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-session";
import { backendRaw } from "@/lib/backend-admin";

export async function GET(req: NextRequest) {
    if (!(await isAdminRequestAuthorized(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await backendRaw("/feedback/export");

    return new NextResponse(res.body, {
        status: res.status,
        headers: res.headers,
    });
}