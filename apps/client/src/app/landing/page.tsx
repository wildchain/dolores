"use client";
import { useEffect } from "react";

export default function Landing() {
  useEffect(() => {
    // Redirect to the static HTML file
    window.location.href = "/landing.html";
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#11110f", color: "#f4eddf" }}
    >
      <div className="text-center">
        <p className="text-lg">Redirecting...</p>
      </div>
    </div>
  );
}
