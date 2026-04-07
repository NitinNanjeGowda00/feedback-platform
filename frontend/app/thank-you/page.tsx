"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ThankYouPage() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_30%),linear-gradient(to_bottom,#eff6ff,#ffffff)] px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-xl sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl shadow-sm">
            ✅
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Thank you for sharing 🙌
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Your input helps us understand real problems and build better tools
            that support people more effectively.
          </p>

          {submissionId ? (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Submission received successfully. Reference ID: #{submissionId}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700"
            >
              Submit another response
            </Link>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            We respect your perspective and aim to improve work, not replace the
            people doing it.
          </p>
        </section>
      </div>
    </main>
  );
}
