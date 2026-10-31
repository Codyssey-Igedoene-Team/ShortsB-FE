# shortB React 프론트엔드

기존 HTML 시안의 디자인과 기능을 React + TypeScript 컴포넌트로 옮긴 개발 프로젝트입니다. 개발 서버는 Vite를 사용하며, 동일한 React 소스에서 팀 검토용 개별 HTML도 생성합니다.

## 실행

Node.js 22.12 이상에서 프로젝트 폴더를 열고 실행합니다.

```sh
npm ci
npm run dev
```

터미널에 표시된 로컬 주소로 접속합니다. 기본 주소는 `http://127.0.0.1:5173/`입니다.

```sh
npm test         # 독서·기록·추천·저장·로그인·화면 전환 테스트
npm run build    # TypeScript 검사 후 dist/ 생성
npm run preview  # 생성된 결과 확인
```

- `/`: 로그인 상태면 홈, 비로그인 상태면 첫 독서 체험·계정 안내
- `/home`: 오늘 읽기 (로그인 필요)
- `/book?book=waiting`: 특정 책 상세
- `/reader?book=waiting`: 특정 책 읽기
- `/complete?book=waiting`: 독서 완료
- 빌드 후 `/pages.html`: 25개 화면의 전체 목록

화면을 이동할 때는 React 상태와 History API를 사용하며 주소에 `.html`을 붙이지 않습니다. 기존 `.html` 링크도 열 수 있으며 앱이 시작되면 확장자 없는 주소로 정리합니다. Vite 개발 서버와 `npm run preview`는 직접 접속과 새로고침을 지원합니다. 다른 서버에 배포할 때는 `/complete`처럼 실제 파일이 없는 경로에 `index.html`을 반환하는 SPA fallback 설정이 필요합니다. 빌드의 개별 HTML은 검토용으로 유지합니다.

## 구조

```text
src/
  App.tsx                    # Provider, Layout, Router 조합
  app/
    PageRouter.tsx           # 25개 경로 → React 페이지 컴포넌트
    routes.ts                # 주소 해석, URL 생성, 첫 방문 흐름
  layouts/AppLayout.tsx      # 헤더, 하단 메뉴, 알림, 본문 틀
  pages/                     # 독서·검색·책장·계정 등 화면
  components/                # 책 표지, 목표, 버튼, 공통 UI
  hooks/                     # 첫 체험 흐름, 실제 독서 시간 측정
  state/AppContext.tsx       # 앱 상태와 독서 액션 연결
  domain/                    # 추천, 페이지 진행, 기록, 저장 복원
  data/                      # 책 본문·출처·추천 관계·표지
scripts/                     # 본문 검증/가져오기, HTML 생성
content-source/              # 재빌드 가능한 원문과 완성 번역 스냅샷
public/fonts/                # 로컬 글꼴과 라이선스
```

페이지별 JSX와 상태가 실제 React로 구현되어 있습니다. 본문/입력값을 HTML 문자열로 합쳐 화면 전체를 교체하지 않습니다. 표지의 고정 SVG 도형만 검증된 로컬 데이터로 삽입합니다.

## 화면 분리 기준

**사용자가 수행하는 기능과 화면 전환 흐름**을 기준으로 나눕니다. 책마다 HTML이나 컴포넌트를 복제하지 않고 책 ID로 데이터를 바꿉니다. 추천 설정 3단계는 한 컴포넌트의 단계 상태로 처리합니다.

| 분류 | 경로 |
| --- | --- |
| 진입·독서 | index, trial, trial-done, home, book, reader, complete, discover |
| 추천·탐색 | setup, preferences, search |
| 기록 | library, calendar, highlights, goals |
| 계정 | login, signup, email, code, signup-password, recover, recover-sent |
| 기타 | settings, source, about |

## 유지한 기능과 검증

- 오늘 목표: 하루 1·3·5·10페이지 중 선택, 읽기 버튼 아래 읽은 양·남은 분량·진행선
- 이어읽기: 현재 판본·책·페이지·스크롤 위치로 복원
- 같은 책/같은 날 같은 페이지 중복 집계 방지
- 가나다순 검색, 형광펜, 대비 추천의 되돌아가는 순환 방지
- 비로그인 상태에서 첫 체험 완료 후 새로고침해도 계정 안내 유지
- 지정 데모 계정 로그인 시 바로 홈, 재방문 시 로그인 유지, 설정에서 로그아웃
- 비로그인 상태에서는 회원 메뉴 접근 차단, 로그인 안내를 거절하면 본문 계속 읽기
- 게스트와 로그인 사용자 모두 독서 완료 → 다른 관점 추천 → 비교 설명 → 추천 대목 읽기 연결
- 이전 판본 기록은 보관하고 새 한국어 판본에 옛 페이지 번호를 적용하지 않음
- 발표용 달력은 실제 기록과 분리

로그인 여부에 따른 진입·저장 복원과 기존 독서 흐름은 자동 테스트로 검증합니다. 상세 구조와 로그인 구현은 [프로젝트 분석](docs/project-analysis.md)을 참고하세요.

## 백엔드 연결 범위

현재 로그인·메일·AI 추천 API는 시연용입니다. **데모 아이디: `demo@shortb.com`, 비밀번호: `Shortb123!`** 조합만 로그인할 수 있습니다. 소셜 로그인과 신규 가입은 준비 중이며 로그인 상태를 만들지 않습니다. 로그인 상태는 localStorage의 앱 상태에 `demoAccountComplete`와 `demoUserId`로 저장합니다. 실제 계정 연결은 `AppContext`의 `login`과 초기 상태 복원, 계정 페이지를, 추천 API는 `domain/catalog.ts`의 추천 결과를 교체하는 지점에서 연결하면 됩니다. 인증번호 화면의 시연 번호는 `123456`입니다. 입력한 이메일/비밀번호는 저장하거나 전송하지 않습니다.

독서/취향 데이터는 해당 출처(origin)의 로컬 저장소에 보관됩니다. 서버 주소나 포트가 바뀌면 저장 영역이 달라집니다. 이전 시안 저장 키를 같은 출처에서 발견하면 새 키로 옮기며 원래 키는 덮어쓰지 않습니다.

로그아웃하면 회원 독서 기록은 별도 계정 저장 키에 보관하고, 현재 세션은 첫 방문 상태로 초기화합니다. 게스트 체험은 1페이지부터 시작하며, 새로고침이나 뒤로가기로 이전 회원 완료 화면을 열지 않습니다. 다시 데모 계정으로 로그인하면 보관한 회원 기록을 복원합니다.

## 본문과 번역

한국어 원문 2편 + AI 한국어 전문 번역 5편을 포함합니다. 다른 4편은 번역 중으로 본문이 열리지 않습니다. AI 번역은 전문 번역가 교열 전임을 출처 화면에 표시합니다.

기본 빌드는 저장소 안의 스냅샷만 사용합니다. 새 번역을 가져올 때만 아래처럼 경로를 지정합니다.

```sh
SHORTB_TRANSLATIONS=/path/to/translations npm run content
npm run build
```

원문 SHA, 전체 문단 순서, 빠진 문단, 원문 대조 검수 상태, 장 범위를 확인한 완성본만 반영합니다. 임의 요약이나 기존 출판 번역문으로 대체하지 않습니다.
