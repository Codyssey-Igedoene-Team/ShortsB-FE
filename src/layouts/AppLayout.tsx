import type { ReactNode } from "react";
import { useApp } from "../state/AppContext";
import { accountRoutes, navigationRoutes } from "../app/routes";
import { BottomNav, Header } from "../components/UI";
export function AppLayout({ children }: { children: ReactNode }) {
  const { location, state, notice, storageError } = useApp();
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
      {showNav && <BottomNav />}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
