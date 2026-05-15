import Link from "next/link";

const modules = [
  {
    id: "pay-calculator",
    icon: "✈️",
    title: "파일럿 급여 계산기",
    titleEn: "Pilot Pay Calculator",
    description: "항공사별 급여 체계, 수당, 세후 실수령액을 정밀 계산합니다.",
    status: "ONLINE",
    statusColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
    dotShadow: "0 0 6px #34d399",
    tag: "FINANCE",
    href: "/pay-calculator",
  },
  {
    id: "logbook",
    icon: "📒",
    title: "전자 로그북",
    titleEn: "Electronic Logbook",
    description: "운항기록부 사진을 업로드하면 Claude Vision이 자동 파싱 후 Supabase에 저장합니다.",
    status: "ONLINE",
    statusColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
    dotShadow: "0 0 6px #34d399",
    tag: "FLIGHT",
    href: "/logbook",
  },
  {
    id: "portfolio",
    icon: "📈",
    title: "투자 포트폴리오",
    titleEn: "Investment Portfolio",
    description: "주식, ETF, 채권 포트폴리오를 통합 관리하고 수익률을 추적합니다.",
    status: "STANDBY",
    statusColor: "text-yellow-400",
    dotColor: "bg-yellow-400",
    dotShadow: "0 0 6px #facc15",
    tag: "INVEST",
    href: "/portfolio",
  },
  {
    id: "game",
    icon: "🎮",
    title: "게임 / 밈코인",
    titleEn: "Gaming & Meme Coins",
    description: "밈코인 시세 모니터링, 게임 자산 추적, 수익 현황을 분석합니다.",
    status: "STANDBY",
    statusColor: "text-yellow-400",
    dotColor: "bg-yellow-400",
    dotShadow: "0 0 6px #facc15",
    tag: "CRYPTO",
    href: "/game",
  },
  {
    id: "trading",
    icon: "📊",
    title: "주식 자동매매",
    titleEn: "Auto Trading System",
    description: "알고리즘 기반 자동매매 전략을 설계하고 백테스트를 실행합니다.",
    status: "STANDBY",
    statusColor: "text-yellow-400",
    dotColor: "bg-yellow-400",
    dotShadow: "0 0 6px #facc15",
    tag: "ALGO",
    href: "/trading",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen grid-bg relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-lg border border-cyan-400/60 flex items-center justify-center bg-cyan-500/10"
                  style={{ boxShadow: "0 0 15px rgba(0,212,255,0.3)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-cyan-300" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.357 2.059l.96.38a2.25 2.25 0 001.354.013l.94-.376A2.25 2.25 0 0019.5 8.818V3.186m-9.75-.082A23.9 23.9 0 003 5.25M14.25 3.104A23.9 23.9 0 0121 5.25" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold tracking-[0.3em] text-cyan-300 logo-flicker glow-text font-mono">
                  JUVIS
                </h1>
              </div>
              <p className="text-[11px] text-cyan-500/70 tracking-widest font-mono uppercase ml-[52px]">
                Jusub&apos;s Unified Virtual Intelligence System
              </p>
            </div>

            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="status-dot" />
                <span className="text-xs font-mono text-cyan-400 tracking-wider">SYSTEM ONLINE</span>
              </div>
              <p className="text-xs text-cyan-600 font-mono">v2.5.0 — BUILD 20260515</p>
              <p className="text-xs text-cyan-700 font-mono mt-0.5">
                {modules.filter((m) => m.status === "ONLINE").length} / {modules.length} MODULES ACTIVE
              </p>
            </div>
          </div>

          <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
          <div className="mt-0.5 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />
        </header>

        {/* Greeting */}
        <div className="mb-8 font-mono">
          <p className="text-sm text-cyan-400/80">
            <span className="text-cyan-600">›</span>{" "}
            Good day, Jusub. All systems nominal. How can I assist you today?
          </p>
        </div>

        {/* Module grid */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono text-cyan-600 tracking-widest uppercase">Modules</span>
            <div className="flex-1 h-px bg-cyan-500/15" />
            <span className="text-xs font-mono text-cyan-700">
              {modules.filter((m) => m.status === "ONLINE").length} online / {modules.length} total
            </span>
          </div>

          {/* 2-2-1 grid layout */}
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {modules.slice(0, 4).map((mod) => (
                <ModuleCard key={mod.id} mod={mod} />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {modules.slice(4).map((mod) => (
                <ModuleCard key={mod.id} mod={mod} />
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-cyan-500/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-cyan-700">
            <p>JUVIS CORE © 2026 — PERSONAL USE ONLY</p>
            <div className="flex items-center gap-4">
              <span>Powered by Next.js 14 + Claude AI</span>
              <span className="flex items-center gap-1.5">
                <div className="status-dot" style={{ width: 6, height: 6 }} />
                SECURE
              </span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function ModuleCard({ mod }: { mod: typeof modules[0] }) {
  return (
    <Link href={mod.href} className="group block">
      <div className="juvis-card cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{mod.icon}</span>
            <div>
              <p className="text-[10px] font-mono text-cyan-600 tracking-widest mb-0.5">[{mod.tag}]</p>
              <h2 className="text-base font-semibold text-cyan-100 group-hover:text-cyan-300 transition-colors">
                {mod.title}
              </h2>
              <p className="text-[10px] font-mono text-cyan-600/60 mt-0.5">{mod.titleEn}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1 shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${mod.dotColor}`} style={{ boxShadow: mod.dotShadow }} />
            <span className={`text-[10px] font-mono tracking-wider ${mod.statusColor}`}>{mod.status}</span>
          </div>
        </div>
        <p className="text-sm text-cyan-300/60 leading-relaxed group-hover:text-cyan-300/80 transition-colors">
          {mod.description}
        </p>
        <div className="mt-5 pt-4 border-t border-cyan-500/10 flex items-center justify-between">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-4 h-0.5 rounded-full bg-cyan-500/20 group-hover:bg-cyan-500/50 transition-colors" />
            ))}
          </div>
          <span className="text-[10px] font-mono text-cyan-600 group-hover:text-cyan-400 transition-colors tracking-widest">
            {mod.status === "ONLINE" ? "ENTER MODULE →" : "COMING SOON"}
          </span>
        </div>
      </div>
    </Link>
  );
}
