import "./globals.css";
import React from "react";
import AuthProvider from "@/components/layout/AuthProvider";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

export const metadata = { title: "CyberSentinel-LLM" };

const space = Space_Grotesk({
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
    <html lang="fr" style={{ colorScheme: "dark" }}>
      <body
        className={`${space.variable} ${jetbrains.variable} h-screen overflow-hidden antialiased`}
        style={{ background: "#080f1a", color: "#e2e8f0" }}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
