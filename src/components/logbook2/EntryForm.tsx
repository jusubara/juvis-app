'use client';

import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Logbook2Entry, CrewMember, CrewDb,
  loadCrewDb, saveEntry, lookupRoute, saveRoute, upsertCrewMember,
  halfTime,
} from '@/lib/logbook2-storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const AC_LIST = [
  'HL8374','HL8375','HL8507','HL8545','HL8546','HL8578','HL8587','HL8588','HL8700',
  'HL8541','HL8542','HL8543','HL8544','HL8599','HL8715','HL8716','HL8717','HL8718','HL8759',
];

const AIRPORT_LIST = [
  'GMP','ICN','PUS','CJU','CJJ','TAE','NRT','KIX','FUK','OKA','CTS','NGO',
  'TPE','HKG','MFM','BKK','DMK','SGN','HAN','KUL','SIN','MNL','DPS',
  'PEK','PVG','CAN','SZX','ALA','BSZ','YNJ','KMJ','KOJ','TKS','TSA',
  'MDC','DAD','PQC','REP','CNX',
];

const AC_TYPE_MAP: Record<string, string> = {
  HL8374:'B738',HL8375:'B738',HL8507:'B738',HL8545:'B738',HL8546:'B738',
  HL8578:'B738',HL8587:'B738',HL8588:'B738',HL8700:'B738',
  HL8541:'B38M',HL8542:'B38M',HL8543:'B38M',HL8544:'B38M',HL8599:'B38M',
  HL8715:'B38M',HL8716:'B38M',HL8717:'B38M',HL8718:'B38M',HL8759:'B38M',
};

const APP_TYPE_OPTIONS = ['', 'ILS', 'RNP', 'VOR', 'LDA', 'VISUAL'];
const APP_SUFFIX_OPTIONS = ['', 'Z', 'Y', 'X', 'W', 'V', 'A'];
const DUTY_CODES = ['C','F','EC','EF','A','L','H','K','M','O','R'];

const PILOTING_TYPES = [
  { key: 'PIC',   label: 'PIC' },
  { key: 'PICUS', label: 'PIC under SV' },
  { key: 'COP',   label: 'CO-PILOT' },
  { key: 'IP',    label: 'IP' },
  { key: 'TR',    label: 'TR' },
] as const;

const EXCLUSIVE_TYPES = new Set(['PICUS', 'TR']);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── DropdownSelect (native select) ──────────────────────────────────────────

function DropdownSelect({
  options, value, onChange, placeholder = '—',
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 10px', fontSize: 13,
        border: '1.5px solid #ddd', borderRadius: 6, background: '#fff',
        color: value ? '#1a1a1a' : '#999', fontFamily: 'inherit',
        cursor: 'pointer', boxSizing: 'border-box', outline: 'none',
      }}
    >
      {options.map(opt => (
        <option key={opt || '__empty__'} value={opt}>
          {opt || placeholder}
        </option>
      ))}
    </select>
  );
}

// ─── TimeInput (modal numpad) ─────────────────────────────────────────────────

function TimeInput({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'h' | 'mm'>('h');
  const [hStr, setHStr] = useState('');
  const [mmStr, setMmStr] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const m = value.match(/^(\d+)\+(\d{2})$/);
    if (m) { setHStr(m[1]); setMmStr(m[2]); }
    else { setHStr(''); setMmStr(''); }
    setMode('h');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function doConfirm() {
    const h = parseInt(hStr || '0');
    const mm = Math.min(parseInt(mmStr || '0'), 59);
    onChange(`${h}+${String(mm).padStart(2, '0')}`);
    setOpen(false);
  }

  function handleDigit(d: string) {
    if (mode === 'h') {
      if (hStr.length < 3) {
        setHStr(p => p + d);
        if (hStr.length === 0) setMode('mm');
      }
    } else {
      if (mmStr.length < 2) setMmStr(p => p + d);
    }
  }

  function handleBack() {
    if (mode === 'mm' && mmStr === '') setMode('h');
    else if (mode === 'mm') setMmStr(p => p.slice(0, -1));
    else setHStr(p => p.slice(0, -1));
  }

  function handleClear() { setHStr(''); setMmStr(''); setMode('h'); }
  function handlePlus() { setMode('mm'); }

  const displayVal = value || '—+——';

  const modal = open && mounted && ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) doConfirm(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px 18px 14px',
        width: 248, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{label} 입력</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              width: 28, height: 28, border: 'none', background: '#f0f0f0',
              borderRadius: 14, cursor: 'pointer', fontSize: 18, lineHeight: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555',
            }}
          >
            ×
          </button>
        </div>
        {/* 시간 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setMode('h')}
            style={{
              width: 72, height: 54, textAlign: 'center', borderRadius: 8,
              border: `2px solid ${mode === 'h' ? '#1a56db' : '#ddd'}`,
              background: mode === 'h' ? '#eff6ff' : '#f8f8f8',
              fontSize: 26, fontWeight: 800, fontFamily: 'monospace', cursor: 'pointer',
              color: hStr ? '#1a1a1a' : '#bbb',
            }}
          >
            {hStr || '0'}
          </button>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#555' }}>+</span>
          <button
            type="button"
            onClick={() => setMode('mm')}
            style={{
              width: 72, height: 54, textAlign: 'center', borderRadius: 8,
              border: `2px solid ${mode === 'mm' ? '#1a56db' : '#ddd'}`,
              background: mode === 'mm' ? '#eff6ff' : '#f8f8f8',
              fontSize: 26, fontWeight: 800, fontFamily: 'monospace', cursor: 'pointer',
              color: mmStr ? '#1a1a1a' : '#bbb',
            }}
          >
            {mmStr.padStart(2, '0') || '00'}
          </button>
        </div>
        {/* 숫자패드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {['7','8','9','4','5','6','1','2','3','←','0','✓'].map(k => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === '←') handleBack();
                else if (k === '✓') doConfirm();
                else handleDigit(k);
              }}
              style={{
                padding: '14px 0', fontSize: k === '✓' || k === '←' ? 20 : 18, fontWeight: 600,
                border: '1.5px solid #e0e0e0', borderRadius: 7,
                background: k === '←' ? '#fef2f2' : k === '✓' ? '#f0fdf4' : '#f8f8f8',
                color: k === '←' ? '#c81e1e' : k === '✓' ? '#15803d' : '#1a1a1a',
                cursor: 'pointer',
              }}
            >
              {k}
            </button>
          ))}
        </div>
        {/* h→mm / 지우기 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={handlePlus}
            style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, border: '1.5px solid #1a56db', borderRadius: 6, background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}
          >
            h → mm
          </button>
          <button
            type="button"
            onClick={handleClear}
            style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, border: '1.5px solid #fca5a5', borderRadius: 6, background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}
          >
            지우기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%', padding: '10px 8px', fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
          border: `2px solid ${open ? '#1a56db' : value ? '#86efac' : '#ddd'}`,
          borderRadius: 7, background: open ? '#eff6ff' : value ? '#f0fdf4' : '#fff',
          cursor: 'pointer', color: value ? '#1a1a1a' : '#ccc', textAlign: 'center',
        }}
      >
        {displayVal}
      </button>
      {modal}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e0', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ background: '#f5f5f0', padding: '8px 14px', borderBottom: '1px solid #e8e8e0', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

// ─── PicusDialog ──────────────────────────────────────────────────────────────

function PicusDialog({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, maxWidth: 340, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#1a1a1a' }}>PIC under SV</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 22, lineHeight: 1.6 }}>
          이륙과 착륙 중<br /><strong>하나만</strong> 수행하였습니까?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onYes}
            style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 700, border: '2px solid #1a56db', borderRadius: 8, background: '#1a56db', color: '#fff', cursor: 'pointer' }}
          >
            YES (B/T 절반)
          </button>
          <button
            type="button"
            onClick={onNo}
            style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 700, border: '2px solid #ddd', borderRadius: 8, background: '#fff', color: '#444', cursor: 'pointer' }}
          >
            NO (B/T 그대로)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EntryForm ────────────────────────────────────────────────────────────────

export default function EntryForm({ lastCrew }: { lastCrew?: CrewMember[] }) {
  const router = useRouter();

  const [date, setDate] = useState(today());
  const [acIdent, setAcIdent] = useState('');
  const [acType, setAcType] = useState('');
  const [fltNo, setFltNo] = useState('201');
  const [fromApt, setFromApt] = useState('');
  const [toApt, setToApt] = useState('');
  const [block, setBlock] = useState('');
  const [night, setNight] = useState('');
  const [inst, setInst] = useState('');

  const [pilotingTypes, setPilotingTypes] = useState<Set<string>>(new Set());
  const [pic, setPic] = useState('');
  const [picus, setPicus] = useState('');
  const [cop, setCop] = useState('');
  const [ip, setIp] = useState('');
  const [tr, setTr] = useState('');
  const [picusDialogOpen, setPicusDialogOpen] = useState(false);

  const [appType, setAppType] = useState('');
  const [appSuffix, setAppSuffix] = useState('');
  const [appRwy, setAppRwy] = useState('');
  const [toDay, setToDay] = useState(false);
  const [toNight, setToNight] = useState(false);
  const [ldDay, setLdDay] = useState(false);
  const [ldNight, setLdNight] = useState(false);
  const [crew, setCrew] = useState<CrewMember[]>(
    lastCrew?.length ? lastCrew.map(c => ({ name: c.name, duty: '' })) : [{ name: '', duty: '' }]
  );
  const [crewDb, setCrewDb] = useState<CrewDb[]>([]);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCrewDb().then(setCrewDb).catch(() => {});
    lookupRoute('201').then(route => {
      if (route) { setFromApt(route.from_apt); setToApt(route.to_apt); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (acIdent && AC_TYPE_MAP[acIdent]) setAcType(AC_TYPE_MAP[acIdent]);
  }, [acIdent]);

  function selectPilotingType(key: string) {
    const isExclusive = EXCLUSIVE_TYPES.has(key);
    const isCurrentlySelected = pilotingTypes.has(key);
    const bt = block;

    setPilotingTypes(prev => {
      const next = new Set(prev);
      if (isCurrentlySelected) {
        next.delete(key);
      } else if (isExclusive) {
        next.clear();
        next.add(key);
      } else {
        next.delete('PICUS');
        next.delete('TR');
        next.add(key);
      }
      return next;
    });

    if (isCurrentlySelected) {
      if (key === 'PIC') setPic('');
      else if (key === 'PICUS') setPicus('');
      else if (key === 'COP') setCop('');
      else if (key === 'IP') setIp('');
      else if (key === 'TR') setTr('');
    } else if (isExclusive) {
      setPic(''); setCop(''); setIp(''); setTr(''); setPicus('');
      if (key === 'PICUS') {
        setPicus(bt);
        if (bt) setPicusDialogOpen(true);
      } else if (key === 'TR') {
        setTr(bt);
      }
    } else {
      setPicus(''); setTr('');
      if (key === 'PIC') setPic(bt);
      else if (key === 'COP') setCop(bt);
      else if (key === 'IP') setIp(bt);
    }
  }

  function handlePicusYes() { setPicus(halfTime(block)); setPicusDialogOpen(false); }
  function handlePicusNo() { setPicus(block); setPicusDialogOpen(false); }

  function updateCrew(idx: number, field: keyof CrewMember, val: string) {
    setCrew(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
    if (field === 'name') {
      const found = crewDb.find(c => c.name === val);
      if (found) {
        setCrew(prev => prev.map((c, i) => i === idx ? { ...c, name: val, duty: found.last_duty } : c));
      }
    }
  }

  function addCrewRow() { setCrew(prev => [...prev, { name: '', duty: '' }]); }
  function removeCrewRow(idx: number) { setCrew(prev => prev.filter((_, i) => i !== idx)); }

  function buildAppType(): string {
    if (!appType) return '';
    let s = appType;
    if (appSuffix) s += ' ' + appSuffix;
    if (appRwy) s += ' RWY' + appRwy.toUpperCase();
    return s;
  }

  async function handleSave() {
    if (!date) { setError('날짜를 입력해주세요.'); return; }
    setError('');
    setSaving(true);
    try {
      if (fltNo && fromApt && toApt) {
        const existing = await lookupRoute(fltNo);
        const isNew = !existing;
        const isDiff = existing && (existing.from_apt !== fromApt || existing.to_apt !== toApt);
        if (isNew || isDiff) {
          if (window.confirm(`${fltNo}: ${fromApt} → ${toApt}\n이 경로를 저장하시겠습니까?`)) {
            await saveRoute(fltNo, fromApt, toApt);
          }
        }
      }
      for (const c of crew) {
        if (c.name && c.duty) await upsertCrewMember(c.name, c.duty);
      }
      const entry: Omit<Logbook2Entry, 'id' | 'created_at'> = {
        date, ac_ident: acIdent, ac_type: acType, flt_no: fltNo,
        from_apt: fromApt, to_apt: toApt, block, night, inst,
        pic, picus, cop, ip, tr,
        app_type: buildAppType(),
        to_d: toDay, to_n: toNight, ld_d: ldDay, ld_n: ldNight,
        crew: crew.filter(c => c.name), remark: remarks,
      };
      await saveEntry(entry);
      router.push('/logbook2');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 10px', fontSize: 13,
    border: '1.5px solid #ddd', borderRadius: 6, background: '#fff',
    color: '#1a1a1a', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.05em', display: 'block', marginBottom: 4,
  };

  const groupLabelStyle: React.CSSProperties = {
    fontSize: 11, color: '#666', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase',
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 12px 40px' }}>

      {picusDialogOpen && <PicusDialog onYes={handlePicusYes} onNo={handlePicusNo} />}

      {/* 1. DATE */}
      <Section title="1. DATE">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, maxWidth: 180 }}
        />
      </Section>

      {/* 2 & 3. A/C IDENT + A/C TYPE */}
      <Section title="2. A/C IDENT & 3. A/C TYPE">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>A/C IDENT</label>
            <DropdownSelect
              options={['', ...AC_LIST]}
              value={acIdent}
              onChange={setAcIdent}
              placeholder="—"
            />
          </div>
          <div>
            <label style={labelStyle}>A/C TYPE</label>
            <DropdownSelect
              options={['', 'B738', 'B38M']}
              value={acType}
              onChange={setAcType}
              placeholder="—"
            />
          </div>
        </div>
        {acIdent && !acType && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>
            A/C TYPE을 직접 선택해주세요.
          </div>
        )}
      </Section>

      {/* 4, 5. FLT NO + FROM / TO */}
      <Section title="4. FLT NO  /  5. FROM · TO">
        <datalist id="apt-list">
          {AIRPORT_LIST.map(a => <option key={a} value={a} />)}
        </datalist>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>FLT NO.</label>
            <input
              type="text"
              value={fltNo}
              onChange={async e => {
                const raw = e.target.value.toUpperCase();
                const val = raw.replace(/^ZE\s*/, '');
                setFltNo(val);
                if (!val) return;
                const route = await lookupRoute(val);
                if (route) {
                  setFromApt(route.from_apt);
                  setToApt(route.to_apt);
                }
              }}
              onBlur={async e => {
                const raw = e.target.value.toUpperCase();
                const val = raw.replace(/^ZE\s*/, '');
                if (!val) return;
                const route = await lookupRoute(val);
                if (route) {
                  setFromApt(route.from_apt);
                  setToApt(route.to_apt);
                }
              }}
              placeholder="201"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>FROM</label>
            <input
              type="text"
              list="apt-list"
              value={fromApt}
              onChange={e => setFromApt(e.target.value.toUpperCase())}
              placeholder="GMP"
              maxLength={4}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>TO</label>
            <input
              type="text"
              list="apt-list"
              value={toApt}
              onChange={e => setToApt(e.target.value.toUpperCase())}
              placeholder="CJU"
              maxLength={4}
              style={inputStyle}
            />
          </div>
        </div>
      </Section>

      {/* 6. B/T, N/T, I/T */}
      <Section title="6. BLOCK / NIGHT / INST TIME">
        <div style={{ display: 'flex', gap: 12 }}>
          <TimeInput label="B/T (Block)" value={block} onChange={v => {
            setBlock(v);
            if (pilotingTypes.has('PIC')) setPic(v);
            if (pilotingTypes.has('COP')) setCop(v);
            if (pilotingTypes.has('IP')) setIp(v);
            if (pilotingTypes.has('TR')) setTr(v);
            if (pilotingTypes.has('PICUS')) setPicus(v);
          }} />
          <TimeInput label="N/T (Night)" value={night} onChange={setNight} />
          <TimeInput label="I/T (Inst)" value={inst} onChange={setInst} />
        </div>
      </Section>

      {/* 7. PILOTING TIME */}
      <Section title="7. PILOTING TIME">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {PILOTING_TYPES.map(({ key, label }) => {
            const sel = pilotingTypes.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectPilotingType(key)}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: sel ? 700 : 500, borderRadius: 7,
                  border: `2px solid ${sel ? '#1a56db' : '#ddd'}`,
                  background: sel ? '#1a56db' : '#f8f8f4',
                  color: sel ? '#fff' : '#444', cursor: 'pointer', transition: 'all .12s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {pilotingTypes.size > 0 && (
          <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 10 }}>시간 입력</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {pilotingTypes.has('PIC')   && <TimeInput label="PIC" value={pic} onChange={setPic} />}
              {pilotingTypes.has('PICUS') && <TimeInput label="PIC under SV" value={picus} onChange={setPicus} />}
              {pilotingTypes.has('COP')   && <TimeInput label="CO-PILOT" value={cop} onChange={setCop} />}
              {pilotingTypes.has('IP')    && <TimeInput label="IP" value={ip} onChange={setIp} />}
              {pilotingTypes.has('TR')    && <TimeInput label="TR" value={tr} onChange={setTr} />}
            </div>
          </div>
        )}
        {pilotingTypes.size === 0 && (
          <div style={{ fontSize: 11, color: '#aaa', padding: '6px 0' }}>위에서 역할을 선택하면 시간이 B/T로 자동 입력됩니다.</div>
        )}
      </Section>

      {/* 8. APP TYPE */}
      <Section title="8. APP TYPE">
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>APP TYPE</label>
            <DropdownSelect
              options={APP_TYPE_OPTIONS}
              value={appType}
              onChange={setAppType}
              placeholder="—"
            />
          </div>
          <div>
            <label style={labelStyle}>SUFFIX</label>
            <DropdownSelect
              options={APP_SUFFIX_OPTIONS}
              value={appSuffix}
              onChange={setAppSuffix}
              placeholder="—"
            />
          </div>
          <div>
            <label style={labelStyle}>RWY</label>
            <input
              type="text"
              value={appRwy}
              onChange={e => setAppRwy(e.target.value.toUpperCase())}
              placeholder="34L"
              maxLength={4}
              style={inputStyle}
            />
          </div>
        </div>
        {buildAppType() && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#1a56db', fontWeight: 600 }}>
            결과: {buildAppType()}
          </div>
        )}
      </Section>

      {/* 9. TO / LD */}
      <Section title="9. TO / LD">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={groupLabelStyle}>TO</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => { if (toDay) { setToDay(false); } else { setToDay(true); setToNight(false); } }}
                style={{
                  width: 68, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 7,
                  border: `2px solid ${toDay ? '#f59e0b' : '#ddd'}`,
                  background: toDay ? '#fef3c7' : '#fff',
                  color: toDay ? '#92400e' : '#888', cursor: 'pointer',
                }}
              >
                DAY
              </button>
              <button
                type="button"
                onClick={() => { if (toNight) { setToNight(false); } else { setToNight(true); setToDay(false); } }}
                style={{
                  width: 68, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 7,
                  border: `2px solid ${toNight ? '#f59e0b' : '#ddd'}`,
                  background: toNight ? '#fef3c7' : '#fff',
                  color: toNight ? '#92400e' : '#888', cursor: 'pointer',
                }}
              >
                NIGHT
              </button>
            </div>
          </div>
          <div>
            <div style={groupLabelStyle}>LD</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => { if (ldDay) { setLdDay(false); } else { setLdDay(true); setLdNight(false); } }}
                style={{
                  width: 68, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 7,
                  border: `2px solid ${ldDay ? '#8b5cf6' : '#ddd'}`,
                  background: ldDay ? '#f5f3ff' : '#fff',
                  color: ldDay ? '#5b21b6' : '#888', cursor: 'pointer',
                }}
              >
                DAY
              </button>
              <button
                type="button"
                onClick={() => { if (ldNight) { setLdNight(false); } else { setLdNight(true); setLdDay(false); } }}
                style={{
                  width: 68, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 7,
                  border: `2px solid ${ldNight ? '#8b5cf6' : '#ddd'}`,
                  background: ldNight ? '#f5f3ff' : '#fff',
                  color: ldNight ? '#5b21b6' : '#888', cursor: 'pointer',
                }}
              >
                NIGHT
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* 10. CREW */}
      <Section title="10. CREW">
        <datalist id="crew-name-list">
          {crewDb.map(c => <option key={c.id} value={c.name} />)}
        </datalist>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {crew.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                list="crew-name-list"
                value={c.name}
                onChange={e => updateCrew(i, 'name', e.target.value)}
                placeholder="이름"
                style={{ ...inputStyle, flex: 2 }}
              />
              <div style={{ flex: 1 }}>
                <DropdownSelect
                  options={['', ...DUTY_CODES]}
                  value={c.duty}
                  onChange={v => updateCrew(i, 'duty', v)}
                  placeholder="듀티"
                />
              </div>
              {crew.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCrewRow(i)}
                  style={{ flexShrink: 0, width: 30, height: 30, border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCrewRow}
          style={{ marginTop: 10, padding: '7px 14px', fontSize: 12, border: '1.5px dashed #bbb', borderRadius: 6, background: '#fafaf8', color: '#666', cursor: 'pointer' }}
        >
          + 크루 추가
        </button>
      </Section>

      {/* 11. REMARK */}
      <Section title="11. REMARK">
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="비고 입력..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </Section>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#c81e1e' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1, padding: '14px 0', fontSize: 15, fontWeight: 700,
            border: '2px solid #1a56db', borderRadius: 10,
            background: saving ? '#93c5fd' : '#1a56db', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/logbook2')}
          style={{
            padding: '14px 24px', fontSize: 15, fontWeight: 600,
            border: '2px solid #ddd', borderRadius: 10,
            background: '#fff', color: '#666', cursor: 'pointer',
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
