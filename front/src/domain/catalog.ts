import data from "../data/catalog.json";
import type { Book, Relation, State } from "./types";
export const books = data.books as unknown as Book[];
export const byId = new Map(books.map((b) => [b.id, b]));
export const availableBooks = books.filter((b) => b.available);
export const relations = data.relations as unknown as Record<string, Relation>;
export const alternatives = data.alternatives as Record<string, Relation[]>;
export const moods = [
  ["calm", "따뜻한 이야기", "다정한 관계와 작은 변화"],
  ["light", "유쾌한 이야기", "해학과 풍자로 기분 전환"],
  ["deep", "생각할 이야기", "불안·외로움·삶의 모순"],
  ["any", "무엇이든 좋아요", "새로운 이야기 만나기"],
] as const;
export const workLabel = (b: Book) =>
  ({ short: "단편", novella: "중편", novel: "장편" })[b.workType];
export const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s.,·’'_-]+/g, "");
export function searchBooks(query: string, mood = "any", kind = "any") {
  const q = normalize(query);
  return books
    .filter(
      (b) =>
        (!q ||
          normalize(
            [b.book, b.author, ...b.aliases, ...b.keywords].join(" "),
          ).includes(q)) &&
        (mood === "any" || b.moods.includes(mood)) &&
        (kind === "any" || b.workType === kind),
    )
    .sort((a, b) => a.book.localeCompare(b.book, "ko", { numeric: true }));
}
export function recommend(s: State, seen: string[] = []): Book {
  const text = normalize(s.profile?.thought || ""),
    mood = s.profile?.mood;
  const named = (b: Book) =>
    [b.book, b.author, ...b.aliases].some(
      (x) => x && text.includes(normalize(x)),
    );
  let candidates = availableBooks;
  if (!candidates.some(named) && mood && mood !== "any") {
    const matched = candidates.filter((b) => b.moods.includes(mood));
    if (matched.length) candidates = matched;
  }
  const unseen = candidates.filter((b) => !seen.includes(b.id));
  if (unseen.length) candidates = unseen;
  const score = (b: Book) =>
    (named(b) ? 150 : 0) +
    (b.moods.includes(mood || "any") ? 28 : 0) +
    b.guide.keywords.filter((k) => text.includes(normalize(k))).length * 12 +
    (s.feedback[b.id] === "like" ? 5 : 0) -
    (s.history.some((h) => h.id === b.id) ? 3 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}
export function nextRelations(s: State, from: string): Relation[] {
  const session = s.active?.id === from ? s.active : s.progress[from];
  const recent = s.history.slice(-3).map((h) => h.id);
  const excluded = new Set([
    from,
    ...(session?.recommendationTrail || []),
    ...recent,
  ]);
  const options = [relations[from], ...(alternatives[from] || [])].filter(
    Boolean,
  );
  // Native Korean fallback while new translations are being completed.
  const nativePairs: Record<string, Relation> = {
    "spring-spring": {
      target: "lucky-day",
      title: "웃음 뒤에 남은, 삶의 무게.",
      kind: "닮은 현실 · 다른 말투",
      fromLabel: "혼례를 둘러싼 해학",
      toLabel: "생계를 둘러싼 불안",
      reason:
        "혼례를 미루는 장인과 청년의 소동 다음으로, 가족 걱정과 하루 벌이 사이를 달리는 김 첨지를 만나보세요. 빠듯한 삶을 다루는 말투가 달라요.",
    },
    "lucky-day": {
      target: "spring-spring",
      title: "무거운 하루 다음에는, 웃음 한 장.",
      kind: "닮은 현실 · 다른 말투",
      fromLabel: "불안이 쌓이는 하루",
      toLabel: "능청스러운 혼례 이야기",
      reason:
        "김 첨지의 불안한 하루에서, 혼례를 기다리는 청년의 엉뚱한 푸념으로 옮겨가 보세요. 삶의 어려움이 해학으로 바뀌는 대목이에요.",
    },
  };
  if (nativePairs[from]) options.push(nativePairs[from]);
  // Curated links can run out before the readable catalog does.
  // Keep their priority, then connect other books through their actual themes.
  const source = byId.get(from);
  if (source) {
    const affinity = (book: Book) =>
      book.topics.filter((topic) => source.topics.includes(topic)).length * 2 +
      book.moods.filter((mood) => source.moods.includes(mood)).length;
    const fallback = [...availableBooks].sort(
      (a, b) => affinity(b) - affinity(a) || a.book.localeCompare(b.book, "ko"),
    );
    options.push(
      ...fallback.map(
        (book): Relation => ({
          target: book.id,
          title: `다음에는, 『${book.book}』의 시선으로.`,
          kind: "주제와 분위기로 이어 읽기",
          fromLabel: source.theme,
          toLabel: book.theme,
          reason: `『${source.book}』에서 ${source.theme}을 읽었다면, 이번에는 『${book.book}』에서 ${book.theme}을 만나보세요. ${source.tone}에서 ${book.tone}로 이야기의 분위기를 바꿔 읽을 수 있어요.`,
        }),
      ),
    );
  }
  const used = new Set<string>();
  const fresh = options.filter((r) => {
    const b = byId.get(r.target);
    if (!b?.available || excluded.has(r.target) || used.has(r.target))
      return false;
    used.add(r.target);
    return !s.readLog.some(
      (x) =>
        x.id === r.target &&
        x.edition === b.edition &&
        x.index === b.guide.start,
    );
  });
  if (fresh.length || !source) return fresh;

  // Persisted trails and page logs must not leave any reader at a dead end.
  // Start another recommendation round, preferring excerpts not read yet.
  const candidates = new Map<string, Relation>();
  for (const relation of options) {
    if (
      relation.target !== from &&
      byId.get(relation.target)?.available &&
      !candidates.has(relation.target)
    )
      candidates.set(relation.target, relation);
  }
  const wasRead = (id: string) => {
    const book = byId.get(id)!;
    return s.readLog.some(
      (record) =>
        record.id === id &&
        record.edition === book.edition &&
        record.index === book.guide.start,
    );
  };
  const lastRead = (id: string) => {
    for (let i = s.history.length - 1; i >= 0; i--) {
      if (s.history[i].id === id) return i;
    }
    return -1;
  };
  return [...candidates.values()]
    .sort(
      (a, b) =>
        Number(wasRead(a.target)) - Number(wasRead(b.target)) ||
        lastRead(a.target) - lastRead(b.target),
    )
    .map((relation) => {
      if (!wasRead(relation.target)) return relation;
      const book = byId.get(relation.target)!;
      return {
        ...relation,
        kind: "다시 읽기 추천",
        title: `『${book.book}』, 다시 만나볼까요?`,
        reason: `이전에 읽은 대목이에요. 『${source.book}』을 읽은 뒤, 『${book.book}』의 ‘${book.theme}’을 다시 살펴보세요.`,
      };
    });
}
