import * as XLSX from "xlsx";

export type SheetRow = {
  sheet: string;
  rowNo: number; // 엑셀에서 보이는 행 번호 (헤더가 1행일 때 데이터는 2행부터)
  data: Record<string, unknown>;
};

// 통합 문서의 모든 시트에서 데이터 행을 읽는다. 완전히 빈 행은 건너뛴다.
// 일부 프로그램이 만든 파일은 !ref(범위)가 실제 데이터보다 작게 기록돼 뒤쪽 행이 잘리므로,
// 셀을 직접 훑어 범위를 다시 계산한다. (시작 위치는 원래 범위를 따른다)
export function readAllRows(wb: XLSX.WorkBook): SheetRow[] {
  const out: SheetRow[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const orig = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    let maxR = orig ? orig.e.r : -1;
    let maxC = orig ? orig.e.c : -1;
    for (const key of Object.keys(sheet)) {
      if (key.startsWith("!")) continue;
      const c = XLSX.utils.decode_cell(key);
      if (c.r > maxR) maxR = c.r;
      if (c.c > maxC) maxC = c.c;
    }
    if (maxR < 0) continue;
    const start = orig ? orig.s : { r: 0, c: 0 };
    sheet["!ref"] = XLSX.utils.encode_range({ s: start, e: { r: maxR, c: maxC } });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      blankrows: true,
    });
    rows.forEach((data, i) => {
      if (Object.values(data).every((v) => String(v ?? "").trim() === "")) return;
      out.push({ sheet: name, rowNo: start.r + i + 2, data });
    });
  }
  return out;
}
