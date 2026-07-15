import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class SessionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Session screen failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <section className="session-recovery" role="alert">
      <div>
        <span>Session interrupted</span>
        <h1>We couldn't open the conversation.</h1>
        <p>Your session is still protected. Return to the dashboard and reconnect, or reload this page.</p>
        <small>{this.state.error.message}</small>
        <nav>
          <button onClick={() => window.location.reload()}>Reload session</button>
          <a href="/student">Return to dashboard</a>
        </nav>
      </div>
    </section>;
  }
}
