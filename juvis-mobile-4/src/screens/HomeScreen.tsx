import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  SafeAreaView, ActivityIndicator, Alert, ScrollView, PanResponder,
  LayoutAnimation, UIManager, Platform, Image, Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';

// Enable LayoutAnimation on Android for smooth drag reordering
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Paths, File as EXFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { printToFileAsync } from 'expo-print';
import {
  LogbookEntry, getAllEntries, deleteEntry,
  parseTimeToMinutes, minutesToTimeStr, updateSortOrders,
  runMigrationReverseSortOrderIfNeeded,
  runMigrationFixSortOrderGlobalIfNeeded,
} from '../lib/database';

// ─── Eastar Jet logo (base64 PNG) ─────────────────────────────────────────────
const EASTAR_LOGO_B64 = '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';

// ─── Brand Colors ──────────────────────────────────────────────────────────────
const RED = '#DC1E28';
const BG = '#FFFFFF';
const CARD_BG = '#F5F5F5';
const BORDER = '#E0E0E0';
const TEXT = '#1A1A1A';
const TEXT_DIM = '#666666';
const TH_BG = '#EDEDE6';
const TF_BG = '#DDE4F0';

// ─── Table column widths ──────────────────────────────────────────────────────
const COL = {
  drag: 32,
  date: 44, type: 40, ident: 52, flt: 46,
  from: 36, to: 36,
  pic: 42, picus: 42, cop: 42, ip: 28, tr: 28,
  block: 42, night: 36, inst: 36, app: 76,
  tod: 24, ton: 24, ldd: 24, ldn: 24,
  remark: 100,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  block: string; night: string;
  pic: string; picus: string; cop: string; ip: string; tr: string; inst: string;
  toDay: number; toNight: number; ldDay: number; ldNight: number;
  count: number;
}

interface Props {
  onNavigate: (screen: 'import' | 'newEntry' | 'mainMenu') => void;
  onEdit: (entry: LogbookEntry) => void;
  refreshTrigger: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcStats(entries: LogbookEntry[]): Stats {
  let block = 0, night = 0, pic = 0, picus = 0, cop = 0, ip = 0, tr = 0, inst = 0;
  let toDay = 0, toNight = 0, ldDay = 0, ldNight = 0;
  for (const e of entries) {
    block += parseTimeToMinutes(e.block);
    night += parseTimeToMinutes(e.night);
    pic += parseTimeToMinutes(e.pic);
    picus += parseTimeToMinutes(e.picus);
    cop += parseTimeToMinutes(e.cop);
    ip += parseTimeToMinutes(e.ip);
    tr += parseTimeToMinutes(e.tr);
    inst += parseTimeToMinutes(e.inst);
    toDay += e.to_d ? 1 : 0;
    toNight += e.to_n ? 1 : 0;
    ldDay += e.ld_d ? 1 : 0;
    ldNight += e.ld_n ? 1 : 0;
  }
  const fmt = (m: number) => (m > 0 ? minutesToTimeStr(m) : '—');
  return {
    block: fmt(block), night: fmt(night),
    pic: fmt(pic), picus: fmt(picus), cop: fmt(cop), ip: fmt(ip), tr: fmt(tr), inst: fmt(inst),
    toDay, toNight, ldDay, ldNight, count: entries.length,
  };
}

function getStatItems(stats: Stats) {
  return [
    { label: 'PIC',      value: stats.pic     },
    { label: 'PICUS',    value: stats.picus   },
    { label: 'CO-PILOT', value: stats.cop     },
    { label: 'IP',       value: stats.ip      },
    { label: 'TR',       value: stats.tr      },
    { label: 'BLOCK',    value: stats.block   },
    { label: 'NIGHT',    value: stats.night   },
    { label: 'INST',     value: stats.inst    },
    { label: 'TO-D',     value: stats.toDay   > 0 ? String(stats.toDay)   : '' },
    { label: 'TO-N',     value: stats.toNight > 0 ? String(stats.toNight) : '' },
    { label: 'LD-D',     value: stats.ldDay   > 0 ? String(stats.ldDay)   : '' },
    { label: 'LD-N',     value: stats.ldNight > 0 ? String(stats.ldNight) : '' },
  ].filter(item => item.value && item.value !== '—');
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

// Strip leading zero from H+MM display: "02+49" → "2+49", "0+50" → "0+50"
function fmtTime(t: string): string {
  if (!t) return '';
  const m = t.match(/^(\d+)\+(\d{2})$/);
  if (!m) return t;
  return `${parseInt(m[1], 10)}+${m[2]}`;
}

function getYear(e: LogbookEntry): string { return e.date?.slice(0, 4) ?? ''; }
function getMonth(e: LogbookEntry): string { return e.date?.slice(5, 7) ?? ''; }

function parseCrew(crewJson: string): string {
  if (!crewJson) return '';
  try {
    const arr = JSON.parse(crewJson) as { name: string; duty: string }[];
    return arr.filter((c) => c.name).map((c) => `${c.name}${c.duty ? '/' + c.duty : ''}`).join(', ');
  } catch { return ''; }
}

function crewAndRemark(e: LogbookEntry): string {
  return [parseCrew(e.crew ?? ''), e.remark].filter(Boolean).join(' | ');
}

// ─── PDF HTML Generator ───────────────────────────────────────────────────────

function generatePrintHTML(entries: LogbookEntry[], logoB64: string = EASTAR_LOGO_B64): string {
  const parseTime = (s: string) => {
    if (!s) return 0;
    const m = s.match(/^(\d+)\+(\d{2})$/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
  };
  const T = (min: number) => min > 0 ? `${Math.floor(min / 60)}+${String(min % 60).padStart(2, '0')}` : '';
  const Nc = (n: number) => n > 0 ? String(n) : '';
  const fD = (iso: string) => {
    if (!iso) return '';
    const p = iso.split('-');
    return p.length >= 3 ? `${parseInt(p[1])}/${parseInt(p[2])}` : '';
  };

  interface PS {
    block: number; night: number; inst: number;
    pic: number; picus: number; cop: number; ip: number; tr: number;
    toD: number; toN: number; ldD: number; ldN: number;
  }
  const emptyPS = (): PS => ({ block:0,night:0,inst:0,pic:0,picus:0,cop:0,ip:0,tr:0,toD:0,toN:0,ldD:0,ldN:0 });
  const addPS = (a: PS, b: PS): PS => ({
    block:a.block+b.block, night:a.night+b.night, inst:a.inst+b.inst,
    pic:a.pic+b.pic, picus:a.picus+b.picus, cop:a.cop+b.cop,
    ip:a.ip+b.ip, tr:a.tr+b.tr,
    toD:a.toD+b.toD, toN:a.toN+b.toN, ldD:a.ldD+b.ldD, ldN:a.ldN+b.ldN,
  });
  const fromEntry = (e: LogbookEntry): PS => ({
    block:parseTime(e.block), night:parseTime(e.night), inst:parseTime(e.inst),
    pic:parseTime(e.pic), picus:parseTime(e.picus), cop:parseTime(e.cop),
    ip:parseTime(e.ip), tr:parseTime(e.tr),
    toD:e.to_d?1:0, toN:e.to_n?1:0, ldD:e.ld_d?1:0, ldN:e.ld_n?1:0,
  });
  const sumPS = (es: LogbookEntry[]) => es.reduce((acc, e) => addPS(acc, fromEntry(e)), emptyPS());

  const sorted = [...entries].sort((a, b) => {
    const dateCmp = (a.date ?? '').localeCompare(b.date ?? '');
    if (dateCmp !== 0) return dateCmp;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const ROWS = 12;
  const chunks: LogbookEntry[][] = [];
  for (let i = 0; i < Math.max(sorted.length, 1); i += ROWS) chunks.push(sorted.slice(i, i + ROWS));
  if (chunks.length === 0) chunks.push([]);

  // 페이지별 순서 진단 로그
  chunks.forEach((chunk, pi) => {
    if (chunk.length === 0) return;
    const first = chunk[0];
    const last  = chunk[chunk.length - 1];
    console.log(
      `[PDF] page ${pi + 1}/${chunks.length}` +
      ` | first: ${first.date} so=${first.sort_order}` +
      ` | last: ${last.date} so=${last.sort_order}`
    );
  });

  const css = `
    @page { size: 250mm 176mm landscape; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
    .lb-page { width: 100%; margin: 0; }
    .lb-logo { display: flex; justify-content: flex-end; margin-bottom: 2mm; }
    .lb-logo-img { display: block; height: 24px; width: auto; max-width: 120px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #555; font-size: 6.5pt; padding: 0 1pt; text-align: center; vertical-align: middle; line-height: 1.2; color: #000; }
    .th-g { background: #d4d4d4; font-weight: 700; }
    .th-s { background: #e8e8e8; font-weight: 600; }
    .dr { height: 8mm; }
    .dr-even { background: #fff; }
    .dr-odd { background: #f8f8f8; }
    .dr td { font-size: 8pt; line-height: 1.4; }
    .fr { background: #dde4f0; }
    .fl { text-align: left; font-weight: 700; font-size: 6pt; padding-left: 2pt; }
    .fb { font-size: 7pt; font-weight: 700; display: block; }
    .sig { text-align: left; vertical-align: top; padding: 3pt 4pt; font-size: 6pt; height: 18mm; max-height: 18mm; }
    .fr-row { height: 6mm; max-height: 6mm; }
    tfoot { display: table-footer-group; height: 18mm; max-height: 18mm; }
    .td-remark { text-align: left; font-size: 6.5pt; white-space: normal; word-break: break-all; overflow: hidden; vertical-align: middle; padding: 1pt; }
    .pagebreak { page-break-after: always; }
  `;

  const colgroup = `<colgroup>
    <col style="width:9mm"/><col style="width:9mm"/><col style="width:11mm"/>
    <col style="width:8mm"/><col style="width:7mm"/><col style="width:7mm"/>
    <col style="width:8mm"/><col style="width:8mm"/><col style="width:8mm"/>
    <col style="width:7mm"/><col style="width:7mm"/>
    <col style="width:8mm"/><col style="width:8mm"/><col style="width:8mm"/>
    <col style="width:20mm"/>
    <col style="width:5mm"/><col style="width:5mm"/><col style="width:5mm"/><col style="width:5mm"/>
    <col style="width:26mm"/>
  </colgroup>`;

  function theadHTML(year: number): string {
    return `<thead>
      <tr>
        <th rowspan="3" class="th-s"><span style="display:block;font-size:5.5pt;font-weight:600">YEAR</span><span style="display:block;font-size:9pt;font-weight:700">${year}</span><span style="display:block;font-size:5.5pt">DATE<br/>(M/D)</span></th>
        <th colspan="2" class="th-g">AIRCRAFT</th>
        <th colspan="3" class="th-g">ROUTE OF FLIGHT</th>
        <th colspan="5" class="th-g">TYPE OF PILOTING TIME</th>
        <th colspan="8" class="th-g">CONDITIONS OF FLIGHT</th>
        <th rowspan="3" class="th-s" style="text-align:left;padding-left:2pt;font-size:6pt">REMARK</th>
      </tr>
      <tr>
        <th rowspan="2" class="th-s">A/C<br/>TYPE</th><th rowspan="2" class="th-s">A/C<br/>IDENT</th>
        <th rowspan="2" class="th-s">FLT<br/>NO.</th><th rowspan="2" class="th-s">FROM</th><th rowspan="2" class="th-s">TO</th>
        <th rowspan="2" class="th-s">PIC</th><th rowspan="2" class="th-s" style="font-size:5.5pt">PIC<br/>UNDER<br/>SUPVSN</th>
        <th rowspan="2" class="th-s" style="font-size:6pt">CO-<br/>PILOT</th>
        <th rowspan="2" class="th-s">IP</th><th rowspan="2" class="th-s">TR</th>
        <th rowspan="2" class="th-s">BLOCK<br/>TIME</th><th rowspan="2" class="th-s">NIGHT</th><th rowspan="2" class="th-s">INST</th>
        <th rowspan="2" class="th-s" style="font-size:6pt">APP<br/>TYPE</th>
        <th colspan="2" class="th-s">T/O</th><th colspan="2" class="th-s">L/D</th>
      </tr>
      <tr>
        <th class="th-s">D</th><th class="th-s">N</th><th class="th-s">D</th><th class="th-s">N</th>
      </tr>
    </thead>`;
  }

  function dataRowHTML(e: LogbookEntry | null, idx: number): string {
    const cls = `dr ${idx % 2 === 0 ? 'dr-even' : 'dr-odd'}`;
    if (!e) return `<tr class="${cls}">${'<td></td>'.repeat(20)}</tr>`;
    let crewArr: { name: string; duty: string }[] = [];
    try { crewArr = e.crew ? JSON.parse(e.crew) : []; } catch {}
    const crewStr = crewArr.filter(c => c.name).map(c => `${c.name}${c.duty ? '/' + c.duty : ''}`).join(', ');
    const remark = [crewStr, e.remark].filter(Boolean).join(' | ');
    return `<tr class="${cls}">
      <td>${fD(e.date)}</td><td>${e.ac_type||''}</td><td>${e.ac_ident||''}</td>
      <td>${e.flt_no||''}</td><td>${e.from_apt||''}</td><td>${e.to_apt||''}</td>
      <td style="font-weight:${e.pic?'700':'400'}">${e.pic||''}</td>
      <td style="font-weight:${e.picus?'700':'400'}">${e.picus||''}</td>
      <td style="font-weight:${e.cop?'700':'400'}">${e.cop||''}</td>
      <td>${e.ip||''}</td><td>${e.tr||''}</td>
      <td style="font-weight:700">${e.block||''}</td>
      <td>${e.night||''}</td><td>${e.inst||''}</td>
      <td style="text-align:left">${e.app_type||''}</td>
      <td>${e.to_d?'&#10003;':''}</td><td>${e.to_n?'&#10003;':''}</td>
      <td>${e.ld_d?'&#10003;':''}</td><td>${e.ld_n?'&#10003;':''}</td>
      <td class="td-remark">${remark}</td>
    </tr>`;
  }

  function footerHTML(pageSt: PS, fwdSt: PS, totalSt: PS): string {
    const tk: (keyof PS)[] = ['pic','picus','cop','ip','tr','block','night','inst'];
    const ck: (keyof PS)[] = ['toD','toN','ldD','ldN'];
    const FV = (v: string) => `<td class="fr"><span class="fb">${v}</span></td>`;
    const r = (st: PS, keys: (keyof PS)[], isCnt: boolean) =>
      keys.map(k => FV(isCnt ? Nc(st[k] as number) : T(st[k] as number))).join('');
    return `
      <tr class="fr-row">
        <td colspan="3" rowspan="3" class="sig"><div style="display:flex;flex-direction:column;justify-content:space-between;height:14mm;"><span>PILOT'S SIGNATURE</span><span style="font-size:5.5pt">THIS RECORD IS CERTIFIED TRUE AND CORRECT</span></div></td>
        <td colspan="3" class="fr fl">PAGE TOTALS</td>${r(pageSt,tk,false)}<td class="fr"></td>${r(pageSt,ck,true)}<td class="fr"></td>
      </tr>
      <tr class="fr-row">
        <td colspan="3" class="fr fl">AMT. FORWARDED</td>${r(fwdSt,tk,false)}<td class="fr"></td>${r(fwdSt,ck,true)}<td class="fr"></td>
      </tr>
      <tr class="fr-row">
        <td colspan="3" class="fr fl">TOTALS TO DATE</td>${r(totalSt,tk,false)}<td class="fr"></td>${r(totalSt,ck,true)}<td class="fr"></td>
      </tr>`;
  }

  let pagesHTML = '';
  let cum = emptyPS();
  chunks.forEach((chunk, pi) => {
    const rows = [...chunk];
    while (rows.length < ROWS) rows.push(null as unknown as LogbookEntry);
    const pageSt = sumPS(chunk);
    const fwdSt = cum;
    const totalSt = addPS(fwdSt, pageSt);
    cum = totalSt;
    const year = chunk.find(e => e?.date) ? parseInt(chunk.find(e => e?.date)!.date.substring(0, 4)) || new Date().getFullYear() : new Date().getFullYear();
    const isLast = pi === chunks.length - 1;
    const padLeft  = pi % 2 === 0 ? '15mm' : '5mm';
    const padRight = pi % 2 === 0 ? '5mm'  : '15mm';
    console.log('[PDF] page ' + (pi + 1) + ': paddingLeft=' + padLeft + ', paddingRight=' + padRight);
    pagesHTML += `<div class="lb-page${!isLast ? ' pagebreak' : ''}" style="padding: 10mm ${padRight} 8mm ${padLeft};">
      <div class="lb-logo"><img src="data:image/png;base64,${logoB64}" class="lb-logo-img" alt="" /></div>
      <table>${colgroup}${theadHTML(year)}<tbody>${rows.map((e, i) => dataRowHTML(e, i)).join('')}</tbody>
      <tfoot>${footerHTML(pageSt, fwdSt, totalSt)}</tfoot></table>
    </div>`;
  });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${pagesHTML}</body></html>`;
}

// ─── AppHeader ────────────────────────────────────────────────────────────────

function AppHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
        <Text style={s.backToMenu}>← 메뉴</Text>
      </TouchableOpacity>
      <View style={s.logoBox}>
        <Text style={s.logoText}>EASTAR JET</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.appTitle}>이스타항공 모바일{'\n'}파일럿 로그북</Text>
        <Text style={s.appSub}>EastarJet Mobile Pilot's Logbook</Text>
      </View>
    </View>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({
  value, options, labels, onSelect, width = 100,
}: {
  value: string; options: string[]; labels?: string[];
  onSelect: (v: string) => void; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = labels ? labels[options.indexOf(value)] ?? value : value;
  return (
    <>
      <TouchableOpacity style={[s.dropdown, { width }]} onPress={() => setOpen(true)}>
        <Text style={s.dropdownText}>{displayLabel}</Text>
        <Text style={s.dropdownArrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[s.dropdownMenu, { minWidth: width }]}>
            {options.map((opt, i) => (
              <TouchableOpacity
                key={opt || '_all'}
                style={[s.dropdownItem, opt === value && s.dropdownItemActive]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[s.dropdownItemText, opt === value && s.dropdownItemTextActive]}>
                  {labels ? labels[i] : opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value || '—'}</Text>
    </View>
  );
}

// ─── Drag handle icon (visual hint only — no touch handlers) ─────────────────

const ROW_HEIGHT = 36;

function DragHandleIcon() {
  return (
    <View style={s.dragHandle}>
      <Text style={s.dragHandleText}>☰</Text>
    </View>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry, rowIndex, isDragged, isAnyDragActive, onPress,
  onDragStart, onDragMove, onDragEnd,
}: {
  entry: LogbookEntry;
  rowIndex: number;
  isDragged: boolean;
  isAnyDragActive: boolean;
  onPress: () => void;
  onDragStart: (fromIdx: number) => void;
  onDragMove: (dy: number) => void;
  onDragEnd: (dy: number) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isDragged ? 1.03 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 180,
    }).start();
    Animated.spring(shadowAnim, {
      toValue: isDragged ? 1 : 0,
      useNativeDriver: false,
      friction: 6,
      tension: 180,
    }).start();
  }, [isDragged]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refs to keep callbacks fresh inside PanResponder closure
  const isDragActiveRef = useRef(false);
  const startYRef = useRef(0);
  const activateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowIndexRef = useRef(rowIndex);
  const isAnyDragActiveRef = useRef(isAnyDragActive);
  const onPressRef = useRef(onPress);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);

  // Keep refs current; freeze rowIndex once drag starts
  if (!isDragActiveRef.current) rowIndexRef.current = rowIndex;
  isAnyDragActiveRef.current = isAnyDragActive;
  onPressRef.current = onPress;
  onDragStartRef.current = onDragStart;
  onDragMoveRef.current = onDragMove;
  onDragEndRef.current = onDragEnd;

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the responder if no other row is currently dragging
      onStartShouldSetPanResponder: () => !isAnyDragActiveRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      // Once drag is active, keep all move events
      onMoveShouldSetPanResponder: () => isDragActiveRef.current,
      onMoveShouldSetPanResponderCapture: () => isDragActiveRef.current,
      // Allow ScrollView to reclaim gestures when not dragging
      onPanResponderTerminationRequest: () => !isDragActiveRef.current,

      onPanResponderGrant: (e) => {
        startYRef.current = e.nativeEvent.pageY;
        // Start 300ms long-press timer to activate drag
        activateTimerRef.current = setTimeout(() => {
          isDragActiveRef.current = true;
          console.log('[Drag] long-press activated, rowIndex:', rowIndexRef.current);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onDragStartRef.current(rowIndexRef.current);
        }, 300);
      },

      onPanResponderMove: (e) => {
        const dy = e.nativeEvent.pageY - startYRef.current;
        if (!isDragActiveRef.current) {
          // Cancel long-press timer if finger moved significantly
          if (Math.abs(dy) > 8 && activateTimerRef.current) {
            clearTimeout(activateTimerRef.current);
            activateTimerRef.current = null;
          }
          return;
        }
        onDragMoveRef.current(dy);
      },

      onPanResponderRelease: (e) => {
        const wasDragging = isDragActiveRef.current;
        if (activateTimerRef.current) {
          clearTimeout(activateTimerRef.current);
          activateTimerRef.current = null;
        }
        isDragActiveRef.current = false;
        if (wasDragging) {
          onDragEndRef.current(e.nativeEvent.pageY - startYRef.current);
        } else {
          // Short tap — show action sheet
          onPressRef.current();
        }
      },

      onPanResponderTerminate: () => {
        if (activateTimerRef.current) {
          clearTimeout(activateTimerRef.current);
          activateTimerRef.current = null;
        }
        if (isDragActiveRef.current) {
          onDragEndRef.current(0);
        }
        isDragActiveRef.current = false;
      },
    })
  ).current;

  const remark = crewAndRemark(entry);
  // shadowOpacity/elevation: layout 속성 → useNativeDriver:false (JS driver)
  const shadowOpacity = shadowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });
  const elevation = shadowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  // 두 드라이버를 분리: 외부 View(JS driver, shadow) → 내부 View(native driver, scale)
  return (
    <Animated.View
      style={[s.dataRow, isDragged && s.dataRowDragging, { shadowOpacity, elevation }]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1, flexDirection: 'row' }}>
        <DragHandleIcon />
        <View style={{ flexDirection: 'row' }}>
          <Text style={[s.td, { width: COL.date }]}>{fmtDate(entry.date)}</Text>
          <Text style={[s.td, { width: COL.type }]}>{entry.ac_type}</Text>
          <Text style={[s.td, { width: COL.ident, fontSize: 10 }]}>{entry.ac_ident}</Text>
          <Text style={[s.td, { width: COL.flt }]}>{entry.flt_no}</Text>
          <Text style={[s.td, { width: COL.from }]}>{entry.from_apt}</Text>
          <Text style={[s.td, { width: COL.to }]}>{entry.to_apt}</Text>
          <Text style={[s.td, { width: COL.pic, fontWeight: entry.pic ? '700' : '400' }]}>{fmtTime(entry.pic)}</Text>
          <Text style={[s.td, { width: COL.picus, fontWeight: entry.picus ? '700' : '400' }]}>{fmtTime(entry.picus)}</Text>
          <Text style={[s.td, { width: COL.cop, fontWeight: entry.cop ? '700' : '400' }]}>{fmtTime(entry.cop)}</Text>
          <Text style={[s.td, { width: COL.ip }]}>{fmtTime(entry.ip)}</Text>
          <Text style={[s.td, { width: COL.tr }]}>{fmtTime(entry.tr)}</Text>
          <Text style={[s.td, { width: COL.block, fontWeight: '700' }]}>{fmtTime(entry.block)}</Text>
          <Text style={[s.td, { width: COL.night }]}>{fmtTime(entry.night)}</Text>
          <Text style={[s.td, { width: COL.inst }]}>{fmtTime(entry.inst)}</Text>
          <Text style={[s.td, { width: COL.app, textAlign: 'left', paddingLeft: 3, fontSize: 10 }]}>{entry.app_type || ''}</Text>
          <Text style={[s.td, { width: COL.tod, color: RED }]}>{entry.to_d ? '✓' : ''}</Text>
          <Text style={[s.td, { width: COL.ton, color: RED }]}>{entry.to_n ? '✓' : ''}</Text>
          <Text style={[s.td, { width: COL.ldd, color: '#7C3AED' }]}>{entry.ld_d ? '✓' : ''}</Text>
          <Text style={[s.td, { width: COL.ldn, color: '#7C3AED' }]}>{entry.ld_n ? '✓' : ''}</Text>
          <Text style={[s.td, { width: COL.remark, textAlign: 'left', paddingLeft: 3, fontSize: 10 }]} numberOfLines={1}>{remark}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function HomeScreen({ onNavigate, onEdit, refreshTrigger }: Props) {
  const [allEntries, setAllEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pendingPdfEntries, setPendingPdfEntries] = useState<LogbookEntry[] | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Run one-time migrations on very first call
      await runMigrationReverseSortOrderIfNeeded();
      await runMigrationFixSortOrderGlobalIfNeeded();
      const data = await getAllEntries();
      setAllEntries(data);
      if (data.length > 0 && !selectedYear) {
        const years = Array.from(new Set(data.map(getYear).filter(Boolean))).sort().reverse();
        if (years.length > 0) setSelectedYear(years[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAll(); }, [loadAll, refreshTrigger]);

  const availableYears = useMemo(() => {
    const s = new Set(allEntries.map(getYear).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [allEntries]);

  const yearOptions = useMemo(() => ['', ...availableYears], [availableYears]);
  const yearLabels = useMemo(() => ['전체', ...availableYears.map((y) => `${y}년`)], [availableYears]);

  const availableMonths = useMemo(() => {
    const src = selectedYear ? allEntries.filter((e) => getYear(e) === selectedYear) : allEntries;
    const s = new Set(src.map(getMonth).filter(Boolean));
    return Array.from(s).sort();
  }, [allEntries, selectedYear]);

  useEffect(() => {
    if (selectedMonth && !availableMonths.includes(selectedMonth)) setSelectedMonth('');
  }, [availableMonths]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat list of PDF export options: total → per year → per month
  const pdfOptions = useMemo(() => {
    type Opt = { label: string; entries: LogbookEntry[]; isSection: boolean };
    const opts: Opt[] = [];
    opts.push({ label: `전체 저장 (${allEntries.length}편)`, entries: allEntries, isSection: false });
    for (const year of availableYears) {
      const ye = allEntries.filter((e) => getYear(e) === year);
      opts.push({ label: `${year}년 전체 (${ye.length}편)`, entries: ye, isSection: true });
      const months = Array.from(new Set(ye.map(getMonth).filter(Boolean))).sort();
      for (const m of months) {
        const me = ye.filter((e) => getMonth(e) === m);
        opts.push({ label: `    ${year}년 ${parseInt(m)}월 (${me.length}편)`, entries: me, isSection: false });
      }
    }
    return opts;
  }, [allEntries, availableYears]);

  const filteredEntries = useMemo(() => {
    let r = allEntries;
    if (selectedYear) r = r.filter((e) => getYear(e) === selectedYear);
    if (selectedMonth) r = r.filter((e) => getMonth(e) === selectedMonth);
    const out = [...r].sort((a, b) => {
      const dateCmp = sortDesc
        ? (b.date ?? '').localeCompare(a.date ?? '')
        : (a.date ?? '').localeCompare(b.date ?? '');
      if (dateCmp !== 0) return dateCmp;
      // 같은 날짜 내에서도 정렬 방향 동일 적용
      return sortDesc
        ? (b.sort_order ?? 0) - (a.sort_order ?? 0)  // 최신순: 나중 입력(높은 so)이 위
        : (a.sort_order ?? 0) - (b.sort_order ?? 0); // 과거순: 먼저 입력(낮은 so)이 위
    });
    return out;
  }, [allEntries, selectedYear, selectedMonth, sortDesc]);

  const totalStats = useMemo(() => calcStats(allEntries), [allEntries]);
  const filteredStats = useMemo(() => calcStats(filteredEntries), [filteredEntries]);

  const isFiltered = selectedYear !== '' || selectedMonth !== '';
  const filterLabel = selectedYear
    ? `${selectedYear}${selectedMonth ? `년 ${parseInt(selectedMonth)}월` : '년'}`
    : '전체';

  const handleDelete = async (entry: LogbookEntry) => {
    Alert.alert(
      '삭제',
      `${entry.flt_no || entry.date} 기록을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            await deleteEntry(entry.id);
            setAllEntries((prev) => prev.filter((e) => e.id !== entry.id));
          },
        },
      ]
    );
  };

  // ─── Drag-and-drop reorder ────────────────────────────────────────────────────

  const [dragInfo, setDragInfo] = useState<{ fromIdx: number; toIdx: number } | null>(null);
  const dragFromIdxRef = useRef<number | null>(null);

  // 순서 변경 감지 → Light 햅틱
  const prevToIdxRef = useRef<number | null>(null);
  useEffect(() => {
    const cur = dragInfo?.toIdx ?? null;
    if (cur !== null && prevToIdxRef.current !== null && prevToIdxRef.current !== cur) {
      console.log('[Drag] order swap haptic, toIdx:', cur);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    prevToIdxRef.current = cur;
  }, [dragInfo?.toIdx]);

  const displayEntries = useMemo(() => {
    if (!dragInfo || dragInfo.fromIdx === dragInfo.toIdx) return filteredEntries;
    const arr = [...filteredEntries];
    const [moved] = arr.splice(dragInfo.fromIdx, 1);
    arr.splice(dragInfo.toIdx, 0, moved);
    return arr;
  }, [filteredEntries, dragInfo]);

  const handleDragStart = useCallback((fromIdx: number) => {
    dragFromIdxRef.current = fromIdx;
    setDragInfo({ fromIdx, toIdx: fromIdx });
  }, []);

  const handleDragMove = useCallback((dy: number) => {
    setDragInfo(prev => {
      if (!prev) return null;
      const toIdx = Math.max(0, Math.min(filteredEntries.length - 1, prev.fromIdx + Math.round(dy / ROW_HEIGHT)));
      if (toIdx === prev.toIdx) return prev;
      // Animate the row shuffle when the target slot changes
      LayoutAnimation.configureNext({
        duration: 180,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.7 },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
      return { ...prev, toIdx };
    });
  }, [filteredEntries.length]);

  const handleDragEndCommit = useCallback(async (dy: number) => {
    const fromIdx = dragFromIdxRef.current;
    setDragInfo(null);
    if (fromIdx === null) return;
    dragFromIdxRef.current = null;
    const toIdx = Math.max(0, Math.min(filteredEntries.length - 1, fromIdx + Math.round(dy / ROW_HEIGHT)));
    if (fromIdx === toIdx) return;

    // 드래그 후 화면 표시 순서
    const newFiltered = [...filteredEntries];
    const [moved] = newFiltered.splice(fromIdx, 1);
    newFiltered.splice(toIdx, 0, moved);

    console.log('[Drag] moved:', moved.flt_no, 'from idx', fromIdx, '→', toIdx);
    console.log('[Drag] before so:', filteredEntries.map(e => `${e.flt_no}(${e.sort_order})`).join(', '));

    // filteredEntries가 차지하는 sort_order 슬롯을 ASC로 수집
    const slots = [...filteredEntries]
      .map(e => e.sort_order ?? 0)
      .sort((a, b) => a - b);

    // 화면 표시 순서 → 절대 순서(sort_order ASC) 변환:
    // date가 다른 항목은 date ASC가 절대 우선.
    // 같은 date 내에서는 드래그 후 화면 위치(displayPos)로 결정하되,
    // sortDesc=true면 displayPos가 sort_order DESC를 의미하므로 역방향.
    const displayPos = new Map(newFiltered.map((e, i) => [e.id, i]));
    const absOrdered = [...newFiltered].sort((a, b) => {
      const dc = (a.date ?? '').localeCompare(b.date ?? '');
      if (dc !== 0) return dc;
      const dpCmp = (displayPos.get(a.id) ?? 0) - (displayPos.get(b.id) ?? 0);
      return sortDesc ? -dpCmp : dpCmp;
    });

    // 슬롯을 절대 순서대로 재배정
    const idToSortOrder = new Map<string, number>(
      absOrdered.map((e, i) => [e.id, slots[i]])
    );

    console.log('[Drag] after so:', absOrdered.map(e => `${e.flt_no}(${idToSortOrder.get(e.id)})`).join(', '));

    const updatedAll = allEntries.map(e =>
      idToSortOrder.has(e.id) ? { ...e, sort_order: idToSortOrder.get(e.id)! } : e
    );

    console.log('[Drag] drop settled');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    prevToIdxRef.current = null;

    setAllEntries(updatedAll);
    await updateSortOrders(
      [...idToSortOrder.entries()].map(([id, sort_order]) => ({ id, sort_order }))
    );
  }, [filteredEntries, allEntries, sortDesc]);

  // ─── CSV Export ──────────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    console.log('[CSV Export] button pressed, entries:', allEntries.length);
    if (allEntries.length === 0) { Alert.alert('알림', '내보낼 기록이 없습니다.'); return; }
    setExporting(true);
    try {
      const headers = ['id','date','ac_type','ac_ident','flt_no','from_apt','to_apt',
        'pic','picus','cop','ip','tr','block','night','inst','app_type',
        'to_d','to_n','ld_d','ld_n','remark','created_at','sort_order'];
      // 화면 정렬 상태(sortDesc)와 무관하게 항상 과거순 고정
      const exportData = [...allEntries].sort((a, b) => {
        if (a.date !== b.date) return (a.date ?? '').localeCompare(b.date ?? '');
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      const head = exportData.slice(0, 5).map(e => e.date);
      const tail = exportData.slice(-5).map(e => e.date);
      console.log('[CSV Export] export order fixed: date ASC + sort_order ASC');
      console.log('[CSV Export] first 5 dates:', head.join(', '));
      console.log('[CSV Export] last 5 dates:', tail.join(', '));
      const rows = exportData.map(e => [
        e.id, e.date, e.ac_type, e.ac_ident, e.flt_no, e.from_apt, e.to_apt,
        e.pic, e.picus, e.cop, e.ip, e.tr, e.block, e.night, e.inst, e.app_type,
        e.to_d, e.to_n, e.ld_d, e.ld_n, e.remark, e.created_at, e.sort_order,
      ]);
      const csv = '\uFEFF' + [headers, ...rows]
        .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const csvFile = new EXFile(Paths.cache, `logbook_export_${Date.now()}.csv`);
      console.log('[CSV Export] writing to:', csvFile.uri);
      csvFile.write(csv);
      console.log('[CSV Export] write done, calling shareAsync...');
      await Sharing.shareAsync(csvFile.uri, { mimeType: 'text/csv', dialogTitle: 'CSV 내보내기' });
      console.log('[CSV Export] shareAsync returned');
    } catch (e) {
      console.error('[CSV Export] error:', String(e));
      Alert.alert('오류', `CSV 내보내기 실패: ${String(e)}`);
    } finally {
      console.log('[CSV Export] finally: setExporting(false)');
      setExporting(false);
    }
  };

  // ─── PDF Export ───────────────────────────────────────────────────────────────

  const doExportPDF = async (entries: LogbookEntry[]) => {
    console.log('[PDF Export] called, entries:', entries.length);
    if (entries.length === 0) { Alert.alert('알림', '내보낼 기록이 없습니다.'); return; }
    setExporting(true);
    try {
      // ── 로고 동적 로딩 (FileSystem 우선, 실패 시 임베디드 fallback) ──────────
      let logoB64 = EASTAR_LOGO_B64;
      try {
        const src = Image.resolveAssetSource(require('../../assets/eastar-logo.png'));
        console.log('[PDF Export] logo asset URI:', src.uri);
        const b64 = await new EXFile(src.uri).base64();
        logoB64 = b64;
        console.log('[PDF Export] logo loaded from FileSystem, length:', b64.length);
      } catch (e) {
        console.log('[PDF Export] logo FileSystem read failed, using embedded b64. Reason:', String(e));
      }

      console.log('[PDF Export] logoB64 length:', logoB64.length);
      console.log('[PDF Export] generating HTML...');
      const html = generatePrintHTML(entries, logoB64);
      console.log('[PDF Export] HTML length:', html.length, '— calling printToFileAsync (60s timeout)');
      // B5 landscape: 250mm × 176mm → 1mm ≈ 2.8346pt
      // width = 250 × 2.8346 ≈ 709, height = 176 × 2.8346 ≈ 499
      const { uri } = await Promise.race([
        printToFileAsync({ html, base64: false, width: 709, height: 499 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PDF 생성 시간 초과 (60초)')), 60000)
        ),
      ]);
      console.log('[PDF Export] printToFileAsync done, uri:', uri);

      // ── 진단: PDF 파일 유효성 확인 ──────────────────────────────────────────
      const pdfFile = new EXFile(uri);
      console.log('[PDF Export] file size:', pdfFile.size);

      // ── 진단: Sharing 가용성 확인 ────────────────────────────────────────────
      const sharingAvailable = await Sharing.isAvailableAsync();
      console.log('[PDF Export] Sharing.isAvailableAsync():', sharingAvailable);
      if (!sharingAvailable) {
        Alert.alert('공유 불가', '이 기기에서는 파일 공유 기능을 사용할 수 없습니다.');
        return;
      }

      // ── cacheDirectory 로 복사 (named URI 사용) ──────────────────────────────
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const namedFile = new EXFile(Paths.cache, `logbook_${stamp}.pdf`);
      console.log('[PDF Export] copying to:', namedFile.uri);
      pdfFile.copy(namedFile);
      console.log('[PDF Export] copied file size:', namedFile.size);

      // ── 공유 (UTI 명시 — iOS에서 PDF sheet 정상 표시에 필요) ─────────────────
      console.log('[PDF Export] calling shareAsync with UTI...');
      await Sharing.shareAsync(namedFile.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'PDF 저장',
      });
      console.log('[PDF Export] shareAsync returned');
    } catch (e) {
      console.error('[PDF Export] error:', String(e));
      Alert.alert('PDF 오류', String(e));
    } finally {
      console.log('[PDF Export] finally: setExporting(false)');
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <AppHeader onBack={() => onNavigate('mainMenu')} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} scrollEnabled={!dragInfo}>

        {/* ─── Year / Month Filter ─── */}
        <View style={s.filterSection}>
          <View style={s.yearRow}>
            <Text style={s.filterLabel}>연도</Text>
            <Dropdown
              value={selectedYear}
              options={yearOptions}
              labels={yearLabels}
              onSelect={(v) => { setSelectedYear(v); setSelectedMonth(''); }}
              width={100}
            />
            {loading && <ActivityIndicator size="small" color={RED} style={{ marginLeft: 8 }} />}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={s.sortBtn}
              onPress={() => setSortDesc((prev) => !prev)}
            >
              <Text style={s.sortBtnText}>{sortDesc ? '최신순 ↓' : '과거순 ↑'}</Text>
            </TouchableOpacity>
            <Text style={s.entryCount}>{filteredEntries.length}편</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.monthRow}>
            {(['', ...availableMonths] as string[]).map((m) => {
              const active = selectedMonth === m;
              return (
                <TouchableOpacity
                  key={m || '_all'}
                  style={[s.monthBtn, active && s.monthBtnActive]}
                  onPress={() => setSelectedMonth(m)}
                >
                  <Text style={[s.monthBtnText, active && s.monthBtnTextActive]}>
                    {m ? `${parseInt(m)}월` : '전체'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Total Stats ─── */}
        <View style={s.statsSection}>
          <Text style={s.statsTitle}>전체 합계 ({allEntries.length}편)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.statsRow}>
              {getStatItems(totalStats).map(item => (
                <StatCard key={item.label} label={item.label} value={item.value} />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ─── Filtered Stats (when filter applied) ─── */}
        {isFiltered && (
          <View style={[s.statsSection, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[s.statsTitle, { color: '#1D4ED8' }]}>{filterLabel} 합계 ({filteredEntries.length}편)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.statsRow}>
                {getStatItems(filteredStats).map(item => (
                  <StatCard key={item.label} label={item.label} value={item.value} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ─── Table ─── */}
        {filteredEntries.length === 0 && !loading ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>기록이 없습니다.</Text>
            <Text style={s.emptyHint}>+ 새 기록을 추가하거나 CSV를 불러오세요.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: COL.drag }]} />
                <Text style={[s.th, { width: COL.date }]}>M/D</Text>
                <Text style={[s.th, { width: COL.type }]}>TYPE</Text>
                <Text style={[s.th, { width: COL.ident }]}>IDENT</Text>
                <Text style={[s.th, { width: COL.flt }]}>FLT</Text>
                <Text style={[s.th, { width: COL.from }]}>FROM</Text>
                <Text style={[s.th, { width: COL.to }]}>TO</Text>
                <Text style={[s.th, { width: COL.pic }]}>PIC</Text>
                <Text style={[s.th, { width: COL.picus }]}>PICUS</Text>
                <Text style={[s.th, { width: COL.cop }]}>COP</Text>
                <Text style={[s.th, { width: COL.ip }]}>IP</Text>
                <Text style={[s.th, { width: COL.tr }]}>TR</Text>
                <Text style={[s.th, { width: COL.block }]}>BLOCK</Text>
                <Text style={[s.th, { width: COL.night }]}>NIGHT</Text>
                <Text style={[s.th, { width: COL.inst }]}>INST</Text>
                <Text style={[s.th, { width: COL.app }]}>APP TYPE</Text>
                <Text style={[s.th, { width: COL.tod }]}>T/D</Text>
                <Text style={[s.th, { width: COL.ton }]}>T/N</Text>
                <Text style={[s.th, { width: COL.ldd }]}>L/D</Text>
                <Text style={[s.th, { width: COL.ldn }]}>L/N</Text>
                <Text style={[s.th, { width: COL.remark, textAlign: 'left', paddingLeft: 3 }]}>REMARK</Text>
              </View>

              {displayEntries.map((entry, index) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  rowIndex={index}
                  isDragged={dragInfo !== null && entry.id === filteredEntries[dragInfo.fromIdx]?.id}
                  isAnyDragActive={dragInfo !== null}
                  onPress={() => {
                    Alert.alert(
                      entry.flt_no || entry.date || '기록',
                      undefined,
                      [
                        { text: '수정', onPress: () => onEdit(entry) },
                        { text: '삭제', style: 'destructive', onPress: () => handleDelete(entry) },
                        { text: '취소', style: 'cancel' },
                      ]
                    );
                  }}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEndCommit}
                />
              ))}

              {filteredEntries.length > 0 && (
                <View style={s.footerRow}>
                  <Text style={[s.tf, { width: COL.drag + COL.date + COL.type + COL.ident + COL.flt + COL.from + COL.to, textAlign: 'left', paddingLeft: 6, fontSize: 9 }]} numberOfLines={1}>
                    TOTALS ({filteredEntries.length})
                  </Text>
                  <Text style={[s.tf, { width: COL.pic, fontSize: 10 }]} numberOfLines={1}>{filteredStats.pic !== '—' ? filteredStats.pic : ''}</Text>
                  <Text style={[s.tf, { width: COL.picus, fontSize: 10 }]} numberOfLines={1}>{filteredStats.picus !== '—' ? filteredStats.picus : ''}</Text>
                  <Text style={[s.tf, { width: COL.cop, fontSize: 10 }]} numberOfLines={1}>{filteredStats.cop !== '—' ? filteredStats.cop : ''}</Text>
                  <Text style={[s.tf, { width: COL.ip, fontSize: 10 }]} numberOfLines={1}>{filteredStats.ip !== '—' ? filteredStats.ip : ''}</Text>
                  <Text style={[s.tf, { width: COL.tr, fontSize: 10 }]} numberOfLines={1}>{filteredStats.tr !== '—' ? filteredStats.tr : ''}</Text>
                  <Text style={[s.tf, { width: COL.block, fontSize: 10 }]} numberOfLines={1}>{filteredStats.block !== '—' ? filteredStats.block : ''}</Text>
                  <Text style={[s.tf, { width: COL.night, fontSize: 10 }]} numberOfLines={1}>{filteredStats.night !== '—' ? filteredStats.night : ''}</Text>
                  <Text style={[s.tf, { width: COL.inst, fontSize: 10 }]} numberOfLines={1}>{filteredStats.inst !== '—' ? filteredStats.inst : ''}</Text>
                  <Text style={[s.tf, { width: COL.app }]} />
                  <Text style={[s.tf, { width: COL.tod }]} numberOfLines={1}>{filteredStats.toDay || ''}</Text>
                  <Text style={[s.tf, { width: COL.ton }]} numberOfLines={1}>{filteredStats.toNight || ''}</Text>
                  <Text style={[s.tf, { width: COL.ldd }]} numberOfLines={1}>{filteredStats.ldDay || ''}</Text>
                  <Text style={[s.tf, { width: COL.ldn }]} numberOfLines={1}>{filteredStats.ldNight || ''}</Text>
                  <Text style={[s.tf, { width: COL.remark }]} />
                </View>
              )}
            </View>
          </ScrollView>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ─── Bottom Buttons ─── */}
      <View style={s.bottomBar}>
        <View style={s.btnRow}>
          <TouchableOpacity style={[s.bottomBtn, s.btnPrimary]} onPress={() => onNavigate('newEntry')}>
            <Text style={s.btnPrimaryText}>+ 새 기록</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.bottomBtn, s.btnSecondary]} onPress={() => onNavigate('import')}>
            <Text style={s.btnSecondaryText}>파일 불러오기</Text>
          </TouchableOpacity>
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.bottomBtn, s.btnExport, exporting && { opacity: 0.5 }]}
            onPress={handleExportCSV}
            disabled={exporting}
          >
            <Text style={s.btnExportText}>{exporting ? '처리 중...' : 'CSV 내보내기'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.bottomBtn, s.btnPdf, exporting && { opacity: 0.5 }]}
            onPress={() => {
              console.log('[PDF] 버튼 눌림 (exporting=' + exporting + ') — 모달 오픈');
              setShowPdfModal(true);
            }}
            disabled={exporting}
          >
            <Text style={s.btnPdfText}>{exporting ? '처리 중...' : 'PDF 저장'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── PDF Range Bottom Sheet ─── */}
      <Modal
        visible={showPdfModal}
        transparent
        animationType="slide"
        onDismiss={() => {
          if (pendingPdfEntries) {
            console.log('[PDF Export] 모달 닫힘 확인');
            const entries = pendingPdfEntries;
            setPendingPdfEntries(null);
            doExportPDF(entries);
          }
        }}
      >
        <TouchableOpacity style={s.pdfOverlay} activeOpacity={1} onPress={() => setShowPdfModal(false)}>
          <View style={s.pdfSheet} onStartShouldSetResponder={() => true}>
            <View style={s.pdfSheetHandle} />
            <Text style={s.pdfSheetTitle}>PDF 저장 범위 선택</Text>
            <ScrollView style={s.pdfSheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
              {pdfOptions.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.pdfMenuItem, opt.isSection && s.pdfMenuItemSection]}
                  onPress={() => {
                    setPendingPdfEntries(opt.entries);
                    setShowPdfModal(false);
                  }}
                >
                  <Text style={[s.pdfMenuItemText, opt.isSection && s.pdfMenuItemTextSection]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.pdfCancelBtn} onPress={() => setShowPdfModal(false)}>
              <Text style={s.pdfCancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: BG, borderBottomWidth: 2, borderBottomColor: RED, gap: 12,
  },
  backToMenu: { fontSize: 13, fontWeight: '600', color: RED, paddingRight: 8 },
  logoBox: { backgroundColor: RED, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  logoText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  appTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  appSub: { fontSize: 11, color: TEXT_DIM, marginTop: 1 },

  // Filter
  filterSection: {
    backgroundColor: '#FAFAF8', borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
  },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  filterLabel: { fontSize: 10, color: TEXT_DIM, fontWeight: '700' },
  entryCount: { color: TEXT_DIM, fontSize: 13 },
  sortBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
    borderWidth: 1, borderColor: BORDER, backgroundColor: BG, marginRight: 8,
  },
  sortBtnText: { fontSize: 11, color: TEXT_DIM, fontWeight: '600' },
  monthRow: { flexDirection: 'row' },
  monthBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4,
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: BG, marginRight: 6,
  },
  monthBtnActive: { borderColor: RED, backgroundColor: RED },
  monthBtnText: { color: TEXT_DIM, fontSize: 12 },
  monthBtnTextActive: { color: '#FFF', fontWeight: '700' },

  // Dropdown
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6,
  },
  dropdownText: { color: TEXT, fontSize: 13 },
  dropdownArrow: { color: TEXT_DIM, fontSize: 11, marginLeft: 4 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden', maxHeight: 320,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  dropdownItem: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  dropdownItemActive: { backgroundColor: RED },
  dropdownItemText: { color: TEXT, fontSize: 14 },
  dropdownItemTextActive: { color: '#FFF', fontWeight: '600' },

  // Stats
  statsSection: {
    padding: 10, backgroundColor: BG,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  statsTitle: { fontSize: 10, color: TEXT_DIM, fontWeight: '700', marginBottom: 6 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    backgroundColor: CARD_BG, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7,
    alignItems: 'center', minWidth: 68,
    borderWidth: 1, borderColor: BORDER,
  },
  statLabel: { color: TEXT_DIM, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  statValue: { color: RED, fontSize: 14, fontWeight: '700' },

  // Table
  tableHeader: {
    flexDirection: 'row', backgroundColor: TH_BG,
    borderBottomWidth: 1.5, borderBottomColor: '#CCC',
  },
  th: {
    paddingHorizontal: 2, paddingVertical: 6,
    fontSize: 9, fontWeight: '700', color: '#555',
    textAlign: 'center', borderRightWidth: 1, borderRightColor: '#CCC',
  },
  dataRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  dataRowDragging: {
    backgroundColor: '#FFF8E1', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  dragHandle: {
    width: COL.drag, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderRightWidth: 1, borderRightColor: BORDER,
  },
  dragHandleText: { fontSize: 14, color: '#888' },
  td: {
    paddingHorizontal: 2, paddingVertical: 5,
    fontSize: 11, color: TEXT, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: BORDER,
  },
  footerRow: {
    flexDirection: 'row', backgroundColor: TF_BG,
    borderTopWidth: 1.5, borderTopColor: '#AAA',
  },
  tf: {
    paddingHorizontal: 2, paddingVertical: 6,
    fontSize: 11, fontWeight: '700', color: TEXT, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: '#C0C8D8',
  },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { color: TEXT_DIM, fontSize: 16 },
  emptyHint: { color: '#AAAAAA', fontSize: 13 },

  // Bottom
  bottomBar: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  bottomBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  btnPrimary: { backgroundColor: RED },
  btnPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  btnSecondary: { backgroundColor: BG, borderWidth: 1.5, borderColor: RED },
  btnSecondaryText: { color: RED, fontWeight: '600', fontSize: 14 },
  btnExport: { backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#16A34A' },
  btnExportText: { color: '#15803D', fontWeight: '600', fontSize: 13 },
  btnPdf: { backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#B45309' },
  btnPdfText: { color: '#92400E', fontWeight: '600', fontSize: 13 },

  // PDF Bottom Sheet
  pdfOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end',
  },
  pdfSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingTop: 10, paddingBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },
  pdfSheetHandle: {
    width: 40, height: 4, backgroundColor: BORDER,
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  pdfSheetTitle: {
    fontSize: 12, fontWeight: '700', color: TEXT_DIM, letterSpacing: 0.5,
    textAlign: 'center', marginBottom: 6, paddingHorizontal: 16,
  },
  pdfSheetScroll: { maxHeight: 360 },
  pdfMenuItem: {
    paddingVertical: 13, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  pdfMenuItemSection: { backgroundColor: '#FAFAF8' },
  pdfMenuItemText: { fontSize: 15, color: TEXT },
  pdfMenuItemTextSection: { fontWeight: '700' },
  pdfCancelBtn: { paddingVertical: 15, alignItems: 'center' },
  pdfCancelBtnText: { color: RED, fontSize: 16, fontWeight: '600' },
});
