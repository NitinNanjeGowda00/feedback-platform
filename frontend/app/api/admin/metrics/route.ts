import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-session";
import { getMetrics } from "@/lib/backend-admin";

export async function GET(req: NextRequest) {
    if (!(await isAdminRequestAuthorized(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getMetrics();
    return NextResponse.json(data);
}