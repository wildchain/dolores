"use client";
import { useEffect, useState } from "react";

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollTop = window.scrollY;
      const totalScroll = scrollHeight - clientHeight;
      const scrollProgress = (scrollTop / totalScroll) * 100;

      setProgress(Math.min(100, Math.max(0, scrollProgress)));
    };

    window.addEventListener("scroll", updateProgress);
    updateProgress(); // Initial call

    return () => window.removeEventListener("scroll", updateProgress);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none"
      style={{
        background: "var(--surface-raised)",
      }}
    >
      <div
        className="h-full transition-all duration-75 ease-out"
        style={{
          width: `${progress}%`,
          background:
            "linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)",
          boxShadow: "0 0 8px var(--accent)",
        }}
      />
    </div>
  );
}
