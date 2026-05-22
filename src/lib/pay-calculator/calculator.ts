// ─────────────────────────────────────────────
// 이스타항공 급여 계산 엔진 (2025년 임금협약)
// ─────────────────────────────────────────────

// ── 공항 타임존 (퀵턴/레이오버 체류시간 계산용) ──
export const AIRPORT_TZ: Record<string, number> = {
  ICN:9, GMP:9, CJU:9, PUS:9, CJJ:9, TAE:9, KWJ:9, USN:9, WJU:9, YNY:9,
  NRT:9, KIX:9, FUK:9, OKA:9, CTS:9, NGO:9, YNJ:9, KMJ:9, KOJ:9, TKS:9,
  TPE:8, TSA:8, HKG:8, MFM:8, DYG:8, UBN:8, DPS:8, PEK:8, PVG:8, CAN:8, MNL:8, KUL:8, SIN:8,
  MDC:8, TXN:8, CGO:8, YNT:8,
  HAN:7, SGN:7, DAD:7, BKK:7, CNX:7, HKT:7, DMK:7, REP:7, PNH:7, VTE:7, CGK:7, PQC:7,
  ALA:6, BSZ:6,
};

export const SPECIAL_AIRPORTS = new Set([
  'CJU','PUS','FUK','YNJ','HKG','ALA','BSZ','DYG','MFM'
]);

export const CHINA_AIRPORTS = new Set([
  'PEK','PVG','CAN','SZX','CTU','KMG','XMN','HGH',
  'NKG','WUH','CGO','TAO','TNA','SHE','HRB','DLC',
  'TXN','YNT',
]);

export const DOMESTIC_AIRPORTS = new Set([
  'GMP','ICN','PUS','CJU','CJJ','TAE','KWJ','USN',
  'WJU','RSU','KUV','MPK','HIN','YNY','CHN',
]);

// ── Duty Code 분류 ────────────────────────────
export type DutyCategory = 'captain' | 'fo' | 'dh' | 'none' | 'instructor' | 'examiner' | 'r_position';

export function getDutyCategory(code: string): DutyCategory {
  const c = code.trim().toUpperCase();
  if (['C','EC','XC','CC','RC','AC','CR','QC'].includes(c)) return 'captain';
  if (['F','EF','T','S','1S','2S','CF','1F','2F'].includes(c)) return 'fo';
  if (c === 'A') return 'dh';
  if (['O','B'].includes(c)) return 'none';
  if (c === 'L') return 'instructor';
  if (['H','K','M'].includes(c)) return 'examiner';
  if (c === 'R') return 'r_position';
  return 'captain';
}

// ── 수당 단가 ─────────────────────────────────
export const RATES = {
  TRANS:            200_000,
  MEAL:             140_000,
  ALPAK:             20_000,
  DOM_LAND_N_CPT:    38_000,
  DOM_LAND_S_CPT:    76_000,
  DOM_LAND_N_FO:     29_000,
  DOM_LAND_S_FO:     58_000,
  INTL_LAND_N_CPT:       33,
  INTL_LAND_S_CPT:       66,
  INTL_LAND_N_FO:        25,
  INTL_LAND_S_FO:        50,
  QUICKTURN_CPT:         38,
  QUICKTURN_FO:          32,
  NIGHT_QT_ADD:          20,
  LAYOVER_H:            3.3,
  LAYOVER_H_CHN:        2.4,
  LAYOVER_TIP_CPT:       10,  // 기장만 적용
  DOM_LAYOVER_CPT:   90_000,
  DOM_LAYOVER_FO:    70_000,
  LOCAL_TRANS_CPT:   30_000,
  LOCAL_TRANS_FO:    20_000,
  OVERTIME_1_RATE:     1.55,
  OVERTIME_2_RATE:     1.80,
  NIGHT_PAY_RATE:       0.5,
  LAYOVER_THRESHOLD:    480,  // 8h (분)
  SENIOR_FO_PAY:    400_000,
  INSTRUCTOR_RATE:   30_000,
  EXAMINER_RATE:     50_000,
};

// ── 근속수당 (기장 임명 후 년수) ──────────────
export function getTenurePay(years: number): number {
  if (years < 2)    return 0;
  if (years <= 5)   return 230_000;
  if (years <= 8)   return 345_000;
  if (years <= 11)  return 460_000;
  return 575_000;
}

// ── 타입 정의 ─────────────────────────────────
export interface RawFlight {
  date_utc: string;
  fltNo: string;
  route: string;
  airportFrom: string;
  airportTo: string;
  dutyCode: string;
  rampOut: string;
  rampIn: string;
  blockTime: number;  // 분 (timeBlock HH:MM:SS 파싱)
  timeFlt: number;    // 분 (DH용)
}

export interface ProcessedFlight {
  date_utc: string;
  month: string;        // UTC date 기준 YYYY-MM
  fltNo: string;
  route: string;
  from: string;
  to: string;
  dutyCode: string;
  dutyCategory: DutyCategory;
  isDH: boolean;
  isDom: boolean;
  isSpecial: boolean;
  blockMin: number;     // UTC date 기준 월에 전부 산입 (자정분할 없음)
  nightMin: number;     // rampOut~rampIn UTC 13~21z 계산값
  tripType: 'quickturn' | 'night_quickturn' | 'layover' | null;
  stayMin: number | null;
  tripMonth: string | null;  // 아웃바운드 편의 KST month (수당 산입 기준)
  rampOutUtc: string;
  rampInUtc: string;
}

export interface CalcInput {
  basePay: number;
  flightPayFromSlip: number;
  position: 'captain' | 'fo';
  seniorCaptainPay: number;  // 선임/수석기장 수당 (직접 입력)
  tenurePay: number;         // 근속수당
  positionGuarantee: 0 | 100 | 120 | 140;  // 보직 보장시간 (0 = 해당없음)
  isSeniorFO: boolean;
  dayOff: number;
  domLayoverDays: number;
  holidayDays: number;
  localTransTrips: number;
  otherDHTrips: number;      // 타항공사 이동 횟수 (1회=1:20×70%=56분)
  unusedLeave: number;       // 미사용 연차일수
  etc: number;
}

export interface MonthResult {
  month: string;
  flightCount: number;
  blockMin: number; nightMin: number;
  blockH: number; nightH: number;
  over70h: number; over80h: number;
  basePay: number; trans: number; meal: number; tenurePay: number;
  positionGuarantee: 0 | 100 | 120 | 140;
  flightPay: number; positionPay: number; overtimePay: number;
  nightPay: number; holidayPay: number; incentive: number;
  alpak: number;
  seniorPay: number;
  domLayoverPay: number; domLandPay: number;
  localTransPay: number; leavePay: number; etc: number;
  instructorPay: number; examinerPay: number;
  totalKRW: number;
  quickturnUSD: number; layoverUSD: number;
  intlLandUSD: number; totalUSD: number;
  ordinary: number; flightRate: number;
  flights: ProcessedFlight[];
}

// ── 유틸 ─────────────────────────────────────
// HH:MM:SS 또는 HH:MM 파싱
function parseHMS(t: string): number | null {
  if (!t?.trim()) return null;
  const p = t.trim().split(':');
  try { return parseInt(p[0]) * 60 + parseInt(p[1]); }
  catch { return null; }
}

// HH+MM 파싱
function parsePlus(t: string): number {
  if (!t?.trim()) return 0;
  const p = t.trim().split('+');
  if (p.length < 2) return 0;
  try { return parseInt(p[0]) * 60 + parseInt(p[1]); }
  catch { return 0; }
}

// 야간시간: rampOut~rampIn 사이 UTC 13~21시 직접 계산
function calcNightMin(rampOut: string, rampIn: string): number {
  const NS = 13 * 60, NE = 21 * 60;
  const ro = parseHMS(rampOut);
  let ri = parseHMS(rampIn);
  if (ro === null || ri === null) return 0;
  if (ri < ro) ri += 24 * 60; // 날짜 넘김
  return Math.max(0, Math.min(ri, NE) - Math.max(ro, NS));
}

// 야간퀵턴 판정: 체류 중 UTC 13~21z 겹치면 야간퀵턴
function isNightStay(rampIn: string, nextRampOut: string): boolean {
  const NS = 13 * 60, NE = 21 * 60;
  const a = parseHMS(rampIn);
  const b = parseHMS(nextRampOut);
  if (a === null || b === null) return false;
  const bAdj = b <= a ? b + 24 * 60 : b;
  return Math.max(0, Math.min(bAdj, NE) - Math.max(a, NS)) > 0;
}

// 절대시간 (퀵턴/레이오버 체류시간 계산용)
function toAbsMin(dateUtc: string, timeUtc: string, prevAbs?: number): number | null {
  try {
    const dt = new Date(`${dateUtc}T${timeUtc.slice(0, 5)}:00Z`);
    const base = new Date('2020-01-01T00:00:00Z');
    let m = Math.floor((dt.getTime() - base.getTime()) / 60000);
    if (prevAbs !== undefined && m < prevAbs) m += 24 * 60;
    return m;
  } catch { return null; }
}

// ── CSV 파싱 ──────────────────────────────────
export function parseCSV(csvText: string): RawFlight[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));

  const colExact = (row: string[], name: string): string => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx] ?? '').trim().replace(/^"|"$/g, '') : '';
  };

  // 포맷 자동 감지: 새 포맷 = DATE(UTC) 포함
  const isNewFormat = headers.includes('DATE(UTC)');

  const flights: RawFlight[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));

    let dateStr: string;
    let fltNo: string, route: string, dutyCode: string;
    let rampOut: string, rampIn: string;
    let blockTime: number, timeFlt: number;
    let airportFrom: string, airportTo: string;

    if (isNewFormat) {
      // 새 포맷: DATE(UTC), FLTNR, DUTY, RTE, B/T, OUT(UTC), IN(UTC)
      dateStr  = colExact(row, 'DATE(UTC)');
      fltNo    = colExact(row, 'FLTNR');
      dutyCode = colExact(row, 'DUTY');
      route    = colExact(row, 'RTE');
      rampOut  = colExact(row, 'OUT(UTC)');
      rampIn   = colExact(row, 'IN(UTC)');
      blockTime = parsePlus(colExact(row, 'B/T')) || 0;
      // DH timeFlt: B/T 있으면 사용, 없으면 OFF~ON 차이로 계산
      const btVal   = parsePlus(colExact(row, 'B/T'));
      const offMin  = parseHMS(colExact(row, 'OFF(UTC)'));
      const onMin   = parseHMS(colExact(row, 'ON(UTC)'));
      let fltCalc   = 0;
      if (offMin !== null && onMin !== null) {
        fltCalc = onMin >= offMin ? onMin - offMin : onMin + 24 * 60 - offMin;
      }
      timeFlt = btVal || fltCalc || 0;
      // RTE에서 출발/도착 공항 파싱 (예: PUS-FUK)
      const rteParts = route.split('-');
      airportFrom = rteParts[0] ?? '';
      airportTo   = rteParts[rteParts.length - 1] ?? '';
    } else {
      // 기존 포맷: date, fltNo, thisCrewDuty, route, timeBlock, rampOut, rampIn
      dateStr   = colExact(row, 'date');
      fltNo     = colExact(row, 'fltNo');
      dutyCode  = colExact(row, 'thisCrewDuty');
      route     = colExact(row, 'route');
      rampOut   = colExact(row, 'rampOut');
      rampIn    = colExact(row, 'rampIn');
      blockTime = parseHMS(colExact(row, 'timeBlock'))
               || parsePlus(colExact(row, 'block_time'))
               || 0;
      timeFlt   = parseHMS(colExact(row, 'timeFlt')) || 0;
      airportFrom = colExact(row, 'airportFrom');
      airportTo   = colExact(row, 'airportTo');
      // 기존 포맷에서 airportFrom/To 없으면 route에서 파싱
      if (!airportFrom && route) {
        const rteParts = route.split('-');
        airportFrom = rteParts[0] ?? '';
        airportTo   = rteParts[rteParts.length - 1] ?? '';
      }
    }

    if (!dateStr || dateStr === 'SUM' || !dateStr.match(/\d{4}-\d{2}-\d{2}/)) continue;
    if (!rampOut || !rampIn) continue; // rampOut/rampIn 없으면 계산 불가

    flights.push({
      date_utc: dateStr.slice(0, 10),
      fltNo, route, airportFrom, airportTo, dutyCode,
      rampOut, rampIn, blockTime, timeFlt,
    });
  }
  return flights;
}

// ── 비행 데이터 처리 ──────────────────────────
export function processFlights(raw: RawFlight[]): ProcessedFlight[] {
  const withAbs = raw.map(f => {
    const roAbs = toAbsMin(f.date_utc, f.rampOut);
    const riAbs = toAbsMin(f.date_utc, f.rampIn, roAbs ?? undefined);
    return { ...f, roAbs, riAbs };
  }).sort((a, b) => (a.roAbs ?? 0) - (b.roAbs ?? 0));

  // 퀵턴/레이오버 판정
  const tripTypes = new Map<string, { type: ProcessedFlight['tripType']; stayMin: number; month: string }>();
  withAbs.forEach((f, i) => {
    const isDom = DOMESTIC_AIRPORTS.has(f.airportFrom) && DOMESTIC_AIRPORTS.has(f.airportTo);
    if (isDom || !DOMESTIC_AIRPORTS.has(f.airportFrom)) return;

    // 날짜 상관없이 roAbs 순서로 다음 귀국편 탐색 (월말→월초 매칭 포함)
    const nextDep = withAbs.slice(i + 1).find(
      nf => nf.airportFrom === f.airportTo
    );
    if (!nextDep || f.riAbs === null || nextDep.roAbs === null) return;

    const stay = nextDep.roAbs - f.riAbs;
    const type: ProcessedFlight['tripType'] = stay >= RATES.LAYOVER_THRESHOLD
      ? 'layover'
      : isNightStay(f.rampIn, nextDep.rampOut)
        ? 'night_quickturn'
        : 'quickturn';

    // 수당 산입 월 = 아웃바운드 편의 KST month
    const roMin = parseHMS(f.rampOut);
    let outMonth = f.date_utc.slice(0, 7);
    if (roMin !== null) {
      const kstMs = new Date(f.date_utc + 'T00:00:00Z').getTime() + roMin * 60000 + 9 * 3600000;
      const kstDate = new Date(kstMs);
      outMonth = kstDate.getUTCFullYear() + '-' + String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    }

    tripTypes.set(`${f.fltNo}_${f.date_utc}`, { type, stayMin: stay, month: outMonth });
  });

  const processed: ProcessedFlight[] = [];

  withAbs.forEach(f => {
    const cat   = getDutyCategory(f.dutyCode);
    const isDH  = cat === 'dh';
    const isDom = DOMESTIC_AIRPORTS.has(f.airportFrom) && DOMESTIC_AIRPORTS.has(f.airportTo);
    // ★ 월 배정: KST(UTC+9) 기준 출발시각으로 결정
    const roUtcMin = parseHMS(f.rampOut);
    let month = f.date_utc.slice(0, 7);
    if (roUtcMin !== null) {
      const roKstMs = new Date(f.date_utc + 'T00:00:00Z').getTime()
                    + roUtcMin * 60000
                    + 9 * 3600000;
      const roKstDate = new Date(roKstMs);
      month = roKstDate.getUTCFullYear() + '-'
            + String(roKstDate.getUTCMonth() + 1).padStart(2, '0');
    }
    // ★ 블록타임: 자정분할 없이 전부 이 달에 산입
    const blockMin = isDH ? Math.round(f.timeFlt * 0.7) : f.blockTime;
    // ★ 야간시간: rampOut~rampIn UTC 13~21z 직접 계산
    const nightMin = isDH ? 0 : calcNightMin(f.rampOut, f.rampIn);

    const trip = tripTypes.get(`${f.fltNo}_${f.date_utc}`);
    processed.push({
      date_utc: f.date_utc, month,
      fltNo: f.fltNo, route: f.route,
      from: f.airportFrom, to: f.airportTo,
      dutyCode: f.dutyCode, dutyCategory: cat,
      isDH, isDom, isSpecial: SPECIAL_AIRPORTS.has(f.airportTo),
      blockMin, nightMin,
      tripType:  trip?.type    ?? null,
      stayMin:   trip?.stayMin ?? null,
      tripMonth: trip?.month   ?? null,
      rampOutUtc: f.rampOut,
      rampInUtc:  f.rampIn,
    });
  });

  return processed;
}

// ── 월별 수당 계산 ────────────────────────────
export function calcMonth(
  flights: ProcessedFlight[],
  month: string,
  input: CalcInput,
  tripOverrides: Record<string, ProcessedFlight['tripType']>
): MonthResult {
  const {
    basePay, flightPayFromSlip, position,
    seniorCaptainPay, tenurePay, positionGuarantee, isSeniorFO,
    dayOff, domLayoverDays, holidayDays, localTransTrips, otherDHTrips, unusedLeave, etc,
  } = input;

  const isCpt = position === 'captain';
  const seniorPay = isCpt
    ? (seniorCaptainPay || 0)          // 선임/수석기장 수당 직접 입력
    : (isSeniorFO ? RATES.SENIOR_FO_PAY : 0);

  // 통상임금
  const ordinary = (basePay + RATES.TRANS + RATES.MEAL + (tenurePay || 0) + seniorPay) / 209;
  // 비행수당 단가 (명세서 역산)
  const flightRate = flightPayFromSlip > 0 ? flightPayFromSlip / 70 : 0;

  const fl = flights.filter(f => f.month === month);

  // ★ 블록타임: 직위별 duty code + DH만 합산
  // 타항공사 DH: 1회당 1:20(80분) × 70% = 56분
  const otherDHMin = Math.round((otherDHTrips || 0) * 85 * 0.7);

  const blockMin = fl.reduce((s, f) => {
    if (f.isDH) return s + f.blockMin;
    if (f.dutyCategory === 'none') return s;  // B 코드 등 블록타임 산입 안함
    if (f.dutyCategory === 'captain')  return s + f.blockMin;
    if (f.dutyCategory === 'fo')       return s + f.blockMin;
    if (f.dutyCategory === 'instructor') return s + f.blockMin;  // 기장시간으로 산입
    if (f.dutyCategory === 'examiner')   return s + f.blockMin;  // 기장시간으로 산입
    if (f.dutyCategory === 'r_position') {
      return s + f.blockMin;
    }
    return s;
  }, 0) + otherDHMin;

  // ★ 야간시간: 직위 코드 편만 (DH 제외)
  const nightMin = fl.reduce((s, f) => {
    if (f.isDH) return s;
    if (f.dutyCategory === 'captain')    return s + f.nightMin;
    if (f.dutyCategory === 'fo')         return s + f.nightMin;
    if (f.dutyCategory === 'instructor') return s + f.nightMin;
    if (f.dutyCategory === 'examiner')   return s + f.nightMin;
    if (f.dutyCategory === 'r_position') return s + f.nightMin;
    return s;
  }, 0);

  const blockH = blockMin / 60;
  const nightH = nightMin / 60;

  // 비행수당 / 보직수당 / 연장수당
  const pg = positionGuarantee || 0;
  const flightPay   = flightRate > 0 ? 70 * flightRate : 0;
  const positionPay = (pg > 0 && flightRate > 0) ? (pg - 70) * flightRate : 0;
  const over70h     = Math.max(0, Math.min(blockH, 80) - 70);
  const over80h     = Math.max(0, blockH - 80);
  const overtimePay = flightRate > 0
    ? pg > 0
      ? Math.max(0, blockH - 70) * flightRate   // 실제 초과분, 할증 없음
      : over70h * RATES.OVERTIME_1_RATE * flightRate + over80h * RATES.OVERTIME_2_RATE * flightRate
    : 0;
  const nightPay = flightRate > 0 ? nightH * RATES.NIGHT_PAY_RATE * flightRate : 0;

  // 랜딩피
  const domLandN  = isCpt ? RATES.DOM_LAND_N_CPT : RATES.DOM_LAND_N_FO;
  const domLandS  = isCpt ? RATES.DOM_LAND_S_CPT : RATES.DOM_LAND_S_FO;
  const intlLandN = isCpt ? RATES.INTL_LAND_N_CPT : RATES.INTL_LAND_N_FO;
  const intlLandS = isCpt ? RATES.INTL_LAND_S_CPT : RATES.INTL_LAND_S_FO;

  let domN = 0, domS = 0, intlN = 0, intlS = 0;
  fl.forEach(f => {
    if (f.isDH) return;
    if (f.isDom) { f.isSpecial ? domS++ : domN++; }
    else         { f.isSpecial ? intlS++ : intlN++; }
  });
  const domLandPay  = domN * domLandN + domS * domLandS;
  const intlLandUSD = Math.ceil(intlN * intlLandN + intlS * intlLandS);

  // 퀵턴 / 레이오버
  const qtRate  = isCpt ? RATES.QUICKTURN_CPT : RATES.QUICKTURN_FO;
  const nqtRate = qtRate + RATES.NIGHT_QT_ADD;
  const loTip   = isCpt ? RATES.LAYOVER_TIP_CPT : 0;

  // 퀵턴/레이오버: 아웃바운드 편의 tripMonth 기준으로 산입 (월말→월초 레이오버 포함)
  let qt = 0, nqt = 0, layoverUSD = 0;
  flights.filter(f => !f.isDom && DOMESTIC_AIRPORTS.has(f.from) && f.tripMonth === month)
    .forEach(f => {
      const tt = tripOverrides[`${f.fltNo}_${f.date_utc}`] ?? f.tripType;
      if (tt === 'quickturn')            qt++;
      else if (tt === 'night_quickturn') nqt++;
      else if (tt === 'layover' && f.stayMin !== null) {
        const isChn = CHINA_AIRPORTS.has(f.to);
        const loRate = isChn ? RATES.LAYOVER_H_CHN : RATES.LAYOVER_H;
        layoverUSD += Math.ceil((f.stayMin / 60) * loRate + loTip);
      }
    });
  const quickturnUSD = Math.ceil(qt * qtRate + nqt * nqtRate);

  // 국내 레이오버
  const domLayoverPay = domLayoverDays * (isCpt ? RATES.DOM_LAYOVER_CPT : RATES.DOM_LAYOVER_FO);
  // 지방 차량이동비
  const localTransPay = localTransTrips * (isCpt ? RATES.LOCAL_TRANS_CPT : RATES.LOCAL_TRANS_FO);

  // 교관수당 / 심사관수당
  const instructorPay = fl.reduce((s, f) => {
    if (f.dutyCategory === 'instructor') return s + (f.blockMin / 60) * RATES.INSTRUCTOR_RATE;
    return s;
  }, 0);
  const examinerPay = fl.reduce((s, f) => {
    if (f.dutyCategory === 'examiner') return s + (f.blockMin / 60) * RATES.EXAMINER_RATE;
    return s;
  }, 0);

  // 연차수당: 통상임금 × 8h × 미사용 연차일수
  const leavePay = Math.ceil((unusedLeave || 0) * ordinary * 8);

  // 휴일근무수당
  const dayOffBase = ordinary * 8;
  const shortage   = Math.max(0, 10 - dayOff);
  const d2  = Math.min(shortage, 2);
  const d25 = Math.max(0, shortage - 2);
  const holidayPay = d2 * dayOffBase * 2 + d25 * dayOffBase * 2.5;

  // 인센티브
  const incentive = holidayDays * ordinary * 8 * 0.5;

  const totalKRW = basePay + RATES.TRANS + RATES.MEAL
    + (tenurePay || 0) + seniorPay
    + flightPay + positionPay + overtimePay + nightPay
    + domLandPay + domLayoverPay
    + holidayPay + incentive
    + RATES.ALPAK + localTransPay + leavePay + etc
    + instructorPay + examinerPay;

  const totalUSD = intlLandUSD + quickturnUSD + layoverUSD;

  return {
    month,
    flightCount: fl.filter(f => !f.isDH || f.dutyCategory !== 'none').length,
    blockMin, nightMin, blockH, nightH, over70h, over80h,
    positionGuarantee: pg as 0 | 100 | 120 | 140,
    basePay, trans: RATES.TRANS, meal: RATES.MEAL, tenurePay: tenurePay || 0,
    flightPay, positionPay, overtimePay, nightPay,
    holidayPay, incentive, alpak: RATES.ALPAK,
    seniorPay,
    domLayoverPay, domLandPay, localTransPay, leavePay, etc,
    instructorPay, examinerPay,
    totalKRW,
    quickturnUSD, layoverUSD, intlLandUSD,
    totalUSD: Math.ceil(totalUSD),
    ordinary, flightRate,
    flights: fl,
  };
}
