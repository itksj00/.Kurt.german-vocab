"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const TABS = [
  { href: "/words", ko: "단어 목록", de: "Wortliste" },
  { href: "/words/add", ko: "단어 추가", de: "Wort hinzufügen" },
  { href: "/sort", ko: "분류", de: "Sortieren" },
  { href: "/patterns", ko: "패턴 목록", de: "Musterliste" },
  { href: "/patterns/add", ko: "패턴 추가", de: "Muster hinzufügen" },
  { href: "/quiz", ko: "퀴즈", de: "Quiz" },
  { href: "/memo", ko: "독독독 오늘의 암기", de: "Auswendig lernen" },
  { href: "/review", ko: "복습항목", de: "Wiederholung" },
  { href: "/settings", ko: "설정", de: "Einstellungen" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  // 분류 대기 단어 수: 페이지 이동, 창 포커스, 분류/가져오기/삭제 때 다시 센다.
  useEffect(() => {
    let active = true;
    async function load() {
      const [w, p] = await Promise.all([
        supabase.from("words").select("id", { count: "exact", head: true }).is("sorted_at", null),
        supabase.from("patterns").select("id", { count: "exact", head: true }).is("sorted_at", null),
      ]);
      // patterns 테이블이 아직 없어도(SQL 실행 전) 단어 수는 표시한다.
      if (active && !w.error) setPending((w.count ?? 0) + (p.error ? 0 : (p.count ?? 0)));
    }
    load();
    window.addEventListener("focus", load);
    window.addEventListener("wortschatz:sort-changed", load);
    window.addEventListener("wortschatz:words-changed", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("wortschatz:sort-changed", load);
      window.removeEventListener("wortschatz:words-changed", load);
    };
  }, [pathname]);

  return (
    <nav className="site-nav">
      {TABS.map((tab) => {
        let active = pathname.startsWith(tab.href);
        if (tab.href === "/words" && pathname.startsWith("/words/add")) {
          active = false;
        }
        if (tab.href === "/patterns" && pathname.startsWith("/patterns/add")) {
          active = false;
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "active" : ""}
          >
            {tab.ko}
            {tab.href === "/sort" && pending > 0 && (
              <span className="nav-badge">{pending}</span>
            )}
            <small>{tab.de}</small>
          </Link>
        );
      })}
    </nav>
  );
}
