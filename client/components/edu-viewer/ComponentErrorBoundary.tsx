"use client";

import React from "react";

interface Props {
  label: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ComponentErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[Topic Component Crash] ${this.props.label}`, error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
        Failed to render {this.props.label}. You can still continue navigation.
      </div>
    );
  }
}

