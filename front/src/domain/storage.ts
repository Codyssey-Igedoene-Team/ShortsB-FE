import {
  defaults,
  migrate,
  LEGACY_KEY,
  STORAGE_KEY,
  syncReadingPlan,
} from "./reading";
import type { State } from "./types";

export const ACCOUNT_STORAGE_KEY = `${STORAGE_KEY}.server-account`;
const accountKey = (id: string) =>
  `${ACCOUNT_STORAGE_KEY}.${encodeURIComponent(id)}`;
export const TEST_BACKUP_KEY = `${STORAGE_KEY}.onboarding-test-backup`;

export type StoragePort = Pick<Storage, "getItem" | "setItem">;

/** Keep corrupt bytes recoverable before allowing any new state to overwrite them. */
export function restore(storage: StoragePort): {
  state: State;
  canWrite: boolean;
  warning: boolean;
} {
  let warning = false;
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return { state: defaults(), canWrite: false, warning: true };
    }
    if (!raw) continue;
    try {
      return { state: migrate(JSON.parse(raw)), canWrite: true, warning };
    } catch {
      warning = true;
      try {
        storage.setItem(`${key}.recovery.${Date.now()}`, raw);
      } catch {
        return { state: defaults(), canWrite: false, warning: true };
      }
    }
  }
  return { state: defaults(), canWrite: true, warning };
}

export function persist(storage: StoragePort, state: State): boolean {
  try {
    const data = JSON.stringify({ ...state, demoAccountComplete: false });
    if (state.demoUserId) storage.setItem(accountKey(state.demoUserId), data);
    storage.setItem(STORAGE_KEY, data);
    return true;
  } catch {
    return false;
  }
}

/** Keep member records separate from the fresh, signed-out reading session. */
export function logoutToGuest(
  storage: StoragePort,
  state: State,
): State | null {
  try {
    if (state.demoUserId)
      storage.setItem(
        accountKey(state.demoUserId),
        JSON.stringify({ ...state, demoAccountComplete: false }),
      );
  } catch {
    return null;
  }
  const guest = defaults();
  return persist(storage, guest) ? guest : null;
}

/** Call only after credentials have been checked. */
export function restoreAccount(storage: StoragePort, id: string): State | null {
  try {
    const raw = storage.getItem(accountKey(id));
    if (!raw) return null;
    const state = migrate(JSON.parse(raw));
    return state.demoUserId === id ? state : null;
  } catch {
    return null;
  }
}

/** Call only with the identity returned by /api/me, never a stored login flag. */
export function bindServerAccount(
  storage: StoragePort,
  current: State,
  id: string,
  testing = false,
): State {
  const saved = testing ? null : restoreAccount(storage, id);
  // Unowned browser data may belong to an earlier guest or demo session.
  // A new account starts fresh; only that account's own records are restored.
  const base =
    current.demoUserId === id
      ? current
      : saved || defaults();
  return syncReadingPlan({
    ...base,
    demoUserId: id,
    demoAccountComplete: true,
  });
}

/** Keep the original state recoverable across repeated tests and page reloads. */
export function beginOnboardingTest(
  storage: StoragePort,
  state: State,
): State | null {
  try {
    if (!storage.getItem(TEST_BACKUP_KEY))
      storage.setItem(TEST_BACKUP_KEY, JSON.stringify(state));
    const fresh = { ...defaults(), calendarDemo: false };
    return persist(storage, fresh) ? fresh : null;
  } catch {
    return null;
  }
}

export function endOnboardingTest(
  storage: StoragePort & Pick<Storage, "removeItem">,
  verifiedUserId: string,
): State | null {
  try {
    const raw = storage.getItem(TEST_BACKUP_KEY);
    if (!raw) return null;
    const original = migrate(JSON.parse(raw));
    if (original.demoUserId !== verifiedUserId) return null;
    original.demoAccountComplete = true;
    if (!persist(storage, original)) return null;
    storage.removeItem(TEST_BACKUP_KEY);
    return original;
  } catch {
    return null;
  }
}
