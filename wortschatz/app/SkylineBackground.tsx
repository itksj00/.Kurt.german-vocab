"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  VIEW_H,
  buildingCount,
  layoutSkyline,
  rnd,
  skylineScale,
  type Placed,
} from "@/lib/skyline";

const BODY = "#3a2d9e";
const SHADE = "#2a1f7a";
const TOP = "#5445c4";
const WIN = "#f2c94c";
const LIGHT = "#e86a92";

function Building({ b }: { b: Placed }) {
  const { x, w, h, i, type } = b;
  const y = VIEW_H - h;
  const cols = Math.max(1, Math.floor((w - 8) / 8));
  const rows = Math.max(1, Math.floor((h - 10) / 10));
  const offX = x + (w - (cols * 8 - 4)) / 2;
  const wins = [];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      if (rnd(i, r, k) > 0.4) {
        wins.push(
          <rect key={`${r}-${k}`} x={offX + k * 8} y={y + 7 + r * 10} width={4} height={5} fill={WIN} />
        );
      }
    }
  }
  return (
    <g>
      {type === "house" && (
        <polygon points={`${x - 2},${y} ${x + w + 2},${y} ${x + w / 2},${y - 10}`} fill={TOP} />
      )}
      {type === "stepped" && (
        <>
          <rect x={x + 6} y={y - 8} width={w - 12} height={8} fill={BODY} />
          <rect x={x + w / 2 - 1} y={y - 16} width={2} height={8} fill={TOP} />
          <rect x={x + w / 2 - 2} y={y - 18} width={4} height={2} fill={LIGHT} className="sk-blink" />
        </>
      )}
      {type === "antenna" && (
        <>
          <rect x={x + w / 2 - 1} y={y - 12} width={2} height={12} fill={TOP} />
          <rect x={x + w / 2 - 2} y={y - 14} width={4} height={2} fill={LIGHT} className="sk-blink" />
        </>
      )}
      {type === "water" && (
        <>
          <rect x={x + w / 2 - 4} y={y - 5} width={1} height={5} fill={TOP} />
          <rect x={x + w / 2 + 3} y={y - 5} width={1} height={5} fill={TOP} />
          <rect x={x + w / 2 - 5} y={y - 11} width={10} height={6} fill={TOP} />
        </>
      )}
      <rect x={x} y={y} width={w} height={h} fill={BODY} />
      <rect x={x} y={y} width={2} height={h} fill={SHADE} />
      <rect x={x} y={y} width={w} height={2} fill={TOP} />
      {wins}
    </g>
  );
}

export default function SkylineBackground() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [words, setWords] = useState(0);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  // 페이지 이동, 창 포커스, 단어 변경 알림(가져오기/전체 삭제) 때 단어 수를 다시 센다.
  useEffect(() => {
    let active = true;
    async function load() {
      const { count, error } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true });
      if (active && !error) setWords(count ?? 0);
    }
    load();
    window.addEventListener("focus", load);
    window.addEventListener("wortschatz:words-changed", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("wortschatz:words-changed", load);
    };
  }, [pathname]);

  if (width === 0) return null;
  const scale = skylineScale(width);
  const placed = layoutSkyline(width / scale);
  const unlocked = buildingCount(words);

  return (
    <svg
      className="skyline-bg"
      aria-hidden="true"
      width={width}
      height={VIEW_H * scale}
      viewBox={`0 0 ${width / scale} ${VIEW_H}`}
      shapeRendering="crispEdges"
    >
      {placed.map((b) =>
        b.i < unlocked ? (
          <Building key={b.i} b={b} />
        ) : (
          <rect
            key={b.i}
            x={b.x}
            y={VIEW_H - b.h}
            width={b.w}
            height={b.h}
            fill={BODY}
            opacity={0.09}
          />
        )
      )}
    </svg>
  );
}
