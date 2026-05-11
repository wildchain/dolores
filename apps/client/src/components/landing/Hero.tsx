"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";

export function Hero() {
  const meshRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Intersection observer for reveal animations
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

    const reveals = document.querySelectorAll(".reveal, .kicker, .stagger");
    reveals.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="relative min-h-screen flex items-center justify-center px-8 py-20"
      style={{
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Background gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(91,175,214,0.08) 0%, transparent 50%)",
        }}
      />

      {/* Animated mesh network background */}
      <div
        ref={meshRef}
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{ zIndex: 1 }}
      >
        {/* Nodes */}
        <div
          className="node n1"
          style={{
            position: "absolute",
            width: "8px",
            height: "8px",
            background: "var(--accent)",
            borderRadius: "50%",
            top: "15%",
            left: "10%",
            animation: "nodeFloat 6s ease-in-out infinite",
          }}
        />
        <div
          className="node n2"
          style={{
            position: "absolute",
            width: "6px",
            height: "6px",
            background: "var(--primary)",
            borderRadius: "50%",
            top: "25%",
            right: "15%",
            animation: "nodeFloat 7s ease-in-out infinite",
          }}
        />
        <div
          className="node n3"
          style={{
            position: "absolute",
            width: "10px",
            height: "10px",
            background: "var(--ok)",
            borderRadius: "50%",
            bottom: "20%",
            left: "20%",
            animation: "nodeFloat 5.5s ease-in-out infinite",
          }}
        />
        <div
          className="node n4"
          style={{
            position: "absolute",
            width: "7px",
            height: "7px",
            background: "var(--accent)",
            borderRadius: "50%",
            bottom: "30%",
            right: "25%",
            animation: "nodeFloat 6.5s ease-in-out infinite",
          }}
        />

        {/* Connection lines (SVG would be better but keeping simple) */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.3 }}
        >
          <line
            x1="10%"
            y1="15%"
            x2="85%"
            y2="25%"
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1="10%"
            y1="15%"
            x2="20%"
            y2="80%"
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1="85%"
            y1="25%"
            x2="75%"
            y2="70%"
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      {/* Content */}
      <div
        className="relative z-10 max-w-4xl mx-auto text-center"
        style={{ zIndex: 2 }}
      >
        {/* Kicker */}
        <div className="kicker reveal mb-6 inline-flex items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full font-semibold uppercase tracking-[.14em]"
            style={{
              fontSize: "var(--fs-12)",
              color: "var(--accent)",
              padding: "6px 16px",
              background: "rgba(91,175,214,0.08)",
              border: "1px solid rgba(91,175,214,0.2)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--ok)" }}
            />
            <span className="kicker-line" />
            Accountability Layer
          </span>
        </div>

        {/* Main headline */}
        <h1
          className="reveal delay-1 font-bold mb-6"
          style={{
            fontSize: "clamp(44px, 8vw, 80px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "var(--fg)",
            marginBottom: "24px",
          }}
        >
          AI agents,{" "}
          <em
            style={{
              fontStyle: "normal",
              background:
                "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            held accountable.
          </em>
        </h1>

        {/* Subheadline */}
        <p
          className="reveal delay-2 mb-10 max-w-2xl mx-auto"
          style={{
            fontSize: "var(--fs-20)",
            color: "var(--fg-muted)",
            lineHeight: 1.5,
          }}
        >
          Dolores is the accountability layer for AI agents on Solana. Every
          action is recorded, every mistake has a cost, and reputation is earned
          through proof—not promises.
        </p>

        {/* CTA buttons */}
        <div className="reveal delay-3 flex items-center justify-center gap-4 flex-wrap mb-16">
          <Link
            href="/explorer"
            className="group px-6 py-3 rounded-[var(--radius)] font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            style={{
              fontSize: "var(--fs-16)",
              background: "var(--fg)",
              color: "var(--fg-inverse)",
              border: "1px solid var(--fg)",
            }}
          >
            Launch app
            <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
          <Link
            href="#how"
            className="px-6 py-3 rounded-[var(--radius)] font-semibold transition-all duration-200 hover:bg-[var(--surface-raised)]"
            style={{
              fontSize: "var(--fs-16)",
              color: "var(--fg)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
            }}
          >
            How it works
          </Link>
          <Link
            href="docs"
            className="px-6 py-3 rounded-[var(--radius)] font-medium transition-all duration-200"
            style={{
              fontSize: "var(--fs-16)",
              color: "var(--fg-muted)",
              textDecoration: "underline",
              textDecorationColor: "var(--border-subtle)",
              textUnderlineOffset: "4px",
            }}
          >
            Read the docs
          </Link>
        </div>

        {/* Scroll cue */}
        <div
          className="reveal delay-4 flex flex-col items-center gap-2"
          style={{ animation: "bobDown 2s ease-in-out infinite" }}
        >
          <span
            style={{
              fontSize: "var(--fs-12)",
              color: "var(--fg-subtle)",
              textTransform: "uppercase",
              letterSpacing: ".12em",
              fontWeight: 600,
            }}
          >
            Scroll to explore
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--fg-subtle)" }}
          >
            <path d="M8 3v10M4 9l4 4 4-4" />
          </svg>
        </div>
      </div>

      <style jsx>{`
        @keyframes nodeFloat {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          25% {
            transform: translateY(-15px) translateX(10px);
          }
          50% {
            transform: translateY(-8px) translateX(-8px);
          }
          75% {
            transform: translateY(12px) translateX(15px);
          }
        }

        @keyframes bobDown {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(8px);
          }
        }

        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .reveal.in-view {
          opacity: 1;
          transform: translateY(0);
        }

        .reveal.delay-1 {
          transition-delay: 0.1s;
        }

        .reveal.delay-2 {
          transition-delay: 0.2s;
        }

        .reveal.delay-3 {
          transition-delay: 0.3s;
        }

        .reveal.delay-4 {
          transition-delay: 0.4s;
        }

        .kicker .kicker-line {
          display: inline-block;
          width: 24px;
          height: 1px;
          background: var(--accent);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .kicker.in-view .kicker-line {
          transform: scaleX(1);
        }
      `}</style>
    </section>
  );
}
