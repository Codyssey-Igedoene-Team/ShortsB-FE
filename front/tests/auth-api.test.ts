import test from "node:test";
import assert from "node:assert/strict";
import { createAuthApi, AuthApiError } from "../src/services/authApi";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const user = {
  id: "9007199254740993",
  email: "reader@example.com",
  nickname: "Reader",
};

test("me uses a credentialed uncached request and preserves string user ids", async () => {
  const api = createAuthApi("http://localhost:8080/", async (url, init) => {
    assert.equal(url, "http://localhost:8080/api/me");
    assert.equal(init?.credentials, "include");
    assert.equal(init?.cache, "no-store");
    return json(user);
  });
  assert.equal(
    api.googleLoginUrl,
    "http://localhost:8080/oauth2/authorization/google",
  );
  assert.deepEqual(await api.me(), user);
});

test("only 401 is anonymous; server failure, network failure and malformed identities are errors", async () => {
  assert.equal(await createAuthApi("", async () => json({}, 401)).me(), null);
  await assert.rejects(
    createAuthApi("", async () =>
      json({ code: "FAILED", message: "failure" }, 500),
    ).me(),
    (error: unknown) => error instanceof AuthApiError && error.status === 500,
  );
  await assert.rejects(
    createAuthApi("", async () => {
      throw new Error("offline");
    }).me(),
    AuthApiError,
  );
  await assert.rejects(
    createAuthApi("", async () => json({ ...user, id: 123 })).me(),
    AuthApiError,
  );
  await assert.rejects(
    createAuthApi("", async () => json(null)).me(),
    AuthApiError,
  );
});

test("logout obtains a fresh CSRF token and sends it with the session cookie", async () => {
  const calls: string[] = [];
  const api = createAuthApi("http://localhost:8080", async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.credentials, "include");
    if (String(url).endsWith("/api/csrf"))
      return json({ token: "fresh-token", headerName: "X-CSRF-TOKEN" });
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("X-CSRF-TOKEN"), "fresh-token");
    return new Response(null, { status: 204 });
  });
  await api.logout();
  assert.deepEqual(calls, [
    "http://localhost:8080/api/csrf",
    "http://localhost:8080/api/logout",
  ]);
});

test("logout refreshes an expired CSRF token once and propagates other failures", async () => {
  let attempts = 0;
  const api = createAuthApi("", async (url) => {
    if (String(url).endsWith("csrf"))
      return json({ token: "token", headerName: "X-CSRF-TOKEN" });
    return ++attempts === 1
      ? json({ code: "CSRF_INVALID" }, 403)
      : new Response(null, { status: 204 });
  });
  await api.logout();
  assert.equal(attempts, 2);
  await assert.rejects(
    createAuthApi("", async () => json({}, 500)).logout(),
    AuthApiError,
  );
});
