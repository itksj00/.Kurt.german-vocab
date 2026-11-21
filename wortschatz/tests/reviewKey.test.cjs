// 실행: npx tsc lib/reviewKey.ts --outDir /tmp/x7 --module commonjs --target es2022 --skipLibCheck  후  node tests/reviewKey.test.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("assert");
const { reviewKeyAction } = require("/tmp/x7/reviewKey.js");
const ev = (key, o = {}) => ({ key, repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, ...o });

assert.strictEqual(reviewKeyAction(ev("ArrowRight")), "known");
assert.strictEqual(reviewKeyAction(ev("ArrowLeft")), "unknown");
assert.strictEqual(reviewKeyAction(ev("z")), "undo");
assert.strictEqual(reviewKeyAction(ev("Z")), "undo");
assert.strictEqual(reviewKeyAction(ev("ArrowUp")), "flip");
assert.strictEqual(reviewKeyAction(ev("ArrowDown")), "flip");
// 스페이스는 더 이상 동작하지 않음
assert.strictEqual(reviewKeyAction(ev(" ")), null);
// 꾹 누르기는 한 번만
assert.strictEqual(reviewKeyAction(ev("ArrowUp", { repeat: true })), null);
assert.strictEqual(reviewKeyAction(ev("ArrowDown", { repeat: true })), null);
// 입력창, 조합키, IME 조합 중에는 무시
for (const t of ["INPUT", "TEXTAREA", "SELECT"]) assert.strictEqual(reviewKeyAction(ev("ArrowUp", { targetTag: t })), null);
assert.strictEqual(reviewKeyAction(ev("ArrowDown", { ctrlKey: true })), null);
assert.strictEqual(reviewKeyAction(ev("ArrowDown", { metaKey: true })), null);
assert.strictEqual(reviewKeyAction(ev("ArrowUp", { isComposing: true })), null);
assert.strictEqual(reviewKeyAction(ev("ArrowRight", { altKey: true })), null);
assert.strictEqual(reviewKeyAction(ev("a")), null);
console.log("reviewKey: all tests passed");
