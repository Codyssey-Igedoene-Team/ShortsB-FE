import test from "node:test";
import assert from "node:assert/strict";
import {
  accountRoutes,
  entryRoute,
  parseLocation,
  resolveLocation,
  routeHref,
} from "../src/app/routes";
import {
  advance,
  defaults,
  startSession,
  setDailyGoal,
  dayKey,
} from "../src/domain/reading";
import { availableBooks } from "../src/domain/catalog";

test("book parameters survive navigation in a subfolder and direct refresh", () => {
  const loc = { page: "reader" as const, book: "spring-spring" };
  const href = routeHref(loc, new URL("https://example.test/shortB/home.html"));
  assert.equal(href, "https://example.test/shortB/reader?book=spring-spring");
  assert.deepEqual(parseLocation(new URL(href)), loc);
});
test("skip links keep the current page; unknown and inherited names cannot become routes", () => {
  assert.deepEqual(
    parseLocation(
      new URL("https://example.test/book.html?book=waiting#main-content"),
    ),
    { page: "book", book: "waiting" },
  );
  for (const name of ["constructor", "toString", "missing"])
    assert.equal(
      parseLocation(new URL("https://example.test/" + name + ".html")).page,
      "index",
    );
});

test("extensionless completion URLs preserve the book on direct refresh and repeated navigation", () => {
  const location = { page: "complete" as const, book: "waiting" };
  const address = "http://127.0.0.1:5173/complete?book=waiting";
  assert.deepEqual(parseLocation(new URL(address)), location);
  assert.equal(
    routeHref(location, new URL("http://127.0.0.1:5173/reader?book=waiting")),
    address,
  );
  assert.equal(routeHref(location, new URL(address)), address);
  assert.equal(
    routeHref(
      location,
      new URL("http://127.0.0.1:5173/complete.html?book=waiting"),
    ),
    address,
  );
  assert.deepEqual(
    parseLocation(new URL("http://127.0.0.1:5173/complete.html?book=waiting")),
    location,
  );
});
test("legacy hash links and local HTML navigation retain book selection", () => {
  assert.deepEqual(
    parseLocation(new URL("https://example.test/index.html#book?book=waiting")),
    { page: "book", book: "waiting" },
  );
  const file = new URL("file:///example/index.html");
  assert.deepEqual(
    parseLocation(
      new URL(routeHref({ page: "reader", book: "waiting" }, file), file),
    ),
    { page: "reader", book: "waiting" },
  );
});
test("first-reading completion survives reload without skipping the account step", () => {
  const state = {
    ...defaults(),
    intro: { bookId: "waiting", status: "done" as const },
    saved: ["waiting"],
  };
  assert.equal(entryRoute(state), "trial-done");
  assert.equal(entryRoute({ ...state, demoAccountComplete: true }), "setup");
  assert.equal(entryRoute({ ...state, setupCompleted: true }), "trial-done");
});

test("obsolete email authentication links open OAuth login", () => {
  for (const name of [
    "email",
    "code",
    "signup-password",
    "recover",
    "recover-sent",
  ]) {
    assert.equal(
      parseLocation(new URL(`http://localhost:5173/${name}`)).page,
      "login",
    );
    assert.equal(
      parseLocation(new URL(`http://localhost:5173/#${name}`)).page,
      "login",
    );
  }
});

test("a first login opens setup and a returning account opens home", () => {
  const state = { ...defaults(), demoAccountComplete: true };
  assert.equal(state.setupCompleted, false);
  assert.equal(state.profile, null);
  for (const page of [
    "index",
    "trial",
    "trial-done",
    ...accountRoutes,
  ] as const)
    assert.deepEqual(resolveLocation(state, { page }), { page: "setup" });
  assert.equal(
    routeHref(
      resolveLocation(state, { page: "index" }),
      new URL("http://127.0.0.1:5173/"),
    ),
    "http://127.0.0.1:5173/setup",
  );
  const returning = {
    ...setDailyGoal(state, { unit: "pages", value: 5 }),
    setupCompleted: true,
  };
  assert.equal(entryRoute(returning), "home");
});

test("signed-in readers keep book links and can still configure their preferences", () => {
  const state = { ...defaults(), demoAccountComplete: true };
  for (const page of [
    "home",
    "reader",
    "book",
    "setup",
    "preferences",
    "search",
    "library",
  ] as const) {
    const location = { page, book: availableBooks[0].id };
    assert.deepEqual(resolveLocation(state, location), location);
  }
});

test("guests still read two pages before seeing the account invitation", () => {
  let state = defaults();
  assert.deepEqual(resolveLocation(state, { page: "index" }), {
    page: "trial",
  });
  state = startSession(state, availableBooks[0].id, {
    mode: "trial",
    start: 0,
  });
  assert.equal(state.active?.end, 2);
  assert.equal(entryRoute(state), "trial");
  state = advance(state);
  assert.equal(state.active?.cursor, 1);
  assert.equal(entryRoute(state), "trial");
  state = advance(state);
  assert.equal(state.active, null);
  assert.equal(entryRoute(state), "trial-done");
  for (const page of ["trial-done", ...accountRoutes] as const)
    assert.deepEqual(resolveLocation(state, { page }), { page });
});

test("preferences and saved books do not count as a login", () => {
  const state = {
    ...defaults(),
    setupCompleted: true,
    profile: { life: "skip", mood: "any" as const, thought: "" },
    saved: ["waiting"],
  };
  assert.equal(entryRoute(state), "trial");
  assert.equal(entryRoute({ ...state, demoAccountComplete: true }), "goals");
  assert.equal(entryRoute({ ...state, demoAccountComplete: false }), "trial");
});

test("returning users select only a daily goal once per Seoul date", () => {
  const firstDay = "2026-11-01",
    nextDay = "2026-11-02";
  const state = {
    ...setDailyGoal(defaults(), { unit: "pages", value: 10 }, firstDay),
    demoAccountComplete: true,
    setupCompleted: true,
  };
  assert.equal(entryRoute(state, firstDay), "home");
  assert.equal(entryRoute(state, nextDay), "goals");
  for (const page of [
    "index",
    "home",
    "reader",
    "login",
    "signup",
    "book",
    "calendar",
  ] as const)
    assert.deepEqual(resolveLocation(state, { page }, nextDay), {
      page: "goals",
    });
  assert.deepEqual(resolveLocation(state, { page: "goals" }, nextDay), {
    page: "goals",
  });
  const selected = setDailyGoal(state, { unit: "pages", value: 5 }, nextDay);
  assert.equal(entryRoute(selected, nextDay), "home");
  assert.deepEqual(
    resolveLocation(selected, { page: "reader", book: "waiting" }, nextDay),
    { page: "reader", book: "waiting" },
  );
  assert.equal(dayKey(new Date("2026-11-01T14:59:59Z")), firstDay);
  assert.equal(dayKey(new Date("2026-11-01T15:00:00Z")), nextDay);
});
