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
  dayKey,
  needsDailyGoal,
} from "../domain/reading";
import { authApi, type SessionUser } from "../services/authApi";
import {
  DEV_LOGIN_ENABLED,
  LOCAL_TEST_SESSION_KEY,
  OAUTH_PENDING_KEY,
  LOCAL_TEST_USER,
  readLocalTestUser,
} from "../services/localTestAuth";
import {
  restore,
  persist,
  logoutToGuest,
  bindServerAccount,
  beginOnboardingTest,
  endOnboardingTest,
  TEST_BACKUP_KEY,
} from "../domain/storage";
import type { Session, State } from "../domain/types";
import {
  routes,
  readLocation,
  routeHref,
  resolveLocation,
  protectedRoutes,
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
  user: SessionUser | null;
  authStatus: "checking" | "authenticated" | "anonymous" | "error";
  authError: string;
  authBusy: boolean;
  localTestLogin: boolean;
  testLogin: () => void;
  refreshSession: () => Promise<void>;
  testing: boolean;
  restartTest: () => void;
  finishTest: () => void;
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
  login: () => void;
  logout: () => Promise<void>;
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
    [ready, setReady] = useState(false),
    [testing, setTesting] = useState(false),
    [user, setUser] = useState<SessionUser | null>(null),
    [authStatus, setAuthStatus] = useState<Context["authStatus"]>("anonymous"),
    [authError, setAuthError] = useState(""),
    [authBusy, setAuthBusy] = useState(false),
    [localTestLogin, setLocalTestLogin] = useState(false);
  const stateRef = useRef(state),
    canWrite = useRef(false),
    mounted = useRef(false),
    initialEntry = useRef<Location | null>(null),
    authRequest = useRef(false),
    authOperation = useRef(false);
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
  const refreshSession = useCallback(async () => {
    if (authRequest.current || authOperation.current) return;
    authRequest.current = true;
    setAuthStatus("checking");
    setAuthError("");
    try {
      const verified = await authApi.me();
      if (!mounted.current) return;
      const previous = stateRef.current;
      const next = verified
        ? bindServerAccount(
            localStorage,
            previous,
            verified.id,
            canWrite.current && !!localStorage.getItem(TEST_BACKUP_KEY),
          )
        : previous.demoUserId
          ? defaults()
          : { ...previous, demoAccountComplete: false };
      update(() => next);
      setUser(verified);
      setAuthStatus(verified ? "authenticated" : "anonymous");
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      const requested =
        verified && initialEntry.current
          ? initialEntry.current
          : readLocation();
      initialEntry.current = null;
      const loginFailed = new URLSearchParams(window.location.search).has(
        "error",
      );
      if (
        !verified &&
        (previous.demoUserId || protectedRoutes.has(requested.page))
      )
        go("login", undefined, true);
      else {
        const resolved = resolveLocation(next, requested);
        const current = readLocation();
        if (
          resolved.page !== current.page ||
          resolved.book !== current.book ||
          window.location.pathname.endsWith(".html")
        )
          go(resolved.page, resolved.book, true);
      }
      if (!verified && loginFailed)
        setNotice("Google 로그인을 완료하지 못했어요. 다시 시도해주세요.");
      setReady(true);
    } catch (error) {
      if (!mounted.current) return;
      initialEntry.current = null;
      // A failed authentication check must never block public guest reading.
      // Keep member records archived instead of displaying them without verification.
      if (stateRef.current.demoUserId) {
        update(() => defaults());
        setUser(null);
        go("login", undefined, true);
      }
      setAuthError(
        error instanceof Error
          ? error.message
          : "로그인 상태를 확인하지 못했어요.",
      );
      setAuthStatus("error");
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      setReady(true);
    } finally {
      authRequest.current = false;
    }
  }, [go, update]);
  useEffect(() => {
    mounted.current = true;
    let restored = initialState;
    try {
      const loaded = restore(localStorage);
      setTesting(!!localStorage.getItem(TEST_BACKUP_KEY));
      restored = loaded.state;
      canWrite.current = loaded.canWrite;
      setStorageError(loaded.warning);
      if (loaded.canWrite && !persist(localStorage, restored))
        setStorageError(true);
    } catch {
      setStorageError(true);
    }
    // No network request on ordinary startup. Only an explicitly started OAuth flow
    // checks the server after returning, and development test sessions stay local.
    const localUser = readLocalTestUser(sessionStorage, DEV_LOGIN_ENABLED);
    const guest = localUser
      ? bindServerAccount(
          localStorage,
          restored,
          localUser.id,
          !!localStorage.getItem(TEST_BACKUP_KEY),
        )
      : restored.demoUserId
        ? defaults()
        : restored;
    stateRef.current = guest;
    setState(guest);
    if (localUser) {
      setUser(localUser);
      setLocalTestLogin(true);
      setAuthStatus("authenticated");
    }
    const requested = readLocation();
    initialEntry.current = requested;
    go(requested.page, requested.book, true);
    setReady(true);
    if (sessionStorage.getItem(OAUTH_PENDING_KEY) === "google")
      void refreshSession();
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
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      authOperation.current = false;
      setAuthBusy(false);
      if (sessionStorage.getItem(OAUTH_PENDING_KEY) === "google")
        void refreshSession();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      mounted.current = false;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
      window.removeEventListener("pageshow", onPageShow);
    };
    // Bootstrap once. Subsequent navigation is state-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let observedDay = dayKey();
    let timer: ReturnType<typeof setTimeout>;
    const checkDay = () => {
      const today = dayKey();
      if (today !== observedDay) {
        observedDay = today;
        update((s) => ({ ...s }));
        const current = stateRef.current;
        if (
          current.demoAccountComplete &&
          current.setupCompleted &&
          needsDailyGoal(current, today)
        )
          go("goals", undefined, true);
      }
      clearTimeout(timer);
      const midnight = Date.parse(`${today}T00:00:00+09:00`) + 86400000;
      timer = setTimeout(checkDay, Math.max(10, midnight - Date.now() + 50));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkDay();
    };
    checkDay();
    window.addEventListener("focus", checkDay);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", checkDay);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [go, update]);
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
  const login = () => {
    if (authOperation.current) return;
    authOperation.current = true;
    setAuthBusy(true);
    sessionStorage.removeItem(LOCAL_TEST_SESSION_KEY);
    sessionStorage.setItem(OAUTH_PENDING_KEY, "google");
    window.location.assign(authApi.googleLoginUrl);
  };
  const testLogin = () => {
    if (!DEV_LOGIN_ENABLED || authOperation.current || authRequest.current)
      return;
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    sessionStorage.setItem(LOCAL_TEST_SESSION_KEY, "active");
    const account = bindServerAccount(
      localStorage,
      stateRef.current,
      LOCAL_TEST_USER.id,
      testing,
    );
    update(() => account);
    setLocalTestLogin(true);
    setUser(LOCAL_TEST_USER);
    setAuthStatus("authenticated");
    setAuthError("");
    go(account.setupCompleted ? "home" : "setup", undefined, true);
  };
  const logout = async () => {
    if (authOperation.current || authRequest.current) return;
    authOperation.current = true;
    setAuthBusy(true);
    try {
      if (!localTestLogin) await authApi.logout();
      sessionStorage.removeItem(LOCAL_TEST_SESSION_KEY);
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      setLocalTestLogin(false);
      const guest = logoutToGuest(localStorage, stateRef.current) || defaults();
      update(() => guest);
      setUser(null);
      setAuthStatus("anonymous");
      go("index", undefined, true);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "로그아웃하지 못했어요. 다시 시도해주세요.",
      );
    } finally {
      authOperation.current = false;
      setAuthBusy(false);
    }
  };
  const restartTest = async () => {
    if (authOperation.current || authRequest.current) return;
    authOperation.current = true;
    setAuthBusy(true);
    try {
      // Back up records before ending the real server session.
      if (!persist(localStorage, stateRef.current))
        throw new Error("기존 기록을 저장하지 못했어요.");
      if (!localTestLogin) await authApi.logout();
      sessionStorage.removeItem(LOCAL_TEST_SESSION_KEY);
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      setLocalTestLogin(false);
      const fresh = beginOnboardingTest(localStorage, stateRef.current);
      if (!fresh) {
        setUser(null);
        setAuthStatus("anonymous");
        update((s) => ({ ...s, demoAccountComplete: false }));
        go("login", undefined, true);
        setNotice("기존 기록을 백업하지 못해 테스트를 시작하지 않았어요.");
        return;
      }
      update(() => fresh);
      setTesting(true);
      setUser(null);
      setAuthStatus("anonymous");
      go("login", undefined, true);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "테스트를 시작하지 못했어요.",
      );
    } finally {
      authOperation.current = false;
      setAuthBusy(false);
    }
  };
  const finishTest = async () => {
    if (authOperation.current || authRequest.current) return;
    authOperation.current = true;
    setAuthBusy(true);
    try {
      const backup = DEV_LOGIN_ENABLED
        ? JSON.parse(localStorage.getItem(TEST_BACKUP_KEY) || "null")
        : null;
      const localBackup =
        DEV_LOGIN_ENABLED && backup?.demoUserId === LOCAL_TEST_USER.id;
      const verified =
        localTestLogin || localBackup ? LOCAL_TEST_USER : await authApi.me();
      if (!verified) {
        setUser(null);
        setAuthStatus("anonymous");
        update((s) => ({ ...s, demoAccountComplete: false }));
        go("login", undefined, true);
        setNotice(
          "기존 기록을 복원하려면 같은 Google 계정으로 로그인해주세요.",
        );
        return;
      }
      const original = endOnboardingTest(localStorage, verified.id);
      if (!original) {
        setNotice(
          "백업한 Google 계정인지 확인해주세요. 기존 기록은 백업에 남아 있어요.",
        );
        return;
      }
      update(() => original);
      setTesting(false);
      setUser(verified);
      if (localBackup || localTestLogin) {
        sessionStorage.setItem(LOCAL_TEST_SESSION_KEY, "active");
        setLocalTestLogin(true);
      }
      setAuthStatus("authenticated");
      go("index", undefined, true);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "기존 기록을 복원하지 못했어요.",
      );
    } finally {
      authOperation.current = false;
      setAuthBusy(false);
    }
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
        user,
        authStatus,
        authError,
        authBusy,
        localTestLogin,
        testLogin,
        refreshSession,
        testing,
        restartTest,
        finishTest,
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
