// 같은 단어는 항상 같은 몬스터가 나오도록, 단어 문자열을 해시 → 시드로 삼아
// 전부 결정적으로 생성한다. 실제 포켓몬 이미지/이름을 쓰지 않는 완전 오리지널 디자인.

export type BodyShape = "round" | "oval" | "blocky" | "spiky";
export type Pattern = "plain" | "spots" | "stripes";
export type Appendage = "none" | "ears" | "horn" | "wings" | "tail" | "antenna";
export type EyeStyle = "open" | "closed";
export type MouthStyle = "smile" | "neutral" | "open";

export type MonsterSpec = {
  dexNumber: number;
  typeKo: string;
  typeDe: string;
  hueBase: number;
  hueAccent: number;
  bodyShape: BodyShape;
  pattern: Pattern;
  appendage: Appendage;
  eyeStyle: EyeStyle;
  mouthStyle: MouthStyle;
};

const TYPES: { ko: string; de: string; hue: number }[] = [
  { ko: "불꽃형", de: "Feuer-Typ", hue: 14 },
  { ko: "물형", de: "Wasser-Typ", hue: 205 },
  { ko: "풀형", de: "Pflanzen-Typ", hue: 115 },
  { ko: "전기형", de: "Elektro-Typ", hue: 48 },
  { ko: "바위형", de: "Gesteins-Typ", hue: 30 },
  { ko: "비행형", de: "Flug-Typ", hue: 195 },
  { ko: "얼음형", de: "Eis-Typ", hue: 185 },
  { ko: "신비형", de: "Mysteriös", hue: 270 },
  { ko: "어둠형", de: "Dunkel-Typ", hue: 250 },
  { ko: "빛형", de: "Licht-Typ", hue: 45 },
];

function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

// mulberry32: 작고 빠른 결정적 시드 PRNG.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function generateMonsterSpec(rawWord: string): MonsterSpec {
  const key = rawWord.trim().toLowerCase() || "?";
  const seed = hashString(key);
  const rand = mulberry32(seed);

  const dexNumber = (seed % 999) + 1;
  const type = pick(rand, TYPES);
  const hueBase = (type.hue + Math.floor(rand() * 24 - 12) + 360) % 360;
  const hueAccent = (hueBase + 28 + Math.floor(rand() * 24)) % 360;

  const bodyShape = pick(rand, [
    "round",
    "oval",
    "blocky",
    "spiky",
  ] as const);
  const pattern = pick(rand, ["plain", "spots", "stripes"] as const);
  const appendage = pick(rand, [
    "none",
    "none",
    "ears",
    "horn",
    "wings",
    "tail",
    "antenna",
  ] as const);
  const eyeStyle = pick(rand, ["open", "closed"] as const);
  const mouthStyle = pick(rand, ["smile", "neutral", "open"] as const);

  return {
    dexNumber,
    typeKo: type.ko,
    typeDe: type.de,
    hueBase,
    hueAccent,
    bodyShape,
    pattern,
    appendage,
    eyeStyle,
    mouthStyle,
  };
}
