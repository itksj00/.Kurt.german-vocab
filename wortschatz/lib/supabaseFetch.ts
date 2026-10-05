import { supabase } from "./supabaseClient";

// Supabase는 한 번에 최대 1000행만 돌려주므로, 전체가 필요할 때(중복 검사 등) 나눠서 모두 읽는다.
export async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    out.push(...page);
    if (page.length < size) break;
  }
  return out;
}
