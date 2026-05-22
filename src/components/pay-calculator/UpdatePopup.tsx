'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'updatePopupHiddenUntil_v2_2';

export default function UpdatePopup() {
  const [visible, setVisible] = useState(false);
  const [hideMonth, setHideMonth] = useState(false);

  useEffect(() => {
    const hiddenUntil = localStorage.getItem(STORAGE_KEY);
    if (hiddenUntil && Date.now() < parseInt(hiddenUntil)) return;
    setVisible(true);
  }, []);

  const close = () => {
    if (hideMonth) {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-blue-600 px-5 py-4">
          <h2 className="text-white font-semibold text-base">업데이트 내역</h2>
        </div>
        <div className="px-5 pt-4 pb-2 space-y-4 text-sm text-gray-700 max-h-72 overflow-y-auto">
          <div>
            <p className="font-semibold text-gray-900 mb-1.5">V.2.2 업데이트 (2026-05-21)</p>
            <ul className="space-y-1.5">
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>국제선 DH 이동시 퀵턴/레이오버 적용 오류 수정</span></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1.5">V.2.1 업데이트 (2026-05-20)</p>
            <ul className="space-y-1.5">
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>보직수당 항목 추가 (100h/120h/140h 보장)</span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>중국 레이오버 단가수정 </span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>월말→월초 레이오버 수당 산입 로직 추가</span></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1.5">V.2 업데이트 (2026-05-20)</p>
            <ul className="space-y-1.5">
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>근속수당 항목 추가</span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>교관/심사관수당 계산 추가</span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>Duty Code 개편 </span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>결과화면 급여/체재비 분리 표시</span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>통상임금 계산식 업데이트 (근속수당 포함)</span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>금액 표기형식 수정 </span></li>
              <li className="flex gap-2"><span className="text-blue-500 mt-0.5">•</span><span>업데이트 내역 팝업 추가 및 과거 업데이트 내역 표시</span></li>
            </ul>
          </div>
        </div>
        <div className="px-5 pb-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={hideMonth} onChange={e => setHideMonth(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-xs text-gray-500">한 달 동안 보지 않기</span>
          </label>
          <button onClick={close}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
