'use client';
import { useState } from 'react';
import { Calculator } from 'lucide-react';
import type { CalcInput } from '@/lib/calculator';

interface Props {
  availableMonths: string[];
  selectedMonth: string;
  input: CalcInput;
  onCalculate: (input: CalcInput, month: string) => void;
}

const baseCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono pr-10';
const numCls = baseCls;
const numReq = baseCls + ' border-blue-300 bg-blue-50';

function Field({ label, unit, required, children }: { label: string; unit?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {children}
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}

// 원화 금액 입력: 세 자리 콤마 포맷, 0이면 빈칸
function MoneyInput({ value, onChange, className, placeholder }: {
  value: number; onChange: (v: number) => void; className?: string; placeholder?: string;
}) {
  const [display, setDisplay] = useState(() => value > 0 ? value.toLocaleString('ko-KR') : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = raw ? parseInt(raw) : 0;
    setDisplay(raw ? num.toLocaleString('ko-KR') : '');
    onChange(num);
  };
  const handleFocus = () => { if (display === '0') setDisplay(''); };
  const handleBlur  = () => { /* 빈칸 유지, 값은 이미 0 */ };

  return (
    <input type="text" inputMode="numeric" className={className}
      value={display} placeholder={placeholder}
      onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} />
  );
}

// 정수 입력: focus 시 0 자동 삭제, blur 시 빈칸이면 0 복원
function NumInput({ value, onChange, className }: {
  value: number; onChange: (v: number) => void; className?: string;
}) {
  const [display, setDisplay] = useState(String(value));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setDisplay(raw);
    onChange(raw ? parseInt(raw) : 0);
  };
  const handleFocus = () => { if (display === '0') setDisplay(''); };
  const handleBlur  = () => { if (!display) { setDisplay('0'); onChange(0); } };

  return (
    <input type="text" inputMode="numeric" className={className}
      value={display}
      onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} />
  );
}

export default function InputStep({ availableMonths, selectedMonth, input, onCalculate }: Props) {
  const [month, setMonth] = useState(selectedMonth);
  const [inp, setInp] = useState<CalcInput>(input);
  const [error, setError] = useState('');

  const set = <K extends keyof CalcInput>(key: K, val: CalcInput[K]) =>
    setInp(prev => ({ ...prev, [key]: val }));

  const isCpt = inp.position === 'captain';
  const fmtMonth = (m: string) => `${m.slice(0, 4)}년 ${parseInt(m.slice(5))}월`;

  const fr = inp.flightPayFromSlip > 0 ? inp.flightPayFromSlip / 70 : 0;
  const ordinary = inp.basePay > 0
    ? (inp.basePay + 200000 + 140000 + (inp.tenurePay || 0) + (isCpt ? (inp.seniorCaptainPay || 0) : (!isCpt && inp.isSeniorFO ? 400000 : 0))) / 209
    : 0;

  const handleCalc = () => {
    if (!inp.basePay) { setError('기본급을 입력해주세요.'); return; }
    if (!inp.flightPayFromSlip) { setError('70시간 기준 비행수당을 입력해주세요.'); return; }
    if (!month) { setError('계산 월을 선택해주세요.'); return; }
    setError('');
    onCalculate(inp, month);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-0.5">정보 입력</h2>
        <p className="text-sm text-gray-500">계산할 달과 급여 정보를 입력해주세요</p>
      </div>

      {/* 월 선택 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">계산 월</p>
        <div className="flex gap-2 flex-wrap">
          {availableMonths.map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${month === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {fmtMonth(m)}
            </button>
          ))}
        </div>
      </div>

      {/* 직위 선택 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">직위</p>
        <div className="flex gap-2">
          {(['captain','fo'] as const).map(pos => (
            <button key={pos} onClick={() => set('position', pos)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${inp.position === pos ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {pos === 'captain' ? '기장' : '부기장'}
            </button>
          ))}
        </div>
        {/* 부기장 선임 여부 */}
        {!isCpt && (
          <div className="mt-3">
            <button onClick={() => set('isSeniorFO', !inp.isSeniorFO)}
              className={`w-full py-2.5 rounded-xl text-sm font-medium border-2 transition-colors
                ${inp.isSeniorFO ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              {inp.isSeniorFO ? '✓ 선임부기장 (월 400,000원 추가)' : '선임부기장 여부 (클릭하여 선택)'}
            </button>
          </div>
        )}
      </div>

      {/* 보직 여부 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">보직여부</p>
          <div className="grid grid-cols-4 gap-2">
            {([0, 100, 120, 140] as const).map(v => (
              <button key={v}
                onClick={() => set('positionGuarantee', v)}
                className={`py-2 rounded-xl text-xs font-medium transition-colors
                  ${inp.positionGuarantee === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {v === 0 ? '해당없음' : `${v}h 보장`}
              </button>
            ))}
          </div>
      </div>

      {/* 급여 정보 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">급여 정보</p>
        <Field label="기본급" unit="원" required>
          <MoneyInput className={numReq} value={inp.basePay}
            placeholder="필수 입력" onChange={v => set('basePay', v)} />
        </Field>
        <Field label="70시간 기준 비행수당" unit="원" required>
          <MoneyInput className={numReq} value={inp.flightPayFromSlip}
            placeholder="필수 입력" onChange={v => set('flightPayFromSlip', v)} />
        </Field>
        {isCpt && (
          <Field label="근속수당">
            <select className={numCls} value={inp.tenurePay || 0}
              onChange={e => set('tenurePay', parseInt(e.target.value) || 0)}>
              <option value={0}>1호봉 (0원)</option>
              <option value={230000}>2~5호봉 (230,000원)</option>
              <option value={345000}>6~8호봉 (345,000원)</option>
              <option value={460000}>9~11호봉 (460,000원)</option>
              <option value={575000}>12호봉 이상 (575,000원)</option>
            </select>
          </Field>
        )}
        {isCpt && (
          <Field label="선임/수석기장 수당" unit="원">
            <MoneyInput className={numCls} value={inp.seniorCaptainPay || 0}
              placeholder="해당 시 입력" onChange={v => set('seniorCaptainPay', v)} />
          </Field>
        )}
        {(inp.basePay > 0 && inp.flightPayFromSlip > 0) && (
          <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-600 space-y-0.5">
            <div>비행수당 단가 <span className="font-mono font-semibold">{fr.toFixed(1)}원/h</span></div>
            <div>통상임금 <span className="font-mono font-semibold">{Math.ceil(ordinary).toLocaleString()}원/h</span></div>
          </div>
        )}
      </div>

      {/* 기타 입력 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">기타 입력</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="휴무일수" unit="일">
            <NumInput className={numCls} value={inp.dayOff} onChange={v => set('dayOff', v)} />
          </Field>
          <Field label="국내 레이오버" unit="일">
            <NumInput className={numCls} value={inp.domLayoverDays} onChange={v => set('domLayoverDays', v)} />
          </Field>
          <Field label="공휴일 근무" unit="일">
            <NumInput className={numCls} value={inp.holidayDays} onChange={v => set('holidayDays', v)} />
          </Field>
          <Field label="지방 차량이동" unit="회">
            <NumInput className={numCls} value={inp.localTransTrips} onChange={v => set('localTransTrips', v)} />
          </Field>
          <Field label="타항공사 이동" unit="회">
            <NumInput className={numCls} value={inp.otherDHTrips} onChange={v => set('otherDHTrips', v)} />
          </Field>
          <Field label="미사용 연차" unit="일">
            <NumInput className={numCls} value={inp.unusedLeave} onChange={v => set('unusedLeave', v)} />
          </Field>
          <Field label="기타" unit="원">
            <MoneyInput className={numCls} value={inp.etc} placeholder="0" onChange={v => set('etc', v)} />
          </Field>
        </div>
        <div className="text-xs text-gray-400 space-y-0.5">
          <div>공휴일: 설날·추석·근로자의날 합산</div>
          <div>지방 차량이동: {isCpt ? '30,000원' : '20,000원'}/회</div>
          <div>타항공사 이동: 1회당 1시간25분 × 70% 블록타임 산입</div>
          <div>미사용 연차: 통상임금 × 8h × 일수</div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button onClick={handleCalc} disabled={!month}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2">
        <Calculator className="w-4 h-4" />
        {month ? fmtMonth(month) : '월을 선택해주세요'} 수당 계산
      </button>
    </div>
  );
}
