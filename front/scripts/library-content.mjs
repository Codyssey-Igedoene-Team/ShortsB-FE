import crypto from "node:crypto";

const sha = text => crypto.createHash("sha256").update(text, "utf8").digest("hex");

/** Validate the supplied full-text pages without rewriting or repaginating them. */
export function buildLibrary(bundle, metadata) {
  if (!Array.isArray(bundle.books) || bundle.books.length !== bundle.bookCount)
    throw new Error("Library book count mismatch");
  const ids = new Set();
  return bundle.books.map(book => {
    if (!book.id || ids.has(book.id)) throw new Error("Duplicate or missing book ID");
    ids.add(book.id);
    if (book.language !== "ko" || !Array.isArray(book.pages) || !book.pages.length ||
        book.pages.some(page => typeof page !== "string" || !page.trim()) ||
        book.pageCount !== book.pages.length || typeof book.pageJoiner !== "string")
      throw new Error(book.id + ": invalid Korean pages");
    if (sha(book.pages.join(book.pageJoiner)) !== book.textSHA256)
      throw new Error(book.id + ": full-text hash mismatch");
    let cursor = 0;
    for (const chapter of book.chapters || []) {
      if (chapter.start !== cursor || !Number.isInteger(chapter.end) ||
          chapter.end <= cursor || chapter.end > book.pages.length)
        throw new Error(book.id + ": invalid chapter range");
      cursor = chapter.end;
    }
    if (cursor !== book.pages.length) throw new Error(book.id + ": incomplete chapters");
    const meta = metadata[book.id];
    const workType = { "단편": "short", "중편": "novella", "장편": "novel" }[book.workType];
    if (!meta || !workType || !Number.isInteger(meta.guide?.start) ||
        meta.guide.start < 0 || meta.guide.start >= book.pages.length ||
        !book.pages[meta.guide.start].includes(meta.guide.anchor))
      throw new Error(book.id + ": invalid reading guide");
    return {
      ...meta, id: book.id, book: book.title, author: book.author, workType,
      parts: book.pages, edition: book.edition, editionLabel: book.editionLabel,
      translationNote: book.translationNote || "", available: true, textLanguage: book.language,
      pageJoiner: book.pageJoiner, totalPages: book.pageCount,
      chapters: book.chapters.map(chapter => ({ ...chapter, available: true })),
      source: book.sourceURL, sourceName: book.sourceName, licenseURL: book.licenseURL || undefined,
      licenseLabel: book.licenseLabel || undefined, credits: book.credits || undefined,
      textSHA256: book.textSHA256,
    };
  });
}
