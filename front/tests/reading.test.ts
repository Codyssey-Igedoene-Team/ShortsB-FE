import test from "node:test";
import assert from "node:assert/strict";
import {
  availableBooks,
  byId,
  nextRelations,
  searchBooks,
} from "../src/domain/catalog";
import {
  addHighlight,
  advance,
  calendarRecords,
  defaults,
  dayKey,
  goalStats,
  migrate,
  readPages,
  retreat,
  continueGuestReading,
  resume,
  resumeBook,
  startSession,
  streak,
  uniqueBooks,
  validDay,
  setDailyGoal,
  dose,
  needsDailyGoal,
} from "../src/domain/reading";

const book = byId.get("spring-spring")!;
const day = dayKey();

test("daily goal selection preserves past goals and reading records without repeating preferences", () => {
  const firstDay = "2026-11-01",
    nextDay = "2026-11-02";
  const original = {
    ...setDailyGoal(defaults(), { unit: "pages", value: 10 }, firstDay),
    setupCompleted: true,
    profile: {
      life: "student",
      mood: "calm" as const,
      thought: "따뜻한 이야기",
    },
  };
  const read = advance(startSession(original, book.id, { start: 0 }), firstDay);
  // Automatically collected daily statistics must not count as an explicit selection.
  const automatic = {
    ...read,
    goalDays: { ...read.goalDays, [nextDay]: read.goal },
  };
  assert.equal(needsDailyGoal(automatic, nextDay), true);
  const selected = setDailyGoal(
    automatic,
    { unit: "pages", value: 5 },
    nextDay,
  );
  assert.equal(needsDailyGoal(selected, nextDay), false);
  assert.equal(selected.goalDays[firstDay].value, 10);
  assert.equal(selected.goalDays[nextDay].value, 5);
  assert.equal(selected.profile, original.profile);
  assert.equal(selected.readLog, read.readLog);
  const restored = migrate(JSON.parse(JSON.stringify(selected)));
  assert.equal(needsDailyGoal(restored, nextDay), false);
  assert.equal(needsDailyGoal(restored, "2026-11-03"), true);
  assert.deepEqual(restored.readLog, read.readLog);
});
function readFive() {
  let state = startSession(
    { ...defaults(), goal: { unit: "pages", value: 5 } },
    book.id,
    {
      start: 0,
      now: 1,
    },
  );
  for (let i = 0; i < 5; i++) state = advance(state, day);
  return state;
}
test("five completed pages resume at page six, including after a reload", () => {
  const state = migrate(JSON.parse(JSON.stringify(readFive())));
  assert.equal(state.active, null);
  assert.equal(readPages(state, book).size, 5);
  assert.equal(resume(state, book.id)?.cursor, 5);
  const next = resumeBook(state, book.id);
  assert.equal(next.active?.start, 5);
  assert.equal(next.active?.end, 10);
  assert.equal(book.parts[next.active!.cursor], book.parts[5]);
});
test("pause/reload preserves the exact unread page and scroll position", () => {
  let state = advance(startSession(defaults(), book.id, { start: 2 }), day);
  const current = { ...state.active!, scrollY: 419 };
  state = { ...state, active: null, progress: { [book.id]: current } };
  const restored = resumeBook(migrate(state), book.id);
  assert.equal(restored.active?.cursor, 3);
  assert.equal(restored.active?.scrollY, 419);
  assert.equal(restored.active?.token, current.token);
});

test("changing the daily goal resizes every paused book while preserving position and past goals", () => {
  let state = startSession(
    setDailyGoal(defaults(), { unit: "pages", value: 5 }),
    book.id,
    { start: 0 },
  );
  state = advance(advance(state, day), day);
  const session = { ...state.active!, scrollY: 419 };
  state = {
    ...state,
    active: null,
    progress: { [book.id]: session },
    goalDays: { ...state.goalDays, "2026-01-01": { unit: "pages", value: 3 } },
  };
  const changed = setDailyGoal(state, { unit: "pages", value: 10 });
  assert.equal(changed.progress[book.id].cursor, 2);
  assert.equal(changed.progress[book.id].end, 10);
  assert.equal(changed.progress[book.id].scrollY, 419);
  assert.equal(changed.progress[book.id].token, session.token);
  assert.equal(changed.active, null);
  assert.equal(changed.readLog, state.readLog);
  assert.equal(changed.goalDays["2026-01-01"].value, 3);
  assert.equal(goalStats(changed).value, 10);
  const restored = resumeBook(migrate(changed), book.id);
  assert.equal(restored.active?.end, 10);
  assert.equal(restored.progress[book.id].end, 10);
  const shortened = setDailyGoal(restored, { unit: "pages", value: 3 });
  assert.equal(shortened.active?.end, 3);
  assert.equal(advance(shortened, day).active, null);
});

test("reading different books shares the same remaining daily goal", () => {
  let state = setDailyGoal(defaults(), { unit: "pages", value: 5 });
  state = advance(
    advance(startSession(state, book.id, { start: 0 }), day),
    day,
  );
  const other = startSession(state, "selfish-giant", { start: 0 });
  assert.equal(other.active?.end, 3);
  assert.equal(dose(state, book, 12), 1);
  const changed = setDailyGoal(other, { unit: "pages", value: 10 });
  assert.equal(changed.active?.end, 7);
  assert.equal(changed.progress[book.id].end, 10);
});

test("goal completion allows more reading and lowering a goal never removes read pages", () => {
  const state = readFive();
  const changed = setDailyGoal(state, { unit: "pages", value: 3 });
  assert.equal(goalStats(changed).done, true);
  assert.equal(changed.history, state.history);
  assert.equal(changed.progress[book.id], state.progress[book.id]);
  assert.equal(readPages(changed, book).size, 5);
  assert.equal(resumeBook(changed, book.id).active?.end, 8);
});

test("a new day restores the daily allowance and ignores legacy manual doses", () => {
  let state = advance(
    startSession(
      setDailyGoal(defaults(), { unit: "pages", value: 5 }),
      book.id,
      { start: 0 },
    ),
    day,
  );
  state = {
    ...state,
    active: null,
    readLog: state.readLog.map((r) => ({ ...r, day: "2026-01-01" })),
  };
  const restored = migrate({ ...state, pageCount: 1, manualDose: true });
  assert.equal(dose(restored, book, 1), 5);
  assert.equal(resumeBook(restored, book.id).active?.end, 6);
});

test("changing goals never extends trials or unrestricted guest reading", () => {
  const state = advance(
    startSession(defaults(), book.id, { start: 0, mode: "trial" }),
    day,
  );
  const changed = setDailyGoal(state, { unit: "pages", value: 10 });
  assert.equal(changed.active?.end, 2);
  const guest = continueGuestReading(state);
  assert.equal(
    setDailyGoal(guest, { unit: "pages", value: 1 }).active?.end,
    book.totalPages,
  );
});

test("trial resume does not restart its two-page allowance", () => {
  const state = advance(
    startSession(defaults(), book.id, { start: 0, mode: "trial" }),
    day,
  );
  const restored = resumeBook(migrate(state), book.id);
  assert.equal(restored.active?.cursor, 1);
  assert.equal(restored.active?.end, 2);
  assert.equal(advance(restored, day).intro?.status, "done");
});
test("re-reading does not duplicate a shelf book or inflate daily page count", () => {
  const first = readFive();
  let again = startSession(first, book.id, { start: 0 });
  for (let i = 0; i < 5; i++) again = advance(again, day);
  assert.deepEqual(uniqueBooks(again), [book.id]);
  assert.equal(readPages(again, book).size, 5);
  assert.equal(goalStats(again, day).current, 5);
  assert.equal(advance(again, day), again);
});
test("finishing an excerpt is not a full-book completion", () => {
  const state = readFive();
  assert.notEqual(readPages(state, book).size, book.totalPages);
  let all = startSession(
    setDailyGoal(state, { unit: "pages", value: 10 }),
    book.id,
    { start: 5 },
  );
  while (all.active) all = advance(all, day);
  assert.equal(readPages(all, book).size, 10);
  all = resumeBook(all, book.id);
  while (all.active) all = advance(all, day);
  assert.equal(readPages(all, book).size, book.totalPages);
  assert.equal(resume(all, book.id), null);
});
test("new Korean editions archive foreign cursors without losing history or legacy attendance", () => {
  const b = byId.get("waiting")!,
    previous = Object.keys(b.legacyEditions)[0];
  const old = {
    ...startSession(defaults(), b.id, { start: 0 }).active!,
    edition: previous,
  };
  const migrated = migrate({
    ...defaults(),
    active: old,
    progress: { [b.id]: old },
    readLog: [{ id: b.id, edition: previous, index: 0, day }],
    completedDays: ["2026-10-20", day, "wrong"],
  });
  assert.equal(migrated.active, null);
  assert.equal(migrated.progress[b.id], undefined);
  assert.ok(migrated.editionArchive[`${b.id}:${previous}`]);
  assert.equal(migrated.readLog.length, 1);
  assert.equal(readPages(migrated, b).size, 0);
  assert.deepEqual(migrated.completedDays, ["2026-10-20", day]);
});
test("invalid persisted dates and counters cannot crash the record screen", () => {
  assert.equal(validDay("2026-99-99"), false);
  assert.equal(validDay("2026-02-30"), false);
  const restored = migrate({
    readLog: [null, { id: book.id, index: 0, day: "2026-99-99" }],
    readingSeconds: { [day]: -30 },
    completedDays: [4, null, "x"],
  });
  assert.equal(restored.readLog.length, 0);
  assert.equal(goalStats(restored, day).current, 0);
});
test("recommendations visit every new book before starting another round", () => {
  for (const initial of availableBooks) {
    let state = defaults(),
      from = initial.id;
    const seen = new Set<string>();
    while (seen.size < availableBooks.length) {
      assert.ok(!seen.has(from), `Repeated ${from}`);
      const trail = [...seen];
      seen.add(from);
      state = startSession(state, from, { trail });
      const relations = nextRelations(state, from);
      if (seen.size === availableBooks.length) {
        assert.ok(relations.length > 0);
        assert.ok(relations.every((relation) => relation.target !== from));
        break;
      }
      assert.ok(relations.every((r) => !seen.has(r.target)));
      if (!relations.length) break;
      from = relations[0].target;
      assert.ok(seen.size <= availableBooks.length);
    }
    assert.equal(seen.size, availableBooks.length);
  }
});
test("highlight offsets must point to exact text and cannot overlap", () => {
  const h = {
    id: "one",
    bookId: book.id,
    edition: book.edition,
    index: 0,
    start: 0,
    end: 12,
    text: book.parts[0].slice(0, 12),
  };
  const state = addHighlight(defaults(), h);
  assert.equal(state.highlights.length, 1);
  assert.equal(addHighlight(state, { ...h, id: "two" }), state);
  assert.equal(
    addHighlight(state, { ...h, id: "three", text: "made up" }),
    state,
  );
});
test("the calendar opens real records for new and existing users", () => {
  assert.equal(defaults().calendarDemo, false);
  assert.equal(calendarRecords(defaults(), day.slice(0, 7), day).length, 0);
  const existing = readFive();
  const restored = migrate({ ...existing, calendarDemo: true });
  assert.equal(restored.calendarDemo, false);
  assert.deepEqual(restored.readLog, existing.readLog);
  assert.equal(calendarRecords(restored, day.slice(0, 7), day).length, 5);
});

test("presentation calendar has fifteen October days and six consecutive days without changing real state", () => {
  const demoDay = "2026-10-31";
  const reading = readFive();
  const state = {
      ...reading,
      readLog: reading.readLog.map((r) => ({ ...r, day: demoDay })),
      calendarDemo: true,
    },
    original = JSON.stringify(state);
  const records = calendarRecords(state, "2026-10", demoDay);
  const days = [...new Set(records.map((r) => r.day))];
  assert.equal(days.length, 15);
  assert.equal(streak(days, demoDay), 6);
  assert.equal(JSON.stringify(state), original);
  assert.equal(calendarRecords(state, "2026-11", demoDay).length, 0);
  assert.equal(
    calendarRecords({ ...state, calendarDemo: false }, "2026-10", demoDay)
      .length,
    5,
  );
});
test("search results use Korean title order", () => {
  const names = searchBooks("").map((b) => b.book);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, "ko", { numeric: true })),
  );
});

test("old time goals become three-page goals and elapsed time cannot complete them", () => {
  let state = migrate({
    ...defaults(),
    goal: { unit: "minutes", value: 10 },
    goalDays: { [day]: { unit: "minutes", value: 5 } },
    readingSeconds: { [day]: 3600 },
  });
  assert.deepEqual(state.goal, { unit: "pages", value: 3 });
  assert.deepEqual(state.goalDays[day], { unit: "pages", value: 3 });
  assert.equal(goalStats(state, day).current, 0);
  assert.equal(goalStats(state, day).done, false);
  state = startSession(state, book.id, { start: 0 });
  state = advance(advance(advance(state, day), day), day);
  assert.equal(goalStats(state, day).current, 3);
  assert.equal(goalStats(state, day).done, true);
});

test("after a final-page excerpt, remaining unread opening pages are still reachable", () => {
  let state = startSession(defaults(), book.id, { start: book.totalPages - 1 });
  state = advance(state, day);
  assert.equal(resume(state, book.id)?.cursor, 0);
  assert.equal(readPages(state, book).size, 1);
});

test("previous page never records a page, removes completed pages or extends the trial", () => {
  let state = startSession(defaults(), book.id, { start: 0, mode: "trial" });
  assert.equal(retreat(state), state);
  assert.equal(readPages(state, book).size, 0);
  state = advance(state, day);
  assert.equal(state.active?.cursor, 1);
  assert.equal(readPages(state, book).size, 1);
  const log = state.readLog;
  state = retreat(state);
  assert.equal(state.active?.cursor, 0);
  assert.equal(state.readLog, log);
  assert.equal(state.active?.end, 2);
  state = advance(state, day);
  assert.equal(state.active?.cursor, 1);
  assert.equal(readPages(state, book).size, 1);
  assert.equal(state.readLog.length, 1);
  state = advance(state, day);
  assert.equal(state.active, null);
  assert.equal(state.intro?.status, "done");
  assert.equal(readPages(state, book).size, 2);
});

test("guest readers can review trial pages after continuing without losing their original range on reload", () => {
  let state = advance(
    advance(
      startSession(defaults(), book.id, { start: 0, mode: "trial" }),
      day,
    ),
    day,
  );
  state = continueGuestReading(state);
  assert.equal(state.active?.start, 2);
  state = retreat(retreat(state));
  assert.equal(state.active?.cursor, 0);
  assert.equal(readPages(state, book).size, 2);
  state = resumeBook(migrate(state), book.id);
  assert.equal(state.active?.cursor, 0);
  assert.equal(state.active?.start, 2);
  assert.equal(state.active?.end, book.totalPages);
  state = advance(advance(state, day), day);
  assert.equal(state.active?.cursor, 2);
  assert.equal(readPages(state, book).size, 2);
  state = advance(state, day);
  assert.equal(readPages(state, book).size, 3);
});

test("page completion counts stay unique across dates, reloads and a final-page confirmation", () => {
  let state = continueGuestReading(
    startSession(defaults(), book.id, { start: 0, mode: "trial" }),
  );
  for (let expected = 1; state.active; expected++) {
    state = advance(state, day);
    assert.equal(readPages(state, book).size, expected);
    if (state.active) {
      state = retreat(state);
      state = advance(state, "2026-11-01");
      assert.equal(readPages(migrate(state), book).size, expected);
    }
  }
  assert.equal(readPages(state, book).size, book.totalPages);
  assert.equal(advance(state, day), state);
});
