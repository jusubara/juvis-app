'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import type { MonthResult, ProcessedFlight } from '@/lib/pay-calculator/calculator';
import { DOMESTIC_AIRPORTS, RATES } from '@/lib/pay-calculator/calculator';

interface Props {
  result: MonthResult;
  position: 'captain' | 'fo';
  tripOverrides: Record<string, ProcessedFlight['tripType']>;
  onTripOverride: (key: string, type: ProcessedFlight['tripType']) => void;
  onBack: () => void;
}

const fw  = (n: number) => Math.ceil(n).toLocaleString('ko-KR') + '원';
const fh  = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
// 달러: 소수점 없이 정수
const fd  = (n: number) => `$${Math.ceil(n)}`;

const TRIP_COLOR: Record<string, string> = {
  quickturn:       'bg-blue-100 text-blue-700 border-blue-200',
  night_quickturn: 'bg-amber-100 text-amber-700 border-amber-200',
  layover:         'bg-purple-100 text-purple-700 border-purple-200',
};

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-1.5">{children}</div>}
    </div>
  );
}

function Row({ label, value, sub, usd, dim }: {
  label: string; value: string; sub?: string; usd?: boolean; dim?: boolean;
}) {
  if (!value || value === '0원' || value === '$0') return null;
  return (
    <div className={`flex items-baseline justify-between py-1.5 border-b border-gray-50 last:border-0 ${dim ? 'opacity-50' : ''}`}>
      <div>
        <span className="text-sm text-gray-600">{label}</span>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${usd ? 'text-blue-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

export default function ResultView({ result: r, position, tripOverrides, onTripOverride, onBack }: Props) {
  const isCpt = position === 'captain';
  const fmtMonth = (m: string) => `${m.slice(0, 4)}년 ${parseInt(m.slice(5))}월`;

  const intlOutbound = r.flights.filter(f =>
    !f.isDom && !f.isDH && DOMESTIC_AIRPORTS.has(f.from)
  );

  const domLandN = isCpt ? RATES.DOM_LAND_N_CPT : RATES.DOM_LAND_N_FO;
  const domLandS = isCpt ? RATES.DOM_LAND_S_CPT : RATES.DOM_LAND_S_FO;
  const intlLandN = isCpt ? RATES.INTL_LAND_N_CPT : RATES.INTL_LAND_N_FO;
  const intlLandS = isCpt ? RATES.INTL_LAND_S_CPT : RATES.INTL_LAND_S_FO;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{fmtMonth(r.month)} 결과</h2>
          <p className="text-xs text-gray-500">
            {r.flightCount}편 · {fh(r.blockMin)} · 야간 {fh(r.nightMin)}
          </p>
        </div>
      </div>

      {/* 합계 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-900 rounded-2xl p-3">
          <p className="text-xs text-gray-400 mb-0.5">총 급여 합계</p>
          <p className="text-[10px] text-gray-500 mb-1">체재비 제외</p>
          <p className="text-base font-bold text-white tabular-nums">{fw(r.totalKRW - r.domLandPay - r.domLayoverPay)}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-3">
          <p className="text-xs text-emerald-600 mb-0.5">국내선 체재비</p>
          <p className="text-[10px] text-emerald-400 mb-1">랜딩 + 레이오버</p>
          <p className="text-base font-bold text-emerald-700 tabular-nums">{fw(r.domLandPay + r.domLayoverPay)}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-3">
          <p className="text-xs text-blue-500 mb-0.5">국제선 체재비</p>
          <p className="text-[10px] text-blue-400 mb-1 tabular-nums">랜딩 {fd(r.intlLandUSD)} · 퀵턴 {fd(r.quickturnUSD)} · L/O {fd(r.layoverUSD)}</p>
          <p className="text-base font-bold text-blue-600 tabular-nums">{fd(r.totalUSD)}</p>
        </div>
      </div>

      {/* 명세서 형식 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">지급 내역 요약</p>
        </div>

        {/* 지급 내역 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            {(() => {
              const row1 = [
                { label: '기본급',       value: r.basePay },
                { label: '교통보조비',   value: r.trans },
                { label: '중식대',       value: r.meal },
                { label: '비행수당',     value: r.flightPay },
                ...(r.positionPay > 0 ? [{ label: '보직수당', value: r.positionPay }] : []),
                { label: '연장근무수당', value: r.overtimePay },
                { label: '휴일근무수당', value: r.holidayPay },
                { label: '야간근무수당', value: r.nightPay },
                { label: 'Incentive',   value: r.incentive },
              ];
              const extra = [
                ...(isCpt && r.tenurePay > 0 ? [{ label: '근속수당', value: r.tenurePay }] : []),
                ...(r.seniorPay > 0 ? [{ label: isCpt ? '선임/수석기장수당' : '선임부기장수당', value: r.seniorPay }] : []),
                ...(r.instructorPay > 0 ? [{ label: '교관수당', value: r.instructorPay }] : []),
                ...(r.examinerPay > 0 ? [{ label: '심사관수당', value: r.examinerPay }] : []),
                ...(r.leavePay > 0 ? [{ label: '연차수당', value: r.leavePay }] : []),
                { label: 'ALPA-K 지원수당', value: r.alpak },
              ];
              const empty = row1.length - extra.length;
              return (
                <>
                  <thead className="bg-gray-50">
                    <tr>
                      {row1.map(({ label }) => (
                        <th key={label} className="px-2 py-2 text-center font-medium text-gray-500 border-r border-gray-100 last:border-0 whitespace-nowrap">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100">
                      {row1.map(({ label, value }) => (
                        <td key={label} className="px-2 py-2.5 text-right font-mono font-medium text-gray-900 border-r border-gray-100 last:border-0">
                          {value > 0 ? Math.ceil(value).toLocaleString() : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                    {/* 추가 수당 */}
                    <tr className="bg-gray-50 border-t border-gray-100">
                      {extra.map(({ label }) => (
                        <th key={label} className="px-2 py-1.5 text-center font-medium text-gray-500 border-r border-gray-100 last:border-0 whitespace-nowrap">{label}</th>
                      ))}
                      {empty > 0 && <td colSpan={empty} className="border-l border-gray-100" />}
                    </tr>
                    <tr className="border-t border-gray-100">
                      {extra.map(({ label, value }) => (
                        <td key={label} className="px-2 py-2.5 text-right font-mono font-medium text-gray-900 border-r border-gray-100 last:border-0">
                          {Math.ceil(value).toLocaleString()}
                        </td>
                      ))}
                      {empty > 0 && <td colSpan={empty} className="border-l border-gray-100" />}
                    </tr>
                  </tbody>
                </>
              );
            })()}
          </table>
        </div>

        {/* 국내선/국제선 체류비 */}
        <div className="border-t border-gray-100 grid grid-cols-2 divide-x divide-gray-100">
          <div>
            <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">국내선 체류비</div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              {[['레이오버퍼듐_국내', r.domLayoverPay > 0 ? fw(r.domLayoverPay) : '—'],
                ['체재비_국내', r.domLandPay > 0 ? fw(r.domLandPay) : '—']].map(([l, v]) => (
                <div key={l} className="px-3 py-2">
                  <div className="text-xs text-gray-400">{l}</div>
                  <div className="font-mono text-xs font-medium text-gray-900 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100">국제선 체류비</div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {[['퀵턴퍼듐', fd(r.quickturnUSD)],
                ['레이오버퍼듐', fd(r.layoverUSD)],
                ['체재비_국제', fd(r.intlLandUSD)]].map(([l, v]) => (
                <div key={l} className="px-3 py-2">
                  <div className="text-xs text-gray-400">{l}</div>
                  <div className="font-mono text-xs font-medium text-blue-600 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 지방차량 이동비 */}
        {r.localTransPay > 0 && (
          <div className="border-t border-gray-100 px-3 py-2">
            <div className="text-xs text-gray-400">지방차량이동비</div>
            <div className="font-mono text-xs font-medium text-gray-900 mt-0.5">{fw(r.localTransPay)}</div>
          </div>
        )}
      </div>

      {/* 계산 상세 */}
      <Section title="계산 상세">
        <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500 space-y-1 mb-2">
          <div>통상임금 <span className="font-mono font-semibold text-gray-700">{fw(Math.round(r.ordinary))}/h</span>
            <span className="ml-1 text-gray-400">(기본급+교통+중식{r.tenurePay > 0 ? '+근속' : ''}{r.seniorPay > 0 ? '+선임' : ''}) ÷ 209</span>
          </div>
          {r.flightRate > 0 && (
            <div>비행수당 단가 <span className="font-mono font-semibold text-gray-700">{r.flightRate.toFixed(1)}원/h</span></div>
          )}
        </div>
        <div className="text-xs font-medium text-gray-400 pt-1 pb-0.5 flex items-center gap-2">
          <span className="flex-1 border-t border-gray-200" />
          <span>급여 항목</span>
          <span className="flex-1 border-t border-gray-200" />
        </div>
        <Row label="비행수당 (70h)" value={r.flightRate > 0 ? fw(r.flightPay) : '—'}
          sub={r.flightRate > 0 ? `70h × ${r.flightRate.toFixed(1)}원` : '명세서 입력 필요'} />
        {r.positionPay > 0 && (
          <Row label={`보직수당 (보장 ${r.positionGuarantee}h)`} value={fw(r.positionPay)}
            sub={`(${r.positionGuarantee}h - 70h) × ${r.flightRate.toFixed(1)}원`} />
        )}
        <Row label="연장근무수당" value={r.flightRate > 0 ? fw(r.overtimePay) : '—'}
          sub={r.positionGuarantee > 0
            ? Math.max(0, r.blockH - 70) > 0
              ? `실제 ${r.blockH.toFixed(1)}h - 70h × 단가 (할증없음)`
              : `해당 없음 (실제 ${r.blockH.toFixed(1)}h ≤ 70h)`
            : r.over70h > 0 ? `${r.over70h.toFixed(2)}h × 155%`
            : r.over80h > 0 ? `${r.over80h.toFixed(2)}h × 180%`
            : `해당 없음 (${r.blockH.toFixed(1)}h ≤ 70h)`} />
        <Row label={`야간근무수당 · ${fh(r.nightMin)}`} value={r.flightRate > 0 ? fw(r.nightPay) : '—'}
          sub="UTC 13~21시 × 50%" />
        {isCpt && r.tenurePay > 0 && <Row label="근속수당" value={fw(r.tenurePay)} />}
        {r.seniorPay > 0 && <Row label={isCpt ? '선임/수석기장수당' : '선임부기장수당'} value={fw(r.seniorPay)} />}
        {r.instructorPay > 0 && <Row label="교관수당" value={fw(r.instructorPay)} sub={`${(r.instructorPay / 30000).toFixed(2)}h × 30,000원/h`} />}
        {r.examinerPay > 0 && <Row label="심사관수당" value={fw(r.examinerPay)} sub={`${(r.examinerPay / 50000).toFixed(2)}h × 50,000원/h`} />}
        <Row label="ALPA-K" value={fw(r.alpak)} />
        <Row label="휴일근무수당" value={fw(r.holidayPay)} />
        <Row label="Incentive" value={fw(r.incentive)} />
        {r.leavePay > 0 && <Row label="연차수당" value={fw(r.leavePay)} sub="통상임금 × 8h × 미사용 연차" />}
        {r.etc !== 0 && <Row label="기타" value={fw(r.etc)} />}
        <div className="text-xs font-medium text-gray-400 pt-2 pb-0.5 flex items-center gap-2">
          <span className="flex-1 border-t border-gray-200" />
          <span>체재비 항목</span>
          <span className="flex-1 border-t border-gray-200" />
        </div>
        <Row label="체재비_국내 (국내 랜딩피)" value={fw(r.domLandPay)}
          sub={`일반 ${domLandN.toLocaleString()}원 / 특수 ${domLandS.toLocaleString()}원`} />
        <Row label="레이오버퍼듐 (국내)" value={fw(r.domLayoverPay)}
          sub={`${isCpt ? '90,000원' : '70,000원'}/일`} />
        <Row label="체재비_국제 (국제 랜딩피)" value={fd(r.intlLandUSD)}
          sub={`일반 $${intlLandN} / 특수 $${intlLandS}`} usd />
        <Row label="퀵턴퍼듐" value={fd(r.quickturnUSD)}
          sub={`퀵턴 $${isCpt ? RATES.QUICKTURN_CPT : RATES.QUICKTURN_FO} / 야간퀵턴 $${(isCpt ? RATES.QUICKTURN_CPT : RATES.QUICKTURN_FO) + RATES.NIGHT_QT_ADD}`} usd />
        <Row label="레이오버퍼듐 (국제)" value={fd(r.layoverUSD)}
          sub={`일반 $${RATES.LAYOVER_H}/h · 중국 $${RATES.LAYOVER_H_CHN}/h${isCpt ? ` + $${RATES.LAYOVER_TIP_CPT}/회 팁` : ''} · 편별 올림`} usd />
        <Row label="지방차량이동비" value={fw(r.localTransPay)}
          sub={`${isCpt ? '30,000원' : '20,000원'}/회`} />
      </Section>

      {/* 퀵턴/레이오버 수동 수정 */}
      {intlOutbound.length > 0 && (
        <Section title="국제선 퀵턴/레이오버 · 클릭으로 수정" defaultOpen={false}>
          <p className="text-xs text-gray-400 mb-2">자동 인식 결과를 수동으로 변경할 수 있어요.</p>
          {intlOutbound.map(f => {
            const key = `${f.fltNo}_${f.date_utc}`;
            const cur = tripOverrides[key] ?? f.tripType;
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-700">{f.fltNo}</span>
                  <span className="text-xs text-gray-400 ml-2">{f.route}</span>
                  {f.stayMin != null && (
                    <span className="text-xs text-gray-400 ml-1">({(f.stayMin / 60).toFixed(1)}h)</span>
                  )}
                </div>
                <select
                  value={cur ?? ''}
                  onChange={e => onTripOverride(key, (e.target.value as ProcessedFlight['tripType']) || null)}
                  className={`text-xs border rounded-lg px-2 py-1 ${cur ? TRIP_COLOR[cur] : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                >
                  <option value="">—</option>
                  <option value="quickturn">퀵턴</option>
                  <option value="night_quickturn">야간퀵턴</option>
                  <option value="layover">레이오버</option>
                </select>
              </div>
            );
          })}
        </Section>
      )}

      {/* 비행편별 내역 */}
      <Section title={`비행편별 내역 (${r.flights.length}편)`} defaultOpen={false}>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-xs min-w-[480px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">날짜</th>
                <th className="px-2 py-2 text-left text-gray-500 font-medium">편명</th>
                <th className="px-2 py-2 text-left text-gray-500 font-medium">노선</th>
                <th className="px-2 py-2 text-left text-gray-500 font-medium">구분</th>
                <th className="px-2 py-2 text-right text-gray-500 font-medium">블록</th>
                <th className="px-2 py-2 text-right text-gray-500 font-medium">야간</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">랜딩피</th>
              </tr>
            </thead>
            <tbody>
              {r.flights.map((f, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-600">{f.date_utc.slice(5)}</td>
                  <td className="px-2 py-2 font-mono text-gray-700">{f.fltNo}</td>
                  <td className="px-2 py-2 text-gray-600">{f.route}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1
                      ${f.isDom ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {f.isDom ? '국내' : '국제'}
                    </span>
                    {f.isSpecial && !f.isDH && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 mr-1">특수</span>
                    )}
                    {f.isDH && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-700 mr-1">DH</span>
                    )}
                    <span className="text-gray-400">{f.dutyCode}</span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-gray-700">
                    {fh(f.blockMin)}
                    {f.isDH && <div className="text-gray-400">70%</div>}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {f.nightMin > 0
                      ? <span className="text-blue-600">{fh(f.nightMin)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {f.isDH ? <span className="text-gray-300">—</span>
                      : f.isDom
                        ? <span className="text-gray-700">{(f.isSpecial ? domLandS : domLandN).toLocaleString()}원</span>
                        : <span className="text-blue-600">${f.isSpecial ? intlLandS : intlLandN}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
