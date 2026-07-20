import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AuthProvider } from "@/context/AuthContext";
import { ServiceProvider } from "@/services/ServiceContext";
import { KeyboardShortcutProvider } from "@/context/KeyboardShortcutContext";
import { AuthToast } from "@/components/auth/AuthToast";
import { breakpoints } from "@/lib/responsive";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Stevenson Course Planner",
  description: "Plan your courses at Stevenson High School",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <style>{`
          .rs-layout-header {
            display: block;
          }
          .rs-layout-sidebar {
            display: flex;
            flex-direction: column;
          }
          .rs-layout-mobile-nav {
            display: none;
          }
          @media (max-width: ${breakpoints.tablet - 1}px) {
            .rs-layout-header,
            .rs-layout-sidebar {
              display: none;
            }
            .rs-layout-mobile-nav {
              display: block;
            }
            .rs-layout-body {
              padding-top: calc(56px + var(--safe-area-top, 0px));
              --layout-min-height: calc(100vh - 56px - var(--safe-area-top, 0px));
            }
          }
          @media (max-width: ${breakpoints.mobile - 1}px) {
            .rs-layout-body {
              padding-top: calc(56px + var(--safe-area-top, 0px) + 12px);
            }
          }
        `}</style>
        <AuthProvider>
          <KeyboardShortcutProvider>
          <ServiceProvider>
            <div className="rs-layout-header">
              <Header />
            </div>
            <div className="rs-layout-mobile-nav">
              <MobileNav />
            </div>
            <div
              className="rs-layout-body"
              style={{ display: "flex", minHeight: "var(--layout-min-height, calc(100vh - 64px))" }}
            >
              <div className="rs-layout-sidebar">
                <Sidebar />
              </div>
              <main style={{ flex: 1 }}>
                {children}
              </main>
            </div>
          </ServiceProvider>
          <AuthToast />
          </KeyboardShortcutProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
