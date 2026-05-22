'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

const CHANGELOG = [
  {
    version: 'Beta V.2.2',
    date: '2026-05-21',
    items: ['국제선 DH 이동시 퀵턴/레이오버 적용 오류 수정'],
  },
  {
    version: 'Beta V.2.1',
    date: '2026-05-20',
    items: [
      '보직수당 항목 추가 (100h/120h/140h 보장)',
      '중국 레이오버 단가수정',
      '월말→월초 레이오버 수당 산입 로직 추가',
    ],
  },
  {
    version: 'Beta V.2',
    date: '2026-05-20',
    items: [
      '근속수당 항목 추가',
      '교관수당 / 심사관수당 계산 추가',
      'Duty Code 업데이트',
      '결과화면 급여/체재비 분리 표시',
      '통상임금 계산식 업데이트 (근속수당 포함)',
      '금액 표기형식 수정',
    ],
  },
  {
    version: 'Beta V.1',
    date: '2026-05-15',
    items: [
      '최초 출시',
      'CSV 파일 업로드 및 비행편 자동 파싱',
      '기본급/비행수당/연장수당/야간수당 계산',
      '국내/국제 랜딩피, 퀵턴/레이오버 수당 계산',
      '퀵턴·레이오버 수동 수정 기능',
    ],
  },
];

interface Props {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: Props) {
  const [openIdx, setOpenIdx] = useState<number>(0); // 최신 버전 자동 펼침

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">업데이트 전체 내역</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 버전 아코디언 */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {CHANGELOG.map((entry, idx) => (
            <div key={entry.version}>
              <button
                onClick={() => setOpenIdx(openIdx === idx ? -1 : idx)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${idx === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {entry.version}
                  </span>
                  <span className="text-xs text-gray-400">{entry.date}</span>
                </div>
                {openIdx === idx
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {openIdx === idx && (
                <ul className="px-5 pb-4 space-y-1.5">
                  {entry.items.map(item => (
                    <li key={item} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
