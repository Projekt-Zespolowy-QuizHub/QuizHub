"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <p className="text-5xl mb-4">⚠️</p>
            <h1 className="text-2xl font-bold mb-2">Coś poszło nie tak</h1>
            <p className="text-gray-400 mb-6 text-sm">
              Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition-colors"
            >
              Odśwież stronę
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
