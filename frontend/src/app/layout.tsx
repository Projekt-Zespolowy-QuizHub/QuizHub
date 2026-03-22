import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/AuthProvider";
import { ToastProvider } from "@/lib/ToastContext";
import { ToastContainer } from "@/components/ToastContainer";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotificationsMount from "@/components/NotificationsMount";
import { LocaleProvider } from "@/lib/LocaleContext";
import TournamentBanner from "@/components/TournamentBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QuizHub",
  description: "Quiz Multiplayer - rywalizuj ze znajomymi",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className={`${inter.className} text-white min-h-screen`}>
        <ErrorBoundary>
          <LocaleProvider>
            <AuthProvider>
              <ToastProvider>
                <TournamentBanner />
                <Navbar />
                <NotificationsMount />
                <main className="max-w-5xl mx-auto px-4 py-4 sm:py-6">{children}</main>
                <ToastContainer />
              </ToastProvider>
            </AuthProvider>
          </LocaleProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
