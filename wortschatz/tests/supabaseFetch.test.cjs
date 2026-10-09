// 실행: npx tsc lib/supabaseFetch.ts --outDir /tmp/x --module commonjs --target es2022 --skipLibCheck --esModuleInterop  후  node tests/supabaseFetch.test.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("module");
const assert = require("assert");

let TOTAL = 2500;
let FAIL_AT = -1; // 해당 from 위치에서 에러를 낸다
const calls = [];

// supabase 쿼리 빌더 흉내: 체이닝 후 range()에서 1000행 상한을 지켜 돌려준다.
function makeBuilder(table) {
  const st = { table, filters: [], orders: [] };
  const b = {
    select: (c) => ((st.columns = c), b),
    is: (c, v) => (st.filters.push(["is", c, v]), b),
    not: (c, op, v) => (st.filters.push(["not", c, op, v]), b),
    order: (c, o) => (st.orders.push([c, o.ascending]), b),
    range: async (from, to) => {
      calls.push({ ...st, from, to });
      if (from === FAIL_AT) return { data: null, error: { message: "boom" } };
      const end = Math.min(to, from + 999, TOTAL - 1);
      const data = [];
      for (let i = from; i <= end; i++) data.push({ id: i + 1 });
      return { data, error: null };
    },
  };
  return b;
}
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === "./supabaseClient") return { supabase: { from: makeBuilder } };
  return orig.call(this, req, ...rest);
};
const { fetchAllRows } = require("/tmp/x/supabaseFetch.js");

(async () => {
  // 1) 1000행을 넘어도 전부, 중복 없이
  let rows = await fetchAllRows("words", "id");
  assert.strictEqual(rows.length, 2500);
  assert.strictEqual(new Set(rows.map((r) => r.id)).size, 2500);
  assert.deepStrictEqual(calls.map((c) => [c.from, c.to]), [[0, 999], [1000, 1999], [2000, 2999]]);

  // 2) 정확히 1000의 배수여도 끝까지 확인(빈 페이지로 종료)
  TOTAL = 2000; calls.length = 0;
  rows = await fetchAllRows("words", "id");
  assert.strictEqual(rows.length, 2000);
  assert.strictEqual(calls.length, 3);

  // 3) 행이 적으면 1번만 호출
  TOTAL = 5; calls.length = 0;
  rows = await fetchAllRows("words", "id");
  assert.strictEqual(rows.length, 5);
  assert.strictEqual(calls.length, 1);

  // 4) 빈 테이블
  TOTAL = 0;
  assert.deepStrictEqual(await fetchAllRows("words", "id"), []);

  // 5) 정렬 + 필터: 지정 정렬 뒤에 id 보조 정렬이 항상 붙고, 필터가 적용된다
  TOTAL = 3; calls.length = 0;
  await fetchAllRows("words", "id", { order: { column: "created_at", ascending: false }, sorted: "pending" });
  assert.deepStrictEqual(calls[0].orders, [["created_at", false], ["id", true]]);
  assert.deepStrictEqual(calls[0].filters, [["is", "sorted_at", null]]);
  calls.length = 0;
  await fetchAllRows("words", "id", { order: { column: "word" }, sorted: "done" });
  assert.deepStrictEqual(calls[0].orders, [["word", true], ["id", true]]);
  assert.deepStrictEqual(calls[0].filters, [["not", "sorted_at", "is", null]]);
  calls.length = 0;
  await fetchAllRows("words", "id");
  assert.deepStrictEqual(calls[0].orders, [["id", true]]);
  assert.deepStrictEqual(calls[0].filters, []);

  // 6) 중간 페이지 에러는 던진다
  TOTAL = 2500; FAIL_AT = 1000;
  await assert.rejects(() => fetchAllRows("words", "id"), /boom/);

  console.log("supabaseFetch: all tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
