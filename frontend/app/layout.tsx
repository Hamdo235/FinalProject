import "./globals.css";
import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import ChatbotDock from "@/components/layout/ChatbotDock";
import MainContent from "@/components/layout/MainContent";
import AlertPulse from "@/components/layout/AlertPulse";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

export const metadata = { title: "CyberSentinel-LLM" };

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ colorScheme: "dark" }}>
      <body
        className={`${space.variable} ${jetbrains.variable} h-screen overflow-hidden antialiased`}
        style={{ background: "#0a0e1a", color: "#e2e8f0" }}
      >
        <div className="flex h-screen min-h-0">
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
        <ChatbotDock />
        <AlertPulse />
      </body>
    </html>
  );
}
