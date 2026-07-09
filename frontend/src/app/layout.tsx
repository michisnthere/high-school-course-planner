import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "High School Course Planner",
  description: "Plan your high school courses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
          <Sidebar />
          <main style={{ flex: 1 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}