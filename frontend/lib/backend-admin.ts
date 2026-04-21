import {
    AiMetrics,
    AnalyticsSummary,
    FeedbackItem,
    InsightsSummary,
    SearchResponse,
} from "./admin-types";

const BACKEND_BASE =
    process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_FEEDBACK_API_BASE_URL ??
    "https://feedback-platform-production.up.railway.app";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "";

function backendUrl(path: string) {
    return `${BACKEND_BASE.replace(/\/$/, "")}${path}`;
}

function authHeaders(extra?: HeadersInit) {
    return {
        accept: "application/json",
        "x-admin-key": ADMIN_API_KEY,
        ...(extra || {}),
    };
}

async function ensureOk(res: Response) {
    if (res.ok) return;

    const text = await res.text().catch(() => "");
    throw new Error(text || `Backend request failed (${res.status})`);
}

export async function backendGetJson<T>(path: string): Promise<T> {
    const res = await fetch(backendUrl(path), {
        headers: authHeaders(),
        cache: "no-store",
    });

    await ensureOk(res);
    return res.json() as Promise<T>;
}

export async function backendPostJson<T>(
    path: string,
    body: unknown,
): Promise<T> {
    const res = await fetch(backendUrl(path), {
        method: "POST",
        headers: authHeaders({
            "content-type": "application/json",
        }),
        body: JSON.stringify(body),
        cache: "no-store",
    });

    await ensureOk(res);
    return res.json() as Promise<T>;
}

export async function backendRaw(path: string): Promise<Response> {
    const res = await fetch(backendUrl(path), {
        headers: authHeaders(),
        cache: "no-store",
    });

    await ensureOk(res);
    return res;
}

export async function getFeedback() {
    return backendGetJson<FeedbackItem[]>("/feedback");
}

export async function getAnalytics() {
    return backendGetJson<AnalyticsSummary>("/analytics/summary");
}

export async function getInsights() {
    return backendGetJson<InsightsSummary>("/insights/summary");
}

export async function getMetrics() {
    return backendGetJson<AiMetrics>("/ai/metrics");
}

export async function searchFeedback(query: string, k = 5) {
    return backendPostJson<SearchResponse>("/search", { query, k });
}