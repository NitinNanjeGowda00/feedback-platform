"use client";

import {
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
    Activity,
    ArrowUpRight,
    BarChart3,
    Building2,
    ChevronDown,
    CircleHelp,
    Download,
    Eye,
    FileText,
    Filter,
    Brain,
    LogOut,
    RefreshCw,
    Search,
    Sparkles,
    Target,
    TrendingUp,
    Users,
    Shield,
} from "lucide-react";
import type {
    AiMetrics,
    AnalyticsSummary,
    FeedbackItem,
    InsightsSummary,
    SearchMatch,
    SearchResponse,
} from "@/lib/admin-types";

type TabKey = "overview" | "feedback" | "insights" | "search";
type SentimentFilter = "all" | "positive" | "neutral" | "negative";

const classNames = (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(" ");

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        ...init,
        headers: {
            accept: "application/json",
            ...(init?.headers || {}),
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
    }

    return (await res.json()) as T;
}

function formatDateTime(value?: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

function formatDate(value?: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-CA").format(d);
}

function toneClasses(
    tone: "neutral" | "purple" | "pink" | "green" | "amber" | "red" | "blue" | "slate",
) {
    switch (tone) {
        case "purple":
            return "border-violet-200 bg-violet-50 text-violet-700";
        case "pink":
            return "border-pink-200 bg-pink-50 text-pink-700";
        case "green":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "amber":
            return "border-amber-200 bg-amber-50 text-amber-800";
        case "red":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "blue":
            return "border-blue-200 bg-blue-50 text-blue-700";
        case "slate":
            return "border-slate-200 bg-slate-50 text-slate-600";
        default:
            return "border-slate-200 bg-white text-slate-700";
    }
}

function confidenceTone(score: number) {
    if (score >= 0.9) return "green";
    if (score >= 0.75) return "blue";
    if (score >= 0.5) return "amber";
    return "red";
}

function sentimentTone(label: string) {
    switch (label?.toLowerCase()) {
        case "positive":
            return "green";
        case "negative":
            return "red";
        case "neutral":
            return "slate";
        default:
            return "purple";
    }
}

function MiniBadge({
    children,
    tone = "neutral",
    className,
}: {
    children: ReactNode;
    tone?: "neutral" | "purple" | "pink" | "green" | "amber" | "red" | "blue" | "slate";
    className?: string;
}) {
    return (
        <span
            className={classNames(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium",
                toneClasses(tone),
                className,
            )}
        >
            {children}
        </span>
    );
}

function Panel({
    title,
    subtitle,
    icon,
    className,
    children,
}: {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section
            className={classNames(
                "rounded-[28px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)]",
                className,
            )}
        >
            <div className="mb-5 flex items-start gap-3">
                {icon ? <div className="mt-0.5 text-violet-600">{icon}</div> : null}
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                        {title}
                    </h2>
                    {subtitle ? (
                        <p className="mt-1 text-base text-slate-500">{subtitle}</p>
                    ) : null}
                </div>
            </div>
            {children}
        </section>
    );
}

function StatCard({
    title,
    value,
    subtext,
    icon,
    iconBg,
    valueClassName,
}: {
    title: string;
    value: string;
    subtext: string;
    icon: ReactNode;
    iconBg: string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-[22px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[15px] font-medium text-slate-700">{title}</p>
                    <div
                        className={classNames(
                            "mt-2 text-[40px] font-semibold leading-none tracking-tight text-slate-950",
                            valueClassName,
                        )}
                    >
                        {value}
                    </div>
                    <p className="mt-3 text-sm text-slate-500">{subtext}</p>
                </div>
                <div
                    className={classNames(
                        "flex h-16 w-16 items-center justify-center rounded-2xl",
                        iconBg,
                    )}
                >
                    {icon}
                </div>
            </div>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={classNames(
                "inline-flex items-center gap-2 rounded-[18px] px-4 py-3 text-[16px] font-semibold transition",
                active
                    ? "bg-[linear-gradient(135deg,#7c3aed_0%,#9333ea_55%,#a855f7_100%)] text-white shadow-[0_12px_24px_rgba(124,58,237,0.18)]"
                    : "text-slate-950 hover:bg-slate-50",
            )}
        >
            {icon}
            {label}
        </button>
    );
}

function AppIcon() {
    return (
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#7c3aed_0%,#a855f7_55%,#8b5cf6_100%)] shadow-[0_14px_30px_rgba(124,58,237,0.28)]">
            <Sparkles className="h-7 w-7 text-white" />
        </div>
    );
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
    };
}

function PieChartCard({ data }: { data: { label: string; count: number }[] }) {
    const colors = ["#8b5cf6", "#ec4899", "#6366f1", "#22c55e", "#f59e0b"];
    const total = data.reduce((sum, item) => sum + item.count, 0);

    const segments = useMemo(() => {
        if (!total) return [];
        let current = -90;
        return data.map((item, index) => {
            const angle = (item.count / total) * 360;
            const start = current;
            const end = current + angle;
            current = end;
            return {
                ...item,
                start,
                end,
                color: colors[index % colors.length],
            };
        });
    }, [data, total]);

    return (
        <div className="rounded-[28px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center gap-2">
                <Target className="h-6 w-6 text-violet-600" />
                <h3 className="text-[22px] font-semibold tracking-tight text-slate-950">
                    Feedback Categories
                </h3>
            </div>

            <div className="flex flex-col items-center">
                <svg viewBox="0 0 340 290" className="h-[280px] w-full max-w-[340px]">
                    <g transform="translate(170 125)">
                        {segments.map((segment, index) => {
                            const r = 95;
                            const start = polarToCartesian(0, 0, r, segment.start);
                            const end = polarToCartesian(0, 0, r, segment.end);
                            const largeArc = segment.end - segment.start > 180 ? 1 : 0;
                            const d = [
                                "M 0 0",
                                `L ${start.x} ${start.y}`,
                                `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
                                "Z",
                            ].join(" ");

                            const mid = segment.start + (segment.end - segment.start) / 2;
                            const labelPos = polarToCartesian(0, 0, 122, mid);
                            const point = polarToCartesian(0, 0, 95, mid);

                            return (
                                <g key={`${segment.label}-${index}`}>
                                    <path
                                        d={d}
                                        fill={segment.color}
                                        stroke="#ffffff"
                                        strokeWidth="1.5"
                                    />
                                    <path
                                        d={`M ${point.x} ${point.y} L ${labelPos.x} ${labelPos.y}`}
                                        stroke={segment.color}
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={labelPos.x}
                                        y={labelPos.y - 4}
                                        textAnchor="middle"
                                        fill={segment.color}
                                        fontSize="14"
                                        fontWeight="600"
                                    >
                                        {segment.count}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    {data.map((item, index) => (
                        <div key={item.label} className="flex items-center gap-2 text-[15px]">
                            <span
                                className="h-3.5 w-3.5 rounded-full"
                                style={{ backgroundColor: colors[index % colors.length] }}
                            />
                            <span className="text-slate-700">
                                {item.label} ({item.count})
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function BarChartCard({ data }: { data: { date: string; count: number }[] }) {
    const max = Math.max(...data.map((d) => d.count), 1);
    const width = 640;
    const height = 280;
    const left = 54;
    const top = 18;
    const chartWidth = width - left - 24;
    const chartHeight = height - top - 54;

    return (
        <div className="rounded-[28px] border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center gap-2">
                <Activity className="h-6 w-6 text-blue-600" />
                <h3 className="text-[22px] font-semibold tracking-tight text-slate-950">
                    Activity Timeline
                </h3>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
                {[0, 2, 4, 6, 8].map((tick) => {
                    const y = top + chartHeight - (tick / 8) * chartHeight;
                    return (
                        <g key={tick}>
                            <line
                                x1={left}
                                y1={y}
                                x2={width - 16}
                                y2={y}
                                stroke="#dbe4f0"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={left - 10}
                                y={y + 4}
                                textAnchor="end"
                                fontSize="13"
                                fill="#64748b"
                            >
                                {tick}
                            </text>
                        </g>
                    );
                })}

                <line
                    x1={left}
                    y1={top + chartHeight}
                    x2={width - 16}
                    y2={top + chartHeight}
                    stroke="#cbd5e1"
                />
                <line x1={left} y1={top} x2={left} y2={top + chartHeight} stroke="#cbd5e1" />

                {data.map((item, index) => {
                    const gap = 34;
                    const barWidth = data.length > 2 ? 140 : 210;
                    const x = left + 24 + index * (barWidth + gap);
                    const barHeight = (item.count / max) * chartHeight;
                    const y = top + chartHeight - barHeight;

                    return (
                        <g key={`${item.date}-${index}`}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                rx="10"
                                fill="#8b5cf6"
                            />
                            <text
                                x={x + barWidth / 2}
                                y={top + chartHeight + 26}
                                textAnchor="middle"
                                fontSize="12.5"
                                fill="#64748b"
                            >
                                {item.date}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function FeedbackCard({
    item,
    index,
}: {
    item: FeedbackItem;
    index: number;
}) {
    const sentiment = item.latest_analysis?.sentiment_label || "neutral";
    const category = item.latest_analysis?.category || "Other";
    const confidence = item.latest_analysis?.confidence_score ?? 0;
    const review = item.latest_analysis?.needs_human_review;

    return (
        <article className="rounded-[26px] border border-slate-200/90 bg-white p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-[18px] font-semibold tracking-tight text-slate-950">
                            {item.respondent?.name || "Anonymous"}
                        </h3>
                        <MiniBadge tone={sentimentTone(sentiment)}>
                            {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                        </MiniBadge>
                        <MiniBadge tone="purple">{category}</MiniBadge>
                        {review ? <MiniBadge tone="amber">Needs review</MiniBadge> : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" /> {item.respondent?.role || "—"}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4" /> {item.respondent?.company || "—"}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4" /> {formatDateTime(item.created_at)}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                    aria-label="View feedback"
                >
                    <Eye className="h-4.5 w-4.5" />
                </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-500">Pain Points</p>
                    <p className="mt-2 text-[15px] leading-7 text-slate-800">
                        {item.pain_points || "—"}
                    </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-500">Desired Tool</p>
                    <p className="mt-2 text-[15px] leading-7 text-slate-800">
                        {item.new_tool || "—"}
                    </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-500">Current Tools</p>
                    <p className="mt-2 text-[15px] leading-7 text-slate-800">
                        {item.tools_used || "—"}
                    </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-500">AI Summary</p>
                    <p className="mt-2 text-[15px] leading-7 text-slate-800">
                        {item.latest_analysis?.summary || "—"}
                    </p>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <MiniBadge tone={confidenceTone(confidence)}>
                    {Math.round(confidence * 100)}% confidence
                </MiniBadge>
                <div className="text-sm font-medium text-slate-400">#{index + 1}</div>
            </div>
        </article>
    );
}

function QuickStat({
    title,
    value,
    tone = "slate",
}: {
    title: string;
    value: string;
    tone?: "neutral" | "purple" | "pink" | "green" | "amber" | "red" | "blue" | "slate";
}) {
    return (
        <div className={classNames("rounded-[22px] border p-5", toneClasses(tone))}>
            <p className="text-[14px] font-medium opacity-85">{title}</p>
            <div className="mt-2 text-[34px] font-semibold leading-none tracking-tight">
                {value}
            </div>
        </div>
    );
}

function LogoutButton() {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin");
        router.refresh();
    };

    return (
        <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
            <LogOut className="mr-2 h-5 w-5" />
            Logout
        </button>
    );
}

export default function AdminDashboardClient() {
    const router = useRouter();

    const [tab, setTab] = useState<TabKey>("overview");
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [error, setError] = useState("");

    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [insights, setInsights] = useState<InsightsSummary | null>(null);
    const [aiMetrics, setAiMetrics] = useState<AiMetrics | null>(null);

    const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    const [searchQuery, setSearchQuery] = useState("");
    const [searchAnswer, setSearchAnswer] = useState("");
    const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);

    const loadAll = async () => {
        setLoading(true);
        setError("");

        try {
            const [feedbackData, analyticsData, insightsData, aiMetricsData] =
                await Promise.all([
                    fetchJson<FeedbackItem[]>("/api/admin/feedback"),
                    fetchJson<AnalyticsSummary>("/api/admin/analytics"),
                    fetchJson<InsightsSummary>("/api/admin/insights"),
                    fetchJson<AiMetrics>("/api/admin/metrics"),
                ]);

            setFeedbacks(feedbackData);
            setAnalytics(analyticsData);
            setInsights(insightsData);
            setAiMetrics(aiMetricsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAll();
    }, []);

    const handleExport = async () => {
        try {
            const res = await fetch("/api/admin/export", {
                method: "GET",
                credentials: "include",
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || `Export failed (${res.status})`);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "feedback_export.csv";
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Export failed");
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearchLoading(true);
        setError("");

        try {
            const data = await fetchJson<SearchResponse>("/api/admin/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQuery.trim(), k: 5 }),
            });

            setSearchAnswer(data.answer);
            setSearchMatches(data.matches);
            setTab("search");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed");
        } finally {
            setSearchLoading(false);
        }
    };

    const categoryOptions = useMemo(() => {
        const fromAnalytics = analytics?.top_issues?.map((item) => item.label) ?? [];
        const fromFeedback = feedbacks
            .map((item) => item.latest_analysis?.category)
            .filter(Boolean) as string[];

        return Array.from(new Set([...fromAnalytics, ...fromFeedback]));
    }, [analytics, feedbacks]);

    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter((item) => {
            const sentiment = item.latest_analysis?.sentiment_label || "neutral";
            const category = item.latest_analysis?.category || "Other";

            const sentimentOk =
                sentimentFilter === "all" || sentiment === sentimentFilter;
            const categoryOk =
                categoryFilter === "all" || category === categoryFilter;

            return sentimentOk && categoryOk;
        });
    }, [feedbacks, sentimentFilter, categoryFilter]);

    const pieData = useMemo(() => {
        if (analytics?.top_issues?.length) return analytics.top_issues;

        const counts = feedbacks.reduce<Record<string, number>>((acc, item) => {
            const label = item.latest_analysis?.category || "Other";
            acc[label] = (acc[label] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts).map(([label, count]) => ({ label, count }));
    }, [analytics, feedbacks]);

    const totalResponses = analytics?.total_responses ?? feedbacks.length;
    const totalCompanies = analytics?.unique_companies ?? 0;
    const aiConfidencePercent = aiMetrics
        ? Math.round((1 - aiMetrics.low_confidence_rate) * 100)
        : 0;
    const sentimentScore = insights
        ? Math.round((insights.sentiment_score ?? 0) * 100)
        : 0;

    const latestSubmissionLabel = analytics?.latest_submission
        ? formatDateTime(analytics.latest_submission)
        : "—";

    return (
        <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-4">
                    <div className="flex items-center gap-4">
                        <AppIcon />
                        <div>
                            <h1 className="text-[28px] font-extrabold tracking-tight text-slate-950">
                                Feedback Intelligence
                            </h1>
                            <p className="text-[18px] text-slate-500">Admin Dashboard</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={loadAll}
                            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
                        >
                            <RefreshCw className="mr-2 h-5 w-5" />
                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={handleExport}
                            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#9333ea_55%,#a855f7_100%)] px-4 text-[15px] font-medium text-white shadow-[0_12px_24px_rgba(124,58,237,0.18)] transition hover:brightness-105"
                        >
                            <Download className="mr-2 h-5 w-5" />
                            Export
                        </button>

                        <LogoutButton />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-[1440px] px-6 py-10">
                {error ? (
                    <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-[15px] text-rose-700">
                        {error}
                    </div>
                ) : null}

                {loading ? (
                    <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-[16px] text-slate-600 shadow-sm">
                        Loading dashboard...
                    </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-4">
                    <StatCard
                        title="Total Responses"
                        value={String(totalResponses)}
                        subtext={`${analytics?.submissions ?? totalResponses} submissions`}
                        icon={<Users className="h-8 w-8 text-violet-600" />}
                        iconBg="bg-violet-100"
                    />
                    <StatCard
                        title="Companies"
                        value={String(totalCompanies)}
                        subtext={`${analytics?.unique_roles ?? 0} unique roles`}
                        icon={<Building2 className="h-8 w-8 text-blue-600" />}
                        iconBg="bg-blue-100"
                    />
                    <StatCard
                        title="AI Confidence"
                        value={`${aiConfidencePercent}%`}
                        subtext={`${Math.round((aiMetrics?.needs_review_rate ?? 0) * 100)}% needs review`}
                        icon={<Brain className="h-8 w-8 text-violet-600" />}
                        iconBg="bg-violet-100"
                    />
                    <StatCard
                        title="Sentiment Score"
                        value={String(sentimentScore)}
                        subtext="Needs attention"
                        icon={<TrendingUp className="h-8 w-8 text-pink-600" />}
                        iconBg="bg-pink-100"
                    />
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-0 rounded-[22px] border border-slate-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                    <TabButton
                        active={tab === "overview"}
                        onClick={() => setTab("overview")}
                        icon={<BarChart3 className="h-4.5 w-4.5" />}
                        label="Overview"
                    />
                    <TabButton
                        active={tab === "feedback"}
                        onClick={() => setTab("feedback")}
                        icon={<FileText className="h-4.5 w-4.5" />}
                        label={`Feedback (${Math.min(3, feedbacks.length)})`}
                    />
                    <TabButton
                        active={tab === "insights"}
                        onClick={() => setTab("insights")}
                        icon={<Sparkles className="h-4.5 w-4.5" />}
                        label="AI Insights"
                    />
                    <TabButton
                        active={tab === "search"}
                        onClick={() => setTab("search")}
                        icon={<Search className="h-4.5 w-4.5" />}
                        label="Search"
                    />
                </div>

                {tab === "overview" ? (
                    <div className="mt-10 space-y-6">
                        <div className="grid gap-6 xl:grid-cols-2">
                            <PieChartCard
                                data={pieData.length ? pieData : [{ label: "Other", count: 1 }]}
                            />
                            <BarChartCard data={analytics?.daily_visits ?? []} />
                        </div>

                        <Panel
                            title="AI Summary"
                            subtitle="Users express frustration with manual tasks and repetitive updates, indicating a need for automation tools."
                            icon={<Sparkles className="h-6 w-6 text-violet-600" />}
                            className="bg-[linear-gradient(180deg,rgba(124,58,237,0.08),rgba(124,58,237,0.03))]"
                        >
                            <p className="max-w-5xl text-[18px] leading-8 text-slate-700">
                                {insights?.summary ||
                                    "Users express frustration with manual tasks and repetitive updates, indicating a need for automation tools."}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                {(insights?.top_patterns?.length
                                    ? insights.top_patterns
                                    : [
                                        "Need for Automation Tools",
                                        "Manual Process Pain Points",
                                        "Productivity Challenges",
                                    ]
                                ).map((item) => (
                                    <MiniBadge key={item} tone="purple" className="bg-white">
                                        {item}
                                    </MiniBadge>
                                ))}
                            </div>
                        </Panel>
                    </div>
                ) : null}

                {tab === "feedback" ? (
                    <div className="mt-10 space-y-6">
                        <div className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 text-[16px] font-semibold text-slate-800">
                                        <Filter className="h-5 w-5 text-violet-600" />
                                        Filters:
                                    </div>

                                    <div className="relative">
                                        <select
                                            value={sentimentFilter}
                                            onChange={(e) =>
                                                setSentimentFilter(e.target.value as SentimentFilter)
                                            }
                                            className="h-[54px] appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-5 pr-12 text-[16px] font-medium text-slate-950 outline-none"
                                        >
                                            <option value="all">All Sentiments</option>
                                            <option value="positive">Positive</option>
                                            <option value="neutral">Neutral</option>
                                            <option value="negative">Negative</option>
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>

                                    <div className="relative">
                                        <select
                                            value={categoryFilter}
                                            onChange={(e) => setCategoryFilter(e.target.value)}
                                            className="h-[54px] appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-5 pr-12 text-[16px] font-medium text-slate-950 outline-none"
                                        >
                                            <option value="all">All Categories</option>
                                            {categoryOptions.map((category) => (
                                                <option key={category} value={category}>
                                                    {category}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>
                                </div>

                                <div className="rounded-full border border-slate-200 px-3 py-1 text-[14px] text-slate-700">
                                    {filteredFeedbacks.length} results
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {filteredFeedbacks.length ? (
                                filteredFeedbacks.map((item, index) => (
                                    <FeedbackCard key={item.id} item={item} index={index} />
                                ))
                            ) : (
                                <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-[16px] text-slate-600">
                                    No feedback matches the current filters.
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {tab === "insights" ? (
                    <div className="mt-10 grid gap-6 xl:grid-cols-5">
                        <div className="space-y-6 xl:col-span-3">
                            <Panel
                                title="Key Insights"
                                subtitle="AI-powered analysis of user feedback"
                                icon={<Brain className="h-6 w-6 text-violet-600" />}
                            >
                                <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(124,58,237,0.08),rgba(124,58,237,0.03))] p-6">
                                    <p className="max-w-4xl text-[18px] leading-8 text-slate-700">
                                        {insights?.summary ||
                                            "Users express frustration with manual tasks and repetitive updates, indicating a need for automation tools."}
                                    </p>
                                </div>

                                <div className="mt-6">
                                    <h4 className="mb-3 text-[18px] font-semibold text-slate-950">
                                        Top Patterns Identified
                                    </h4>
                                    <div className="space-y-3">
                                        {(insights?.top_patterns?.length
                                            ? insights.top_patterns
                                            : [
                                                "Need for Automation Tools",
                                                "Manual Process Pain Points",
                                                "Productivity Challenges",
                                            ]
                                        ).map((item, idx) => (
                                            <div
                                                key={item}
                                                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                            >
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-[16px] font-semibold text-white">
                                                    {idx + 1}
                                                </div>
                                                <div className="text-[16px] text-slate-800">{item}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Panel>

                            <Panel
                                title="AI Recommendations"
                                subtitle="Actionable insights for improvement"
                                icon={<Sparkles className="h-6 w-6 text-orange-500" />}
                                className="bg-[#fff7e8]"
                            >
                                <div className="space-y-4">
                                    {(insights?.recommendations?.length
                                        ? insights.recommendations
                                        : [
                                            "Develop or integrate automation tools to reduce manual tasks",
                                            "Provide training on existing automation features in current tools",
                                            "Consider implementing workflow automation solutions",
                                        ]
                                    ).map((item, idx) => (
                                        <div
                                            key={item}
                                            className="flex items-center justify-between gap-4 rounded-[22px] border border-orange-200 bg-white px-5 py-4"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-[17px] font-semibold text-white">
                                                    {idx + 1}
                                                </div>
                                                <p className="text-[16px] leading-7 text-slate-800">{item}</p>
                                            </div>
                                            <ArrowUpRight className="h-5 w-5 shrink-0 text-orange-500" />
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </div>

                        <div className="space-y-6 xl:col-span-2">
                            <Panel
                                title="Quick Stats"
                                subtitle="AI-powered analysis"
                                icon={<Activity className="h-6 w-6 text-blue-600" />}
                            >
                                <div className="space-y-4">
                                    <QuickStat
                                        title="Total Analyzed"
                                        value={String(aiMetrics?.total ?? totalResponses)}
                                        tone="blue"
                                    />
                                    <QuickStat
                                        title="Sentiment Score"
                                        value={String(sentimentScore)}
                                        tone={sentimentScore < 0 ? "pink" : "green"}
                                    />
                                    <QuickStat
                                        title="Low Confidence"
                                        value={`${Math.round((aiMetrics?.low_confidence_rate ?? 0) * 100)}%`}
                                        tone="amber"
                                    />
                                    <QuickStat
                                        title="Needs Review"
                                        value={`${Math.round((aiMetrics?.needs_review_rate ?? 0) * 100)}%`}
                                        tone="purple"
                                    />
                                </div>
                            </Panel>

                            <Panel
                                title="Snapshot"
                                subtitle="Most recent submission and quality state"
                                icon={<CircleHelp className="h-6 w-6 text-slate-500" />}
                            >
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <p className="text-sm font-medium text-slate-500">
                                            Latest submission
                                        </p>
                                        <p className="mt-2 text-[16px] font-medium text-slate-900">
                                            {latestSubmissionLabel}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <p className="text-sm font-medium text-slate-500">
                                            Snapshot source
                                        </p>
                                        <p className="mt-2 text-[16px] font-medium text-slate-900">
                                            {insights?.source || "snapshot"}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <p className="text-sm font-medium text-slate-500">
                                            Generated at
                                        </p>
                                        <p className="mt-2 text-[16px] font-medium text-slate-900">
                                            {formatDateTime(insights?.generated_at)}
                                        </p>
                                    </div>
                                </div>
                            </Panel>
                        </div>
                    </div>
                ) : null}

                {tab === "search" ? (
                    <div className="mt-10 space-y-6">
                        <Panel
                            title="Semantic Search"
                            subtitle="Find feedback using AI-powered natural language search"
                            icon={<Search className="h-6 w-6 text-violet-600" />}
                        >
                            <textarea
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                rows={6}
                                placeholder='e.g., "automation challenges", "productivity complaints", "feature requests"...'
                                className="min-h-[190px] w-full rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-4 text-[16px] leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400"
                            />

                            <button
                                type="button"
                                onClick={handleSearch}
                                disabled={searchLoading || !searchQuery.trim()}
                                className="mt-5 inline-flex h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#9333ea_55%,#a855f7_100%)] text-[18px] font-semibold text-white shadow-[0_16px_30px_rgba(124,58,237,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Search className="h-5 w-5" />
                                {searchLoading ? "Searching..." : "Search Feedback"}
                            </button>
                        </Panel>

                        {searchAnswer || searchMatches.length ? (
                            <div className="grid gap-6 xl:grid-cols-5">
                                <div className="xl:col-span-3">
                                    <Panel
                                        title="Search Result"
                                        subtitle="Best matching theme and answer"
                                        icon={<Sparkles className="h-6 w-6 text-violet-600" />}
                                    >
                                        <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(124,58,237,0.08),rgba(124,58,237,0.03))] p-6">
                                            <p className="text-[18px] leading-8 text-slate-700">
                                                {searchAnswer || "No answer yet."}
                                            </p>
                                        </div>

                                        <div className="mt-6 flex flex-wrap gap-2">
                                            {searchMatches.slice(0, 3).map((match) => (
                                                <MiniBadge key={match.id} tone="purple">
                                                    {match.category}
                                                </MiniBadge>
                                            ))}
                                        </div>
                                    </Panel>
                                </div>

                                <div className="space-y-6 xl:col-span-2">
                                    <Panel
                                        title="Top Matches"
                                        subtitle="Ranked by semantic similarity"
                                        icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
                                    >
                                        <div className="space-y-4">
                                            {searchMatches.length ? (
                                                searchMatches.map((match, idx) => (
                                                    <div
                                                        key={match.id}
                                                        className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="text-[16px] font-semibold text-slate-950">
                                                                    {match.name}
                                                                </div>
                                                                <div className="mt-1 text-sm text-slate-500">
                                                                    {match.role} · {match.company}
                                                                </div>
                                                            </div>
                                                            <MiniBadge tone="slate">
                                                                #{idx + 1} · {(match.score * 100).toFixed(1)}%
                                                            </MiniBadge>
                                                        </div>
                                                        <p className="mt-3 text-[15px] leading-7 text-slate-700">
                                                            {match.snippet}
                                                        </p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-[15px] text-slate-500">
                                                    Run a search to see matching feedback.
                                                </div>
                                            )}
                                        </div>
                                    </Panel>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </main>
    );
}