"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FeedbackFormData = {
  name: string;
  email: string;
  role: string;
  company: string;
  tools_used: string;
  pain_points: string;
  new_tool: string;
};

type FeedbackResponse = FeedbackFormData & {
  id: number;
  category?: string | null;
  sentiment_label?: string | null;
  sentiment_score?: number | null;
  summary?: string | null;
  created_at: string;
};

type FieldErrors = Partial<Record<keyof FeedbackFormData, string>>;

const initialFormData: FeedbackFormData = {
  name: "",
  email: "",
  role: "",
  company: "",
  tools_used: "",
  pain_points: "",
  new_tool: "",
};

const fieldLabels: Record<keyof FeedbackFormData, string> = {
  name: "Name",
  email: "Email",
  role: "Role",
  company: "Company",
  tools_used: "Tools you use",
  pain_points: "Pain points",
  new_tool: "Ideal solution",
};

export default function Home() {
  const router = useRouter();

  const [formData, setFormData] = useState<FeedbackFormData>(initialFormData);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSubmittedSignature, setLastSubmittedSignature] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const formCompletion = useMemo(() => {
    const filled = Object.values(formData).filter((v) => v.trim()).length;
    return Math.round((filled / Object.keys(formData).length) * 100);
  }, [formData]);

  const submissionSignature = useMemo(
    () => JSON.stringify(formData),
    [formData]
  );

  const validateForm = (data: FeedbackFormData) => {
    const errors: FieldErrors = {};

    for (const [key, value] of Object.entries(data) as [keyof FeedbackFormData, string][]) {
      if (!value.trim()) {
        errors[key] = `${fieldLabels[key]} is required.`;
      }
    }

    if (data.email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(data.email.trim())) {
        errors.email = "Enter a valid email address.";
      }
    }

    return errors;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const key = name as keyof FeedbackFormData;

    setFormData((current) => ({ ...current, [key]: value }));
    setSubmitError("");

    if (fieldErrors[key]) {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const submitFeedback = async (attempt = 0): Promise<FeedbackResponse> => {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") || "";

    let payload: any = null;
    if (responseText) {
      payload = contentType.includes("application/json")
        ? JSON.parse(responseText)
        : { message: responseText };
    }

    if (!response.ok) {
      const message = payload?.message || payload?.detail || "Failed to submit feedback.";

      if (response.status >= 500 && attempt === 0) {
        setRetryCount(1);
        return submitFeedback(1);
      }

      throw new Error(message);
    }

    return payload as FeedbackResponse;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validateForm(formData);
    setFieldErrors(errors);
    setSubmitError("");
    setRetryCount(0);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (loading) {
      return;
    }

    if (lastSubmittedSignature === submissionSignature) {
      setSubmitError("This feedback was already submitted. Please update the form before sending again.");
      return;
    }

    setLoading(true);

    try {
      const result = await submitFeedback();
      setLastSubmittedSignature(submissionSignature);
      router.push(`/thank-you?submissionId=${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit feedback.";
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10">
      <div className="absolute -top-20 left-10 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl float" />
      <div className="absolute top-40 right-10 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl float-slow" />

      <div className="relative mx-auto max-w-7xl">
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-4">
              <div className="glow flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 text-2xl font-bold">
                AI
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-indigo-400">
                  Feedback App
                </p>
                <h1 className="text-3xl font-bold">AI Feedback Intelligence</h1>
              </div>
            </div>

            <h2 className="mt-8 text-5xl font-extrabold leading-tight">
              Tell us what’s slowing your team down.
            </h2>

            <p className="mt-5 max-w-xl text-slate-400">
              Turn real frustrations into structured insights that drive product
              decisions.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {["Private", "AI Powered", "Actionable"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600 p-8 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-widest text-indigo-200">
              Why people respond
            </p>

            <h3 className="mt-4 text-3xl font-bold">
              They feel understood, safe, and respected.
            </h3>

            <div className="mt-8 grid grid-cols-3 gap-4">
              <Stat label="Private" value="100%" />
              <Stat label="Questions" value="3" />
              <Stat label="Outcome" value="Insights" />
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Share your feedback</h3>

            <div className="text-sm text-slate-400">{formCompletion}%</div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-6" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="name"
                placeholder="Name"
                value={formData.name}
                onChange={handleChange}
                error={fieldErrors.name}
              />
              <Input
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                error={fieldErrors.email}
                type="email"
              />
              <Input
                name="role"
                placeholder="Role"
                value={formData.role}
                onChange={handleChange}
                error={fieldErrors.role}
              />
              <Input
                name="company"
                placeholder="Company"
                value={formData.company}
                onChange={handleChange}
                error={fieldErrors.company}
              />
            </div>

            <Textarea
              name="tools_used"
              placeholder="Tools you use..."
              value={formData.tools_used}
              onChange={handleChange}
              error={fieldErrors.tools_used}
            />
            <Textarea
              name="pain_points"
              placeholder="Pain points..."
              value={formData.pain_points}
              onChange={handleChange}
              error={fieldErrors.pain_points}
            />
            <Textarea
              name="new_tool"
              placeholder="Ideal solution..."
              value={formData.new_tool}
              onChange={handleChange}
              error={fieldErrors.new_tool}
            />

            {submitError ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {submitError}
              </div>
            ) : null}

            {retryCount > 0 ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                The first attempt failed, retrying automatically.
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 py-4 text-lg font-semibold transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Submitting..." : "Share Feedback"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

type InputProps = {
  name: keyof FeedbackFormData;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
};

function Input({ name, placeholder, value, onChange, error, type = "text" }: InputProps) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-slate-300">{fieldLabels[name]}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`rounded-xl border bg-white/5 p-3 outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? "border-red-400/70" : "border-white/10"
        }`}
        required
      />
      {error ? (
        <span id={`${name}-error`} className="text-sm text-red-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

type TextareaProps = {
  name: keyof FeedbackFormData;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
};

function Textarea({ name, placeholder, value, onChange, error }: TextareaProps) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-slate-300">{fieldLabels[name]}</span>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`rounded-xl border bg-white/5 p-3 outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? "border-red-400/70" : "border-white/10"
        }`}
        required
      />
      {error ? (
        <span id={`${name}-error`} className="text-sm text-red-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-4 text-center">
      <p className="text-sm text-indigo-200">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
