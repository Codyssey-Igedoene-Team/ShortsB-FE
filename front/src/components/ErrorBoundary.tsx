import { Component, type ReactNode } from "react";
import { routeHref } from "../app/routes";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="error-page">
        <h1>화면을 다시 열어주세요.</h1>
        <p>저장한 독서 기록은 그대로 남아 있어요.</p>
        <button
          onClick={() =>
            (window.location.href = routeHref(
              { page: "home" },
              new URL(window.location.href),
            ))
          }
        >
          오늘 읽기로
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
