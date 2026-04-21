"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Eye, EyeOff, KeyRound, Lock, Shield } from "lucide-react";

export default function AdminLoginForm() {
    const router = useRouter();
    const [adminKey, setAdminKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ key: adminKey }),
            });

            const data = (await res.json().catch(() => ({}))) as {
                error?: string;
            };

            if (!res.ok) {
                throw new Error(data.error || "Invalid admin key");
            }

            router.replace("/admin/dashboard");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.09),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f8fafc_100%)] px-4 py-10 text-slate-900">
            <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl flex-col items-center justify-center">
                <div className="w-full max-w-[560px] text-center">
                    <div className="mx-auto mb-8 flex justify-center">
                        <div className="flex h-[100px] w-[100px] items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#7c3aed_0%,#a855f7_55%,#8b5cf6_100%)] shadow-[0_16px_30px_rgba(124,58,237,0.26)]">
                            <Shield className="h-11 w-11 text-white" />
                        </div>
                    </div>

                    <h1 className="text-[42px] font-extrabold tracking-tight text-slate-950">
                        Admin Portal
                    </h1>
                    <p className="mt-3 text-[18px] text-slate-600">
                        Feedback Intelligence Dashboard
                    </p>

                    <div className="mt-16 rounded-[26px] border border-slate-200/90 bg-white/95 p-8 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
                        <div className="flex items-center justify-center gap-2 text-[26px] font-semibold tracking-tight text-slate-950">
                            <KeyRound className="h-6 w-6 text-violet-600" />
                            Secure Access
                        </div>
                        <p className="mt-3 text-[18px] text-slate-500">
                            Enter your admin key to continue
                        </p>

                        <form onSubmit={handleLogin} className="mt-12 text-left">
                            <label className="mb-2 block text-[16px] font-semibold text-slate-800">
                                Admin Key
                            </label>

                            <div className="relative">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Lock className="h-5 w-5" />
                                </span>

                                <input
                                    type={showKey ? "text" : "password"}
                                    value={adminKey}
                                    onChange={(e) => setAdminKey(e.target.value)}
                                    placeholder="Enter your x-admin-key"
                                    autoComplete="current-password"
                                    className="h-[58px] w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-14 text-[17px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-violet-400"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowKey((v) => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-800"
                                    aria-label={showKey ? "Hide key" : "Show key"}
                                >
                                    {showKey ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>

                            <p className="mt-3 text-[15px] text-slate-500">
                                This key is used to authenticate API requests
                            </p>

                            {error ? (
                                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </div>
                            ) : null}

                            <button
                                type="submit"
                                disabled={loading || !adminKey}
                                className="mt-6 inline-flex h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#9333ea_55%,#a855f7_100%)] text-[18px] font-semibold text-white shadow-[0_16px_30px_rgba(124,58,237,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Verifying..." : "Access Dashboard"}
                                <ArrowUpRight className="h-5 w-5" />
                            </button>
                        </form>

                        <div className="mt-8 border-t border-slate-200 pt-7">
                            <div className="flex items-center justify-center gap-2 text-[16px] text-slate-500">
                                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                                Secure connection
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}