'use client';

import { useRouter, usePathname } from 'next/navigation';
import { getSupabaseAuth } from '@/lib/supabase-auth';

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  // 로그인 페이지에서는 렌더링하지 않음
  if (pathname === '/login') return null;

  async function handleLogout() {
    const supabase = getSupabaseAuth();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-[10px] font-mono text-cyan-700 hover:text-cyan-400 tracking-widest transition-colors px-2 py-1 border border-transparent hover:border-cyan-500/20 rounded"
    >
      LOGOUT
    </button>
  );
}
