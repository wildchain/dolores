import type { Metadata } from "next";
import "./globals.css";
import "@mantine/core/styles.css";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ToastProvider } from "@/components/ui/Toast";
import { WalletContextProvider } from "@/context/WalletContextProvider";
import { AuthProvider } from "@/context/AuthContext";
import { AppQueryProvider } from "@/context/QueryProvider";
import { PendingChallengesProvider } from "@/context/PendingChallengesContext";
import { MantineProviderWrapper } from "@/components/providers/MantineProviderWrapper";
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
        <AppQueryProvider>
          <WalletContextProvider>
            <MantineProvider>
              <AuthProvider>
                <PendingChallengesProvider>
                  <ToastProvider>
                    <div className="relative z-10">
                      <ConditionalNavbar />
                      <main className="min-h-screen">{children}</main>
                    </div>
                  </ToastProvider>
                </PendingChallengesProvider>
              </AuthProvider>
            </MantineProvider>
          </WalletContextProvider>
        </AppQueryProvider>
      </body>
    </html>
  );
}
