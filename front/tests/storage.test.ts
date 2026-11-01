import test from "node:test";
import assert from "node:assert/strict";
import {
  restore,
  persist,
  logoutToGuest,
  restoreAccount,
  bindServerAccount,
  ACCOUNT_STORAGE_KEY,
  TEST_BACKUP_KEY,
  beginOnboardingTest,
  endOnboardingTest,
  type StoragePort,
} from "../src/domain/storage";
import {
  defaults,
  LEGACY_KEY,
  STORAGE_KEY,
  startSession,
  advance,
  resumeBook,
  setDailyGoal,
} from "../src/domain/reading";
import { resolveLocation } from "../src/app/routes";
import { DEMO_USER, authenticateDemo } from "./auth-fixture";
function memory(initial: [string, string][] = []) {
  const data = new Map(initial);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
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

test("only a verified server identity restores an authenticated account", () => {
  const storage = memory();
  const state = {
    ...defaults(),
    demoAccountComplete: true,
    demoUserId: DEMO_USER.id,
    saved: ["waiting"],
  };
  assert.equal(persist(storage, state), true);
  const restored = restore(storage).state;
  assert.equal(restored.demoAccountComplete, false);
  const verified = bindServerAccount(storage, restored, DEMO_USER.id);
  assert.deepEqual(resolveLocation(verified, { page: "index" }), {
    page: "setup",
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
  const account = restoreAccount(storage, DEMO_USER.id)!;
  assert.equal(account.demoAccountComplete, false);
  assert.deepEqual(account.saved, member.saved);
  assert.deepEqual(account.readLog, member.readLog);
  assert.equal(account.active?.cursor, 5);
  assert.equal(account.finished?.id, "waiting");
  assert.ok(
    !storage
      .getItem(`${ACCOUNT_STORAGE_KEY}.${encodeURIComponent(DEMO_USER.id)}`)!
      .includes(DEMO_USER.password),
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

test("first-login testing starts with zero pages and preserves the original through repeats and reloads", () => {
  const storage = memory();
  const original = {
    ...advance(
      startSession(
        authenticateDemo(defaults(), DEMO_USER.id, DEMO_USER.password)!,
        "waiting",
        { start: 0 },
      ),
    ),
    setupCompleted: true,
    saved: ["waiting"],
  };
  const fresh = beginOnboardingTest(storage, original)!;
  assert.equal(fresh.demoAccountComplete, false);
  assert.equal(fresh.setupCompleted, false);
  assert.equal(fresh.readLog.length, 0);
  assert.equal(fresh.calendarDemo, false);
  assert.equal(storage.getItem(TEST_BACKUP_KEY), JSON.stringify(original));
  assert.equal(restore(storage).state.readLog.length, 0);
  beginOnboardingTest(storage, fresh);
  assert.equal(storage.getItem(TEST_BACKUP_KEY), JSON.stringify(original));
  const restored = endOnboardingTest(storage, DEMO_USER.id)!;
  assert.deepEqual(restored.readLog, original.readLog);
  assert.deepEqual(restored.saved, original.saved);
  assert.equal(restored.active?.cursor, original.active?.cursor);
  assert.equal(restored.setupCompleted, true);
  assert.equal(storage.getItem(TEST_BACKUP_KEY), null);
});

test("a failed test backup leaves existing data intact", () => {
  const storage = memory([[STORAGE_KEY, JSON.stringify(defaults())]]);
  const before = storage.getItem(STORAGE_KEY);
  const blocked = {
    ...storage,
    setItem: () => {
      throw new Error("full");
    },
  };
  assert.equal(beginOnboardingTest(blocked, defaults()), null);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test("different server users cannot inherit one another's local reading state", () => {
  const storage = memory();
  const first = {
    ...defaults(),
    demoUserId: "user-1",
    demoAccountComplete: true,
    setupCompleted: true,
    saved: ["waiting"],
  };
  assert.equal(persist(storage, first), true);
  const second = bindServerAccount(storage, first, "user-2");
  assert.deepEqual(second.saved, []);
  assert.equal(second.setupCompleted, false);
  assert.equal(second.demoUserId, "user-2");
  const back = bindServerAccount(storage, second, "user-1");
  assert.deepEqual(back.saved, ["waiting"]);
  assert.equal(back.setupCompleted, true);
  assert.equal(restore(storage).state.demoAccountComplete, false);
});

test("test backups can only be restored for the verified original account", () => {
  const storage = memory();
  const original = {
    ...defaults(),
    demoUserId: "user-1",
    demoAccountComplete: true,
  };
  beginOnboardingTest(storage, original);
  assert.equal(endOnboardingTest(storage, "user-2"), null);
  assert.ok(storage.getItem(TEST_BACKUP_KEY));
  assert.ok(endOnboardingTest(storage, "user-1"));
});

test("login removes the trial cap and goal ten stops at this eight-page book's last page", () => {
  const storage = memory();
  const trial = startSession(defaults(), "emperor-clothes", {
    start: 0,
    mode: "trial",
  });
  assert.equal(trial.active?.end, 2);
  const member = bindServerAccount(storage, trial, "local-test-user");
  const changed = setDailyGoal(member, { unit: "pages", value: 10 });
  assert.equal(changed.active?.mode, "book");
  assert.equal(changed.active?.cursor, 0);
  assert.equal(changed.active?.end, 8);
  assert.deepEqual(changed.readLog, trial.readLog);
  assert.equal(persist(storage, changed), true);
  const restored = bindServerAccount(
    storage,
    restore(storage).state,
    "local-test-user",
  );
  assert.equal(resumeBook(restored, "emperor-clothes").active?.end, 8);
});
