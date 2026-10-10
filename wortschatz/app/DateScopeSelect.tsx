// 퀴즈 출제 범위 "날짜 선택": 추가한 날짜와 개수 드롭다운. 날짜를 고르면 onPick(날짜)이 호출된다.
export default function DateScopeSelect({
  options,
  value,
  noun,
  onPick,
}: {
  options: { date: string; count: number }[];
  value: string;
  noun: string;
  onPick: (date: string) => void;
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label>추가한 날짜 Datum</label>
      <select value={value} onChange={(e) => onPick(e.target.value)}>
        <option value="">날짜를 선택하세요 Datum wählen</option>
        {options.map((o) => (
          <option key={o.date} value={o.date}>
            {o.date} ({o.count}개)
          </option>
        ))}
      </select>
      <small className="muted">날짜를 고르면 그날 추가한 {noun} 퀴즈를 바로 시작합니다.</small>
    </div>
  );
}
