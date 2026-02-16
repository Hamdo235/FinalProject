import "./globals.css";
import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import ChatbotDock from "@/components/layout/ChatbotDock";
import MainContent from "@/components/layout/MainContent";
import AlertPulse from "@/components/layout/AlertPulse";
import { Space_Grotesk, Fraunces } from "next/font/google";

export const metadata = { title: "CyberSentinel-LLM" };

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${space.variable} ${fraunces.variable} h-screen overflow-hidden text-gray-900 antialiased`}>
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
