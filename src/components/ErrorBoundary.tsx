import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render crashes so the app never leaves a blank white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="login-page">
          <div className="login-card panel" role="alert">
            <div className="brand login-brand">
              <div className="brand-mark" aria-hidden>
                OPA
              </div>
              <h1>Something went wrong</h1>
              <p>The app hit an unexpected error. Try reloading.</p>
            </div>
            <p className="form-error">{this.state.error.message}</p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                this.setState({ error: null });
                window.location.assign("/login");
              }}
            >
              Reload login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
