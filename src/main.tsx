import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Clinical Companion AI render error:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "12vh auto", padding: 24, color: "#1b2540" }}>
          <h1>Clinical Companion AI</h1>
          <h2>The app encountered a rendering error</h2>
          <p>Reload the page. If the problem continues, share this error message with support.</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#fff1f0", padding: 16, borderRadius: 8 }}>{this.state.error}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#3564d9", color: "white" }}>Reload app</button>
        </main>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error('Root element "#root" was not found.');
createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
