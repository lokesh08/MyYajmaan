import React from "react";
import { showError } from "../utils/toaster";
import { t } from "../i18n";

/**
 * Generic render-error boundary. Wraps a section of the page that can
 * fail for reasons outside our control (e.g. a third-party map/chart
 * library choking on bad data) so a crash in it degrades to a toast +
 * inline fallback instead of unmounting the whole app to a blank
 * white screen. The rest of the page (header, list, etc.) keeps working.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    showError(this.props.message || t("Something went wrong loading this section."));
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--color-rose-800)" }}>
            {this.props.message || t("Something went wrong loading this section.")}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
