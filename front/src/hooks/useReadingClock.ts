import { useEffect } from "react";
import { useApp } from "../state/AppContext";
import { dayKey } from "../domain/reading";
export function useReadingClock() {
  const { location, state, update, ready } = useApp(),
    id = state.active?.id;
  useEffect(() => {
    if (!ready || location.page !== "reader" || !id) return;
    let last = Date.now(),
      lastActivity = Date.now(),
      eligible = document.visibilityState === "visible" && document.hasFocus(),
      day = dayKey();
    const activity = () => {
      lastActivity = Date.now();
    };
    const tick = () => {
      const now = Date.now(),
        nextDay = dayKey(),
        active =
          document.visibilityState === "visible" &&
          document.hasFocus() &&
          now - lastActivity < 120000;
      const seconds =
        eligible && active && nextDay === day
          ? Math.min(10, Math.max(0, Math.floor((now - last) / 1000)))
          : 0;
      if (seconds)
        update((s) => ({
          ...s,
          readingSeconds: {
            ...s.readingSeconds,
            [day]: (s.readingSeconds[day] || 0) + seconds,
          },
          goalDays: { ...s.goalDays, [day]: s.goalDays[day] || s.goal },
        }));
      last = now;
      day = nextDay;
      eligible = active;
    };
    const timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("blur", tick);
    window.addEventListener("focus", tick);
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) =>
      window.addEventListener(e, activity, { passive: true }),
    );
    return () => {
      clearInterval(timer);
      tick();
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("blur", tick);
      window.removeEventListener("focus", tick);
      events.forEach((e) => window.removeEventListener(e, activity));
    };
  }, [location.page, id, update, ready]);
}
