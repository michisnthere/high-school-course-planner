import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AuthProvider } from "@/context/AuthContext";
import { ServiceProvider } from "@/services/ServiceContext";
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
              --layout-min-height: calc(100vh - 56px - var(--safe-area-top, 0px));
            }
          }
        `}</style>
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
