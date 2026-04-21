import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    ADMIN_SESSION_COOKIE_NAME,
    verifyAdminSessionToken,
} from "@/lib/admin-session";
import AdminDashboardClient from "@/components/admin/admin-dashboard-client";

export default async function AdminDashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    const secret = process.env.ADMIN_SESSION_SECRET;

    if (!token || !secret) {
        redirect("/admin");
    }

    const valid = await verifyAdminSessionToken(token, secret);

    if (!valid) {
        redirect("/admin");
    }

    return <AdminDashboardClient />;
}