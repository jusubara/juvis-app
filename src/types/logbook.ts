export type DutyCode = 'C' | 'F' | 'A' | 'L' | 'O' | 'SIM' | 'T' | '';
export type ApproachType = 'ILS' | 'VOR' | 'VISUAL' | 'RNAV' | 'RNP' | 'CIRCLING' | 'NDB' | '-' | '';

export interface LogbookEntry {
  id: string;
  date: string;           // YYYY-MM-DD
  flight_number: string;  // e.g. KE123
  departure: string;      // ICAO e.g. RKSS
  arrival: string;        // ICAO e.g. VHHH
  block_time: string;     // HH:MM
  night_time: string;     // HH:MM
  aircraft_type: string;  // e.g. B737, A320
  aircraft_reg: string;   // e.g. HL8000
  duty_code: DutyCode;
  approach_type: ApproachType;
  remarks: string;
  created_at: string;     // ISO string
}

export type ParsedEntry = Omit<LogbookEntry, 'id' | 'duty_code' | 'approach_type' | 'remarks' | 'created_at'>;

export const DUTY_CODE_LABELS: Record<string, string> = {
  C: 'C — Captain',
  F: 'F — First Officer',
  A: 'A — Active',
  L: 'L — Line Check',
  O: 'O — Observer',
  SIM: 'SIM — Simulator',
  T: 'T — Training',
};

export const APPROACH_TYPE_LABELS: Record<string, string> = {
  ILS: 'ILS',
  VOR: 'VOR',
  VISUAL: 'Visual',
  RNAV: 'RNAV',
  RNP: 'RNP',
  CIRCLING: 'Circling',
  NDB: 'NDB',
  '-': '— (해당없음)',
};
