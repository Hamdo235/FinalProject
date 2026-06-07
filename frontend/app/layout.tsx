import "./globals.css";
import React from "react";
import AuthProvider from "@/components/layout/AuthProvider";
import { Inter, JetBrains_Mono } from "next/font/google";

export const metadata = { title: "CyberSentinel-LLM" };

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  preload: true,
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  preload: true,
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body
        className={`${inter.variable} ${jetbrains.variable} h-screen overflow-hidden antialiased`}
        style={{ background: "#0D1117", color: "#E6E9EF" }}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
