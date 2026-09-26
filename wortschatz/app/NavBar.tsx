"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/words", ko: "단어 목록", de: "Wortliste" },
  { href: "/words/add", ko: "단어 추가", de: "Wort hinzufügen" },
  { href: "/quiz", ko: "퀴즈", de: "Quiz" },
  { href: "/review", ko: "복습항목", de: "Wiederholung" },
  { href: "/settings", ko: "설정", de: "Einstellungen" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="top-nav">
      {TABS.map((tab) => {
        let active = pathname.startsWith(tab.href);
        if (tab.href === "/words" && pathname.startsWith("/words/add")) {
          active = false;
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "active" : ""}
          >
            {tab.ko}
            <small>{tab.de}</small>
          </Link>
        );
      })}
    </nav>
  );
}
