import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { ServiceProvider } from "@/services/ServiceContext";
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var raw = window.localStorage.getItem("stevenson-preferences");
                  if (!raw) return;
                  var prefs = JSON.parse(raw);
                  var root = document.documentElement;
                  if (prefs && prefs.largerText === true) root.classList.add("rs-larger-text");
                  if (prefs && prefs.reducedMotion === "off") root.classList.add("rs-motion-off");
                  if (prefs && prefs.reducedMotion === "on") root.classList.add("rs-reduced-motion");
                } catch (error) {}
              })();
            `,
          }}
        />
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
            --layout-min-height: calc(100dvh - 56px - var(--safe-area-top, 0px));
          }
          }
          @media (max-width: ${breakpoints.mobile - 1}px) {
            .rs-layout-body {
              padding-top: calc(56px + var(--safe-area-top, 0px) + 12px);
            }
          }
          @media (min-width: ${breakpoints.tablet}px) {
            .rs-layout-body {
              height: calc(100dvh - 64px);
              overflow: hidden;
            }
            .rs-layout-body > main {
              overflow-y: auto;
              height: 100%;
            }
            .rs-layout-sidebar {
              overflow-y: auto;
              height: 100%;
            }
          }
        `}</style>
        <AuthProvider>
          <PreferencesProvider>
            <ServiceProvider>
              <a
                href="#main-content"
                className="rs-skip-link"
              >
                Skip to main content
              </a>
              <div className="rs-layout-header">
                <Header />
              </div>
              <div className="rs-layout-mobile-nav">
                <MobileNav />
              </div>
              <div
                className="rs-layout-body"
                style={{ display: "flex" }}
              >
                <div className="rs-layout-sidebar">
                  <Sidebar />
                </div>
                <main id="main-content" style={{ flex: 1, minWidth: 0 }}>
                  {children}
                </main>
              </div>
            </ServiceProvider>
          </PreferencesProvider>
          <AuthToast />
        </AuthProvider>
      </body>
    </html>
  );
}
