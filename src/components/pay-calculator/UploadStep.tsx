'use client';
import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface Props { onLoaded: (csv: string) => void; }

export default function UploadStep({ onLoaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('CSV 파일만 업로드할 수 있어요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      if (!text) { setError('파일을 읽을 수 없어요.'); return; }
      onLoaded(text);
    };
    // 이스타항공 비행로그는 EUC-KR 인코딩
    reader.readAsText(file, 'EUC-KR');
  }, [onLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-6">
      <div className="text-center pt-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">비행기록 파일 업로드</h2>
        <p className="text-sm text-gray-500">이스타항공 비행기록CSV 파일(2026년)을 업로드해주세요</p>
      </div>

      {/* 드래그 앤 드롭 영역 */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-2xl cursor-pointer transition-colors
          ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'}`}
      >
        <input type="file" accept=".csv" className="hidden" onChange={onInputChange} />
        <Upload className={`w-10 h-10 mb-3 ${dragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700">클릭하거나 파일을 여기에 놓으세요</p>
        <p className="text-xs text-gray-400 mt-1">FlightLog-XXXXXXX-YYYY.csv</p>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">파일 다운로드 방법</span>
        </div>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>이스타항공 CMS 접속</li>
          <li>FLIGHT → 비행기록조회 → YEAR → 2026, ALL → 검색</li>
          <li>조회 후 EXCEL 버튼 눌러 CSV 파일 다운로드</li>
        </ol>
        <p className="text-xs text-blue-500 mt-2">
          ※ 파일은 브라우저에서만 처리되며 서버에 전송되지 않습니다.
        </p>
      </div>
    </div>
  );
}
