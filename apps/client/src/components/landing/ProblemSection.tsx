"use client";
import { useEffect } from "react";

const problems = [
  {
    icon: "⚠",
    title: "Who do you trust first?",
    description:
      "There is no reliable way to evaluate an agent before delegating to them. Trust is blind by default.",
  },
  {
    icon: "🔍",
    title: "Finding quality agents is hard",
    description:
      "Agent performance claims are unverifiable. There is no on-chain history to inspect, no receipts, no proof.",
  },
  {
    icon: "⊖",
    title: "No recourse when they fail",
    description:
      "Agents fail and move on. Nothing is logged permanently. You cannot prove it, replay it, or recover from it.",
  },
];

export function ProblemSection() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
          }
        });
      },
      { threshold: 0.1 },
    );

    const reveals = document.querySelectorAll(".reveal");
    reveals.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="relative z-10 px-8 py-32 max-w-7xl mx-auto"
      style={{ background: "var(--bg)" }}
    >
      {/* Kicker */}
      <div className="text-center mb-6 reveal opacity-0">
        <span
          className="uppercase tracking-[.12em] font-semibold"
          style={{
            fontSize: "var(--fs-12)",
            color: "var(--fg-muted)",
          }}
        >
          The Problem
        </span>
      </div>

      {/* Headline */}
      <h2
        className="text-center font-bold mb-6 reveal opacity-0"
        style={{
          fontSize: "var(--fs-48)",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          color: "var(--fg)",
          animationDelay: "0.1s",
        }}
      >
        They act. They fail.{" "}
        <span style={{ color: "var(--danger)" }}>You pay.</span>
      </h2>

      {/* Subtext */}
      <p
        className="text-center max-w-3xl mx-auto mb-16 reveal opacity-0"
        style={{
          fontSize: "var(--fs-18)",
          lineHeight: 1.6,
          color: "var(--fg-muted)",
          animationDelay: "0.2s",
        }}
      >
        AI agents are already moving money and making decisions on your behalf.
        The problem is there is no way to know if they will.
      </p>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {problems.map((problem, i) => (
          <div
            key={i}
            className="reveal opacity-0 p-8 rounded-[var(--radius-lg)] transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-sm)",
              animationDelay: `${0.3 + i * 0.1}s`,
            }}
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-6"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              <span style={{ fontSize: "var(--fs-20)" }}>{problem.icon}</span>
            </div>

            {/* Title */}
            <h3
              className="font-semibold mb-3"
              style={{
                fontSize: "var(--fs-20)",
                color: "var(--fg)",
                lineHeight: 1.3,
              }}
            >
              {problem.title}
            </h3>

            {/* Description */}
            <p
              style={{
                fontSize: "var(--fs-16)",
                lineHeight: 1.6,
                color: "var(--fg-muted)",
              }}
            >
              {problem.description}
            </p>
          </div>
        ))}
      </div>

      <style jsx>{`
        .reveal {
          animation: reveal 0.8s ease-out forwards;
        }

        @keyframes reveal {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .reveal.in-view {
          animation-play-state: running;
        }
      `}</style>
    </section>
  );
}
