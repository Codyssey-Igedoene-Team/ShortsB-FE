import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { byId } from "../domain/catalog";
import {
  defaults,
  startSession,
  resumeBook,
  advance,
  retreat,
  continueGuestReading,
} from "../domain/reading";
import { authenticateDemo } from "../domain/auth";
import {
  restore,
  persist,
  logoutToGuest,
  restoreAccount,
} from "../domain/storage";
import type { Session, State } from "../domain/types";
import {
  routes,
  readLocation,
  routeHref,
  resolveLocation,
  type Route,
  type Location,
} from "../app/routes";
type Context = {
  state: State;
  update: (fn: (s: State) => State) => void;
  location: Location;
  go: (page: Route, book?: string, replace?: boolean) => void;
  notify: (text: string) => void;
  notice: string;
  storageError: boolean;
  ready: boolean;
  start: (
    id: string,
    start?: number,
    mode?: Session["mode"],
    trail?: string[],
  ) => void;
  resume: (id: string) => void;
  next: () => void;
  previous: () => void;
  pause: () => void;
  login: (id: string, password: string) => boolean;
  logout: () => void;
  continueReading: () => void;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({
  children,
  initialLocation = { page: "index" },
  initialState = defaults(),
}: {
  children: ReactNode;
  initialLocation?: Location;
  initialState?: State;
}) {
  const [state, setState] = useState(initialState),
    [location, setLocation] = useState(initialLocation),
    [notice, setNotice] = useState(""),
    [storageError, setStorageError] = useState(false),
    [ready, setReady] = useState(false);
  const stateRef = useRef(state),
    canWrite = useRef(false);
  stateRef.current = state;
  const update = useCallback((fn: (s: State) => State) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    if (canWrite.current) setStorageError(!persist(localStorage, next));
  }, []);
  const go = useCallback((page: Route, book?: string, replace = false) => {
    setNotice("");
    const requestedLocation = { page, book };
    const nextLocation = resolveLocation(stateRef.current, requestedLocation);
    setLocation(nextLocation);
    if (typeof window !== "undefined") {
      window.history[
        replace || nextLocation !== requestedLocation
          ? "replaceState"
          : "pushState"
      ]({}, "", routeHref(nextLocation, new URL(window.location.href)));
      window.scrollTo(0, 0);
    }
  }, []);
  useEffect(() => {
    let restored = initialState;
    try {
      const loaded = restore(localStorage);
      restored = loaded.state;
      canWrite.current = loaded.canWrite;
      setStorageError(loaded.warning);
      if (loaded.canWrite && !persist(localStorage, restored))
        setStorageError(true);
    } catch {
      setStorageError(true);
    }
    stateRef.current = restored;
    setState(restored);
    const loc = readLocation();
    const resolved = resolveLocation(restored, loc);
    if (
      resolved !== loc ||
      (window.location.protocol !== "file:" &&
        window.location.pathname.endsWith(".html"))
    )
      go(resolved.page, resolved.book, true);
    else setLocation(loc);
    setReady(true);
    const onPop = () => {
      const requested = readLocation();
      const resolved = resolveLocation(stateRef.current, requested);
      if (resolved !== requested) go(resolved.page, resolved.book, true);
      else {
        setLocation(requested);
        setNotice("");
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
    // Bootstrap once. Subsequent navigation is state-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    document.title = `shortB · ${routes[location.page]}`;
    document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
  }, [location.page]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(t);
  }, [notice]);
  const start = useCallback<Context["start"]>(
    (id, offset, mode = "excerpt", trail) => {
      if (!byId.get(id)?.available) {
        setNotice("한국어 전문을 준비하고 있어요.");
        return;
      }
      update((s) => startSession(s, id, { start: offset, mode, trail }));
      go("reader", id);
    },
    [go, update],
  );
  const resume = useCallback<Context["resume"]>(
    (id) => {
      const next = resumeBook(stateRef.current, id);
      if (!next.active) {
        go("book", id);
        return;
      }
      update(() => next);
      go("reader", id);
    },
    [go, update],
  );
  const previous = () => {
    update(retreat);
    window.scrollTo(0, 0);
  };
  const next = () => {
    const previous = stateRef.current.active;
    if (!previous) return;
    const result = advance(stateRef.current);
    update(() => result);
    window.scrollTo(0, 0);
    if (!result.active)
      go(previous.mode === "trial" ? "trial-done" : "complete", previous.id);
  };
  const pause = () => {
    update((s) => {
      if (!s.active) return s;
      const a = { ...s.active, scrollY: window.scrollY, updatedAt: Date.now() };
      return { ...s, active: null, progress: { ...s.progress, [a.id]: a } };
    });
    go("home");
    setNotice("읽던 위치를 저장했어요.");
  };
  const login = (id: string, password: string) => {
    const authenticated = authenticateDemo(stateRef.current, id, password);
    if (!authenticated) return false;
    update(() => restoreAccount(localStorage) || authenticated);
    go("home", undefined, true);
    return true;
  };
  const logout = () => {
    const guest = logoutToGuest(localStorage, stateRef.current);
    if (!guest) {
      setStorageError(true);
      setNotice("독서 기록을 보관하지 못했어요. 다시 로그아웃해 주세요.");
      return;
    }
    update(() => guest);
    go("index", undefined, true);
  };
  const continueReading = useCallback(() => {
    const next = continueGuestReading(stateRef.current);
    if (!next.active) {
      go("complete", next.finished?.id, true);
      return;
    }
    update(() => next);
    go("reader", next.active?.id, true);
  }, [go, update]);
  return (
    <AppContext.Provider
      value={{
        state,
        update,
        location,
        go,
        notify: setNotice,
        notice,
        storageError,
        ready,
        start,
        resume,
        next,
        previous,
        pause,
        login,
        logout,
        continueReading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw Error("AppProvider is required");
  return c;
}
