import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentApi,
  ContentApiError,
} from "../src/services/r4/contentApi";
import {
  toPreviewRequest,
  pageNoFromIndex,
  toPageDisplay,
} from "../src/services/r4/adapters";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("creating the R4 client is dormant and GET uses cookies with string IDs", async () => {
  const calls: string[] = [];
  const api = createContentApi("http://localhost:8080/", async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.credentials, "include");
    assert.equal(init?.method, "GET");
    return json({ bookId: "9007199254740993" });
  });
  assert.equal(calls.length, 0);
  const book = await api.getBook("9007199254740993");
  assert.equal(book.bookId, "9007199254740993");
  assert.deepEqual(calls, ["http://localhost:8080/api/books/9007199254740993"]);
});

test("R4 read routes use the documented session/page paths and 204 means no current reading", async () => {
  const urls: string[] = [];
  const api = createContentApi("", async (url) => {
    urls.push(String(url));
    return String(url).includes("/current")
      ? new Response(null, { status: 204 })
      : json({});
  });
  await api.getPreview("preview-id");
  await api.getReading("9007199254740993");
  await api.getPage("9007199254740993", pageNoFromIndex(0));
  assert.equal(await api.getCurrentReading(), null);
  assert.equal(await api.getCurrentReading("9007199254740993"), null);
  assert.deepEqual(urls, [
    "/api/previews/preview-id",
    "/api/reading-sessions/9007199254740993",
    "/api/reading-sessions/9007199254740993/pages/1",
    "/api/reading-sessions/current",
    "/api/reading-sessions/current?bookId=9007199254740993",
  ]);
});

test("state changes fetch CSRF and preserve exact bodies without retrying writes", async () => {
  const writes: { url: string; method?: string; body?: BodyInit | null }[] = [];
  let csrfRequests = 0;
  const api = createContentApi("", async (url, init) => {
    if (url === "/api/csrf") {
      csrfRequests++;
      return json({ token: "fresh-token", headerName: "X-CSRF-TOKEN" });
    }
    assert.equal(new Headers(init?.headers).get("X-CSRF-TOKEN"), "fresh-token");
    writes.push({ url: String(url), method: init?.method, body: init?.body });
    return json({});
  });
  const preview = toPreviewRequest(10, "calm", "따뜻한 이야기");
  await api.createPreview(preview);
  await api.startReading({ bookId: "9007199254740993" });
  await api.saveProgress("1", {
    pageNo: "2",
    position: "10",
    version: "9007199254740993",
    status: "paused",
  });
  await api.completeReading("1", { version: "9007199254740994" });
  assert.equal(csrfRequests, 4);
  assert.deepEqual(JSON.parse(String(writes[0].body)), {
    requestedPageCount: "10",
    storyType: "WARM",
    prompt: "따뜻한 이야기",
  });
  assert.deepEqual(
    writes.slice(1).map((w) => [w.url, w.method]),
    [
      ["/api/reading-sessions", "POST"],
      ["/api/reading-sessions/1/progress", "PATCH"],
      ["/api/reading-sessions/1/complete", "POST"],
    ],
  );
  assert.equal(JSON.parse(String(writes[2].body)).version, "9007199254740993");
});

test("no contrast is a normal response and its POST has no JSON body", async () => {
  const api = createContentApi("", async (url, init) => {
    if (url === "/api/csrf")
      return json({ token: "token", headerName: "X-CSRF-TOKEN" });
    assert.equal(url, "/api/previews/source-id/contrast");
    assert.equal(init?.body, undefined);
    return json({
      available: false,
      sourcePreviewId: "source-id",
      reasonCode: "NO_ELIGIBLE_CONTRAST",
      contrast: null,
    });
  });
  assert.equal((await api.getContrast("source-id")).available, false);
});

test("409 preserves the latest state for review without changing the version or resending", async () => {
  const current = { sessionId: "1", version: "12" };
  let attempts = 0;
  const api = createContentApi("", async (url) => {
    if (url === "/api/csrf")
      return json({ token: "token", headerName: "X-CSRF-TOKEN" });
    attempts++;
    return json(
      { code: "READING_VERSION_CONFLICT", message: "conflict", current },
      409,
    );
  });
  await assert.rejects(
    api.saveProgress("1", {
      pageNo: "1",
      position: "0",
      version: "11",
      status: "reading",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ContentApiError);
      assert.equal(error.status, 409);
      assert.deepEqual(error.current, current);
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test("aborted and failed requests do not become fake empty results", async () => {
  let calls = 0;
  const api = createContentApi("", async () => {
    calls++;
    return json({ code: "CONTENT_NOT_READY", message: "unavailable" }, 503);
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.getBook("1", controller.signal), {
    name: "AbortError",
  });
  assert.equal(calls, 0);
  await assert.rejects(
    api.getBook("1"),
    (error: unknown) =>
      error instanceof ContentApiError &&
      error.status === 503 &&
      error.code === "CONTENT_NOT_READY",
  );
  assert.equal(toPreviewRequest(3, "any", "   ").prompt, undefined);
  assert.deepEqual(toPageDisplay({ pageNo: 3, content: "원문" }), {
    index: 2,
    text: "원문",
  });
});
