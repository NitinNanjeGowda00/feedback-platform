"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ThankYouPage() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId");

  // 🎉 Calm Confetti
  useEffect(() => {
    let isMounted = true;

    const loadConfetti = async () => {
      const confetti = (await import("canvas-confetti")).default;

      const duration = 1800;
      const end = Date.now() + duration;

      const colors = ["#a78bfa", "#f472b6", "#60a5fa"];

      const frame = () => {
        if (!isMounted) return;

        confetti({
          particleCount: 2,
          angle: 60,
          spread: 45,
          origin: { x: 0, y: 0 },
          colors,
          gravity: 0.6,
          scalar: 0.8,
        });

        confetti({
          particleCount: 2,
          angle: 120,
          spread: 45,
          origin: { x: 1, y: 0 },
          colors,
          gravity: 0.6,
          scalar: 0.8,
        });

        if (Date.now() < end) requestAnimationFrame(frame);
      };

      frame();
    };

    loadConfetti();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = async () => {
    if (submissionId) {
      await navigator.clipboard.writeText(submissionId);
      alert("Copied to clipboard!");
    }
  };

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">

        {/* ✅ WHITE CARD */}
        <section className="w-full rounded-[2rem] bg-white p-10 text-center shadow-2xl sm:p-12">

          {/* ✅ Animated Check (SVG + real animation) */}
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">

            {/* Pulse Ring */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-200 opacity-60 animate-pingSlow"></span>

            {/* Circle + Check */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 animate-scaleBounce">
              <svg
                className="h-10 w-10 text-green-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h1 className="mt-6 flex items-center justify-center gap-3 text-4xl font-extrabold text-slate-900">
            <span className="animate-spinSlow">⭐</span>
            Thank You!
            <span className="animate-spinSlow">⭐</span>
          </h1>

          <p className="mt-3 text-lg text-slate-700">
            Your feedback has been successfully submitted! 🎉
          </p>

          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
            We've received your ideas and they're already making a difference.
            Your voice helps us build better tools for everyone in the community!
          </p>

          {/* Reference ID */}
          {submissionId && (
            <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-purple-200 bg-purple-50 p-5">
              <p className="mb-2 text-sm font-semibold text-purple-700">
                ✨ Your Reference ID
              </p>

              <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
                <span className="font-mono text-sm text-purple-700">
                  {submissionId}
                </span>

                <button
                  onClick={handleCopy}
                  className="rounded-lg bg-purple-600 px-3 py-1 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Copy
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Save this ID! You can use it to track your submission later.
              </p>
            </div>
          )}

          {/* Chips */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <span className="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-sm text-pink-600">
              ❤️ Community Powered
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-600">
              ⚡ Innovation Together
            </span>
            <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-600">
              ✨ Better Tools Ahead
            </span>
          </div>

          {/* CTA */}
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-red-500 px-8 py-3 font-semibold text-white shadow-lg transition hover:scale-105"
            >
              ← Submit Another Feedback
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-10 rounded-2xl bg-slate-50 p-6 text-sm text-slate-700">
            <p className="mb-2 font-semibold">✨ What happens next?</p>
            <p>
              Our team reviews every submission carefully. We'll use your
              insights to create AI tools that solve real problems and make work
              easier for everyone. If we need more details, we'll reach out using
              the email you provided!
            </p>
          </div>
        </section>
      </div>

      {/* Animations */}
      <style jsx>{`
        .animate-scaleBounce {
          animation: scaleBounce 0.6s ease-out;
        }

        @keyframes scaleBounce {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
          70% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
          }
        }

        .animate-pingSlow {
          animation: pingSlow 1.5s ease-out;
        }

        @keyframes pingSlow {
          0% {
            transform: scale(0.8);
            opacity: 0.6;
          }
          80% {
            transform: scale(1.4);
            opacity: 0;
          }
          100% {
            opacity: 0;
          }
        }

        .animate-spinSlow {
          animation: spinSlow 6s linear infinite;
        }

        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}