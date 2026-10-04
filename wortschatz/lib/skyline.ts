// 단어 수에 따라 양쪽 가장자리부터 하나씩 늘어나는 픽셀 도시 (순수 함수)

export type BuildingType = "flat" | "antenna" | "house" | "stepped" | "water";
export type Side = "L" | "R";
export type BuildingSpec = { side: Side; w: number; h: number; type: BuildingType };
export type Placed = BuildingSpec & { i: number; x: number };

// i번째 건물이 생기는 등록 단어 수
export const THRESHOLDS = [5, 15, 30, 50, 75, 100, 140, 180, 230, 300, 380, 480, 600, 800];

// 생기는 순서대로: 짝수는 왼쪽, 홀수는 오른쪽 (바깥에서 안쪽으로 자란다)
export const SPECS: BuildingSpec[] = [
  { side: "L", w: 30, h: 56, type: "flat" },
  { side: "R", w: 34, h: 66, type: "antenna" },
  { side: "L", w: 26, h: 40, type: "house" },
  { side: "R", w: 28, h: 46, type: "flat" },
  { side: "L", w: 34, h: 78, type: "antenna" },
  { side: "R", w: 30, h: 52, type: "water" },
  { side: "L", w: 28, h: 60, type: "flat" },
  { side: "R", w: 36, h: 92, type: "stepped" },
  { side: "L", w: 32, h: 48, type: "house" },
  { side: "R", w: 26, h: 70, type: "flat" },
  { side: "L", w: 38, h: 100, type: "stepped" },
  { side: "R", w: 30, h: 44, type: "house" },
  { side: "L", w: 30, h: 72, type: "flat" },
  { side: "R", w: 34, h: 84, type: "antenna" },
];

export const GAP = 3;
export const VIEW_H = 128; // 건물(지붕/안테나 포함)이 들어가는 높이

export function buildingCount(words: number): number {
  return THRESHOLDS.filter((t) => words >= t).length;
}

export function nextThreshold(words: number): number | null {
  return THRESHOLDS.find((t) => words < t) ?? null;
}

// 한쪽에 건물이 차지하는 최대 가로 길이
export const SIDE_EXTENT = Math.max(
  ...(["L", "R"] as Side[]).map((s) =>
    SPECS.filter((b) => b.side === s).reduce((a, b) => a + b.w + GAP, 0)
  )
);

// 좁은 화면에서는 양쪽 건물이 가운데서 겹치지 않도록 축소한다 (최대 1배).
export function skylineScale(width: number): number {
  return Math.min(1, width / (2 * SIDE_EXTENT + 20));
}

// width는 축소 전 좌표계의 가로 길이(= 화면 너비 / scale)
export function layoutSkyline(width: number): Placed[] {
  const cum: Record<Side, number> = { L: 0, R: 0 };
  return SPECS.map((b, i) => {
    const x = b.side === "L" ? cum.L : width - cum.R - b.w;
    cum[b.side] += b.w + GAP;
    return { ...b, i, x };
  });
}

// 창문 점등용 결정적 의사난수 (렌더마다 같은 결과)
export function rnd(i: number, j: number, k: number): number {
  const x = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return x - Math.floor(x);
}
