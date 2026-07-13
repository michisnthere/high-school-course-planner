import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider } from "@/context/AuthContext";

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
      <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
            <Sidebar />
            <main style={{ flex: 1 }}>
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
