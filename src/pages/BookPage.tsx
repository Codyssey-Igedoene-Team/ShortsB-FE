import { byId, availableBooks, workLabel } from "../domain/catalog";
import { dose, resume as resumeSession } from "../domain/reading";
import { useApp } from "../state/AppContext";
import {
  Back,
  BookCover,
  Button,
  DosePicker,
  Progress,
  SaveButton,
  Scene,
} from "../components/UI";
export function BookPage() {
  const { location, state, go, start, resume } = useApp(),
    b = byId.get(location.book || "") || availableBooks[0],
    active = resumeSession(state, b.id),
    offset = active?.cursor ?? b.guide.start,
    remaining = active ? active.end - active.cursor : dose(state, b, offset);
  return (
    <section>
      <Back to="search" title="책 정보" />
      <div className="book-detail-heading">
        <BookCover book={b} large />
        <h1>{b.book}</h1>
        <p>{b.author}</p>
        <span className="edition-badge">
          {workLabel(b)} · {b.editionLabel}
        </span>
        <SaveButton book={b} />
      </div>
      <p className="body-copy">
        {b.description.replace(
          /공개 영어 판본.*|콘스턴스 가넷의 공개 영어.*|아오조라 문고의 일본어 판본.*/g,
          "",
        )}
      </p>
      {b.available ? (
        <>
          <Progress book={b} />
          <div className="why-this-book">
            <h2>이 책을 권하는 이유</h2>
            <p>{b.guide.reason}</p>
          </div>
          <Scene book={b} />
          {active && (
            <p className="small muted" role="status">
              이어 읽을 분량 {remaining}페이지 · {offset + 1}–
              {offset + remaining}쪽
              {active.mode === "trial" &&
                " · 체험 읽기는 첫 두 페이지까지예요."}
            </p>
          )}
          <DosePicker book={b} start={offset} session={active} />
          <Button onClick={() => (active ? resume(b.id) : start(b.id))}>
            {active
              ? `${offset + 1}쪽부터 ${remaining}페이지 이어 읽기`
              : `이 대목부터 ${dose(state, b, offset)}페이지 읽기`}
          </Button>
          {offset > 0 && (
            <button
              className="text-button centered"
              onClick={() => start(b.id, 0, "book")}
            >
              첫 페이지부터 읽기
            </button>
          )}
          <details className="contents-list">
            <summary>목차와 읽던 위치</summary>
            {b.chapters.map((c) => (
              <button key={c.id} onClick={() => start(b.id, c.start, "book")}>
                <span>{c.title}</span>
                <small>
                  {c.start + 1}–{c.end}쪽
                </small>
              </button>
            ))}
          </details>
        </>
      ) : (
        <div className="notice-box">
          <strong>한국어 전문을 번역하고 있어요.</strong>
          <p>
            완성된 번역을 검수한 뒤 읽기를 열어둘게요. 책장에 담아둘 수 있어요.
          </p>
          <Button secondary onClick={() => go("search")}>
            읽을 수 있는 책 찾아보기
          </Button>
        </div>
      )}
      <button
        className="text-button centered"
        onClick={() => go("source", b.id)}
      >
        판본과 출처 보기 ↗
      </button>
    </section>
  );
}
export function SourcePage() {
  const { location } = useApp(),
    b = byId.get(location.book || "") || availableBooks[0];
  return (
    <section>
      <Back to="book" title="본문과 출처" />
      <h1 className="page-title">{b.book}</h1>
      <p>{b.author}</p>
      <span className="edition-badge">{b.editionLabel}</span>
      <p className="body-copy">
        {!b.available
          ? "한국어 전문 번역을 준비 중입니다. 아래에서 번역의 바탕이 되는 공개 원문을 확인할 수 있어요."
          : b.translationNote ||
            "위키문헌에서 확인한 한국어 원문입니다. 옛 표기와 문장 순서를 유지했습니다."}
      </p>
      <div className="notice-box">
        쪽수는 shortB 화면 편집 기준이에요. 종이책의 쪽수와는 달라요. 추천
        설명은 책 본문과 별도로 작성했어요.
      </div>
      <p className="source-links">
        <a href={b.source} target="_blank" rel="noreferrer">
          {b.sourceName || "공개 원문"} ↗
        </a>
        {b.licenseURL && (
          <a href={b.licenseURL} target="_blank" rel="noreferrer">
            {b.licenseLabel || "이용 안내"} ↗
          </a>
        )}
      </p>
      <p className="small muted">{b.credits}</p>
    </section>
  );
}
