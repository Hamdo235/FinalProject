import "./globals.css";
import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import ChatbotDock from "@/components/layout/ChatbotDock";
import MainContent from "@/components/layout/MainContent";

export const metadata = { title: "CyberSentinel-LLM" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="h-screen overflow-hidden bg-gray-50 text-gray-900 antialiased">
        <div className="flex h-screen min-h-0">
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
        <ChatbotDock />
      </body>
    </html>
  );
}
