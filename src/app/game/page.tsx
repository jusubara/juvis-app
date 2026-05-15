import Link from "next/link";

export default function GamePage() {
  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-center relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>
      <div className="relative z-10 text-center px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-600 hover:text-cyan-400 transition-colors mb-10">
          ← JUVIS
        </Link>
        <div className="text-6xl mb-6">🎮</div>
        <p className="text-[10px] font-mono text-cyan-600 tracking-widest mb-2">[CRYPTO]</p>
        <h1 className="text-2xl font-bold text-cyan-300 font-mono glow-text mb-1">게임 / 밈코인</h1>
        <p className="text-xs text-cyan-600 font-mono mb-10">Gaming & Meme Coins</p>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-yellow-500/40 bg-yellow-500/10">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ boxShadow: "0 0 6px #facc15" }} />
          <span className="text-xs font-mono text-yellow-400 tracking-widest">UNDER CONSTRUCTION</span>
        </div>
        <p className="mt-6 text-sm text-cyan-600/60 font-mono">이 모듈은 개발 중입니다.</p>
      </div>
    </main>
  );
}
