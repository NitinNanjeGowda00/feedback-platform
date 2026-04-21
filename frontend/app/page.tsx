"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroSlideshow } from "./HeroSlideShow";

type FeedbackFormData = {
  name: string;
  email: string;
  role: string;
  company: string;
  pain_points: string;
  new_tool: string;
  tools_used: string;
};

const initialFormData: FeedbackFormData = {
  name: "",
  email: "",
  role: "",
  company: "",
  pain_points: "",
  new_tool: "",
  tools_used: "",
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_FEEDBACK_API_BASE_URL ??
  "https://feedback-platform-production.up.railway.app";

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState<FeedbackFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const payload = useMemo(
    () => ({
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role.trim(),
      company: formData.company.trim(),
      tools_used: formData.tools_used.trim(),
      pain_points: formData.pain_points.trim(),
      new_tool: formData.new_tool.trim(),
      source_channel: "web",
      language: "en",
      consent_to_store: true,
      is_anonymous: false,
    }),
    [formData]
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          data?.detail ||
          data?.message ||
          "Failed to submit feedback. Please try again.";
        throw new Error(message);
      }

      const submissionId = data?.submission_id ?? data?.id;

      if (submissionId) {
        router.push(`/thank-you?submissionId=${submissionId}`);
        return;
      }

      router.push("/thank-you");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 pb-20 pt-10 sm:pb-24 sm:pt-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12">
        <HeroSlideshow />

        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/14 px-5 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-md">
            <span>👂</span>
            <span>We Are Listening</span>
          </div>

          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Your Ideas Can Help Everyone
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base font-medium text-white/85 sm:text-lg">
            Share your experience and help improve tools for thousands of users.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {["Community", "Better Tools", "Shared Growth"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/18 bg-white/12 px-6 py-3 text-sm font-medium text-white shadow-sm backdrop-blur-md"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <section
          id="feedback-form"
          className="w-full max-w-5xl rounded-[30px] bg-white px-5 py-8 text-slate-900 shadow-[0_30px_80px_rgba(17,24,39,0.18)] sm:px-8 sm:py-10"
        >
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                ⭐ Share Your Story ⭐
              </h2>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">
                Every great innovation starts with listening. We&apos;re all ears! 👂
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="text-lg">👤</span>
                  <span>What should we call you?</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="text-lg">📧</span>
                  <span>Where can we reach you?</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                  placeholder="john.doe@company.com"
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="text-lg">💼</span>
                    <span>Your Role</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="input"
                    placeholder="Product Manager"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="text-lg">🏢</span>
                    <span>Company Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="input"
                    placeholder="Acme Corp"
                    required
                  />
                </div>
              </div>

              <div className="relative rounded-[24px] border border-rose-200 bg-gradient-to-b from-rose-50 to-white px-5 py-5 sm:px-6">
                <div className="absolute -top-4 left-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-lg">
                  <span>⚡</span>
                  <span>Most Important!</span>
                </div>

                <div className="space-y-4 pt-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="text-lg">😵‍💫</span>
                    <span>What is making your work hard?</span>
                    <span className="text-rose-500">*</span>
                  </label>

                  <div className="rounded-2xl bg-white/90 px-4 py-4 text-sm text-slate-600">
                    Tell us the tasks that feel slow, boring, or stressful. Share as much or as little as you want.
                  </div>

                  <textarea
                    name="pain_points"
                    value={formData.pain_points}
                    onChange={handleChange}
                    className="textarea min-h-[190px] border-rose-200 focus:border-rose-300 focus:ring-rose-100"
                    placeholder="e.g., I spend too much time copying data from one app to another, and it happens every day."
                    required
                  />
                </div>
              </div>

              <div className="relative rounded-[24px] border border-sky-200 bg-gradient-to-b from-sky-50 to-white px-5 py-5 sm:px-6">
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="text-lg">💡</span>
                    <span>Do you have a smart idea?</span>
                  </label>

                  <div className="rounded-2xl bg-white/90 px-4 py-4 text-sm text-slate-600">
                    Tell us your dream solution. Even big ideas are okay.
                  </div>

                  <textarea
                    name="new_tool"
                    value={formData.new_tool}
                    onChange={handleChange}
                    className="textarea min-h-[190px] border-sky-200 focus:border-sky-300 focus:ring-sky-100"
                    placeholder="e.g., I wish an AI could read my emails and make a task list for me."
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="text-lg">🔧</span>
                  <span>Which tools are part of your day?</span>
                  <span className="text-rose-500">*</span>
                </label>

                <p className="text-sm text-slate-600">
                  Tell us the software and devices you use most often.
                </p>

                <input
                  name="tools_used"
                  value={formData.tools_used}
                  onChange={handleChange}
                  className="input"
                  placeholder="e.g., Gmail, Trello, Figma, VS Code, iPhone, Slack, Notion, Google Drive, Windows laptop, Chrome"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-rose-500 px-6 py-4 text-lg font-semibold text-white shadow-[0_18px_35px_rgba(236,72,153,0.35)] transition hover:brightness-105 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Executing..." : "Submit & Start Your Transformation!"}
              </button>
            </form>
          </div>
        </section>

        <section className="w-full max-w-4xl rounded-[24px] border border-white/18 bg-white/12 px-6 py-6 text-center text-white shadow-sm backdrop-blur-md">
          <h3 className="text-lg font-semibold sm:text-xl">
            ✨ Your feedback is gold! ✨
          </h3>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-white/90 sm:text-base">
            We read every single submission and use them to build AI tools that actually solve real problems. Together, we&apos;ll make work feel less like work! 🎯
          </p>
        </section>
      </section>
    </main>
  );
}