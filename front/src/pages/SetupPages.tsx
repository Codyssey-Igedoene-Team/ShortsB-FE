import { useState } from "react";
import { moods } from "../domain/catalog";
import { setDailyGoal, needsDailyGoal } from "../domain/reading";
import type { Goal, Mood } from "../domain/types";
import { useApp } from "../state/AppContext";
import { Back, Button, GoalPicker, Icon } from "../components/UI";
function TastePicker({
  mood,
  onMood,
  thought,
  onThought,
}: {
  mood: Mood;
  onMood: (m: Mood) => void;
  thought: string;
  onThought: (text: string) => void;
}) {
  return (
    <>
      <div className="mood-options" role="group" aria-label="읽고 싶은 분위기">
        {moods.map(([id, label, desc]) => (
          <button
            key={id}
            aria-pressed={mood === id}
            onClick={() => onMood(id)}
          >
            <span>
              <strong>{label}</strong>
              <Icon name={mood === id ? "check" : "book"} />
            </span>
            <small>{desc}</small>
          </button>
        ))}
      </div>
      <label className="thought-field">
        조금 더 알려주고 싶다면 <small>선택</small>
        <textarea
          rows={4}
          maxLength={100}
          placeholder="이런 책을 추천받고 싶어요!"
          value={thought}
          onChange={(e) => onThought(e.target.value.slice(0, 100))}
        />
        <small>{thought.length} / 100자</small>
      </label>
      <p className="tiny muted">
        예: 남의 시선을 신경 쓰지 않고 가볍게 읽고 싶어요.
      </p>
    </>
  );
}
export function SetupPage() {
  const { state, update, go } = useApp(),
    [step, setStep] = useState(1),
    [life, setLife] = useState(state.profile?.life || "skip"),
    [goal, setGoal] = useState<Goal>(state.goal),
    [mood, setMood] = useState<Mood>(state.profile?.mood || "any"),
    [thought, setThought] = useState(state.profile?.thought || "");
  const titles = [
    <>
      당신의 하루에 맞는
      <br />
      책을 골라볼게요.
    </>,
    <>
      하루에 얼마만큼
      <br />
      읽어볼까요?
    </>,
    <>
      어떤 이야기에
      <br />
      마음이 가나요?
    </>,
  ];
  const finish = () => {
    update((s) => ({
      ...setDailyGoal(s, goal),
      profile: { life, mood, thought },
      setupCompleted: true,
    }));
    go("home");
  };
  return (
    <section className="setup-page">
      <div className="row setup-step">
        <button
          disabled={step === 1}
          onClick={() => setStep((n) => n - 1)}
          className="text-button"
        >
          <Icon name="back" />
          이전
        </button>
        <span>{step} / 3</span>
      </div>
      <div className="setup-progress" aria-label={`추천 설정 ${step}/3단계`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= step ? "active" : ""} />
        ))}
      </div>
      <h1 className="page-title">{titles[step - 1]}</h1>
      <p className="muted setup-description">
        {step === 1
          ? "평소 어떤 하루를 보내고 있나요?"
          : step === 2
            ? "작게 시작해도 좋아요. 언제든 바꿀 수 있어요."
            : "분위기를 고르거나 읽고 싶은 책을 알려주세요."}
      </p>
      {step === 1 ? (
        <div className="life-options" role="group" aria-label="생활 유형">
          {[
            ["student", "학생"],
            ["employee", "직장인"],
            ["independent", "프리랜서·자영업"],
            ["other", "그 외의 하루"],
            ["skip", "지금은 건너뛰기"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={life === id}
              onClick={() => setLife(id)}
            >
              {label}
              {life === id && <Icon name="check" />}
            </button>
          ))}
        </div>
      ) : step === 2 ? (
        <GoalPicker goal={goal} onChange={setGoal} />
      ) : (
        <TastePicker
          mood={mood}
          onMood={setMood}
          thought={thought}
          onThought={setThought}
        />
      )}
      <div className="setup-bottom">
        <Button onClick={() => (step === 3 ? finish() : setStep((n) => n + 1))}>
          {step === 3 ? "내게 맞는 책 만나기" : "다음"}
          <Icon name="arrow" />
        </Button>
        <p className="tiny muted centered">
          설정과 첫 독서 기록은 이 브라우저에 남아요.
        </p>
      </div>
    </section>
  );
}
export function PreferencesPage() {
  const { state, go, update } = useApp(),
    [mood, setMood] = useState<Mood>(state.profile?.mood || "any"),
    [thought, setThought] = useState(state.profile?.thought || "");
  return (
    <section>
      <Back title="취향 선택" />
      <h1 className="page-title">
        지금 읽고 싶은
        <br />
        이야기를 알려주세요.
      </h1>
      <p className="muted">분위기 하나, 또는 자유로운 한 줄이면 돼요.</p>
      <TastePicker
        mood={mood}
        onMood={setMood}
        thought={thought}
        onThought={setThought}
      />
      <Button
        onClick={() => {
          update((s) => ({
            ...s,
            profile: { life: s.profile?.life || "skip", mood, thought },
          }));
          go("home");
        }}
      >
        추천 한 권 보기
        <Icon name="arrow" />
      </Button>
      <p className="tiny muted centered">
        지금은 준비된 작품과 추천 근거로 연결하는 시연이에요.
      </p>
    </section>
  );
}
export function GoalsPage() {
  const { state, update, go } = useApp(),
    [goal, setGoal] = useState<Goal>(state.goal),
    firstToday = needsDailyGoal(state);
  return (
    <section>
      {!firstToday && <Back title="오늘 목표 변경" />}
      <h1 className="page-title">
        {firstToday ? (
          <>
            오늘은 몇 페이지
            <br />
            읽어볼까요?
          </>
        ) : (
          <>
            오늘의 목표를
            <br />
            바꿔볼까요?
          </>
        )}
      </h1>
      <p className="muted setup-description">
        {firstToday
          ? "지난번 목표를 미리 선택했어요. 오늘의 목표만 정하면 바로 읽을 수 있어요."
          : "오늘 목표에만 반영돼요. 지난날의 목표와 읽은 기록은 그대로 남아요."}
      </p>
      <GoalPicker goal={goal} onChange={setGoal} />
      <div className="setup-bottom">
        <Button
          onClick={() => {
            update((s) => setDailyGoal(s, goal));
            go("home");
          }}
        >
          {firstToday ? "오늘 목표로 시작하기" : "오늘 목표 저장"}
          <Icon name="check" />
        </Button>
      </div>
    </section>
  );
}
