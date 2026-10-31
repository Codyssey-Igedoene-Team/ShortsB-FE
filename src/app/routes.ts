import type { State } from "../domain/types";
export const routes = {
  index: "시작",
  home: "오늘 읽기",
  trial: "첫 독서",
  "trial-done": "첫 독서 완료",
  login: "로그인",
  signup: "회원가입",
  email: "이메일 입력",
  code: "인증번호",
  "signup-password": "비밀번호 설정",
  recover: "비밀번호 찾기",
  "recover-sent": "메일 안내",
  setup: "추천 설정",
  search: "책 찾기",
  book: "책 정보",
  reader: "독서",
  complete: "독서 완료",
  discover: "다른 관점",
  library: "나의 책장",
  calendar: "독서 기록",
  goals: "하루 목표",
  preferences: "취향 선택",
  highlights: "표시한 문장",
  settings: "설정",
  source: "본문 출처",
  about: "앱 안내",
} as const;
export type Route = keyof typeof routes;
export type Location = { page: Route; book?: string };

export const isRoute = (value: string): value is Route =>
  Object.hasOwn(routes, value);
export const accountRoutes = new Set<Route>([
  "login",
  "signup",
  "email",
  "code",
  "signup-password",
  "recover",
  "recover-sent",
]);
export const navigationRoutes = new Set<Route>([
  "home",
  "search",
  "library",
  "settings",
  "highlights",
  "book",
  "complete",
  "discover",
]);

export function parseLocation(url: URL): Location {
  const [hash, hashQuery] = url.hash.slice(1).split("?");
  const file =
    url.pathname
      .split("/")
      .pop()
      ?.replace(/\.html$/, "") || "index";
  const page = isRoute(hash) ? hash : isRoute(file) ? file : "index";
  const query = new URLSearchParams(
    isRoute(hash) ? hashQuery || url.search : url.search,
  );
  return { page, book: query.get("book") || undefined };
}
export function readLocation(): Location {
  return parseLocation(new URL(window.location.href));
}
export function routeHref(location: Location, current: URL): string {
  if (current.protocol === "file:")
    return (
      "#" +
      location.page +
      (location.book ? "?book=" + encodeURIComponent(location.book) : "")
    );
  const url = new URL(location.page, current);
  if (location.book) url.searchParams.set("book", location.book);
  return url.href;
}
export function entryRoute(state: State): Route {
  if (state.demoAccountComplete) return "home";
  if (state.guestContinue && (state.active || state.finished)) return "reader";
  if (state.intro)
    return state.intro.status === "done" ? "trial-done" : "trial";
  return "trial";
}

export const protectedRoutes = new Set<Route>([
  "home",
  "search",
  "library",
  "book",
  "complete",
  "discover",
  "calendar",
  "goals",
  "preferences",
  "highlights",
  "settings",
  "setup",
]);

function guestEntry(state: State): Location {
  const page = entryRoute(state);
  return page === "reader"
    ? { page, book: state.active?.id || state.finished?.id }
    : { page };
}

/** Returning accounts skip introductory screens while keeping ordinary links. */
export function resolveLocation(state: State, location: Location): Location {
  if (location.page === "index") return guestEntry(state);
  if (!state.demoAccountComplete) {
    if (
      (location.page === "complete" || location.page === "discover") &&
      state.guestContinue &&
      state.finished?.completed &&
      (!location.book || location.book === state.finished.id)
    )
      return location;
    if (protectedRoutes.has(location.page)) return guestEntry(state);
    if (location.page === "reader" && !state.guestContinue) {
      if (state.intro?.status === "done") return { page: "trial-done" };
      if (
        !state.active ||
        state.active.mode !== "trial" ||
        (location.book && location.book !== state.active.id)
      )
        return { page: "trial" };
    }
    if (
      state.guestContinue &&
      (location.page === "trial" || location.page === "trial-done")
    )
      return guestEntry(state);
  }
  if (
    state.demoAccountComplete &&
    (accountRoutes.has(location.page) ||
      location.page === "trial" ||
      location.page === "trial-done")
  )
    return { page: "home" };
  return location;
}
