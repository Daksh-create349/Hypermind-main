import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-black text-white h-full w-full flex flex-col items-center justify-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong.</h1>
                    <pre className="bg-neutral-900 p-4 rounded border border-red-500/30 text-xs font-mono max-w-2xl overflow-auto">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500"
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
