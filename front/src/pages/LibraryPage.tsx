import { useState } from "react";
import { byId } from "../domain/catalog";
import { pending, uniqueBooks } from "../domain/reading";
import { useApp } from "../state/AppContext";
import { BookCover, Button, Empty, Icon, Progress } from "../components/UI";
export function LibraryPage() {
  const { state, go, resume } = useApp(),
    [tab, setTab] = useState("progress"),
    reading = pending(state),
    read = uniqueBooks(state),
    saved = [...new Set(state.saved)],
    ids =
      tab === "progress"
        ? reading.map((a) => a.id)
        : tab === "saved"
          ? saved
          : read;
  return (
    <section>
      <div className="row">
        <h1 className="page-title">나의 책장</h1>
        <button
          className="icon-button"
          aria-label="설정 열기"
          onClick={() => go("settings")}
        >
          <Icon name="settings" />
        </button>
      </div>
      <button className="shelf-link" onClick={() => go("calendar")}>
        <span>
          <Icon name="calendar" />
          독서 달력
        </span>
        <Icon name="chevron" />
      </button>
      <button className="shelf-link" onClick={() => go("highlights")}>
        <span>
          표시한 문장 <small>{state.highlights.length}</small>
        </span>
        <Icon name="chevron" />
      </button>
      <div
        className="filter-tabs shelf-tabs"
        role="group"
        aria-label="책장 종류"
      >
        {[
          ["progress", "읽던 책", reading.length],
          ["saved", "담은 책", saved.length],
          ["history", "읽은 기록", read.length],
        ].map(([id, label, count]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(String(id))}
          >
            {label}
            <small>{count}</small>
          </button>
        ))}
      </div>
      {ids.length ? (
        ids.map((id) => {
          const b = byId.get(id)!;
          return (
            <article className="book-row shelf-row" key={id}>
              <BookCover book={b} />
              <div>
                <h2>{b.book}</h2>
                <p>{b.author}</p>
                {b.available ? (
                  <Progress book={b} />
                ) : (
                  <small>한국어 번역 준비 중 · 이전 기록 보관</small>
                )}
              </div>
              <button
                className="icon-button"
                aria-label={`${b.book} ${tab === "progress" ? "이어 읽기" : "정보 보기"}`}
                onClick={() =>
                  tab === "progress" ? resume(id) : go("book", id)
                }
              >
                <Icon name="arrow" />
              </button>
            </article>
          );
        })
      ) : (
        <Empty
          title={
            tab === "progress"
              ? "다음 이야기를 기다리는 자리."
              : "아직 담긴 이야기가 없어요."
          }
        >
          <p>
            마음에 드는 책을 저장하거나
            <br />한 페이지를 읽어보세요.
          </p>
          <Button onClick={() => go("home")}>오늘 읽기</Button>
        </Empty>
      )}
      <p className="tiny muted centered footer-note">
        짧게 읽은 날도, 모두 나의 기록이에요.
      </p>
    </section>
  );
}
export function HighlightsPage() {
  const { state, update, start, go, notify } = useApp();
  return (
    <section>
      <div className="page-back">
        <button
          className="icon-button"
          aria-label="책장으로"
          onClick={() => go("library")}
        >
          <Icon name="back" />
        </button>
      </div>
      <h1 className="page-title">표시한 문장</h1>
      <p className="muted">마음이 머문 자리를 다시 펼쳐보세요.</p>
      {state.highlights.length ? (
        state.highlights.map((h) => {
          const b = byId.get(h.bookId)!,
            current = b.available && h.edition === b.edition;
          return (
            <article className="highlight-card" key={h.id}>
              <small>
                {b.book} · {current ? "" : "이전 판본 · "}
                {h.index + 1}쪽
              </small>
              <blockquote>{h.text}</blockquote>
              <div className="row">
                <button
                  className="text-button"
                  onClick={() =>
                    current
                      ? start(b.id, h.index, "book")
                      : notify(
                          "이전 판본에서 저장한 문장이에요. 새 본문에는 위치를 적용하지 않아요.",
                        )
                  }
                >
                  {current ? "페이지로 가기" : "이전 판본의 문장"}
                </button>
                <button
                  className="icon-button"
                  aria-label="형광펜 지우기"
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      highlights: s.highlights.filter((x) => x.id !== h.id),
                    }))
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
            </article>
          );
        })
      ) : (
        <Empty title="마음에 남는 문장을 만났다면.">
          <p>
            본문을 길게 눌러 선택하고
            <br />
            형광펜으로 표시해보세요.
          </p>
          <Button onClick={() => go("home")}>책 읽으러 가기</Button>
        </Empty>
      )}
    </section>
  );
}
