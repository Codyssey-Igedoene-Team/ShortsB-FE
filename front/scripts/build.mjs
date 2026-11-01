import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { loadEnv } from "vite";
const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
const env = loadEnv("production", root, "VITE_");
const define = {
  "process.env.NODE_ENV": '"production"',
  "import.meta.env": JSON.stringify({
    DEV: false,
    VITE_API_BASE_URL: env.VITE_API_BASE_URL ?? "http://localhost:8080",
  }),
};
// Regenerate only the dedicated build output; user source and the previous HTML stay intact.
fs.mkdirSync("dist/assets", { recursive: true });
fs.mkdirSync(".build", { recursive: true });
await build({
  entryPoints: ["src/main.tsx"],
  outfile: "dist/assets/app.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["safari16.4", "chrome111"],
  loader: { ".woff2": "file" },
  assetNames: "fonts/[name]-[hash]",
  metafile: true,
  define,
}).then((result) =>
  fs.writeFileSync(
    ".build/meta.json",
    JSON.stringify(result.metafile, null, 2),
  ),
);
await build({
  entryPoints: ["src/render.tsx"],
  outfile: ".build/render.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  define,
});
const { render, routes } = await import("../.build/render.mjs?" + Date.now());
const escape = (s) =>
  s
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
// Remove only the retired generated authentication pages from previous builds.
for (const page of [
  "email",
  "code",
  "signup-password",
  "recover",
  "recover-sent",
]) {
  fs.rmSync(path.join(root, "dist", `${page}.html`), { force: true });
}
for (const [page, title] of Object.entries(routes)) {
  const { html, data } = render(page);
  const doc = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#12675b"><title>shortB · ${title}</title><link rel="stylesheet" href="./assets/app.css"></head><body><div id="root">${html}</div><script id="shortb-bootstrap" type="application/json">${escape(JSON.stringify(data))}</script><script defer src="./assets/app.js"></script></body></html>`;
  fs.writeFileSync(`dist/${page}.html`, doc);
}
const groups = [
  [
    "독서 흐름",
    [
      "index",
      "trial",
      "trial-done",
      "home",
      "book",
      "reader",
      "complete",
      "discover",
    ],
  ],
  ["나의 기록", ["library", "calendar", "highlights", "goals"]],
  ["추천과 탐색", ["setup", "preferences", "search"]],
  ["소셜 로그인", ["signup", "login"]],
  ["앱 안내", ["settings", "source", "about"]],
];
fs.writeFileSync(
  "dist/pages.html",
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>shortB · 페이지 모음</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#fafaf7;color:#202a2a;margin:40px auto;padding:0 24px;max-width:900px;line-height:1.6}h1{font-size:36px}h2{font-size:20px;margin-top:38px}p{color:#65726d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}a{display:flex;flex-direction:column;padding:20px;border:1px solid #dce4d8;border-radius:13px;color:#12675b;text-decoration:none;background:#fff}a:hover{background:#edf3ec}small{font-size:11px;color:#65726d;margin-top:7px}footer{margin:50px 0;font-size:12px}</style></head><body><h1>shortB</h1><p>페이지별 검토용 HTML · 동일한 React 소스에서 생성합니다.</p><p>각 화면은 서로 연결됩니다. 첫 방문 흐름은 <a href="./" style="display:inline;padding:0;border:0">시작 화면</a>에서 확인하세요. 독서 완료 화면은 책을 읽은 뒤 내용이 표시됩니다.</p>${groups.map(([title, items]) => `<h2>${title}</h2><div class="grid">${items.map((p) => `<a href="${p}">${routes[p]}<small>${p}</small></a>`).join("")}</div>`).join("")}<footer>Google OAuth 로그인·서버 세션 인증 연결. 독서 기록과 추천은 브라우저에서 관리합니다. 완성된 한국어 번역만 가져오며 준비 중인 책은 본문을 열지 않습니다.</footer></body></html>`,
);
fs.cpSync("public/fonts", "dist/assets/licenses", {
  recursive: true,
  filter: (source) => !source.endsWith(".woff2"),
});
console.log(
  `Built ${Object.keys(routes).length} React-rendered HTML pages + pages.html. Shared assets emitted once.`,
);
