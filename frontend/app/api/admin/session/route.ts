import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const authenticated = req.cookies.get("admin_session")?.value === "true";
    return NextResponse.json({ authenticated });
}