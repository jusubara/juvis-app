// ─── Eastar Jet Logbook Entry ───────────────────────────────────────────────
export interface EastarEntry {
  id: string;
  date: string;       // "M/D" format (e.g. "7/9") as used in 이스타항공 logbook
  ac_type: string;    // "B738" | "B38M"
  ac_ident: string;   // "HL8507"
  from_apt: string;   // IATA 3-letter (e.g. "GMP")
  to_apt: string;     // IATA 3-letter (e.g. "CJU")
  flt_no: string;     // Flight number without ZE prefix (e.g. "221")
  pic: string;        // PIC time "H+MM"
  picus: string;      // PIC Under Supervision
  cop: string;        // Co-pilot time
  ip: string;         // Instructor Pilot
  tr: string;         // Training
  block: string;      // Block time "H+MM"
  night: string;      // Night time
  inst: string;       // Instrument time
  app_type: string;   // Combined approach string (e.g. "ILS Z RWY07")
  to_d: boolean;      // Takeoff Day
  to_n: boolean;      // Takeoff Night
  ld_d: boolean;      // Landing Day
  ld_n: boolean;      // Landing Night
  remarks: string;
  created_at: string;
}

// ─── OCR (Claude Vision) Result Types ───────────────────────────────────────
export interface OcrCrew {
  position: number;
  name: string;
  emp_no: string;
  duty_codes: Record<string, string>; // {"1":"C","2":"F","3":"","4":""}
}

export interface OcrLeg {
  leg: number;
  flt_no: string;
  from: string;
  to: string;
  block_bt: string;
  night_time: string;
  inst_time: string;
  crew_to_day: string;
  crew_to_night: string;
  crew_ld_day: string;
  crew_ld_night: string;
}

export interface OcrResult {
  date_utc: string;   // "15-MAY-26"
  ac_no: string;      // "8542" (HL suffix digits only)
  ac_type: string;    // "B737-800"
  log_page: string;
  crew: OcrCrew[];
  legs: OcrLeg[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
export const AC_TYPE_MAP: Record<string, string> = {
  '8542': 'B38M',
  // Add more registrations as needed
};

export const APP_TYPES = [
  '', 'ILS', 'ILS CAT II', 'ILS CAT III', 'LDA', 'LOC', 'LOC BC',
  'VOR', 'VOR/DME', 'RNAV (GPS)', 'RNAV (RNP)', 'NDB', 'NDB DME',
  'SDF', 'Visual', 'Circling',
];

export const APP_SUFFIXES = ['', 'Y', 'Z', 'W', 'X', 'V'];

export const PIC_DUTIES = ['C', 'EC', 'XC', 'CC', 'RC', 'AC', 'B', 'QC'];
