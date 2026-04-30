"use client";
import React from "react";

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] uncaught error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6"
          style={{ background: "#060c15" }}
        >
          <div
            className="max-w-md w-full rounded-2xl p-6 text-center"
            style={{ background: "#0c1628", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "#ef4444" }}>
              Erreur inattendue
            </h2>
            <p className="text-sm mb-5 font-mono-cyber" style={{ color: "#64748b" }}>
              {this.state.error.message || "Une erreur est survenue dans l'interface."}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.reset}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(34,211,238,0.1)",
                  border: "1px solid rgba(34,211,238,0.3)",
                  color: "#22d3ee",
                }}
              >
                Réessayer
              </button>
              <button
                onClick={() => (typeof window !== "undefined" ? window.location.reload() : undefined)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(100,116,139,0.08)",
                  border: "1px solid rgba(100,116,139,0.2)",
                  color: "#94a3b8",
                }}
              >
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
