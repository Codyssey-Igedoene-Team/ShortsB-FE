import { useState } from "react";
import { searchBooks } from "../domain/catalog";
import { useApp } from "../state/AppContext";
import { BookRow, Empty, Icon } from "../components/UI";
export function SearchPage() {
  const [query, setQuery] = useState(""),
    [mood, setMood] = useState("any"),
    [kind, setKind] = useState("any"),
    { go } = useApp();
  const result = searchBooks(query, mood, kind);
  return (
    <section>
      <h1 className="page-title">
        다음 이야기를
        <br />
        찾아보세요.
      </h1>
      <form
        className="search-form"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <Icon name="search" />
        <input
          type="search"
          aria-label="제목, 작가, 분위기로 검색"
          placeholder="제목, 작가, 분위기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <div className="filter-tabs" role="group" aria-label="분위기 필터">
        {[
          ["any", "전체"],
          ["calm", "따뜻한"],
          ["light", "유쾌한"],
          ["deep", "생각할 이야기"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={mood === id}
            onClick={() => setMood(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="row result-heading">
        <span role="status">
          책 목록 <strong>{result.length}</strong>
        </span>
        <select
          aria-label="작품 길이"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {[
            ["any", "모든 길이"],
            ["short", "단편"],
            ["novella", "중편"],
            ["novel", "장편"],
          ].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {result.length ? (
        result.map((b) => <BookRow book={b} key={b.id} />)
      ) : (
        <Empty title="아직 그 책은 없어요.">
          <p>다른 제목이나 작가로 찾아보세요.</p>
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setKind("any");
              setMood("any");
            }}
          >
            전체 책 보기
          </button>
        </Empty>
      )}
      <p className="tiny muted">
        가나다순 · 한국어 번역이 완성된 책부터 읽을 수 있어요.
      </p>
      <button className="catalog-request" onClick={() => go("preferences")}>
        <span>
          어떤 책을 읽을지 고민이라면<strong>이런 책을 추천받고 싶어요!</strong>
        </span>
        <Icon name="arrow" />
      </button>
    </section>
  );
}
