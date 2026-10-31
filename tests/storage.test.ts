import test from "node:test";
import assert from "node:assert/strict";
import {
  restore,
  persist,
  logoutToGuest,
  restoreAccount,
  ACCOUNT_STORAGE_KEY,
  type StoragePort,
} from "../src/domain/storage";
import {
  defaults,
  LEGACY_KEY,
  STORAGE_KEY,
  startSession,
  advance,
  resumeBook,
} from "../src/domain/reading";
import { resolveLocation } from "../src/app/routes";
import { DEMO_USER, authenticateDemo } from "../src/domain/auth";
function memory(initial: [string, string][] = []) {
  const data = new Map(initial);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
test("corrupt new storage is backed up and legacy data recovered before overwrite", () => {
  const old = JSON.stringify({ ...defaults(), saved: ["waiting"] });
  const storage = memory([
    [STORAGE_KEY, "{broken"],
    [LEGACY_KEY, old],
  ]);
  const result = restore(storage);
  assert.equal(result.canWrite, true);
  assert.deepEqual(result.state.saved, ["waiting"]);
  assert.ok(
    [...storage.data].some(
      ([key, value]) =>
        key.startsWith(STORAGE_KEY + ".recovery.") && value === "{broken",
    ),
  );
  assert.equal(storage.getItem(LEGACY_KEY), old);
});
test("a full storage area never permits corrupt data to be overwritten without backup", () => {
  const storage: StoragePort = {
    getItem: () => "{broken",
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(restore(storage).canWrite, false);
  assert.equal(persist(storage, defaults()), false);
});

test("restoring a signed-in account opens home with reading records intact", () => {
  const storage = memory();
  const state = {
    ...defaults(),
    demoAccountComplete: true,
    demoUserId: DEMO_USER.id,
    saved: ["waiting"],
  };
  assert.equal(persist(storage, state), true);
  const restored = restore(storage).state;
  assert.deepEqual(resolveLocation(restored, { page: "index" }), {
    page: "home",
  });
  assert.deepEqual(restored.saved, ["waiting"]);
  assert.equal(restored.setupCompleted, false);
});

test("logout starts a fresh first-page trial after reload while retaining member records separately", () => {
  const storage = memory();
  let member = authenticateDemo(
    { ...defaults(), saved: ["waiting"], guestContinue: true },
    DEMO_USER.id,
    DEMO_USER.password,
  )!;
  member = startSession(member, "waiting", { start: 0, mode: "trial" });
  member = advance(advance(member));
  assert.ok(member.finished);
  member = startSession(member, "spring-spring", { start: 5, mode: "book" });
  const original = JSON.stringify(member);
  const guest = logoutToGuest(storage, member)!;
  assert.deepEqual(guest, defaults());
  assert.equal(JSON.stringify(member), original);
  const reloaded = restore(storage).state;
  for (const page of ["index", "reader", "complete", "home"] as const) {
    assert.deepEqual(resolveLocation(reloaded, { page, book: "waiting" }), {
      page: "trial",
    });
  }
  assert.equal(reloaded.guestContinue, false);
  assert.equal(reloaded.finished, null);
  assert.equal(reloaded.intro, null);
  assert.deepEqual(reloaded.progress, {});
  assert.deepEqual(reloaded.readLog, []);
  const trial = startSession(reloaded, "waiting", { start: 0, mode: "trial" });
  assert.equal(trial.active?.cursor, 0);
  assert.equal(trial.active?.end, 2);
  assert.equal(persist(storage, trial), true);
  assert.equal(resumeBook(restore(storage).state, "waiting").active?.cursor, 0);
  const account = restoreAccount(storage)!;
  assert.equal(account.demoAccountComplete, true);
  assert.deepEqual(account.saved, member.saved);
  assert.deepEqual(account.readLog, member.readLog);
  assert.equal(account.active?.cursor, 5);
  assert.equal(account.finished?.id, "waiting");
  assert.ok(
    !storage.getItem(ACCOUNT_STORAGE_KEY)!.includes(DEMO_USER.password),
  );
});

test("logout keeps the member session if records cannot be saved", () => {
  const member = authenticateDemo(
    defaults(),
    DEMO_USER.id,
    DEMO_USER.password,
  )!;
  const storage: StoragePort = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(logoutToGuest(storage, member), null);
  assert.equal(member.demoAccountComplete, true);
});
