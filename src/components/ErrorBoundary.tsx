import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-[#1A2C54] mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-6 font-light">
              We encountered a temporary loading issue. Refreshing the page usually resolves this.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-ruby text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs hover:bg-ruby/90 transition-all"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 bg-gray-100 text-[#1A2C54] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-200 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
