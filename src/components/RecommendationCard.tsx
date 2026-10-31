import { byId, nextRelations } from "../domain/catalog";
import { useApp } from "../state/AppContext";
import { BookCover, Icon } from "./UI";

/** The same recommendation and reasoning for guest and signed-in completion. */
export function RecommendationCard({ from }: { from: string }) {
  const { state, go } = useApp();
  const relation = nextRelations(state, from)[0];
  if (!relation)
    return (
      <div className="notice-box">
        <strong>새롭게 연결할 대목은 여기까지예요.</strong>
        <p>
          이미 만난 책으로 되돌아가지 않아요. 잠시 이야기의 여운을 느껴보세요.
        </p>
      </div>
    );
  const book = byId.get(relation.target)!;
  return (
    <section className="contrast-next" aria-label="다른 관점 추천">
      <small>{relation.kind}</small>
      <h2>{relation.title}</h2>
      <p>{relation.reason}</p>
      <button className="contrast-book" onClick={() => go("discover", from)}>
        <BookCover book={book} />
        <span>
          <strong>{book.book}</strong>
          <small>
            {relation.kind === "다시 읽기 추천"
              ? "다시 읽을 대목 보기"
              : "다른 관점의 대목 만나기"}
          </small>
        </span>
        <Icon name="arrow" />
      </button>
    </section>
  );
}
