import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_TEST_USER,
  LOCAL_TEST_SESSION_KEY,
  readLocalTestUser,
} from "../src/services/localTestAuth";

test("a local test session is only restored when explicitly enabled for development", () => {
  const storage = {
    getItem: (key: string) =>
      key === LOCAL_TEST_SESSION_KEY ? "active" : null,
  };
  assert.equal(readLocalTestUser(storage, false), null);
  assert.deepEqual(readLocalTestUser(storage, true), LOCAL_TEST_USER);
  assert.equal(readLocalTestUser({ getItem: () => null }, true), null);
});
