'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadEntries, Logbook2Entry, parseTime, fmtTime } from '@/lib/logbook2-storage';

// ─── Stats ────────────────────────────────────────────────────────────────────

interface PS {
  block: number; night: number; inst: number;
  pic: number; picus: number; cop: number; ip: number; tr: number;
  toD: number; toN: number; ldD: number; ldN: number;
}

function emptyPS(): PS {
  return { block:0,night:0,inst:0,pic:0,picus:0,cop:0,ip:0,tr:0,toD:0,toN:0,ldD:0,ldN:0 };
}

function addPS(a: PS, b: PS): PS {
  return {
    block:a.block+b.block, night:a.night+b.night, inst:a.inst+b.inst,
    pic:a.pic+b.pic, picus:a.picus+b.picus, cop:a.cop+b.cop,
    ip:a.ip+b.ip, tr:a.tr+b.tr,
    toD:a.toD+b.toD, toN:a.toN+b.toN, ldD:a.ldD+b.ldD, ldN:a.ldN+b.ldN,
  };
}

function fromEntry(e: Logbook2Entry): PS {
  return {
    block:parseTime(e.block), night:parseTime(e.night), inst:parseTime(e.inst),
    pic:parseTime(e.pic), picus:parseTime(e.picus), cop:parseTime(e.cop),
    ip:parseTime(e.ip), tr:parseTime(e.tr),
    toD:e.to_d?1:0, toN:e.to_n?1:0, ldD:e.ld_d?1:0, ldN:e.ld_n?1:0,
  };
}

function sumPS(entries: Logbook2Entry[]): PS {
  return entries.reduce((acc, e) => addPS(acc, fromEntry(e)), emptyPS());
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function T(min: number): string { return fmtTime(min) || ''; }
function Nc(n: number): string { return n > 0 ? String(n) : ''; }
function fmtDate(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}
function pageYear(entries: Logbook2Entry[]): number {
  const first = entries.find(e => e?.date);
  return first ? parseInt(first.date.substring(0, 4)) : new Date().getFullYear();
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const PRINT_CSS = `
  @page { size: 254mm 187mm; }
  @page :right { margin: 15mm 7mm 13mm 20mm; }
  @page :left  { margin: 15mm 20mm 13mm 7mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
  @media screen {
    body { background: #ccc; padding: 16px; }
    .lb-page { background: #fff; margin: 0 auto 20px; width: 214mm;
               padding: 3mm; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
  }
  @media print {
    body { background: none; padding: 0; }
    .lb-page { width: 100%; margin: 0; padding: 0; }
    .no-print { display: none !important; }
  }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td {
    border: 0.4pt solid #555; font-size: 7pt; padding: 0 1pt;
    text-align: center; vertical-align: middle; line-height: 1.2;
    color: #000;
  }
  .th-g  { background: #d4d4d4; font-weight: 700; }
  .th-s  { background: #e8e8e8; font-weight: 600; }
  .dr    { height: 7.2mm; }
  .dr-even { background: #fff; }
  .dr-odd  { background: #f8f8f8; }
  .fr { background: #dde4f0; }
  .fl { text-align: left; font-weight: 700; font-size: 6.5pt; padding-left: 2pt; }
  .fb { font-size: 8pt; font-weight: 700; display: block; }
  .sig { text-align: left; vertical-align: top; padding: 3pt 4pt; font-size: 6.5pt; }
`;

// ─── Table header ─────────────────────────────────────────────────────────────

function THead({ year }: { year: number }) {
  return (
    <thead>
      {/* Row 1: group labels */}
      <tr>
        <th rowSpan={3} className="th-s">
          <span style={{display:'block',fontSize:'6pt',fontWeight:600,lineHeight:1.3}}>YEAR</span>
          <span style={{display:'block',fontSize:'10pt',fontWeight:700,lineHeight:1.1}}>{year}</span>
          <span style={{display:'block',fontSize:'6pt',lineHeight:1.3}}>DATE<br/>(M/D)</span>
        </th>
        <th colSpan={2} className="th-g">AIRCRAFT</th>
        <th colSpan={3} className="th-g">ROUTE OF FLIGHT</th>
        <th colSpan={5} className="th-g">TYPE OF PILOTING TIME</th>
        <th colSpan={8} className="th-g">CONDITIONS OF FLIGHT</th>
        <th rowSpan={3} className="th-s" style={{textAlign:'left',paddingLeft:'2pt',fontSize:'6.5pt'}}>REMARK</th>
      </tr>
      {/* Row 2: column labels */}
      <tr>
        <th rowSpan={2} className="th-s">A/C<br/>TYPE</th>
        <th rowSpan={2} className="th-s">A/C<br/>IDENT</th>
        <th rowSpan={2} className="th-s">FLT<br/>NO.</th>
        <th rowSpan={2} className="th-s">FROM</th>
        <th rowSpan={2} className="th-s">TO</th>
        <th rowSpan={2} className="th-s">PIC</th>
        <th rowSpan={2} className="th-s" style={{fontSize:'5.5pt'}}>PIC<br/>UNDER<br/>SUPVSN</th>
        <th rowSpan={2} className="th-s" style={{fontSize:'6pt'}}>CO-<br/>PILOT</th>
        <th rowSpan={2} className="th-s">IP</th>
        <th rowSpan={2} className="th-s">TR</th>
        <th rowSpan={2} className="th-s">BLOCK<br/>TIME</th>
        <th rowSpan={2} className="th-s">NIGHT</th>
        <th rowSpan={2} className="th-s">INST</th>
        <th rowSpan={2} className="th-s" style={{fontSize:'6pt'}}>APP<br/>TYPE</th>
        <th colSpan={2} className="th-s">T/O</th>
        <th colSpan={2} className="th-s">L/D</th>
      </tr>
      {/* Row 3: D/N sub-labels only */}
      <tr>
        <th className="th-s">D</th><th className="th-s">N</th>
        <th className="th-s">D</th><th className="th-s">N</th>
      </tr>
    </thead>
  );
}

// ─── Data row ─────────────────────────────────────────────────────────────────

function DataRow({ entry, idx }: { entry: Logbook2Entry | null; idx: number }) {
  const cls = `dr ${idx % 2 === 0 ? 'dr-even' : 'dr-odd'}`;
  if (!entry) return <tr className={cls}>{Array.from({length:20}).map((_,i)=><td key={i}/>)}</tr>;
  const crew = entry.crew?.map(c=>`${c.name}${c.duty?'/'+c.duty:''}`).join(', ') ?? '';
  const remark = [crew, entry.remark].filter(Boolean).join(' | ');
  return (
    <tr className={cls}>
      <td>{fmtDate(entry.date)}</td>
      <td>{entry.ac_type}</td>
      <td style={{fontSize:'6.5pt'}}>{entry.ac_ident}</td>
      <td>{entry.flt_no}</td>
      <td>{entry.from_apt}</td>
      <td>{entry.to_apt}</td>
      <td style={{fontWeight:entry.pic?700:400}}>{entry.pic}</td>
      <td style={{fontWeight:entry.picus?700:400}}>{entry.picus}</td>
      <td style={{fontWeight:entry.cop?700:400}}>{entry.cop}</td>
      <td>{entry.ip}</td>
      <td>{entry.tr}</td>
      <td style={{fontWeight:700}}>{entry.block}</td>
      <td>{entry.night}</td>
      <td>{entry.inst}</td>
      <td style={{textAlign:'left',fontSize:'6pt'}}>{entry.app_type}</td>
      <td>{entry.to_d?'✓':''}</td>
      <td>{entry.to_n?'✓':''}</td>
      <td>{entry.ld_d?'✓':''}</td>
      <td>{entry.ld_n?'✓':''}</td>
      <td style={{textAlign:'left',fontSize:'6pt'}}>{remark}</td>
    </tr>
  );
}

// ─── Footer rows ──────────────────────────────────────────────────────────────
// Layout: A:C (colspan=3, rowspan=3) = signature | D:F (colspan=3) = label
//         G:N = time sums (pic,picus,cop,ip,tr,block,night,inst)
//         O = APP TYPE (blank) | P:S = TO/LD counts | T = blank
//
// Each cell shows a single value only (no secondary small text).
//
// Normal mode  → pageSt = this page's entries, fwdSt = prev page's TOTALS TO DATE
// Monthly mode → pageSt = entire month's entries, fwdSt = prev month's TOTALS TO DATE

function FooterRows({ pageSt, fwdSt, totalSt }: { pageSt: PS; fwdSt: PS; totalSt: PS }) {
  const timeKeys: (keyof PS)[] = ['pic','picus','cop','ip','tr','block','night','inst'];
  const cntKeys:  (keyof PS)[] = ['toD','toN','ldD','ldN'];

  const FV = ({ v }: { v: string }) => (
    <td className="fr"><span className="fb">{v}</span></td>
  );

  return (
    <>
      {/* PAGE TOTALS */}
      <tr>
        <td colSpan={3} rowSpan={3} className="sig">
          PILOT&apos;S SIGNATURE _______________________________
          <br/><br/>
          <span style={{fontSize:'6pt',color:'#000'}}>THIS RECORD IS CERTIFIED TRUE AND CORRECT</span>
        </td>
        <td colSpan={3} className="fr fl">PAGE TOTALS</td>
        {timeKeys.map(k => <FV key={k} v={T(pageSt[k])}/>)}
        <td className="fr"/>
        {cntKeys.map(k => <FV key={k} v={Nc(pageSt[k])}/>)}
        <td className="fr"/>
      </tr>
      {/* AMT. FORWARDED */}
      <tr>
        <td colSpan={3} className="fr fl">AMT. FORWARDED</td>
        {timeKeys.map(k => <FV key={k} v={T(fwdSt[k])}/>)}
        <td className="fr"/>
        {cntKeys.map(k => <FV key={k} v={Nc(fwdSt[k])}/>)}
        <td className="fr"/>
      </tr>
      {/* TOTALS TO DATE */}
      <tr>
        <td colSpan={3} className="fr fl">TOTALS TO DATE</td>
        {timeKeys.map(k => <FV key={k} v={T(totalSt[k])}/>)}
        <td className="fr"/>
        {cntKeys.map(k => <FV key={k} v={Nc(totalSt[k])}/>)}
        <td className="fr"/>
      </tr>
    </>
  );
}

// ─── Single physical page ─────────────────────────────────────────────────────

interface PageBlockProps {
  entries: Logbook2Entry[];
  maxRows: number;
  showFooter: boolean;
  pageSt: PS;
  fwdSt: PS;
  totalSt: PS;
  year: number;
}

function PageBlock({ entries, maxRows, showFooter, pageSt, fwdSt, totalSt, year }: PageBlockProps) {
  const rows = [...entries];
  while (rows.length < maxRows) rows.push(null as unknown as Logbook2Entry);

  return (
    <div className="lb-page">
      <table>
        <colgroup>
          <col style={{width:'8mm'}}/>   {/* DATE */}
          <col style={{width:'9mm'}}/>   {/* A/C TYPE */}
          <col style={{width:'11mm'}}/>  {/* A/C IDENT */}
          <col style={{width:'8mm'}}/>   {/* FLT NO */}
          <col style={{width:'7mm'}}/>   {/* FROM */}
          <col style={{width:'7mm'}}/>   {/* TO */}
          <col style={{width:'9mm'}}/>   {/* PIC */}
          <col style={{width:'9mm'}}/>   {/* PICUS */}
          <col style={{width:'9mm'}}/>   {/* CO-PILOT */}
          <col style={{width:'6mm'}}/>   {/* IP */}
          <col style={{width:'6mm'}}/>   {/* TR */}
          <col style={{width:'9mm'}}/>   {/* BLOCK */}
          <col style={{width:'8mm'}}/>   {/* NIGHT */}
          <col style={{width:'8mm'}}/>   {/* INST */}
          <col style={{width:'12mm'}}/>  {/* APP TYPE */}
          <col style={{width:'5mm'}}/>   {/* TO-D */}
          <col style={{width:'5mm'}}/>   {/* TO-N */}
          <col style={{width:'5mm'}}/>   {/* LD-D */}
          <col style={{width:'5mm'}}/>   {/* LD-N */}
          <col style={{width:'22mm'}}/>  {/* REMARK */}
        </colgroup>
        <THead year={year}/>
        <tbody>
          {rows.map((e, i) => <DataRow key={i} entry={e} idx={i}/>)}
        </tbody>
        {showFooter && (
          <tfoot>
            <FooterRows pageSt={pageSt} fwdSt={fwdSt} totalSt={totalSt}/>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Normal print (15 rows/page, always with footer) ─────────────────────────
// pageSt  = this page's entries sum
// fwdSt   = previous page's TOTALS TO DATE (0 for first page)
// totalSt = fwdSt + pageSt

function NormalPrint({ entries }: { entries: Logbook2Entry[] }) {
  const ROWS = 15;
  const chunks: Logbook2Entry[][] = [];
  for (let i = 0; i < Math.max(entries.length, 1); i += ROWS) {
    chunks.push(entries.slice(i, i + ROWS));
  }
  if (chunks.length === 0) chunks.push([]);

  let cum = emptyPS();
  const pages = chunks.map((ch, pi) => {
    const pageSt  = sumPS(ch);
    const fwdSt   = cum;
    const totalSt = addPS(fwdSt, pageSt);
    cum = totalSt;
    const year = pageYear(ch);
    return { ch, pageSt, fwdSt, totalSt, year, isLast: pi === chunks.length - 1 };
  });

  return (
    <>
      {pages.map(({ ch, pageSt, fwdSt, totalSt, year, isLast }, pi) => (
        <div key={pi} style={{pageBreakAfter:isLast?'auto':'always', breakAfter:isLast?'auto':'page'}}>
          <PageBlock entries={ch} maxRows={ROWS} showFooter pageSt={pageSt} fwdSt={fwdSt} totalSt={totalSt} year={year}/>
        </div>
      ))}
    </>
  );
}

// ─── Monthly print ────────────────────────────────────────────────────────────
// pageSt  = ENTIRE month's entries sum (not just the last-page chunk)
// fwdSt   = previous month's TOTALS TO DATE (0 for the first displayed month)
// totalSt = fwdSt + pageSt
// All pages within a month share the same pageSt/fwdSt/totalSt;
// only the last page of each month shows the footer.

function MonthlyPrint({ entries, filterYear, filterMonth }: {
  entries: Logbook2Entry[];
  filterYear: number | null;
  filterMonth: number | null;
}) {
  const display = entries.filter(e => {
    const ey = parseInt(e.date.substring(0, 4));
    const em = parseInt(e.date.substring(5, 7));
    if (filterYear !== null && ey !== filterYear) return false;
    if (filterMonth !== null && em !== filterMonth) return false;
    return true;
  });

  // Cumulative sum of all entries that come before the first displayed entry.
  const firstDisplayIdx = display.length > 0 ? entries.indexOf(display[0]) : entries.length;
  let globalCum = sumPS(entries.slice(0, firstDisplayIdx));

  const monthKeys: string[] = [];
  const monthMap = new Map<string, Logbook2Entry[]>();
  for (const e of display) {
    const key = e.date.substring(0, 7);
    if (!monthMap.has(key)) { monthMap.set(key, []); monthKeys.push(key); }
    monthMap.get(key)!.push(e);
  }

  interface PD {
    key: string; entries: Logbook2Entry[];
    maxRows: number; showFooter: boolean;
    pageSt: PS; fwdSt: PS; totalSt: PS;
    year: number; isLast: boolean;
  }
  const allPages: PD[] = [];

  for (const key of monthKeys) {
    const me   = monthMap.get(key)!;
    const N    = me.length;
    const year = filterYear ?? parseInt(key.substring(0, 4));

    // Month-level stats (shared by all pages in this month).
    const fwdSt   = globalCum;           // AMT.FORWARDED = before this month
    const pageSt  = sumPS(me);           // PAGE TOTALS   = entire month
    const totalSt = addPS(fwdSt, pageSt); // TOTALS TO DATE = fwdSt + month total
    globalCum = totalSt;

    // Split: non-last pages are always 18 rows full; last page ≤ 15 rows (+ footer).
    // k = ceil((N-15)/18) → number of full 18-row non-last pages.
    // Edge: if lastCount = N - 18k ≤ 0 (N ≡ 0,16,17 mod 18), reduce k by 1.
    const chunks: { entries: Logbook2Entry[]; isLast: boolean }[] = [];
    if (N <= 15) {
      chunks.push({ entries: me, isLast: true });
    } else {
      const k = Math.ceil((N - 15) / 18);
      const lastCount = N - 18 * k;
      const fullPages = lastCount > 0 ? k : k - 1;
      for (let i = 0; i < fullPages; i++) {
        chunks.push({ entries: me.slice(i * 18, (i + 1) * 18), isLast: false });
      }
      chunks.push({ entries: me.slice(fullPages * 18), isLast: true });
    }

    for (const { entries: ch, isLast } of chunks) {
      // last page: maxRows = max(15, actual) to handle rare edge cases (N=16~18)
      const maxRows = isLast ? Math.max(15, ch.length) : 18;
      allPages.push({
        key, entries: ch,
        maxRows,
        showFooter: isLast,
        pageSt, fwdSt, totalSt,  // month-level stats for all pages in this month
        year, isLast: false,
      });
    }
  }

  if (allPages.length > 0) allPages[allPages.length - 1].isLast = true;

  return (
    <>
      {allPages.map((p, pi) => (
        <div key={pi} style={{pageBreakAfter:p.isLast?'auto':'always', breakAfter:p.isLast?'auto':'page'}}>
          <PageBlock
            entries={p.entries} maxRows={p.maxRows} showFooter={p.showFooter}
            pageSt={p.pageSt} fwdSt={p.fwdSt} totalSt={p.totalSt} year={p.year}
          />
        </div>
      ))}
    </>
  );
}

// ─── Print content ────────────────────────────────────────────────────────────

function PrintContent() {
  const params = useSearchParams();
  const mode        = params.get('mode') ?? 'normal';
  const filterYear  = params.get('year')  ? parseInt(params.get('year')!)  : null;
  const filterMonth = params.get('month') ? parseInt(params.get('month')!) : null;

  const [entries, setEntries] = useState<Logbook2Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadEntries()
      .then(data => setEntries([...data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))))
      .catch(e => setErr(e instanceof Error ? e.message : '로딩 실패'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{padding:20}}>로딩 중…</div>;
  if (err)     return <div style={{padding:20,color:'red'}}>오류: {err}</div>;

  const modeLabel = mode === 'monthly'
    ? `월별 출력${filterYear ? ` — ${filterYear}년${filterMonth ? ` ${filterMonth}월` : ' 전체'}` : ' — 전체'}`
    : `일반 출력 (전체 ${entries.length}개)`;

  return (
    <>
      <div className="no-print" style={{
        padding: '10px 20px', background: '#111', color: '#eee',
        fontSize: 13, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <span style={{fontWeight:700, color:'#7dd3fc'}}>LOGBOOK v2 인쇄 미리보기</span>
        <span style={{color:'#94a3b8'}}>{modeLabel}</span>
        <span style={{color:'#64748b', marginLeft:'auto'}}>
          Ctrl+P (Mac: ⌘P) 를 눌러 인쇄하세요.
        </span>
      </div>

      {mode === 'monthly'
        ? <MonthlyPrint entries={entries} filterYear={filterYear} filterMonth={filterMonth}/>
        : <NormalPrint entries={entries}/>
      }
    </>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function LogbookPrintPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }}/>
      <Suspense fallback={<div style={{padding:20}}>로딩 중…</div>}>
        <PrintContent/>
      </Suspense>
    </>
  );
}
