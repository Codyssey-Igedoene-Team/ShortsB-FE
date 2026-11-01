import type { ReactNode } from "react";
import { useApp } from "../state/AppContext";
import { accountRoutes, navigationRoutes } from "../app/routes";
import { BottomNav, Header } from "../components/UI";
export function AppLayout({ children }: { children: ReactNode }) {
  const {
    location,
    state,
    notice,
    storageError,
    testing,
    finishTest,
    authStatus,
    authBusy,
    localTestLogin,
  } = useApp();
  const page = location.page;
  const showHeader =
    !(page === "complete" && !state.demoAccountComplete) &&
    !accountRoutes.has(page) &&
    !["reader", "trial", "index"].includes(page);
  const showNav = state.demoAccountComplete && navigationRoutes.has(page);
  return (
    <div className={"app-shell " + (page === "reader" ? "reading" : "")}>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      {showHeader && <Header />}
      {localTestLogin && (
        <aside className="test-session-banner">
          테스트 로그인 중 · 서버에 연결하지 않아요.
        </aside>
      )}
      {testing && (
        <aside className="test-session-banner" aria-label="첫 로그인 테스트">
          <span>첫 로그인 테스트 중 · 기존 기록은 백업되어 있어요.</span>
          <button
            className="text-button"
            onClick={finishTest}
            disabled={authBusy}
          >
            테스트 종료 · 기존 기록 복원
          </button>
        </aside>
      )}
      {storageError && (
        <p className="storage-warning" role="alert">
          저장된 기록을 불러오거나 새 기록을 저장하는 데 문제가 있어요. 기존
          데이터는 보관했어요.
        </p>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          accountRoutes.has(page)
            ? "auth-main"
            : showNav
              ? "content with-nav"
              : "content"
        }
      >
        {children}
      </main>
      {showNav && authStatus !== "checking" && authStatus !== "error" && (
        <BottomNav />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
