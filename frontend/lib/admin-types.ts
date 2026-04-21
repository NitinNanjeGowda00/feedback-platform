export type FeedbackItem = {
    id: number;
    submission_id: string;
    status: string;
    priority: string;
    tags: string[] | string | null;
    owner: string | null;
    source_channel: string;
    language: string;
    consent_to_store: boolean;
    is_anonymous: boolean;
    tools_used: string;
    pain_points: string;
    new_tool: string;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
    respondent: {
        id: number;
        name: string;
        email: string;
        role: string;
        company: string;
        preferred_language: string;
    };
    latest_analysis: {
        id: number;
        model_version: string;
        category: string;
        confidence_score: number;
        sentiment_label: string;
        sentiment_score: number;
        summary: string;
        processing_status: string;
        needs_human_review: boolean;
        created_at: string;
        updated_at: string;
    };
};

export type AnalyticsSummary = {
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

export type InsightsSummary = {
    summary: string;
    top_patterns: string[];
    recommendations: string[];
    sentiment_score: number;
    total_feedback: number;
    generated_at: string;
    source: string;
};

export type AiMetrics = {
    total: number;
    low_confidence_rate: number;
    needs_review_rate: number;
};

export type SearchMatch = {
    id: number;
    submission_id: string;
    score: number;
    category: string;
    summary: string;
    snippet: string;
    created_at: string;
    name: string;
    role: string;
    company: string;
};

export type SearchResponse = {
    answer: string;
    matches: SearchMatch[];
};