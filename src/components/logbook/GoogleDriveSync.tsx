'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { LogbookEntry } from '@/types/logbook';
import { syncToDrive, importFromDrive } from '@/lib/google-drive';

export interface GoogleDriveSyncHandle {
  sync: (entries: LogbookEntry[]) => Promise<void>;
  isConnected: () => boolean;
}

interface Props {
  onImport: (entries: LogbookEntry[]) => void;
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

const GoogleDriveSync = forwardRef<GoogleDriveSyncHandle, Props>(({ onImport }, ref) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isImporting, setIsImporting] = useState(false);

  const login = useGoogleLogin({
    scope:
      'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    onSuccess: async (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await res.json();
        setUserEmail((info as { email?: string }).email ?? null);
      } catch {
        // user info optional
      }
    },
    onError: () => {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    },
  });

  useImperativeHandle(ref, () => ({
    sync: async (entries: LogbookEntry[]) => {
      if (!accessToken) return;
      setSyncStatus('syncing');
      try {
        await syncToDrive(accessToken, entries);
        setSyncStatus('done');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
    },
    isConnected: () => !!accessToken,
  }));

  const handleImport = async () => {
    if (!accessToken) return;
    setIsImporting(true);
    try {
      const imported = await importFromDrive(accessToken);
      if (imported && imported.length > 0) {
        onImport(imported);
      } else {
        alert('Drive에서 JUVIS_logbook.csv를 찾을 수 없습니다.');
      }
    } catch {
      alert('Drive 가져오기에 실패했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  const logout = () => {
    setAccessToken(null);
    setUserEmail(null);
    setSyncStatus('idle');
  };

  if (!accessToken) {
    return (
      <button
        onClick={() => login()}
        className="flex items-center gap-2 px-3 py-1.5 rounded border border-cyan-500/30 bg-cyan-500/5 text-[10px] font-mono text-cyan-500 hover:text-cyan-300 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition-all"
      >
        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Google Drive 연동
      </button>
    );
  }

  const statusColor: Record<SyncStatus, string> = {
    idle: 'text-emerald-400',
    syncing: 'text-yellow-400',
    done: 'text-emerald-300',
    error: 'text-red-400',
  };

  const statusLabel: Record<SyncStatus, string> = {
    idle: 'DRIVE 연동됨',
    syncing: '동기화 중...',
    done: '동기화 완료',
    error: '동기화 실패',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            syncStatus === 'syncing'
              ? 'animate-pulse bg-yellow-400'
              : syncStatus === 'error'
              ? 'bg-red-400'
              : 'bg-emerald-400'
          }`}
        />
        <span className={`text-[10px] font-mono ${statusColor[syncStatus]}`}>
          {statusLabel[syncStatus]}
        </span>
        {userEmail && (
          <span className="text-[10px] font-mono text-cyan-700 hidden sm:inline">
            ({userEmail})
          </span>
        )}
      </div>
      <button
        onClick={handleImport}
        disabled={isImporting}
        className="px-2 py-1 rounded border border-cyan-500/20 text-[10px] font-mono text-cyan-600 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isImporting ? '가져오는 중...' : 'DRIVE IMPORT'}
      </button>
      <button
        onClick={logout}
        className="px-2 py-1 rounded border border-cyan-500/15 text-[10px] font-mono text-cyan-700 hover:text-cyan-500 hover:border-cyan-500/30 transition-colors"
      >
        연결 해제
      </button>
    </div>
  );
});

GoogleDriveSync.displayName = 'GoogleDriveSync';
export default GoogleDriveSync;
