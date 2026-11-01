import { availableBooks, byId, nextRelations } from "./catalog";
import type { Book, Goal, Highlight, Session, State } from "./types";
export const STORAGE_KEY = "shortb-react-v1";
export const LEGACY_KEY = "ilsaeng-iljang-design-v1";
export function dayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
export function validDay(day: string) {
  const date = new Date(day + "T12:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === day
  );
}
export function validGoal(
  g?: { unit?: unknown; value?: unknown } | null,
): Goal {
  return {
    unit: "pages",
    value:
      g?.unit !== "minutes" && [1, 3, 5, 10].includes(Number(g?.value))
        ? Number(g?.value)
        : 3,
  };
}
export function defaults(): State {
  return {
    version: 4,
    profile: null,
    goal: { unit: "pages", value: 3 },
    goalSelectedDay: null,
    goalDays: {},
    readingSeconds: {},
    saved: [],
    completedDays: [],
    readLog: [],
    history: [],
    progress: {},
    active: null,
    finished: null,
    highlights: [],
    feedback: {},
    intro: null,
    setupCompleted: false,
    demoAccountComplete: false,
    demoUserId: null,
    guestContinue: false,
    fontLarge: false,
    calendarDemo: false,
    editionArchive: {},
    catalogEditions: {},
  };
}
export function migrate(raw: unknown): State {
  const s = defaults();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return s;
  const r = raw as Partial<State>;
  const object = <T>(x: unknown, fallback: T): T =>
    x && typeof x === "object" && !Array.isArray(x) ? (x as T) : fallback;
  s.profile =
    r.profile && typeof r.profile.thought === "string"
      ? {
          life: r.profile.life || "skip",
          thought: r.profile.thought.slice(0, 100),
          mood: ["calm", "light", "deep"].includes(r.profile.mood)
            ? r.profile.mood
            : "any",
        }
      : null;
  s.goal = validGoal(r.goal);
  s.goalSelectedDay =
    typeof r.goalSelectedDay === "string" && validDay(r.goalSelectedDay)
      ? r.goalSelectedDay
      : null;
  s.goalDays = Object.fromEntries(
    Object.entries(object<Record<string, Goal>>(r.goalDays, {}))
      .filter(([d]) => validDay(d))
      .map(([d, g]) => [d, validGoal(g)]),
  );
  s.readingSeconds = Object.fromEntries(
    Object.entries(object<Record<string, number>>(r.readingSeconds, {}))
      .filter(([d, v]) => validDay(d) && Number.isFinite(v) && v >= 0)
      .map(([d, v]) => [d, Math.min(86400, v)]),
  );
  s.feedback = object(r.feedback, {});
  s.editionArchive = { ...object(r.editionArchive, {}) };
  s.catalogEditions = { ...object(r.catalogEditions, {}) };
  s.saved = [
    ...new Set(
      (Array.isArray(r.saved) ? r.saved : []).filter((id) => byId.has(id)),
    ),
  ];
  const seen = new Set<string>();
  s.readLog = (Array.isArray(r.readLog) ? r.readLog : []).flatMap((x) => {
    if (
      !x ||
      !byId.has(x.id) ||
      typeof x.day !== "string" ||
      !validDay(x.day) ||
      !Number.isInteger(x.index) ||
      x.index < 0
    )
      return [];
    const b = byId.get(x.id)!,
      edition = x.edition || s.catalogEditions[b.id] || b.defaultLegacyEdition;
    const length =
      edition === b.edition ? b.totalPages : b.legacyEditions[edition];
    // Preserve unavailable source-edition history, but never apply its cursor to Korean text.
    const maximum = length || b.legacyEditions[edition] || 0;
    if (x.index >= maximum) return [];
    const key = [x.day, x.id, edition, x.index].join(":");
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: x.id, day: x.day, edition, index: x.index }];
  });
  s.completedDays = [
    ...new Set(
      [
        ...(Array.isArray(r.completedDays) ? r.completedDays : []),
        ...s.readLog.map((x) => x.day),
      ].filter((d) => typeof d === "string" && validDay(d)),
    ),
  ];
  s.history = (Array.isArray(r.history) ? r.history : [])
    .filter((x) => x && byId.has(x.id))
    .map((x) => ({
      ...x,
      edition:
        x.edition ||
        s.catalogEditions[x.id] ||
        byId.get(x.id)!.defaultLegacyEdition,
      recommendationTrail: Array.isArray(x.recommendationTrail)
        ? x.recommendationTrail
        : [],
    }));
  const progress = object<Record<string, Session>>(r.progress, {});
  for (const [id, p] of Object.entries(progress)) {
    const b = byId.get(id);
    if (!b || !p) continue;
    const edition =
      p.edition || s.catalogEditions[id] || b.defaultLegacyEdition;
    if (!b.available || edition !== b.edition) {
      s.editionArchive[id + ":" + edition] = p;
      continue;
    }
    if (Number.isInteger(p.cursor) && p.cursor >= 0 && p.cursor < b.totalPages)
      s.progress[id] = {
        ...p,
        id,
        edition,
        start: Math.max(
          0,
          Math.min(b.totalPages - 1, Number.isInteger(p.start) ? p.start : 0),
        ),
        updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : 0,
        token:
          typeof p.token === "string"
            ? p.token
            : `legacy-${id}-${edition}-${p.cursor}`,
        mode: ["book", "trial", "excerpt"].includes(p.mode) ? p.mode : "book",
        end: Math.min(b.totalPages, Math.max(p.cursor + 1, p.end || 1)),
        recommendationTrail: Array.isArray(p.recommendationTrail)
          ? p.recommendationTrail
          : [],
        scrollY: Math.max(0, Number(p.scrollY) || 0),
      };
  }
  if (r.active?.id && s.progress[r.active.id])
    s.active = { ...s.progress[r.active.id] };
  if (r.finished?.id && byId.get(r.finished.id)?.edition === r.finished.edition)
    s.finished = r.finished;
  s.highlights = (Array.isArray(r.highlights) ? r.highlights : []).filter(
    (h) =>
      h &&
      byId.has(h.bookId) &&
      typeof h.text === "string" &&
      Number.isInteger(h.start) &&
      Number.isInteger(h.end) &&
      h.end > h.start,
  );
  s.intro = r.intro && byId.get(r.intro.bookId)?.available ? r.intro : null;
  s.setupCompleted =
    typeof r.setupCompleted === "boolean" ? r.setupCompleted : !!s.profile;
  // Authentication is verified with /api/me; persisted data only identifies its owner.
  s.demoAccountComplete = false;
  s.demoUserId =
    typeof r.demoUserId === "string" && r.demoUserId !== "demo@shortb.com"
      ? r.demoUserId
      : null;
  s.guestContinue = r.guestContinue === true;
  s.fontLarge = !!r.fontLarge;
  // Open real records by default, including browsers that previously showed examples.
  s.calendarDemo = false;
  for (const b of availableBooks) s.catalogEditions[b.id] = b.edition;
  return s;
}
export const readPages = (s: State, b: Book) =>
  new Set(
    s.readLog
      .filter(
        (x) =>
          x.id === b.id &&
          x.edition === b.edition &&
          Number.isInteger(x.index) &&
          x.index >= 0 &&
          x.index < b.totalPages,
      )
      .map((x) => x.index),
  );
export const estimated = (text: string) =>
  Math.max(
    1,
    Math.ceil(
      (text.match(/[가-힣一-龯ぁ-んァ-ン]/g)?.length || 0) / 400 +
        (text.match(/[A-Za-z]+/g)?.length || 0) / 200,
    ),
  );
export function dose(s: State, b: Book, start: number) {
  const g = goalStats(s);
  return Math.min(g.done ? g.value : g.value - g.current, b.totalPages - start);
}
/** Refresh a member's allowance without moving their saved reading position. */
function plannedSession(s: State, book: Book, session: Session): Session {
  if (
    (session.mode === "trial" && !s.demoAccountComplete) ||
    (!s.demoAccountComplete && s.guestContinue)
  )
    return session;
  return {
    ...session,
    mode: session.mode === "trial" ? "book" : session.mode,
    end: session.cursor + dose(s, book, session.cursor),
  };
}
export function setDailyGoal(s: State, goal: Goal, day = dayKey()): State {
  const next = {
    ...s,
    goal: validGoal(goal),
    goalSelectedDay: day,
    goalDays: { ...s.goalDays, [day]: validGoal(goal) },
  };
  return syncReadingPlan(next);
}
export function needsDailyGoal(s: State, day = dayKey()) {
  return s.goalSelectedDay !== day;
}
/** Apply the daily goal after login as well as after a goal change. */
export function syncReadingPlan(s: State): State {
  const progress = { ...s.progress };
  for (const [id, session] of Object.entries(progress)) {
    const book = byId.get(id);
    if (
      book?.available &&
      book.edition === session.edition &&
      !session.completed
    )
      progress[id] = plannedSession(s, book, session);
  }
  return {
    ...s,
    progress,
    active: s.active ? progress[s.active.id] || s.active : null,
  };
}
export function resume(s: State, id: string): Session | null {
  const b = byId.get(id),
    a = s.progress[id];
  if (!b?.available || !a || a.edition !== b.edition) return null;
  if (!a.completed) return plannedSession(s, b, a);
  const read = readPages(s, b);
  if (read.size === b.totalPages) return null;
  const cursor = b.parts.findIndex((_, i) => i >= a.end && !read.has(i));
  const offset =
    cursor >= 0 ? cursor : b.parts.findIndex((_, i) => !read.has(i));
  return {
    ...a,
    mode: a.mode === "trial" && s.demoAccountComplete ? "book" : a.mode,
    start: offset,
    cursor: offset,
    end: Math.min(b.totalPages, offset + dose(s, b, offset)),
    completed: false,
    scrollY: 0,
  };
}
export const pending = (s: State) =>
  Object.keys(s.progress)
    .map((id) => resume(s, id))
    .filter((s): s is Session => !!s)
    .sort((a, b) => b.updatedAt - a.updatedAt);
export function startSession(
  s: State,
  id: string,
  options: {
    start?: number;
    mode?: Session["mode"];
    trail?: string[];
    now?: number;
  } = {},
): State {
  const b = byId.get(id);
  if (!b?.available) return s;
  const mode = options.mode || "excerpt",
    offset = Math.max(
      0,
      Math.min(b.totalPages - 1, options.start ?? b.guide.start),
    ),
    now = options.now ?? Date.now();
  const a: Session = {
    id,
    edition: b.edition,
    start: offset,
    cursor: offset,
    end: Math.min(
      b.totalPages,
      offset + (mode === "trial" ? 2 : dose(s, b, offset)),
    ),
    mode,
    completed: false,
    scrollY: 0,
    updatedAt: now,
    token: `${id}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    recommendationTrail: [...new Set([...(options.trail || []), id])],
  };
  return {
    ...s,
    active: a,
    progress: { ...s.progress, [id]: a },
    ...(mode === "trial"
      ? { intro: { bookId: id, status: "reading" as const } }
      : {}),
  };
}
export function resumeBook(s: State, id: string): State {
  const a = resume(s, id);
  if (!a) return s;
  if (s.progress[id].completed)
    return startSession(s, id, {
      start: a.cursor,
      mode: "book",
      trail: a.recommendationTrail,
    });
  return { ...s, active: { ...a }, progress: { ...s.progress, [id]: a } };
}

/** Shared by the next-book preview and its reading action. */
export function guestReadingTarget(
  s: State,
): { book: Book; start: number } | null {
  const previous = s.finished || (s.intro && s.progress[s.intro.bookId]);
  const current = previous && byId.get(previous.id);
  if (current?.available && previous!.end < current.totalPages)
    return { book: current, start: previous!.end };
  if (!current) return { book: availableBooks[0], start: 0 };
  const relation = nextRelations(s, current.id)[0];
  if (!relation) return null;
  const book = byId.get(relation.target)!;
  return { book, start: book.guide.start };
}

/** Continue after the invitation without a repeated prompt or daily dose limit. */
export function continueGuestReading(s: State): State {
  if (s.active && !s.active.completed) {
    const book = byId.get(s.active.id);
    if (book?.available) {
      const active = {
        ...s.active,
        mode: "book" as const,
        end: book.totalPages,
      };
      return {
        ...s,
        guestContinue: true,
        active,
        progress: { ...s.progress, [active.id]: active },
      };
    }
  }
  const target = guestReadingTarget(s);
  if (!target) return s;
  const { book, start } = target;
  const previous = s.finished || (s.intro && s.progress[s.intro.bookId]);
  const next = startSession({ ...s, guestContinue: true }, book.id, {
    start,
    mode: "book",
    trail: previous?.recommendationTrail,
  });
  const active = { ...next.active!, end: book.totalPages };
  return { ...next, active, progress: { ...next.progress, [book.id]: active } };
}
/** Reviewing an earlier page changes position only, never the reading allowance or log. */
export function retreat(s: State): State {
  const a = s.active;
  const book = a && byId.get(a.id);
  if (
    !a ||
    !book?.available ||
    a.edition !== book.edition ||
    a.completed ||
    a.cursor <= 0
  )
    return s;
  const active = {
    ...a,
    cursor: a.cursor - 1,
    scrollY: 0,
    updatedAt: Date.now(),
  };
  return { ...s, active, progress: { ...s.progress, [a.id]: active } };
}

export function advance(s: State, day = dayKey()): State {
  const a = s.active,
    b = a && byId.get(a.id);
  if (!a || !b?.available || a.edition !== b.edition) return s;
  const record = { id: a.id, edition: a.edition, index: a.cursor, day };
  const readLog = s.readLog.some(
    (x) =>
      x.id === record.id &&
      x.edition === record.edition &&
      x.index === record.index &&
      x.day === day,
  )
    ? s.readLog
    : [...s.readLog, record];
  const goalDays = { ...s.goalDays, [day]: s.goalDays[day] || s.goal },
    completedDays = [...new Set([...s.completedDays, day])];
  if (a.cursor + 1 < a.end) {
    const next = {
      ...a,
      cursor: a.cursor + 1,
      scrollY: 0,
      updatedAt: Date.now(),
    };
    return {
      ...s,
      readLog,
      goalDays,
      completedDays,
      active: next,
      progress: { ...s.progress, [a.id]: next },
    };
  }
  const done = { ...a, completed: true, scrollY: 0, updatedAt: Date.now() };
  const history = s.history.some((h) => h.token === a.token)
    ? s.history
    : [...s.history, { ...done, day }];
  return {
    ...s,
    readLog,
    goalDays,
    completedDays,
    history,
    active: null,
    finished: done,
    progress: { ...s.progress, [a.id]: done },
    intro: a.mode === "trial" ? { bookId: a.id, status: "done" } : s.intro,
  };
}
export function uniqueBooks(s: State) {
  return [
    ...new Set([...s.history.map((h) => h.id), ...s.readLog.map((r) => r.id)]),
  ].filter((id) => byId.has(id));
}
export function goalStats(s: State, day = dayKey()) {
  const g = validGoal(s.goalDays[day] || s.goal),
    value = new Set(
      s.readLog
        .filter((r) => r.day === day)
        .map((r) => `${r.id}:${r.edition}:${r.index}`),
    ).size;
  return {
    ...g,
    current: value,
    ratio: Math.min(1, value / g.value),
    done: value >= g.value,
  };
}
export function addHighlight(s: State, h: Highlight): State {
  const b = byId.get(h.bookId);
  if (
    !b ||
    h.edition !== b.edition ||
    h.start < 0 ||
    h.end <= h.start ||
    b.parts[h.index]?.slice(h.start, h.end) !== h.text
  )
    return s;
  if (
    s.highlights.some(
      (x) =>
        x.bookId === h.bookId &&
        x.edition === h.edition &&
        x.index === h.index &&
        x.start < h.end &&
        x.end > h.start,
    )
  )
    return s;
  return { ...s, highlights: [...s.highlights, h] };
}
export function calendarRecords(s: State, month: string, today = dayKey()) {
  if (!s.calendarDemo) return s.readLog.filter((x) => x.day.startsWith(month));
  const [year, m] = month.split("-").map(Number),
    days = new Date(Date.UTC(year, m, 0)).getUTCDate(),
    last = month === today.slice(0, 7) ? Number(today.slice(-2)) : days;
  if (month > today.slice(0, 7)) return [];
  const count = Math.min(15, last),
    selected = new Set<number>();
  for (let d = Math.max(1, last - 5); d <= last; d++) selected.add(d);
  const prior = Math.max(0, count - selected.size),
    priorLast = Math.max(0, last - 7);
  for (let i = 0; i < prior; i++)
    selected.add(
      Math.max(
        1,
        Math.round(1 + (i * (priorLast - 1)) / Math.max(1, prior - 1)),
      ),
    );
  const result = [];
  for (const d of selected) {
    const b = availableBooks[d % availableBooks.length];
    for (let i = 0; i < Math.min(2 + (d % 4), b.parts.length); i++)
      result.push({
        id: b.id,
        edition: b.edition,
        index: i,
        day: `${month}-${String(d).padStart(2, "0")}`,
      });
  }
  return result;
}
export function streak(days: string[], today = dayKey()) {
  const set = new Set(days);
  let date = new Date(today + "T12:00:00Z"),
    count = 0;
  if (!set.has(today)) date.setUTCDate(date.getUTCDate() - 1);
  while (set.has(date.toISOString().slice(0, 10))) {
    count++;
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return count;
}
