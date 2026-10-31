import { useState } from "react";
import { Brand, Button, Icon } from "../components/UI";
import { useApp } from "../state/AppContext";
import type { Route } from "../app/routes";
import { DEMO_USER } from "../domain/auth";
export function AuthPage() {
  const { location, go, login, notify, continueReading } = useApp(),
    page = location.page;
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState("");
  const field = (
    id: string,
    label: string,
    value: string,
    change: (v: string) => void,
    type = "text",
    placeholder = "",
  ) => (
    <label className="form-field">
      {label}
      <input
        id={id}
        value={value}
        onChange={(e) => {
          change(e.target.value);
          setError("");
        }}
        type={type}
        placeholder={placeholder}
        autoComplete={
          type === "password"
            ? page === "login"
              ? "current-password"
              : "new-password"
            : type === "email"
              ? "email"
              : "off"
        }
        maxLength={type === "email" ? 254 : 100}
        required
        aria-describedby={error ? "auth-error" : undefined}
      />
    </label>
  );
  const finish = () => {
    if (!login(email, password)) {
      setError(
        "아이디 또는 비밀번호가 올바르지 않아요. 안내된 데모 계정을 사용해주세요.",
      );
      return;
    }
    setPassword("");
    setConfirmation("");
  };
  const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (["login", "email", "recover"].includes(page) && !validEmail()) {
      setError("이메일 주소를 확인해주세요.");
      return;
    }
    if (page === "login") {
      if (password.length < 8) {
        setError("비밀번호를 8자 이상 입력해주세요.");
        return;
      }
      finish();
    } else if (page === "email") go("code");
    else if (page === "recover") go("recover-sent");
    else if (page === "code") {
      if (code !== "123456") {
        setError("화면 체험용 번호는 123456이에요.");
        return;
      }
      go("signup-password");
    } else if (page === "signup-password") {
      if (password.length < 8 || password !== confirmation) {
        setError(
          password.length < 8
            ? "비밀번호를 8자 이상 입력해주세요."
            : "비밀번호가 서로 달라요.",
        );
        return;
      }
      setPassword("");
      setConfirmation("");
      go("login");
      notify("신규 가입은 준비 중이에요. 안내된 데모 계정으로 로그인해주세요.");
    }
  };
  const title: Partial<Record<Route, React.ReactNode>> = {
    login: (
      <>
        다시 만나서
        <br />
        반가워요.
      </>
    ),
    signup: (
      <>
        한 장씩 쌓일,
        <br />
        당신의 이야기.
      </>
    ),
    email: (
      <>
        책장을 연결할
        <br />
        이메일을 알려주세요.
      </>
    ),
    code: (
      <>
        여섯 자리 숫자를
        <br />
        확인해주세요.
      </>
    ),
    "signup-password": (
      <>
        나의 책장을 여는
        <br />
        비밀번호를 정해주세요.
      </>
    ),
    recover: (
      <>
        읽던 이야기로
        <br />
        돌아갈 수 있도록.
      </>
    ),
    "recover-sent": (
      <>
        메일함을
        <br />
        확인해주세요.
      </>
    ),
  };
  return (
    <section className="auth-page">
      <div className="auth-top">
        <button
          className="brand-button"
          aria-label="shortB 시작 화면"
          onClick={continueReading}
        >
          <Brand />
        </button>
        <button
          className="text-button"
          onClick={() => go(page === "login" ? "signup" : "login")}
        >
          {page === "login" ? "회원가입" : "로그인"}
        </button>
      </div>
      <div className="auth-copy">
        <h1>{title[page]}</h1>
        <p>
          {page === "signup" ? (
            <>
              간편하게 시작하고,
              <br />
              읽던 곳에서 다시 만나요.
            </>
          ) : page === "login" ? (
            <>
              잠시 멈춘 이야기,
              <br />
              그다음 페이지가 기다리고 있어요.
            </>
          ) : page === "recover" ? (
            "가입한 이메일 주소를 입력해주세요."
          ) : (
            "나만의 책장으로 이어지는 한 걸음."
          )}
        </p>
      </div>
      {page === "signup" ? (
        <>
          <div className="kept-place">
            <div className="kept-page">
              <i />
            </div>
            <p>
              담아둔 책과 읽어온 날들.
              <br />
              나의 책장에 차곡차곡.
            </p>
          </div>
          <div className="providers">
            {[
              ["kakao", "카카오", "●"],
              ["apple", "Apple", "●"],
              ["google", "Google", "G"],
            ].map(([id, name, symbol]) => (
              <button
                className={"provider " + id}
                key={id}
                onClick={() =>
                  notify(
                    "소셜 로그인은 준비 중이에요. 데모 계정으로 로그인해주세요.",
                  )
                }
              >
                <span aria-hidden="true">{symbol}</span>
                {name}로 계속하기
              </button>
            ))}
            <button
              className="text-button centered"
              onClick={() => go("email")}
            >
              <Icon name="mail" />
              이메일로 계속하기
            </button>
            <div className="terms">
              <button
                onClick={() =>
                  notify("이용약관은 서비스 출시 전에 연결할 예정이에요.")
                }
              >
                이용약관
              </button>
              <button
                onClick={() =>
                  notify("현재 입력 정보는 서버로 전송하지 않아요.")
                }
              >
                개인정보 처리방침
              </button>
            </div>
          </div>
        </>
      ) : page === "recover-sent" ? (
        <>
          <div className="notice-box">
            메일 발송 뒤에 보일 화면의 미리보기예요. 실제 메일은 발송되지
            않았어요.
          </div>
          <Button onClick={() => go("login")}>로그인으로 돌아가기</Button>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="auth-form">
          {["login", "email", "recover"].includes(page) &&
            field(
              "email",
              "이메일 주소",
              email,
              setEmail,
              "email",
              "you@example.com",
            )}
          {["login", "signup-password"].includes(page) &&
            field(
              "password",
              "비밀번호",
              password,
              setPassword,
              "password",
              "8자 이상 입력",
            )}
          {page === "signup-password" &&
            field(
              "confirm-password",
              "비밀번호 확인",
              confirmation,
              setConfirmation,
              "password",
              "비밀번호를 한 번 더 입력",
            )}
          {page === "code" && (
            <>
              <label className="form-field">
                인증번호
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </label>
              <p className="small muted">
                화면 체험용 번호는 <strong>123456</strong>이에요. 실제 이메일은
                발송되지 않아요.
              </p>
            </>
          )}
          {error && (
            <p id="auth-error" className="error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit">
            {page === "login"
              ? "로그인"
              : page === "recover"
                ? "재설정 링크 받기"
                : page === "email"
                  ? "인증번호 받기"
                  : page === "signup-password"
                    ? "가입하고 시작하기"
                    : "확인하고 계속하기"}
            <Icon name="arrow" />
          </Button>
          {page === "login" && (
            <>
              <button
                type="button"
                className="text-button centered"
                onClick={() => go("recover")}
              >
                비밀번호를 잊었나요?
              </button>
              <div className="login-social">
                {["카카오", "Apple", "Google"].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      notify(
                        "소셜 로그인은 준비 중이에요. 데모 계정으로 로그인해주세요.",
                      )
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </form>
      )}
      <div className="notice-box">
        <p>
          현재는 아래 데모 계정으로만 로그인할 수 있어요. 신규 가입과 소셜
          로그인은 준비 중이에요.
        </p>
        <p>
          아이디: <strong>{DEMO_USER.id}</strong>
          <br />
          비밀번호: <strong>{DEMO_USER.password}</strong>
        </p>
        {page !== "login" && (
          <Button onClick={() => go("login")}>데모 계정으로 로그인</Button>
        )}
      </div>
      <button className="text-button centered" onClick={continueReading}>
        로그인하지 않고 계속 읽기
      </button>
      <p className="auth-note">
        데모 로그인 · 로그인 상태는 이 브라우저에 저장돼요.
        <br />
        입력한 이메일과 비밀번호는 저장하지 않아요.
      </p>
    </section>
  );
}
