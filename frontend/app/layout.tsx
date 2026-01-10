import "./globals.css";
import React from "react";

export const metadata = { title: "CyberSentinel-LLM" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="w-full border-b bg-white">
          <nav className="max-w-5xl mx-auto flex items-center gap-4 p-3 text-sm">
            <a href="/" className="font-medium">Accueil</a>
            <a href="/alerts" className="text-neutral-700 hover:text-black">Alerts</a>
            <a href="/demo" className="text-neutral-700 hover:text-black">Demo</a>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
