// 실행: npx tsc app/useEnterAdvance.ts lib/enterKey.ts --outDir /tmp/x5 --module commonjs --target es2022 --skipLibCheck --esModuleInterop --jsx react-jsx 후
//       NODE_PATH=$PWD/node_modules:/tmp/jsd/node_modules node tests/useEnterAdvance.test.cjs   (jsdom은 이 테스트에만 필요: npm i --no-save jsdom)
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><body><div id='root'></div></body>", { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = React;
const { useEnterAdvance } = require("/tmp/x5/app/useEnterAdvance.js");

const calls = [];
function App({ enabled }) {
  const [n, setN] = React.useState(0);
  useEnterAdvance(enabled, () => {
    calls.push(n); // 최신 상태를 보는지 확인
  });
  return React.createElement(
    "div",
    null,
    React.createElement("button", { id: "plain", onClick: () => setN((x) => x + 1) }, "btn"),
    React.createElement("input", { id: "inp" }),
    React.createElement("input", { id: "dis", disabled: true }),
    React.createElement("textarea", { id: "ta" }),
    React.createElement("button", { id: "off", disabled: true }, "off")
  );
}

function press(target, init = {}) {
  const e = new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

(async () => {
  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(App, { enabled: true })));

  // 1) body / 입력 칸 / 잠긴 입력 칸 / textarea 에서 Enter → 한 번씩만 실행, 기본 동작 취소
  for (const target of [document.body, document.getElementById("inp"), document.getElementById("dis"), document.getElementById("ta")]) {
    calls.length = 0;
    let e;
    await act(async () => { e = press(target); });
    assert.strictEqual(calls.length, 1, `${target.id || "body"}: 정확히 1번 실행`);
    assert.strictEqual(e.defaultPrevented, true);
  }

  // 2) 포커스된 일반 버튼의 Enter는 브라우저가 처리 (훅은 개입하지 않음 → 이중 실행 방지)
  calls.length = 0;
  let e;
  await act(async () => { e = press(document.getElementById("plain")); });
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(e.defaultPrevented, false);

  // 3) 비활성화된 버튼(방금 누른 보기)에 포커스가 남은 경우는 실행
  calls.length = 0;
  await act(async () => { press(document.getElementById("off")); });
  assert.strictEqual(calls.length, 1);

  // 4) 길게 누름 / 한글 조합 / Shift+Enter / 다른 키는 무시
  calls.length = 0;
  await act(async () => {
    press(document.body, { repeat: true });
    press(document.getElementById("inp"), { isComposing: true });
    press(document.getElementById("ta"), { shiftKey: true });
    press(document.body, { key: "a" });
  });
  assert.strictEqual(calls.length, 0);

  // 5) 콜백은 항상 최신 상태를 본다 (버튼을 눌러 상태가 바뀐 뒤 Enter)
  await act(async () => { document.getElementById("plain").click(); });
  await act(async () => { document.getElementById("plain").click(); });
  calls.length = 0;
  await act(async () => { press(document.body); });
  assert.deepStrictEqual(calls, [2]);

  // 6) enabled=false 이면 리스너가 없다 / 다시 켜면 동작
  await act(async () => root.render(React.createElement(App, { enabled: false })));
  calls.length = 0;
  await act(async () => { press(document.body); });
  assert.strictEqual(calls.length, 0);
  await act(async () => root.render(React.createElement(App, { enabled: true })));
  await act(async () => { press(document.body); });
  assert.strictEqual(calls.length, 1);

  // 7) 언마운트 후에는 리스너가 남지 않는다
  await act(async () => root.unmount());
  calls.length = 0;
  press(document.body);
  assert.strictEqual(calls.length, 0);

  console.log("useEnterAdvance: all tests passed");
})().catch((err) => { console.error(err); process.exit(1); });
