import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    ADMIN_SESSION_COOKIE_NAME,
    verifyAdminSessionToken,
} from "@/lib/admin-session";
import AdminLoginForm from "@/components/admin/admin-login-form";

export default async function AdminPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    const secret = process.env.ADMIN_SESSION_SECRET;

    if (token && secret) {
        const valid = await verifyAdminSessionToken(token, secret);
        if (valid) redirect("/admin/dashboard");
    }

    return <AdminLoginForm />;
}