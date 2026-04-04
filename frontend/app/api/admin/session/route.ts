import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "../_auth";

export async function GET(req: NextRequest) {
    return NextResponse.json({ authenticated: isAuthenticated(req) });
}