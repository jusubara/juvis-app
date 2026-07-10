import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 — JUVIS",
  description: "이스타항공 모바일 파일럿 로그북 개인정보처리방침",
};

const sections = [
  {
    num: "1",
    title: "수집하는 정보",
    content: (
      <>
        본 앱은 회원가입이나 로그인 기능이 없으며, 어떠한 개인정보도 외부
        서버로 전송하거나 수집하지 않습니다.
        <br />
        <br />
        사용자가 입력하는 비행 기록(날짜, 편명, 출발/도착지, 비행시간, 동승
        승무원 이름 등)은 오직 사용자의 기기 내부에만 저장되며, 개발자를
        포함한 어떠한 제3자도 이 데이터에 접근할 수 없습니다.
      </>
    ),
  },
  {
    num: "2",
    title: "데이터 저장 위치",
    content: (
      <>
        모든 데이터는 사용자의 iOS 기기 내 로컬 데이터베이스에 저장됩니다.
        인터넷 연결 없이도 앱의 모든 기능(비행 기록 작성, 조회, PDF/CSV
        내보내기)을 사용할 수 있습니다.
      </>
    ),
  },
  {
    num: "3",
    title: "데이터 삭제",
    content: (
      <>
        앱을 삭제하면 기기에 저장된 모든 데이터가 함께 삭제됩니다. 앱 내에서
        개별 기록의 수정 및 삭제도 가능합니다.
      </>
    ),
  },
  {
    num: "4",
    title: "제3자 제공",
    content: (
      <>본 앱은 어떠한 개인정보도 제3자에게 제공하거나 공유하지 않습니다.</>
    ),
  },
  {
    num: "5",
    title: "문의처",
    content: (
      <>
        본 개인정보처리방침에 대해 문의사항이 있으시면 아래 연락처로 문의해
        주시기 바랍니다.
        <br />
        <br />
        <span className="text-cyan-300 font-mono">개발자</span>
        <span className="text-cyan-100/70 ml-2">Jusub Kim</span>
        <br />
        <span className="text-cyan-300 font-mono">이메일</span>
        <span className="text-cyan-100/70 ml-2">jujusangsa@gmail.com</span>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#020c14] text-cyan-100 py-16 px-4">
      <div className="max-w-2xl mx-auto">

        {/* 뒤로가기 */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-mono mb-10 transition-colors"
        >
          ← JUVIS 홈으로
        </Link>

        {/* 헤더 */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono text-cyan-500 tracking-widest uppercase">
              Legal
            </span>
            <span className="h-px flex-1 bg-cyan-900/60" />
          </div>
          <h1 className="text-3xl font-bold text-cyan-100 tracking-tight mb-3">
            개인정보처리방침
          </h1>
          <p className="text-sm text-cyan-500 font-mono">
            최종 수정일: 2026년 7월 10일
          </p>
        </div>

        {/* 인트로 */}
        <div className="bg-[#041824] border border-cyan-900/50 rounded-xl p-6 mb-8 text-cyan-100/80 leading-relaxed">
          이스타항공 모바일 파일럿 로그북(이하 &quot;본 앱&quot;)은 사용자의
          개인정보 보호를 중요하게 생각합니다.
        </div>

        {/* 섹션들 */}
        <div className="space-y-4">
          {sections.map((sec) => (
            <div
              key={sec.num}
              className="bg-[#041824] border border-cyan-900/40 rounded-xl p-6"
            >
              <div className="flex items-start gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-cyan-900/60 border border-cyan-700/50 flex items-center justify-center text-xs font-mono text-cyan-400 mt-0.5">
                  {sec.num}
                </span>
                <div className="flex-1">
                  <h2 className="font-semibold text-cyan-200 mb-3 text-base">
                    {sec.title}
                  </h2>
                  <p className="text-cyan-100/70 text-sm leading-7">
                    {sec.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="mt-12 pt-6 border-t border-cyan-900/40 text-center">
          <p className="text-xs text-cyan-700 font-mono">
            © 2026 JUJUSANGSA · 이스타항공 파일럿 전용 내부 앱
          </p>
        </div>

      </div>
    </main>
  );
}
