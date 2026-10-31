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
  changeReadingDose,
} from "../src/domain/reading";

const book = byId.get("spring-spring")!;
const day = "2026-10-31";
function readFive() {
  let state = startSession({ ...defaults(), pageCount: 5 }, book.id, {
    start: 0,
    now: 1,
  });
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

test("changing a paused dose extends or shortens the remaining pages without resetting position or records", () => {
  let state = startSession({ ...defaults(), pageCount: 5 }, book.id, {
    start: 0,
  });
  state = advance(advance(state, day), day);
  const session = { ...state.active!, scrollY: 419 };
  state = { ...state, active: null, progress: { [book.id]: session } };
  const extended = changeReadingDose(state, book.id, 7);
  assert.equal(extended.progress[book.id].cursor, 2);
  assert.equal(extended.progress[book.id].end, 9);
  assert.equal(extended.progress[book.id].scrollY, 419);
  assert.equal(extended.progress[book.id].token, session.token);
  assert.equal(extended.active, null);
  assert.equal(extended.readLog, state.readLog);
  const resumed = resumeBook(migrate(extended), book.id);
  assert.equal(resumed.active?.end, 9);
  assert.equal(resumed.active?.cursor, 2);
  const shortened = changeReadingDose(resumed, book.id, 1);
  assert.equal(shortened.active?.end, 3);
  assert.equal(shortened.active, shortened.progress[book.id]);
  const finished = advance(shortened, day);
  assert.equal(finished.active, null);
  assert.equal(finished.finished?.end, 3);
  assert.equal(readPages(finished, book).size, 3);
});

test("dose changes stop at the end of the book and keep other sessions and completed history intact", () => {
  const finished = readFive();
  const changed = changeReadingDose(finished, book.id, 2);
  assert.equal(changed.progress[book.id], finished.progress[book.id]);
  assert.equal(changed.history, finished.history);
  assert.equal(resumeBook(changed, book.id).active?.end, 7);
  const other = startSession(changed, "waiting", { start: 0 });
  const resized = changeReadingDose(other, book.id, 10);
  assert.equal(resized.active, other.active);
  let last = startSession(defaults(), book.id, { start: book.totalPages - 2 });
  last = changeReadingDose(last, book.id, 10);
  assert.equal(last.active?.end, book.totalPages);
  assert.equal(last.active!.end - last.active!.cursor, 2);
  const otherActive = startSession(last, "waiting", { start: 0 });
  const resizedPaused = changeReadingDose(otherActive, book.id, 1);
  assert.equal(resizedPaused.active, otherActive.active);
  assert.equal(resizedPaused.progress[book.id].end, book.totalPages - 1);
});

test("resizing after reviewing an earlier page keeps a valid completion range", () => {
  let state = startSession(defaults(), book.id, { start: 5 });
  state = retreat(retreat(state));
  state = changeReadingDose(state, book.id, 1);
  assert.equal(state.active?.cursor, 3);
  assert.equal(state.active?.start, 3);
  assert.equal(state.active?.end, 4);
  assert.equal(advance(state, day).finished?.end, 4);
});

test("resizing never extends the two-page trial", () => {
  const state = advance(
    startSession(defaults(), book.id, { start: 0, mode: "trial" }),
    day,
  );
  const resized = changeReadingDose(state, book.id, 10);
  assert.equal(resized.active?.end, 2);
  assert.equal(resized.progress[book.id], state.progress[book.id]);
  assert.equal(changeReadingDose(state, book.id, NaN), state);
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
  let all = startSession({ ...state, pageCount: 10 }, book.id, { start: 5 });
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
test("presentation calendar has fifteen October days and six consecutive days without changing real state", () => {
  const state = readFive(),
    original = JSON.stringify(state);
  const records = calendarRecords(state, "2026-10", day);
  const days = [...new Set(records.map((r) => r.day))];
  assert.equal(days.length, 15);
  assert.equal(streak(days, day), 6);
  assert.equal(JSON.stringify(state), original);
  assert.equal(calendarRecords(state, "2026-11", day).length, 0);
  assert.equal(
    calendarRecords({ ...state, calendarDemo: false }, "2026-10", day).length,
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
