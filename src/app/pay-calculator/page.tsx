'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { parseCSV, processFlights, calcMonth } from '@/lib/pay-calculator/calculator';
import type { ProcessedFlight, MonthResult, CalcInput } from '@/lib/pay-calculator/calculator';
import UploadStep from '@/components/pay-calculator/UploadStep';
import InputStep from '@/components/pay-calculator/InputStep';
import ResultView from '@/components/pay-calculator/ResultView';
import UpdatePopup from '@/components/pay-calculator/UpdatePopup';
import ChangelogModal from '@/components/pay-calculator/ChangelogModal';

export type AppStep = 'upload' | 'input' | 'result';

const DEFAULT_INPUT: CalcInput = {
  basePay: 0,
  flightPayFromSlip: 0,
  position: 'captain',
  seniorCaptainPay: 0,
  tenurePay: 0,
  positionGuarantee: 0,
  isSeniorFO: false,
  dayOff: 10,
  domLayoverDays: 0,
  holidayDays: 0,
  localTransTrips: 0,
  otherDHTrips: 0,
  unusedLeave: 0,
  etc: 0,
};

export default function PayCalculatorPage() {
  const [step, setStep] = useState<AppStep>('upload');
  const [flights, setFlights] = useState<ProcessedFlight[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [input, setInput] = useState<CalcInput>(DEFAULT_INPUT);
  const [tripOverrides, setTripOverrides] = useState<Record<string, ProcessedFlight['tripType']>>({});
  const [result, setResult] = useState<MonthResult | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleFileLoaded = useCallback((csvText: string) => {
    const raw = parseCSV(csvText);
    const processed = processFlights(raw);
    const months = Array.from(new Set(
      processed.filter(f => f.fltNo !== '__overflow__').map(f => f.month)
    )).sort();
    setFlights(processed);
    setAvailableMonths(months);
    setSelectedMonth(months[months.length - 1] ?? '');
    setTripOverrides({});
    setStep('input');
  }, []);

  const handleCalculate = useCallback((inp: CalcInput, month: string) => {
    setInput(inp);
    setSelectedMonth(month);
    const res = calcMonth(flights, month, inp, tripOverrides);
    setResult(res);
    setStep('result');
  }, [flights, tripOverrides]);

  const handleTripOverride = useCallback((key: string, type: ProcessedFlight['tripType']) => {
    const next = { ...tripOverrides, [key]: type };
    setTripOverrides(next);
    if (result) {
      setResult(calcMonth(flights, result.month, input, next));
    }
  }, [flights, result, input, tripOverrides]);

  const reset = () => {
    setStep('upload');
    setFlights([]);
    setResult(null);
    setTripOverrides({});
  };

  const STEP_LABELS: Record<AppStep, string> = {
    upload: '파일 업로드', input: '정보 입력', result: '결과',
  };
  const STEPS: AppStep[] = ['upload', 'input', 'result'];

  return (
    <main className="min-h-screen bg-gray-50">
      <UpdatePopup />
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Link href="/" className="text-xs font-mono text-cyan-600 hover:text-cyan-500 transition-colors">
                ← JUVIS
              </Link>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">이스타항공 급여 계산기 (2026 Beta V.2.2)</h1>
            <p className="text-xs text-gray-400">운항승무원 비행수당 자동 계산</p>
          </div>
          {step !== 'upload' && (
            <button onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5">
              처음으로
            </button>
          )}
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium
                  ${step === s ? 'bg-blue-600 text-white'
                    : STEPS.indexOf(step) > i ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'}`}>
                  {i + 1}
                </div>
                <span className={`text-xs ${step === s ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {STEP_LABELS[s]}
                </span>
                {i < 2 && <div className="w-6 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {step === 'upload' && (
          <>
            <UploadStep onLoaded={handleFileLoaded} />
            <div className="mt-4 flex justify-center">
              <button onClick={() => setShowChangelog(true)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                업데이트 전체 내역
              </button>
            </div>
          </>
        )}
        {step === 'input' && (
          <InputStep
            availableMonths={availableMonths}
            selectedMonth={selectedMonth}
            input={input}
            onCalculate={handleCalculate}
          />
        )}
        {step === 'result' && result && (
          <ResultView
            result={result}
            position={input.position}
            tripOverrides={tripOverrides}
            onTripOverride={handleTripOverride}
            onBack={() => setStep('input')}
          />
        )}
      </div>
    </main>
  );
}
