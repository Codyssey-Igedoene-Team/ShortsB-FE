import test from "node:test";
import assert from "node:assert/strict";
import { createLocalBookSource } from "../src/services/bookSource";
import { books, byId } from "../src/domain/catalog";

test("book summaries and details are available without embedding the full text", async () => {
  const source = createLocalBookSource(books);
  const summaries = await source.list();
  assert.equal(summaries.length, books.length);
  assert.ok(summaries.every((book) => !("parts" in book)));
  const details = await source.details("waiting");
  assert.equal(details?.book, byId.get("waiting")!.book);
  assert.ok(details && !("parts" in details));
  assert.equal(await source.details("missing"), null);
  details!.guide.reason = "changed";
  assert.notEqual((await source.details("waiting"))!.guide.reason, "changed");
});

test("page lookup respects book identity, edition and zero-based position", async () => {
  const source = createLocalBookSource(books),
    book = byId.get("waiting")!;
  const request = { bookId: book.id, edition: book.edition, index: 0 };
  assert.equal((await source.page(request))?.text, book.parts[0]);
  assert.equal(
    await source.page({ ...request, edition: "other-edition" }),
    null,
  );
  assert.equal(await source.page({ ...request, index: book.totalPages }), null);
  assert.equal(await source.page({ ...request, bookId: "missing" }), null);
  await assert.rejects(source.page({ ...request, index: -1 }), RangeError);
});

test("an abandoned request is cancelled instead of returning data", async () => {
  const source = createLocalBookSource(books),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(source.list(controller.signal), { name: "AbortError" });
});
