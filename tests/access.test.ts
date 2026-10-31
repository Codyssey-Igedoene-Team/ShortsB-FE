import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { App } from "../src/App";
import { DEMO_USER, authenticateDemo } from "../src/domain/auth";
import { availableBooks, byId, nextRelations } from "../src/domain/catalog";
import {
  advance,
  continueGuestReading,
  defaults,
  guestReadingTarget,
  migrate,
  startSession,
  retreat,
  changeReadingDose,
} from "../src/domain/reading";
import {
  entryRoute,
  parseLocation,
  protectedRoutes,
  resolveLocation,
  routeHref,
} from "../src/app/routes";

test("book details show the actual remaining dose and reflect a changed reading range", () => {
  let state = authenticateDemo(
    { ...defaults(), pageCount: 5 },
    DEMO_USER.id,
    DEMO_USER.password,
  )!;
  state = advance(advance(startSession(state, "spring-spring", { start: 0 })));
  const render = (initialState: typeof state) =>
    renderToString(
      createElement(App, {
        initialState,
        initialLocation: { page: "book", book: "spring-spring" },
      }),
    ).replace(/<!--.*?-->/g, "");
  const before = render(state);
  assert.ok(before.includes("이어 읽을 분량 3페이지 · 3–5쪽"));
  assert.ok(before.includes('<option value="3" selected="">'));
  const after = render(changeReadingDose(state, "spring-spring", 7));
  assert.ok(after.includes("이어 읽을 분량 7페이지 · 3–9쪽"));
  assert.ok(after.includes("3쪽부터 7페이지 이어 읽기"));
  assert.ok(after.includes('<option value="7" selected="">'));
});

test("only the fixed demo credentials can create a login", () => {
  const state = defaults();
  for (const [id, password] of [
    ["other@example.com", DEMO_USER.password],
    [DEMO_USER.id, "wrongpass"],
    [DEMO_USER.id, ""],
    ["", DEMO_USER.password],
    [DEMO_USER.id, DEMO_USER.password + " "],
  ])
    assert.equal(authenticateDemo(state, id, password), null);
  const signedIn = authenticateDemo(state, DEMO_USER.id, DEMO_USER.password)!;
  assert.equal(signedIn.demoAccountComplete, true);
  assert.equal(migrate(signedIn).demoAccountComplete, true);
  assert.equal(entryRoute(signedIn), "home");
  assert.equal(state.demoAccountComplete, false);
  assert.ok(!JSON.stringify(signedIn).includes(DEMO_USER.password));
});

test("previous unrestricted demo sessions expire without losing reading records", () => {
  const state = migrate({
    ...defaults(),
    demoAccountComplete: true,
    saved: ["waiting"],
  });
  assert.equal(state.demoAccountComplete, false);
  assert.equal(state.demoUserId, null);
  assert.deepEqual(state.saved, ["waiting"]);
});

test("guests cannot open member screens by path, hash or navigation", () => {
  const guest = defaults();
  const signedIn = authenticateDemo(guest, DEMO_USER.id, DEMO_USER.password)!;
  for (const page of protectedRoutes) {
    for (const address of [
      `http://127.0.0.1:5173/${page}.html`,
      `http://127.0.0.1:5173/#${page}`,
    ]) {
      assert.equal(
        resolveLocation(guest, parseLocation(new URL(address))).page,
        "trial",
      );
    }
    assert.equal(resolveLocation(guest, { page }).page, "trial");
    assert.equal(resolveLocation(signedIn, { page }).page, page);
  }
  for (const page of ["home", "search", "library"] as const) {
    const html = renderToString(
      createElement(App, { initialLocation: { page }, initialState: guest }),
    );
    assert.ok(!html.includes('aria-label="주요 메뉴"'));
    assert.ok(!html.includes('class="book-home"'));
    assert.ok(!html.includes('class="search-form"'));
    assert.ok(!html.includes('class="shelf-link"'));
  }
});

test("declining the invitation resumes at page three and survives reload without another prompt", () => {
  const book = availableBooks.find((b) => b.totalPages > 3)!;
  let state = startSession(defaults(), book.id, { start: 0, mode: "trial" });
  state = advance(advance(state));
  assert.equal(entryRoute(state), "trial-done");
  state = continueGuestReading(state);
  assert.equal(state.demoAccountComplete, false);
  assert.equal(state.active?.cursor, 2);
  assert.equal(state.active?.end, book.totalPages);
  state = migrate(JSON.parse(JSON.stringify(advance(state))));
  assert.equal(state.active?.cursor, 3);
  assert.equal(entryRoute(state), "reader");
  for (const page of ["home", "search", "library", "trial-done"] as const) {
    const location = resolveLocation(state, { page });
    assert.deepEqual(location, { page: "reader", book: book.id });
    assert.ok(
      routeHref(location, new URL("http://127.0.0.1:5173/")).includes(
        "reader?book=",
      ),
    );
  }
  while (state.active) state = advance(state);
  assert.equal(entryRoute(migrate(state)), "reader");
  const next = continueGuestReading(state);
  assert.notEqual(next.active?.id, book.id);
  assert.equal(next.active?.cursor, 0);
});

test("returning from an account page preserves the unread page and scroll", () => {
  const book = availableBooks[0];
  let state = advance(
    startSession(defaults(), book.id, { start: 0, mode: "trial" }),
  );
  const active = { ...state.active!, scrollY: 251 };
  state = {
    ...state,
    active,
    progress: { ...state.progress, [book.id]: active },
  };
  const continued = continueGuestReading(state);
  assert.equal(continued.active?.cursor, 1);
  assert.equal(continued.active?.scrollY, 251);
  assert.equal(continued.active?.mode, "book");
  assert.equal(continued.active?.end, book.totalPages);
});

test("guest completion distinguishes finished pages from a complete book and previews the actual next book", () => {
  const book = availableBooks.find((b) => b.totalPages > 3)!;
  let state = startSession({ ...defaults(), guestContinue: true }, book.id, {
    start: book.totalPages - 1,
  });
  state = advance(state);
  const render = (initialState: typeof state) =>
    renderToString(
      createElement(App, {
        initialLocation: { page: "reader", book: book.id },
        initialState,
      }),
    );
  assert.ok(!render(state).includes("한 권의 마지막 장까지"));
  assert.ok(render(state).includes("여기까지 읽었어요."));
  state = startSession(state, book.id, { start: 0 });
  while (state.active) state = advance(state);
  while (state.progress[book.id].end < book.totalPages) {
    state = continueGuestReading(state);
    while (state.active) state = advance(state);
  }
  const html = render(state);
  assert.ok(html.includes("한 권의 마지막 장까지"));
  assert.ok(html.includes(book.book));
  const target = guestReadingTarget(state);
  assert.ok(target);
  assert.ok(html.includes(target.book.book));
  assert.equal(continueGuestReading(state).active?.id, target.book.id);
  assert.equal(continueGuestReading(state).active?.cursor, target.start);
});

function finishGuestBook() {
  let state = continueGuestReading(
    startSession(defaults(), "waiting", { start: 0, mode: "trial" }),
  );
  while (state.active) state = advance(state);
  return migrate(state);
}

test("guest completion and the original discovery page remain accessible after a reload", () => {
  const state = finishGuestBook();
  const relation = nextRelations(state, "waiting")[0];
  assert.ok(relation);
  for (const page of ["complete", "discover"] as const) {
    const location = { page, book: "waiting" };
    assert.deepEqual(resolveLocation(state, location), location);
    const html = renderToString(
      createElement(App, { initialState: state, initialLocation: location }),
    );
    assert.ok(html.includes(relation.title));
    assert.ok(html.includes(relation.reason));
    assert.ok(!html.includes('aria-label="주요 메뉴"'));
  }
  for (const page of ["home", "search", "library"] as const)
    assert.equal(resolveLocation(state, { page }).page, "reader");
  assert.notEqual(
    resolveLocation(defaults(), { page: "discover", book: "waiting" }).page,
    "discover",
  );
  assert.notEqual(
    resolveLocation(state, { page: "discover", book: "lucky-day" }).page,
    "discover",
  );
});

test("guest and account completion show the same relationship recommendation", () => {
  const state = finishGuestBook();
  const signedIn = authenticateDemo(state, DEMO_USER.id, DEMO_USER.password)!;
  const relation = nextRelations(state, "waiting")[0];
  const target = guestReadingTarget(state);
  assert.ok(target);
  assert.equal(target.book.id, relation.target);
  assert.equal(target.start, byId.get(relation.target)!.guide.start);
  for (const initialState of [state, signedIn]) {
    const html = renderToString(
      createElement(App, {
        initialState,
        initialLocation: { page: "complete", book: "waiting" },
      }),
    );
    assert.ok(html.includes(relation.title));
    assert.ok(html.includes(relation.kind));
    assert.ok(html.includes("다른 관점의 대목 만나기"));
  }
  const continued = continueGuestReading(state);
  assert.equal(continued.active?.id, relation.target);
  assert.ok(continued.active?.recommendationTrail.includes("waiting"));
});

test("a completed book still recommends readable books after its curated links run out", () => {
  let state = startSession(
    { ...defaults(), pageCount: 10 },
    "emperor-clothes",
    {
      start: 0,
      trail: ["gift-of-magi", "spring-spring"],
    },
  );
  while (state.active) state = advance(state);
  state = authenticateDemo(state, DEMO_USER.id, DEMO_USER.password)!;
  const relation = nextRelations(state, "emperor-clothes")[0];
  assert.ok(relation);
  assert.ok(byId.get(relation.target)?.available);
  assert.ok(
    !["emperor-clothes", "gift-of-magi", "spring-spring"].includes(
      relation.target,
    ),
  );
  for (const page of ["complete", "discover"] as const) {
    const html = renderToString(
      createElement(App, {
        initialState: state,
        initialLocation: { page, book: "emperor-clothes" },
      }),
    );
    assert.ok(html.includes(relation.title));
    assert.ok(html.includes(relation.reason));
    assert.ok(!html.includes("새롭게 연결할 대목은 여기까지예요."));
  }
});

test("signed-in completion and discovery still recommend after every excerpt was read", () => {
  let state = finishGuestBook();
  state.progress.waiting.recommendationTrail = availableBooks.map(
    (book) => book.id,
  );
  state.readLog = availableBooks.flatMap((book) =>
    book.parts.map((_, index) => ({
      id: book.id,
      edition: book.edition,
      index,
      day: "2026-10-31",
    })),
  );
  state = authenticateDemo(migrate(state), DEMO_USER.id, DEMO_USER.password)!;
  const relation = nextRelations(state, "waiting")[0];
  assert.ok(relation);
  assert.notEqual(relation.target, "waiting");
  assert.equal(relation.kind, "다시 읽기 추천");
  for (const page of ["complete", "discover"] as const) {
    const html = renderToString(
      createElement(App, {
        initialState: state,
        initialLocation: { page, book: "waiting" },
      }),
    );
    assert.ok(html.includes(relation.title));
    assert.ok(html.includes("다시 읽기 추천"));
    assert.ok(!html.includes("새롭게 연결할 대목은 여기까지예요."));
  }
  const restarted = startSession(state, relation.target, {
    start: byId.get(relation.target)!.guide.start,
    trail: state.progress.waiting.recommendationTrail,
  });
  assert.ok(restarted.active);
  assert.equal(restarted.active.id, relation.target);
});

test("signed-in readers prefer an unread excerpt when their persisted trail is exhausted", () => {
  let state = finishGuestBook();
  state.progress.waiting.recommendationTrail = availableBooks.map(
    (book) => book.id,
  );
  const unread = "lucky-day";
  state.readLog.push(
    ...availableBooks
      .filter((book) => book.id !== unread)
      .map((book) => ({
        id: book.id,
        edition: book.edition,
        index: book.guide.start,
        day: "2026-10-31",
      })),
  );
  state = authenticateDemo(state, DEMO_USER.id, DEMO_USER.password)!;
  assert.equal(nextRelations(state, "waiting")[0].target, unread);
});

test("guests can continue to an unread book after their saved recommendation trail runs out", () => {
  const state = finishGuestBook();
  state.progress.waiting = {
    ...state.progress.waiting,
    recommendationTrail: availableBooks.map((b) => b.id),
  };
  const relation = nextRelations(state, "waiting")[0];
  assert.ok(relation);
  assert.notEqual(relation.target, "waiting");
  assert.equal(guestReadingTarget(state)?.book.id, relation.target);
  assert.equal(continueGuestReading(state).active?.id, relation.target);
  const html = renderToString(
    createElement(App, {
      initialState: state,
      initialLocation: { page: "complete", book: "waiting" },
    }),
  );
  assert.ok(html.includes(relation.title));
  assert.ok(!html.includes("새롭게 연결할 대목은 여기까지예요."));
});

test("guests who read all books can open and read a recommended book again without logging in", () => {
  let state = finishGuestBook();
  state.progress.waiting.recommendationTrail = availableBooks.map(
    (book) => book.id,
  );
  state.readLog = availableBooks.flatMap((book) =>
    book.parts.map((_, index) => ({
      id: book.id,
      edition: book.edition,
      index,
      day: "2026-10-31",
    })),
  );
  state = migrate(state);
  const relation = nextRelations(state, "waiting")[0];
  assert.equal(relation.kind, "다시 읽기 추천");
  assert.notEqual(relation.target, "waiting");
  for (const page of ["complete", "discover"] as const) {
    const html = renderToString(
      createElement(App, {
        initialState: state,
        initialLocation: { page, book: "waiting" },
      }),
    );
    assert.ok(html.includes(relation.title));
    assert.ok(html.includes("다시 읽기 추천"));
    assert.ok(!html.includes("새롭게 연결할 대목은 여기까지예요."));
  }
  const continued = continueGuestReading(state);
  assert.equal(continued.demoAccountComplete, false);
  assert.equal(continued.active?.id, relation.target);
  assert.equal(continued.active?.completed, false);
  assert.equal(
    resolveLocation(continued, { page: "reader", book: relation.target }).page,
    "reader",
  );
  const advanced = advance(continued);
  assert.equal(advanced.readLog.length, state.readLog.length);
});

test("reader page counters and position bar agree when moving forwards and backwards", () => {
  const book = availableBooks[0];
  const first = startSession(defaults(), book.id, { start: 0, mode: "trial" });
  const second = advance(first);
  const render = (initialState: typeof first) =>
    renderToString(
      createElement(App, {
        initialLocation: { page: "reader", book: book.id },
        initialState,
      }),
    ).replace(/<!--.*?-->/g, "");
  const firstHtml = render(first);
  assert.ok(firstHtml.includes(`현재 1 / ${book.totalPages}쪽`));
  assert.ok(firstHtml.includes(`<strong>1 / ${book.totalPages}쪽</strong>`));
  assert.ok(!firstHtml.includes("읽기 완료"));
  assert.ok(firstHtml.includes("이전 페이지"));
  assert.ok(firstHtml.includes('disabled=""'));
  assert.ok(render(second).includes(`현재 2 / ${book.totalPages}쪽`));
  assert.ok(
    render(second).includes(`<strong>2 / ${book.totalPages}쪽</strong>`),
  );
  assert.ok(
    render(second).includes(`<progress value="2" max="${book.totalPages}"`),
  );
  assert.ok(render(retreat(second)).includes(`현재 1 / ${book.totalPages}쪽`));
  assert.ok(
    render(retreat(second)).includes(
      `<strong>1 / ${book.totalPages}쪽</strong>`,
    ),
  );
});
