import { useState } from "react";
import { byId } from "../domain/catalog";
import { calendarRecords, dayKey, streak } from "../domain/reading";
import { useApp } from "../state/AppContext";
import { Back, BookCover, Icon } from "../components/UI";
export function CalendarPage() {
  const { state, update, go, start } = useApp(),
    today = dayKey(),
    [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today);
  const [year, m] = month.split("-").map(Number),
    offset = new Date(Date.UTC(year, m - 1, 1)).getUTCDay(),
    length = new Date(Date.UTC(year, m, 0)).getUTCDate(),
    records = calendarRecords(state, month, today),
    days = [
      ...new Set([
        ...records.map((r) => r.day),
        ...(state.calendarDemo
          ? []
          : state.completedDays.filter((d) => d.startsWith(month))),
      ]),
    ],
    items = records.filter((r) => r.day === selected),
    groups = [...new Set(items.map((r) => r.id))],
    consecutive = streak(
      state.calendarDemo ? days : state.completedDays,
      today,
    );
  const move = (n: number) => {
    const next = new Date(Date.UTC(year, m - 1 + n, 1))
      .toISOString()
      .slice(0, 7);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : next + "-01");
  };
  return (
    <section className="calendar-page">
      <Back to="library" title="나의 독서 기록" />
      <div className="month-story">
        <h1>이번 달 읽은 페이지</h1>
        <div className="month-pages">
          <strong>{records.length}</strong>
          <span>페이지</span>
        </div>
        <p className="month-caption">
          {days.length}일, 책을 펼쳤어요.
          <br />
          {consecutive > 0
            ? `${consecutive}일째 이어 읽는 중`
            : "한 페이지부터 시작해요."}
        </p>
      </div>
      <div className="calendar-month">
        <button
          className="icon-button"
          aria-label="이전 달"
          onClick={() => move(-1)}
        >
          <Icon name="back" />
        </button>
        <h2>
          {year}년 {m}월
        </h2>
        <button
          className="icon-button"
          aria-label="다음 달"
          disabled={month >= today.slice(0, 7)}
          onClick={() => move(1)}
        >
          <Icon name="arrow" />
        </button>
      </div>
      <div className="calendar-weekdays">
        {"일월화수목금토".split("").map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: offset }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`,
            done = days.includes(day);
          return (
            <button
              key={day}
              className={[
                done ? "done" : "",
                day === today ? "today" : "",
                day === selected ? "selected" : "",
              ].join(" ")}
              disabled={day > today}
              aria-pressed={selected === day}
              aria-label={`${m}월 ${i + 1}일${day === today ? ", 오늘" : ""}, ${done ? "독서 기록 있음" : "독서 기록 없음"}`}
              onClick={() => setSelected(day)}
            >
              {i + 1}
              {done && <i />}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i />
          읽은 날
        </span>
        <span>
          <i className="today" />
          오늘
        </span>
        <small>날짜를 눌러 기록 보기</small>
      </div>
      <div className="calendar-details">
        <h3>
          {m}월 {Number(selected.slice(-2))}일
        </h3>
        {groups.length ? (
          groups.map((id) => {
            const b = byId.get(id)!,
              rows = items.filter((r) => r.id === id),
              indexes = rows.map((r) => r.index),
              legacy = rows.some((r) => r.edition !== b.edition);
            return (
              <article className="book-row" key={id}>
                <BookCover book={b} />
                <div>
                  <h2>{b.book}</h2>
                  <p>{b.author}</p>
                  <small>
                    {legacy ? "이전 판본 · " : ""}
                    {Math.min(...indexes) + 1}–{Math.max(...indexes) + 1}쪽 ·{" "}
                    {rows.length}페이지 읽음
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`${b.book} 다시 펼치기`}
                  onClick={() =>
                    b.available
                      ? start(id, legacy ? 0 : Math.min(...indexes), "book")
                      : go("book", id)
                  }
                >
                  <Icon name="arrow" />
                </button>
              </article>
            );
          })
        ) : (
          <p className="muted small empty-day">
            {days.includes(selected)
              ? "이전 시안에서 읽은 날이에요. 페이지별 기록은 남아 있지 않아요."
              : "이날은 아직 남겨둔 독서 기록이 없어요."}
          </p>
        )}
      </div>
      <div className="demo-toggle">
        <span>
          {state.calendarDemo ? "발표용 예시 기록" : "실제 독서 기록"}
        </span>
        <button
          className="text-button"
          onClick={() =>
            update((s) => ({ ...s, calendarDemo: !s.calendarDemo }))
          }
        >
          {state.calendarDemo ? "실제 기록 보기" : "발표용 예시 보기"}
        </button>
      </div>
      {state.calendarDemo && (
        <p className="tiny muted">
          발표용 기록은 실제 목표·책장·진행률에 반영하지 않아요.
        </p>
      )}
    </section>
  );
}
