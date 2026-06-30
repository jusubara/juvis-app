'use client';

import { useState } from 'react';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Logbook2Entry, Logbook2Stats, fmtTime } from '@/lib/logbook2-storage';

interface EditState {
  id: string;
  field: string;
  value: string;
}

interface Props {
  entries: Logbook2Entry[];
  stats: Logbook2Stats;
  onDelete: (id: string) => void;
  onReorder?: (newEntries: Logbook2Entry[]) => void;
  onUpdate: (id: string, changes: Partial<Logbook2Entry>) => void;
  onEdit: (entry: Logbook2Entry) => void;
}

function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #ccc', padding: '4px 3px', textAlign: 'center',
    verticalAlign: 'middle', background: '#edede6', fontSize: 10,
    fontWeight: 600, color: '#555', lineHeight: 1.3, whiteSpace: 'nowrap',
    ...extra,
  };
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #ccc', padding: '3px 3px', textAlign: 'center',
    verticalAlign: 'middle', fontSize: 11, ...extra,
  };
}

function tfootTd(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #ccc', padding: '5px 3px', textAlign: 'center',
    background: '#dde4f0', fontSize: 11, fontWeight: 700, color: '#1a1a1a', ...extra,
  };
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function crewStr(crew: Logbook2Entry['crew']): string {
  return crew.map(c => `${c.name}${c.duty ? '/' + c.duty : ''}`).join(', ');
}

function SortableRow({
  entry, i, onDelete, onEdit,
  editingField, editingValue,
  onCellClick, onBoolToggle, onEditChange, onEditKeyDown,
}: {
  entry: Logbook2Entry;
  i: number;
  onDelete: (id: string) => void;
  onEdit: () => void;
  editingField: string | null;
  editingValue: string;
  onCellClick: (field: string, value: string) => void;
  onBoolToggle: (field: string) => void;
  onEditChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const rowStyle: React.CSSProperties = {
    background: i % 2 === 0 ? '#fff' : '#fafaf8',
    opacity: isDragging ? 0.5 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function textCell(field: string, value: string, displayValue?: React.ReactNode, extra: React.CSSProperties = {}) {
    const isEditing = editingField === field;
    const cellStyle: React.CSSProperties = {
      ...tdStyle(extra),
      cursor: isEditing ? 'default' : 'pointer',
      background: isEditing ? '#fffde7' : undefined,
    };
    const inputStyle: React.CSSProperties = {
      width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: 0,
      fontSize: (extra.fontSize ?? 11) as number,
      textAlign: (extra.textAlign as 'left' | 'center') ?? 'center',
      fontWeight: (extra.fontWeight ?? 400) as number,
    };
    return (
      <td style={cellStyle} onClick={isEditing ? undefined : () => onCellClick(field, value)}>
        {isEditing ? (
          <input
            autoFocus
            value={editingValue}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={onEditKeyDown}
            style={inputStyle}
          />
        ) : (
          displayValue ?? value
        )}
      </td>
    );
  }

  function boolCell(field: string, checked: boolean) {
    return (
      <td style={{ ...tdStyle(), cursor: 'pointer' }} onClick={() => onBoolToggle(field)}>
        {checked ? <span style={{ fontSize: 13, color: '#1a56db' }}>✓</span> : null}
      </td>
    );
  }

  const remarkDisplay = [crewStr(entry.crew), entry.remark].filter(Boolean).join(' | ');

  return (
    <tr ref={setNodeRef} style={rowStyle}>
      <td style={tdStyle({ cursor: 'grab', color: '#bbb', fontSize: 14, padding: '2px' })}>
        <span
          {...attributes}
          {...listeners}
          style={{ display: 'block', padding: '2px 4px', cursor: 'grab', userSelect: 'none' }}
        >
          ⠿
        </span>
      </td>
      {textCell('date', entry.date, fmtDate(entry.date))}
      {textCell('ac_type', entry.ac_type)}
      {textCell('ac_ident', entry.ac_ident)}
      {textCell('flt_no', entry.flt_no)}
      {textCell('from_apt', entry.from_apt)}
      {textCell('to_apt', entry.to_apt)}
      {textCell('pic', entry.pic, undefined, { fontWeight: entry.pic ? 600 : 400 })}
      {textCell('picus', entry.picus, undefined, { fontWeight: entry.picus ? 600 : 400 })}
      {textCell('cop', entry.cop, undefined, { fontWeight: entry.cop ? 600 : 400 })}
      {textCell('ip', entry.ip)}
      {textCell('tr', entry.tr)}
      {textCell('block', entry.block, undefined, { fontWeight: 600 })}
      {textCell('night', entry.night)}
      {textCell('inst', entry.inst)}
      {textCell('app_type', entry.app_type, undefined, { textAlign: 'left', paddingLeft: 3, fontSize: 10 })}
      {boolCell('to_d', entry.to_d)}
      {boolCell('to_n', entry.to_n)}
      {boolCell('ld_d', entry.ld_d)}
      {boolCell('ld_n', entry.ld_n)}
      {textCell('remark', entry.remark, remarkDisplay, { textAlign: 'left', paddingLeft: 3, fontSize: 10 })}
      <td style={tdStyle({ padding: '2px 1px' })}>
        <button
          onClick={() => { if (window.confirm('이 기록을 수정하시겠습니까?')) onEdit(); }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc', padding: '2px 3px', fontSize: 12 }}
          onMouseEnter={ev => (ev.currentTarget.style.color = '#1a56db')}
          onMouseLeave={ev => (ev.currentTarget.style.color = '#ccc')}
          title="수정"
        >
          ✏
        </button>
        <button
          onClick={() => { if (window.confirm('이 기록을 삭제하시겠습니까?')) onDelete(entry.id); }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc', padding: '2px 3px', fontSize: 15 }}
          onMouseEnter={ev => (ev.currentTarget.style.color = '#e53e3e')}
          onMouseLeave={ev => (ev.currentTarget.style.color = '#ccc')}
          title="삭제"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

export default function LogbookTable({ entries, stats, onDelete, onReorder, onUpdate, onEdit }: Props) {
  const [editing, setEditing] = useState<EditState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (entries.length === 0) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
        기록이 없습니다.
      </div>
    );
  }

  function handleCellClick(entry: Logbook2Entry, field: string, value: string) {
    if (editing && (editing.id !== entry.id || editing.field !== field)) {
      const confirmed = window.confirm('변경사항을 저장하시겠습니까?');
      if (confirmed) {
        onUpdate(editing.id, { [editing.field]: editing.value } as Partial<Logbook2Entry>);
        setEditing({ id: entry.id, field, value });
      } else {
        setEditing(null);
      }
      return;
    }
    if (!editing) {
      setEditing({ id: entry.id, field, value });
    }
  }

  function handleBoolToggle(entry: Logbook2Entry, field: string) {
    const currentVal = entry[field as keyof Logbook2Entry] as boolean;
    if (editing) {
      const confirmed = window.confirm('변경사항을 저장하시겠습니까?');
      if (confirmed) {
        onUpdate(editing.id, { [editing.field]: editing.value } as Partial<Logbook2Entry>);
        onUpdate(entry.id, { [field]: !currentVal } as Partial<Logbook2Entry>);
      }
      setEditing(null);
      return;
    }
    onUpdate(entry.id, { [field]: !currentVal } as Partial<Logbook2Entry>);
  }

  function handleEditChange(value: string) {
    setEditing(prev => prev ? { ...prev, value } : null);
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (editing) {
        onUpdate(editing.id, { [editing.field]: editing.value } as Partial<Logbook2Entry>);
        setEditing(null);
      }
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  }

  function handleDelete(id: string) {
    if (editing?.id === id) setEditing(null);
    onDelete(id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = entries.findIndex(e => e.id === active.id);
    const newIdx = entries.findIndex(e => e.id === over.id);
    onReorder?.(arrayMove(entries, oldIdx, newIdx));
  }

  const thG = thStyle({ background: '#e2e2da', color: '#444' });

  return (
    <div style={{ overflowX: 'auto', background: '#fff' }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 22 }} />  {/* DRAG */}
            <col style={{ width: 44 }} />  {/* DATE */}
            <col style={{ width: 44 }} />  {/* A/C TYPE */}
            <col style={{ width: 50 }} />  {/* A/C IDENT */}
            <col style={{ width: 44 }} />  {/* FLT NO. */}
            <col style={{ width: 34 }} />  {/* FROM */}
            <col style={{ width: 34 }} />  {/* TO */}
            <col style={{ width: 42 }} />  {/* PIC */}
            <col style={{ width: 42 }} />  {/* PICUS */}
            <col style={{ width: 42 }} />  {/* COP */}
            <col style={{ width: 28 }} />  {/* IP */}
            <col style={{ width: 28 }} />  {/* TR */}
            <col style={{ width: 42 }} />  {/* BLOCK */}
            <col style={{ width: 36 }} />  {/* NIGHT */}
            <col style={{ width: 36 }} />  {/* INST */}
            <col style={{ width: 88 }} />  {/* APP TYPE */}
            <col style={{ width: 22 }} />  {/* TO D */}
            <col style={{ width: 22 }} />  {/* TO N */}
            <col style={{ width: 22 }} />  {/* LD D */}
            <col style={{ width: 22 }} />  {/* LD N */}
            <col style={{ width: 130 }} /> {/* REMARK */}
            <col style={{ width: 48 }} />  {/* EDIT/DEL */}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={3} style={thStyle({ width: 22 })} />
              <th rowSpan={3} style={thStyle()}>DATE<br />(M/D)</th>
              <th colSpan={2} style={thG}>AIRCRAFT</th>
              <th colSpan={3} style={thG}>ROUTE OF FLIGHT</th>
              <th colSpan={5} style={thG}>TYPE OF PILOTING TIME</th>
              <th colSpan={8} style={thG}>CONDITIONS OF FLIGHT</th>
              <th rowSpan={3} style={thStyle({ textAlign: 'left', paddingLeft: 4 })}>REMARK</th>
              <th rowSpan={3} style={thStyle()} />
            </tr>
            <tr>
              <th rowSpan={2} style={thStyle()}>A/C<br />TYPE</th>
              <th rowSpan={2} style={thStyle()}>A/C<br />IDENT</th>
              <th rowSpan={2} style={thStyle()}>FLT<br />NO.</th>
              <th rowSpan={2} style={thStyle()}>FROM</th>
              <th rowSpan={2} style={thStyle()}>TO</th>
              <th rowSpan={2} style={thStyle()}>PIC</th>
              <th rowSpan={2} style={thStyle()}>PIC<br />UNDER<br />SUPVSN</th>
              <th rowSpan={2} style={thStyle()}>CO-<br />PILOT</th>
              <th rowSpan={2} style={thStyle()}>IP</th>
              <th rowSpan={2} style={thStyle()}>TR</th>
              <th rowSpan={2} style={thStyle()}>BLOCK<br />TIME</th>
              <th rowSpan={2} style={thStyle()}>NIGHT</th>
              <th rowSpan={2} style={thStyle()}>INST</th>
              <th rowSpan={2} style={thStyle()}>APP<br />TYPE</th>
              <th colSpan={2} style={thStyle()}>TO</th>
              <th colSpan={2} style={thStyle()}>LD</th>
            </tr>
            <tr>
              <th style={thStyle()}>D</th>
              <th style={thStyle()}>N</th>
              <th style={thStyle()}>D</th>
              <th style={thStyle()}>N</th>
            </tr>
          </thead>
          <tbody>
            <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
              {entries.map((e, i) => (
                <SortableRow
                  key={e.id}
                  entry={e}
                  i={i}
                  onDelete={handleDelete}
                  onEdit={() => onEdit(e)}
                  editingField={editing?.id === e.id ? editing.field : null}
                  editingValue={editing?.id === e.id ? editing.value : ''}
                  onCellClick={(field, value) => handleCellClick(e, field, value)}
                  onBoolToggle={(field) => handleBoolToggle(e, field)}
                  onEditChange={handleEditChange}
                  onEditKeyDown={handleEditKeyDown}
                />
              ))}
            </SortableContext>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ ...tfootTd(), textAlign: 'left', paddingLeft: 8, fontSize: 10, color: '#444' }}>
                TOTALS ({entries.length} sectors)
              </td>
              <td style={tfootTd()}>{fmtTime(stats.totalPic)}</td>
              <td style={tfootTd()}>{fmtTime(stats.totalPicus)}</td>
              <td style={tfootTd()}>{fmtTime(stats.totalCop)}</td>
              <td style={tfootTd()}>{fmtTime(stats.totalIp)}</td>
              <td style={tfootTd()}>{fmtTime(stats.totalTr)}</td>
              <td style={tfootTd()}>{fmtTime(stats.totalBlock)}</td>
              <td style={tfootTd()}>{fmtTime(stats.totalNight)}</td>
              <td style={tfootTd()}>{fmtTime(stats.totalInst)}</td>
              <td style={tfootTd()} />
              <td style={tfootTd()}>{stats.toDay || ''}</td>
              <td style={tfootTd()}>{stats.toNight || ''}</td>
              <td style={tfootTd()}>{stats.ldDay || ''}</td>
              <td style={tfootTd()}>{stats.ldNight || ''}</td>
              <td colSpan={2} style={tfootTd()} />
            </tr>
          </tfoot>
        </table>
      </DndContext>
    </div>
  );
}
