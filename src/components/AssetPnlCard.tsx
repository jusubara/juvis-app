const ASSET_PNL_URL = 'https://asset-pnl-app.vercel.app';

export default function AssetPnlCard() {
  return (
    <a
      href={ASSET_PNL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <div className="juvis-card cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">💰</span>
            <div>
              <p className="text-[10px] font-mono text-cyan-600 tracking-widest mb-0.5">[INVEST]</p>
              <h2 className="text-base font-semibold text-cyan-100 group-hover:text-cyan-300 transition-colors">
                자산 손익
              </h2>
              <p className="text-[10px] font-mono text-cyan-600/60 mt-0.5">Asset P&amp;L Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
            <span className="text-[10px] font-mono tracking-wider text-emerald-400">ONLINE</span>
          </div>
        </div>
        <p className="text-sm text-cyan-300/60 leading-relaxed group-hover:text-cyan-300/80 transition-colors">
          자산별 실현·미실현 손익, 수익률, 포트폴리오 변동 내역을 통합 분석합니다.
        </p>
        <div className="mt-5 pt-4 border-t border-cyan-500/10 flex items-center justify-between">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-4 h-0.5 rounded-full bg-cyan-500/20 group-hover:bg-cyan-500/50 transition-colors" />
            ))}
          </div>
          <span className="text-[10px] font-mono text-cyan-600 group-hover:text-cyan-400 transition-colors tracking-widest">
            ENTER MODULE →
          </span>
        </div>
      </div>
    </a>
  );
}
