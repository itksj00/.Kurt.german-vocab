import { supabase } from "./supabaseClient";

export type FetchAllOptions = {
  // 정렬 기준. 같은 값이 여러 행이어도 페이지 경계에서 행이 빠지거나 겹치지 않도록 id를 보조 기준으로 항상 붙인다.
  order?: { column: string; ascending?: boolean };
  // "pending" = 분류 대기(sorted_at 없음), "done" = 분류 완료.
  sorted?: "pending" | "done";
};

// Supabase는 한 번에 최대 1000행만 돌려주므로, 전체가 필요할 때(중복 검사 등) 나눠서 모두 읽는다.
export async function fetchAllRows<T>(
  table: string,
  columns: string,
  opts: FetchAllOptions = {}
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    let q = supabase.from(table).select(columns);
    if (opts.sorted === "pending") q = q.is("sorted_at", null);
    if (opts.sorted === "done") q = q.not("sorted_at", "is", null);
    if (opts.order) q = q.order(opts.order.column, { ascending: opts.order.ascending ?? true });
    const { data, error } = await q
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    out.push(...page);
    if (page.length < size) break;
  }
  return out;
}
