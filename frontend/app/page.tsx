"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormData = {
  name: string;
  email: string;
  role: string;
  company: string;
  tools_used: string;
  pain_points: string;
  new_tool: string;
};

export default function Home() {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    role: "",
    company: "",
    tools_used: "",
    pain_points: "",
    new_tool: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        const message =
          data?.detail?.[0]?.msg || data?.detail || "Failed to submit feedback";
        throw new Error(message);
      }

      router.push("/thank-you");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_35%),linear-gradient(to_bottom,#eff6ff,#ffffff_35%,#f8fafc)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between rounded-3xl border border-white/60 bg-white/70 px-5 py-4 shadow-sm backdrop-blur">
          <div>
            <p className="text-sm font-semibold tracking-wide text-indigo-600">
              Feedback App
            </p>
            <h1 className="text-lg font-bold sm:text-xl">
              Share your daily work struggles
            </h1>
          </div>

          <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 sm:block">
            🔒 Private & respectful
          </div>
        </header>

        <section className="mb-8 overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-xl">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-8 sm:p-10 lg:p-12">
              <span className="inline-flex rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
                Built to understand your work, not replace it
              </span>

              <h2 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Tell us what&apos;s slowing you down.
              </h2>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Your role matters. We are here to learn what feels repetitive,
                frustrating, or time-consuming so we can build tools that make
                your day lighter, faster, and more productive.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <InfoPill title="Confidential" text="Your responses stay private" />
                <InfoPill title="Practical" text="Focus on real work problems" />
                <InfoPill title="Helpful" text="Build better solutions together" />
              </div>
            </div>

            <div className="flex items-stretch bg-gradient-to-br from-indigo-600 to-blue-700 p-8 text-white sm:p-10 lg:p-12">
              <div className="flex w-full flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-100">
                    Why people respond
                  </p>
                  <p className="mt-4 text-2xl font-bold leading-tight">
                    They feel understood, safe, and respected.
                  </p>
                </div>

                <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm text-indigo-100">What you share helps us learn:</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-white/95">
                    <li>• Which tools create friction in daily work</li>
                    <li>• Where time gets lost across tasks</li>
                    <li>• Which simple tools could make life easier</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-8 lg:p-10">
          <div className="mb-8">
            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Share your feedback
            </h3>
            <p className="mt-3 max-w-3xl text-slate-600">
              Please answer honestly. The more specific you are, the better we
              can understand real workflow problems and design useful solutions.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Name"
                name="name"
                placeholder="Your full name"
                value={formData.name}
                onChange={handleChange}
              />
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
              />
              <Input
                label="Role"
                name="role"
                placeholder="e.g. Designer, Developer, Manager"
                value={formData.role}
                onChange={handleChange}
              />
              <Input
                label="Company"
                name="company"
                placeholder="Your company or organization"
                value={formData.company}
                onChange={handleChange}
              />
            </div>

            <Textarea
              label="What tools do you use in daily life?"
              name="tools_used"
              placeholder="Slack, Notion, Excel, Jira, Cursor..."
              value={formData.tools_used}
              onChange={handleChange}
            />

            <Textarea
              label="What pain points do you face in day-to-day life?"
              name="pain_points"
              placeholder="What slows you down, feels repetitive, or causes frustration?"
              value={formData.pain_points}
              onChange={handleChange}
            />

            <Textarea
              label="What new tool would solve your problems?"
              name="new_tool"
              placeholder="Describe the ideal tool or feature that would help you most"
              value={formData.new_tool}
              onChange={handleChange}
            />

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Submitting..." : "Share my feedback"}
            </button>

            <p className="text-center text-sm text-slate-500">
              We respect your perspective and aim to improve work, not replace
              the people doing it.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        required
      />
    </label>
  );
}

function Textarea({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={5}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        required
      />
    </label>
  );
}

function InfoPill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}