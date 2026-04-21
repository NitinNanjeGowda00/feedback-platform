"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

type Slide = {
  badge: string;
  h1: string;
  h2: string;
  h3: string;
  gradient: string;
  image: string;
};

const slides: Slide[] = [
  {
    badge: "🤖 AI-Powered",
    h1: "Smarter Work Starts Now",
    h2: "Make Work Easy",
    h3: "Share what slows you down, and help us build better tools",
    gradient: "from-purple-600/85 to-indigo-600/75",
    image: "/slide1.jpg",
  },
  {
    badge: "💡 Innovation",
    h1: "Fix the Small Problems",
    h2: "Improve Your Workday",
    h3: "Your feedback helps us make better tools for everyone",
    gradient: "from-orange-500/85 to-pink-600/75",
    image: "/slide2.jpg",
  },
  {
    badge: "🚀 Most Popular",
    h1: "Your Voice Matters",
    h2: "Improve the Way You Work",
    h3: "Tell us what you need to work with less stress",
    gradient: "from-blue-600/85 to-purple-600/75",
    image: "/slide3.jpg",
  },
  {
    badge: "⭐ Trusted",
    h1: "We Listen to Users",
    h2: "Real Feedback, Real Change",
    h3: "Your day-to-day struggles can guide our next ideas",
    gradient: "from-emerald-500/85 to-teal-600/75",
    image: "/slide4.jpg",
  },
];

export function HeroSlideshow() {
  const [current, setCurrent] = useState(0);

  // 👇 NEW: hover state
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const prevSlide = () => {
    setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % slides.length);
  };

  return (
    <div
      className="relative w-full max-w-5xl mx-auto h-[400px] sm:h-[450px] lg:h-[500px] rounded-[30px] overflow-hidden shadow-[0_28px_70px_rgba(0,0,0,0.24)]"

      // 👇 NEW: hover detection
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {slides.map((slide, index) => {
        const isActive = index === current;

        return (
          <div
            key={slide.h1}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${isActive
                ? "opacity-100 z-10"
                : "opacity-0 z-0 pointer-events-none"
              }`}
          >
            <div
              className={`relative h-full w-full bg-gradient-to-r ${slide.gradient}`}
            >
              <Image
                src={slide.image}
                alt={slide.h1}
                fill
                priority={isActive}
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover object-center opacity-30"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-transparent" />

              <div className="relative z-10 h-full flex items-center px-8 sm:px-12 lg:px-16">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center mb-4 rounded-full border border-white/25 bg-white/18 px-5 py-2 text-sm text-white shadow-sm backdrop-blur-md">
                    {slide.badge}
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.05] mb-4">
                    {slide.h1}
                  </h1>

                  <h2 className="text-2xl sm:text-3xl font-semibold text-white/92 mb-4">
                    {slide.h2}
                  </h2>

                  <p className="text-lg sm:text-xl text-white/82 mb-7 max-w-xl">
                    {slide.h3}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("feedback-form")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                    }
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-medium text-slate-800 shadow-md transition hover:scale-[1.02] hover:shadow-lg"
                  >
                    <span>👇</span>
                    <span>Share Your Feedback Below</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 👇 UPDATED: LEFT ARROW */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Previous slide"
        className={`absolute left-5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.14)] transition-all duration-300 hover:scale-105 active:scale-95 ${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
      >
        <ChevronLeft className="h-5 w-5 text-slate-700" />
      </button>

      {/* 👇 UPDATED: RIGHT ARROW */}
      <button
        type="button"
        onClick={nextSlide}
        aria-label="Next slide"
        className={`absolute right-5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.14)] transition-all duration-300 hover:scale-105 active:scale-95 ${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
      >
        <ChevronRight className="h-5 w-5 text-slate-700" />
      </button>

      <div className="absolute bottom-5 left-0 right-0 z-20 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-3 w-3 rounded-full transition ${i === current ? "bg-white" : "bg-white/45"
              }`}
          />
        ))}
      </div>
    </div>
  );
}