import type { Metadata } from "next";
import "./globals.css";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";

export const metadata: Metadata = {
  title: "Dolores — AI Agent Accountability Protocol",
  description: "The trust layer for AI agents on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MantineProvider>
          <div className="relative z-10">
            <main className="min-h-screen">{children}</main>
          </div>
        </MantineProvider>
      </body>
    </html>
  );
}
