import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/ui/Toast";
import { WalletContextProvider } from "@/context/WalletContextProvider";
import { AuthProvider } from "@/context/AuthContext";

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
        <WalletContextProvider>
          <AuthProvider>
            <ToastProvider>
              <div className="relative z-10">
                <Navbar />
                <main className="min-h-screen">{children}</main>
              </div>
            </ToastProvider>
          </AuthProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}
