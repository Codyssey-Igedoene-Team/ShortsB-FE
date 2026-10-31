import { useEffect } from "react";
import { useApp } from "../state/AppContext";
import { byId, availableBooks } from "../domain/catalog";
export function useTrial() {
  const { state, ready, start, resume, go, location } = useApp();
  useEffect(() => {
    if (!ready || location.page !== "trial") return;
    if (state.intro?.status === "done") {
      go("trial-done", undefined, true);
      return;
    }
    const b =
      byId.get(state.intro?.bookId || "") ||
      availableBooks[Math.floor(Math.random() * availableBooks.length)];
    const previous = state.progress[b.id];
    if (previous?.mode === "trial" && !previous.completed) resume(b.id);
    else start(b.id, 0, "trial");
  }, [ready, location.page, state.intro, state.progress, start, resume, go]);
}
