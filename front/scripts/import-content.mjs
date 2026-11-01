import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const source = JSON.parse(
  fs.readFileSync(path.join(root, "content-source/catalog.json"), "utf8"),
);
const bundledDir = path.join(root, "content-source/translations");
// Builds use the committed snapshot. Import a new batch only with SHORTB_TRANSLATIONS.
const translationDir = process.env.SHORTB_TRANSLATIONS || bundledDir;
fs.mkdirSync(bundledDir, { recursive: true });
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
function paginate(text) {
  const parts = [];
  let rest = text;
  while (rest.length > 750) {
    const window = rest.slice(0, 751);
    let end = window.lastIndexOf("\n\n");
    if (end < 350) {
      const hits = [...window.matchAll(/[.!?][”"’']?\s+/g)];
      end = hits.at(-1)?.index ?? -1;
      if (end > 350) end += hits.at(-1)[0].length;
    } else end += 2;
    if (end < 350) end = window.lastIndexOf(" ");
    if (end < 350) end = 750;
    parts.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest) parts.push(rest);
  return parts;
}
function readTranslation(id) {
  for (const dir of [translationDir, bundledDir]) {
    const file = path.join(dir, id + ".json");
    if (!fs.existsSync(file)) continue;
    let t;
    try {
      t = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      if (dir === bundledDir) throw error;
      console.warn(
        `${id}: translation workspace file is being written; keeping the bundled edition.`,
      );
      continue;
    }
    if (t.complete === true) return t;
  }
}
const books = source.books.map((old) => {
  const native = !old.textLanguage || old.textLanguage === "ko";
  let parts = native ? old.parts : [],
    edition = old.edition || "original",
    guide = { ...old.readingGuide };
  let editionLabel = native ? "한국어 원문" : "한국어 번역 준비 중",
    translationNote = "",
    chapters = old.chapters;
  const translation = readTranslation(old.id);
  if (translation) {
    const original = old.parts.join(old.pageJoiner ?? "\n\n");
    if (
      ![sha(original), sha(original + "\n")].includes(translation.sourceSHA256)
    )
      throw Error(old.id + ": translation source hash mismatch");
    if (
      !Array.isArray(translation.paragraphs) ||
      !translation.paragraphs.length ||
      translation.paragraphs.some((p) => !p.ko?.trim() || !p.source?.trim())
    )
      throw Error(old.id + ": incomplete paragraph mapping");
    if (translation.paragraphs.map((p) => p.source).join("\n\n") !== original)
      throw Error(old.id + ": missing source paragraphs");
    const reviewed = new Set(translation.reviewedParagraphs || []);
    if (!translation.paragraphs.every((_, i) => reviewed.has(i)))
      throw Error(old.id + ": source comparison review incomplete");
    const korean = translation.paragraphs.map((p) => p.ko).join("\n\n");
    const sections = translation.chapters?.length
      ? translation.chapters
      : [
          {
            id: "body",
            title: "본문",
            start: 0,
            end: translation.paragraphs.length,
          },
        ];
    parts = [];
    chapters = [];
    let nextParagraph = 0;
    for (const section of sections) {
      if (
        section.start !== nextParagraph ||
        !Number.isInteger(section.end) ||
        section.end <= section.start ||
        section.end > translation.paragraphs.length
      )
        throw Error(old.id + ": invalid chapter ranges");
      const chunk = translation.paragraphs
        .slice(section.start, section.end)
        .map(
          (p, i) =>
            p.ko +
            (section.start + i + 1 < translation.paragraphs.length
              ? "\n\n"
              : ""),
        )
        .join("");
      const start = parts.length;
      parts.push(...paginate(chunk));
      chapters.push({
        id: section.id,
        title: section.title,
        start,
        end: parts.length,
        available: true,
      });
      nextParagraph = section.end;
    }
    if (
      nextParagraph !== translation.paragraphs.length ||
      parts.join("") !== korean
    )
      throw Error(old.id + ": chapter pagination changed the full translation");
    edition = "shortb-ai-ko-" + sha(korean).slice(0, 12);
    editionLabel = "AI 한국어 번역";
    translationNote =
      translation.translationNote ||
      "공개 원문에서 새로 번역한 AI 번역본입니다. 전문 번역가의 교열 전입니다.";
    const paragraph = translation.paragraphs.find((p) =>
      p.source.includes(old.readingGuide.anchor),
    );
    const offset = korean.indexOf(
      paragraph?.ko || translation.paragraphs[0].ko,
    );
    let sum = 0,
      page = 0;
    for (let i = 0; i < parts.length; i++) {
      if (sum + parts[i].length > offset) {
        page = i;
        break;
      }
      sum += parts[i].length;
    }
    guide = {
      ...guide,
      start: page,
      anchor: parts[page].trim().split("\n\n")[0],
      note: translationNote,
    };
    // Store only validated complete documents so rebuilding on a teammate's machine is self-contained.
    const destination = path.join(bundledDir, old.id + ".json");
    fs.writeFileSync(
      destination + ".tmp",
      JSON.stringify(translation, null, 2),
    );
    fs.renameSync(destination + ".tmp", destination);
  }
  const legacyEditions = {
    ...(old.legacyEditions || {}),
    [old.edition || "original"]: old.parts.length,
  };
  if (old.previousEdition)
    legacyEditions[old.previousEdition] = old.previousPageCount;
  return {
    id: old.id,
    book: old.book,
    author: old.author,
    originalTitle: old.originalTitle || old.book,
    aliases: old.aliases || [],
    topics: old.topics,
    moods: old.moods,
    keywords: old.keywords || [],
    description: old.description,
    theme: old.theme,
    tone: old.tone,
    workType: old.workType,
    parts,
    edition,
    editionLabel,
    translationNote,
    available: parts.length > 0,
    textLanguage: "ko",
    pageJoiner: translation ? "" : (old.pageJoiner ?? "\n\n"),
    totalPages: parts.length,
    chapters: parts.length ? chapters : [],
    guide,
    source: old.source,
    sourceName: old.sourceName,
    licenseURL: old.licenseURL,
    licenseLabel: old.licenseLabel,
    credits: old.credits,
    legacyEditions,
    defaultLegacyEdition: old.previousEdition || old.edition || "original",
  };
});
fs.writeFileSync(
  path.join(root, "src/data/catalog.json"),
  JSON.stringify({
    books,
    relations: source.relations,
    alternatives: source.alternatives,
  }),
);
console.log(
  `Content: ${books.filter((b) => b.available).length} Korean editions; ${books.filter((b) => !b.available).length} awaiting translation. No incomplete book imported.`,
);
