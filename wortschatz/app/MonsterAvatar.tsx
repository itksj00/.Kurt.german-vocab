"use client";

import { useId, useMemo } from "react";
import { generateMonsterSpec } from "@/lib/monster";
import type { BodyShape } from "@/lib/monster";

function BodyPath({
  shape,
  fill,
  id,
}: {
  shape: BodyShape;
  fill: string;
  id?: string;
}) {
  switch (shape) {
    case "round":
      return <circle id={id} cx="50" cy="55" r="32" fill={fill} />;
    case "oval":
      return <ellipse id={id} cx="50" cy="55" rx="26" ry="34" fill={fill} />;
    case "blocky":
      return (
        <rect id={id} x="20" y="24" width="60" height="60" rx="16" fill={fill} />
      );
    case "spiky": {
      const points = 8;
      const rOuter = 34;
      const rInner = 21;
      let d = "";
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? rOuter : rInner;
        const angle = (Math.PI * i) / points;
        const x = 50 + r * Math.sin(angle);
        const y = 55 - r * Math.cos(angle);
        d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
      }
      d += "Z";
      return <path id={id} d={d} fill={fill} />;
    }
  }
}

export default function MonsterAvatar({
  word,
  size = 40,
}: {
  word: string;
  size?: number;
}) {
  const spec = useMemo(() => generateMonsterSpec(word), [word]);
  const rawId = useId();
  const clipId = `mon-clip-${rawId.replace(/:/g, "")}`;

  const bodyFill = `hsl(${spec.hueBase} 62% 62%)`;
  const accentFill = `hsl(${spec.hueAccent} 60% 55%)`;
  const darkFill = `hsl(${spec.hueBase} 40% 32%)`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${spec.typeKo} 몬스터`}
    >
      <defs>
        <clipPath id={clipId}>
          <BodyPath shape={spec.bodyShape} fill="white" />
        </clipPath>
      </defs>

      {/* 날개: 몸통보다 뒤에 그려서 등 뒤에서 나오는 것처럼 보이게 함 */}
      {spec.appendage === "wings" && (
        <>
          <ellipse
            cx="16"
            cy="55"
            rx="13"
            ry="21"
            fill={accentFill}
            opacity={0.85}
            transform="rotate(-25 16 55)"
          />
          <ellipse
            cx="84"
            cy="55"
            rx="13"
            ry="21"
            fill={accentFill}
            opacity={0.85}
            transform="rotate(25 84 55)"
          />
        </>
      )}

      <BodyPath shape={spec.bodyShape} fill={bodyFill} />

      {/* 무늬: 몸통 모양으로 클리핑 */}
      <g clipPath={`url(#${clipId})`}>
        {spec.pattern === "spots" && (
          <>
            <circle cx="36" cy="42" r="6" fill={accentFill} opacity={0.55} />
            <circle cx="64" cy="48" r="5" fill={accentFill} opacity={0.55} />
            <circle cx="48" cy="72" r="7" fill={accentFill} opacity={0.5} />
            <circle cx="70" cy="70" r="4" fill={accentFill} opacity={0.5} />
          </>
        )}
        {spec.pattern === "stripes" && (
          <>
            <rect
              x="10"
              y="40"
              width="90"
              height="8"
              fill={accentFill}
              opacity={0.5}
              transform="rotate(-18 55 44)"
            />
            <rect
              x="10"
              y="62"
              width="90"
              height="8"
              fill={accentFill}
              opacity={0.5}
              transform="rotate(-18 55 66)"
            />
          </>
        )}
      </g>

      {spec.appendage === "ears" && (
        <>
          <circle cx="31" cy="25" r="8" fill={bodyFill} />
          <circle cx="69" cy="25" r="8" fill={bodyFill} />
        </>
      )}
      {spec.appendage === "horn" && (
        <polygon points="50,8 43,28 57,28" fill={accentFill} />
      )}
      {spec.appendage === "antenna" && (
        <>
          <line
            x1="50"
            y1="24"
            x2="50"
            y2="8"
            stroke={accentFill}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx="50" cy="6" r="4" fill={accentFill} />
        </>
      )}
      {spec.appendage === "tail" && (
        <path
          d="M74,78 Q94,88 88,66"
          stroke={accentFill}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* 눈 */}
      {spec.eyeStyle === "open" ? (
        <>
          <circle cx="39" cy="50" r="7" fill="#fff" />
          <circle cx="61" cy="50" r="7" fill="#fff" />
          <circle cx="40.5" cy="51" r="3.4" fill={darkFill} />
          <circle cx="62.5" cy="51" r="3.4" fill={darkFill} />
        </>
      ) : (
        <>
          <path
            d="M33,50 Q39,44 45,50"
            stroke={darkFill}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M55,50 Q61,44 67,50"
            stroke={darkFill}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}

      {/* 입 */}
      {spec.mouthStyle === "smile" && (
        <path
          d="M42,66 Q50,72 58,66"
          stroke={darkFill}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {spec.mouthStyle === "neutral" && (
        <line
          x1="44"
          y1="68"
          x2="56"
          y2="68"
          stroke={darkFill}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      )}
      {spec.mouthStyle === "open" && (
        <ellipse cx="50" cy="68" rx="6" ry="5" fill={darkFill} />
      )}
    </svg>
  );
}
