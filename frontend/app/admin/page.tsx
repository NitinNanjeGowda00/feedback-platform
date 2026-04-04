"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type FeedbackEntry = {
    id: number;
    name: string;
    email: string;
    role: string;
    company: string;
    tools_used: string;
    pain_points: string;
    new_tool: string;
    category?: string | null;
    sentiment_label?: string | null;
    sentiment_score?: number | null;
    summary?: string | null;
    created_at: string;
};

type SortMode = "newest" | "oldest";

type AnalyticsSummary = {
    total_responses: number;
    page_views: number;
    submissions: number;
    conversion_rate: number;
    unique_companies: number;
    unique_roles: number;
    top_issues: { label: string; count: number }[];
    daily_visits: { date: string; count: number }[];
    latest_submission: string | null;
};

type InsightSummary = {
    summary: string;
    recommendations: string[];
    top_categories: { label: string; count: number }[];
    sample_highlights: string[];
};

type SearchResponse = {
    answer: string;
    matches: Array<{
        id: number;
        score: number;
        category?: string | null;
        summary?: string | null;
        snippet: string;
        created_at: string;
        name?: string;
        role?: string;
        company?: string;
    }>;
};

export default function AdminPage() {
    const [checkingSession, setCheckingSession] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    const [data, setData] = useState<FeedbackEntry[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [insights, setInsights] = useState<InsightSummary | null>(null);
    const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);

    const [dataLoading, setDataLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [sortMode, setSortMode] = useState<SortMode>("newest");
    const [refreshing, setRefreshing] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [ragQuery, setRagQuery] = useState("");

    useEffect(() => {
        void checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const res = await fetch("/api/admin/session", {
                method: "GET",
                cache: "no-store",
            });
            const json = await res.json();

            if (json?.authenticated) {
                setAuthorized(true);
                await loadAllData();
            } else {
                setAuthorized(false);
            }
        } catch {
            setAuthorized(false);
        } finally {
            setCheckingSession(false);
        }
    };

    const loadAllData = async () => {
        setDataLoading(true);
        setError("");

        try {
            const [feedbackRes, analyticsRes, insightsRes] = await Promise.all([
                fetch("/api/admin/feedback", { cache: "no-store" }),
                fetch("/api/admin/analytics", { cache: "no-store" }),
                fetch("/api/admin/insights", { cache: "no-store" }),
            ]);

            if (!feedbackRes.ok) throw new Error("Failed to load feedback submissions.");
            if (!analyticsRes.ok) throw new Error("Failed to load analytics.");
            if (!insightsRes.ok) throw new Error("Failed to load insights.");

            const feedbackJson: FeedbackEntry[] = await feedbackRes.json();
            const analyticsJson: AnalyticsSummary = await analyticsRes.json();
            const insightsJson: InsightSummary = await insightsRes.json();

            setData(feedbackJson);
            setAnalytics(analyticsJson);
            setInsights(insightsJson);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setDataLoading(false);
            setRefreshing(false);
        }
    };

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError("");

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password }),
            });

            const json = await res.json();

            if (!res.ok || !json?.authenticated) {
                throw new Error(json?.message || "Invalid password.");
            }

            setAuthorized(true);
            setPassword("");
            await loadAllData();
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = async () => {
        setLogoutLoading(true);
        try {
            await fetch("/api/admin/logout", { method: "POST" });
            setAuthorized(false);
            setPassword("");
            setData([]);
            setAnalytics(null);
            setInsights(null);
            setSearchResult(null);
            setSearch("");
            setRagQuery("");
            setSortMode("newest");
        } finally {
            setLogoutLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAllData();
    };

    const handleSemanticSearch = async () => {
        const query = ragQuery.trim();
        if (!query) return;

        setSearchLoading(true);
        setError("");

        try {
            const res = await fetch("/api/admin/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query, k: 5 }),
            });

            if (!res.ok) {
                throw new Error("Semantic search failed.");
            }

            const json: SearchResponse = await res.json();
            setSearchResult(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed");
        } finally {
            setSearchLoading(false);
        }
    };

    const filteredAndSorted = useMemo(() => {
        const q = search.trim().toLowerCase();

        const filtered = data.filter((item) => {
            if (!q) return true;

            return (
                item.name.toLowerCase().includes(q) ||
                item.email.toLowerCase().includes(q) ||
                item.role.toLowerCase().includes(q) ||
                item.company.toLowerCase().includes(q) ||
                (item.category || "").toLowerCase().includes(q) ||
                (item.sentiment_label || "").toLowerCase().includes(q) ||
                item.tools_used.toLowerCase().includes(q) ||
                item.pain_points.toLowerCase().includes(q) ||
                item.new_tool.toLowerCase().includes(q) ||
                (item.summary || "").toLowerCase().includes(q)
            );
        });

        return [...filtered].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortMode === "newest" ? dateB - dateA : dateA - dateB;
        });
    }, [data, search, sortMode]);

    const stats = useMemo(() => {
        const total = data.length;
        const companies = new Set(
            data.map((item) => item.company.trim()).filter(Boolean)
        ).size;
        const roles = new Set(data.map((item) => item.role.trim()).filter(Boolean)).size;
        const latest =
            data.length > 0
                ? new Date(
                    data.reduce((latestItem, current) =>
                        new Date(current.created_at) > new Date(latestItem.created_at)
                            ? current
                            : latestItem
                    ).created_at
                ).toLocaleString()
                : "—";

        return { total, companies, roles, latest };
    }, [data]);

    if (checkingSession) {
        return (
            <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.10),transparent_40%),linear-gradient(to_bottom,#f8fafc,#ffffff)] px-4 py-10">
                <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
                    <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
                        <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />
                        <div className="mt-6 h-8 w-48 animate-pulse rounded-full bg-slate-100" />
                        <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
                        <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-100" />
                    </div>
                </div>
            </main>
        );
    }

    if (!authorized) {
        return (
            <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.10),transparent_40%),linear-gradient(to_bottom,#f8fafc,#ffffff)] px-4 py-10">
                <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
                    <section className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-2xl backdrop-blur">
                        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-lg shadow-indigo-600/20">
                            🔐
                        </div>

                        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                            Private admin area
                        </p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                            Feedback Workspace
                        </h1>
                        <p className="mt-3 leading-7 text-slate-600">
                            Enter your passcode to review submissions, export data, and spot
                            patterns from the feedback you receive.
                        </p>

                        <form onSubmit={handleLogin} className="mt-8 space-y-4">
                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">
                                    Admin passcode
                                </span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your passcode"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                                    required
                                />
                            </label>

                            {loginError && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {loginError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loginLoading}
                                className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loginLoading ? "Opening workspace..." : "Enter workspace"}
                            </button>
                        </form>

                        <p className="mt-5 text-center text-xs text-slate-500">
                            This area is for the creator of the app only.
                        </p>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.10),transparent_35%),linear-gradient(to_bottom,#f8fafc,#ffffff)] px-4 py-8 text-slate-900">
            <div className="mx-auto max-w-7xl">
                <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl backdrop-blur sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
                                <span>●</span> Private admin workspace
                            </div>

                            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                                Feedback Intelligence Dashboard
                            </h1>

                            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                                Review what people are struggling with, identify patterns, search semantically,
                                and export data for deeper analysis or follow-up.
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                                <StatCard label="Total responses" value={stats.total} />
                                <StatCard label="Page views" value={analytics?.page_views ?? "—"} />
                                <StatCard
                                    label="Conversion rate"
                                    value={analytics ? `${analytics.conversion_rate}%` : "—"}
                                />
                                <StatCard label="Companies" value={stats.companies} />
                                <StatCard label="Roles" value={stats.roles} />
                                <StatCard label="Latest submission" value={stats.latest} compact />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 lg:min-w-[240px] lg:items-end">
                            <a
                                href="/api/admin/export"
                                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
                            >
                                Export CSV
                            </a>

                            <button
                                onClick={handleRefresh}
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                {refreshing ? "Refreshing..." : "Refresh data"}
                            </button>

                            <button
                                onClick={handleLogout}
                                disabled={logoutLoading}
                                className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {logoutLoading ? "Logging out..." : "Logout"}
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-6 lg:grid-cols-2">
                        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                            <h2 className="text-lg font-bold text-slate-950">AI summary</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                {insights?.summary || "No insights available yet."}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {insights?.top_categories?.map((item) => (
                                    <span
                                        key={item.label}
                                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                                    >
                                        {item.label}: {item.count}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-5">
                                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-500">
                                    Recommendations
                                </h3>
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                                    {(insights?.recommendations || []).map((item) => (
                                        <li key={item} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                            <h2 className="text-lg font-bold text-slate-950">Semantic search</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Ask a question and retrieve similar feedback with an AI-generated answer.
                            </p>

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <input
                                    value={ragQuery}
                                    onChange={(e) => setRagQuery(e.target.value)}
                                    placeholder='Try: "What do developers complain about?"'
                                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                                />
                                <button
                                    onClick={handleSemanticSearch}
                                    disabled={searchLoading}
                                    className="rounded-2xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {searchLoading ? "Searching..." : "Ask AI"}
                                </button>
                            </div>

                            <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
                                <p className="text-sm font-bold text-slate-900">Answer</p>
                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                    {searchResult?.answer || "Results will appear here."}
                                </p>
                            </div>

                            <div className="mt-4">
                                <p className="text-sm font-bold text-slate-900">Matching feedback</p>
                                <div className="mt-3 space-y-3">
                                    {(searchResult?.matches || []).map((match) => (
                                        <div key={match.id} className="rounded-2xl bg-white p-4 shadow-sm">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                                    {match.category || "Other"}
                                                </span>
                                                <span className="text-xs text-slate-500">score {match.score}</span>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-slate-700">{match.snippet}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <div className="flex items-center justify-between gap-4">
                            <p className="font-semibold text-slate-800">
                                {dataLoading
                                    ? "Loading..."
                                    : `${filteredAndSorted.length} result${filteredAndSorted.length === 1 ? "" : "s"}`}
                            </p>
                            <p className="text-sm text-slate-500">
                                {search ? `Filtered by: "${search}"` : "Showing all submissions"}
                            </p>
                        </div>
                    </div>

                    {dataLoading ? (
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="h-10 animate-pulse rounded-2xl bg-slate-100" />
                                <div className="h-10 animate-pulse rounded-2xl bg-slate-100" />
                                <div className="h-10 animate-pulse rounded-2xl bg-slate-100" />
                            </div>
                        </div>
                    ) : filteredAndSorted.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                                ✨
                            </div>
                            <h2 className="mt-4 text-xl font-bold text-slate-900">
                                No matching feedback
                            </h2>
                            <p className="mt-2 text-slate-600">
                                Try a different search term or clear the filter.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="min-w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 bg-slate-50">
                                    <tr>
                                        {[
                                            "Name",
                                            "Email",
                                            "Role",
                                            "Company",
                                            "Category",
                                            "Sentiment",
                                            "Tools",
                                            "Pain Points",
                                            "New Tool",
                                            "Date",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="border-b border-slate-200 px-4 py-4 text-left text-sm font-bold text-slate-700"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredAndSorted.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="align-top transition hover:bg-slate-50/80"
                                        >
                                            <td className="border-b border-slate-100 px-4 py-4 font-medium">
                                                {item.name}
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                {item.email}
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                {item.role}
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                {item.company}
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                <Pill text={item.category || "Other"} />
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                <Pill text={item.sentiment_label || "neutral"} />
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                <CellText text={item.tools_used} />
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                <CellText text={item.pain_points} />
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                                                <CellText text={item.new_tool} />
                                            </td>
                                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                                                {new Date(item.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function StatCard({
    label,
    value,
    compact = false,
}: {
    label: string;
    value: string | number;
    compact?: boolean;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p
                className={`mt-1 font-black text-slate-950 ${compact ? "text-base" : "text-2xl"}`}
            >
                {value}
            </p>
        </div>
    );
}

function SortButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl px-4 py-3 font-semibold transition ${active
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
        >
            {label}
        </button>
    );
}

function CellText({ text }: { text: string }) {
    return <div className="max-w-[280px] whitespace-pre-wrap leading-6">{text}</div>;
}

function Pill({ text }: { text: string }) {
    return (
        <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {text}
        </span>
    );
}