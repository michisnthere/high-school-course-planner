import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider } from "@/context/AuthContext";
import { ServiceProvider } from "@/services/ServiceContext";

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
        <AuthProvider>
          <ServiceProvider>
            <Header />
            <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
              <Sidebar />
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
