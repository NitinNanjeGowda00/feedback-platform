import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-session";
import { getFeedback } from "@/lib/backend-admin";

export async function GET(req: NextRequest) {
    if (!(await isAdminRequestAuthorized(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getFeedback();
    return NextResponse.json(data);
}