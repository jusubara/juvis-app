import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const PARSE_PROMPT = `You are an expert OCR system for EASTAR JET Flight & Maintenance Log documents.

Carefully read the image and extract data. Return ONLY a valid JSON object — no markdown, no explanation.

=== DOCUMENT STRUCTURE ===
TOP SECTION (upper-left area of the document):
- "A/C NO." field: reads "HL XXXX" (e.g. HL 8542 → ac_no = "8542")
- "DATE (UTC)" or "DATE (DD-MMM-YY)": date field near top center (e.g. 15-MAY-26)
- "LOG PAGE": large number at top-right corner

CREW NAME TABLE (below A/C NO., left side):
  This table has numbered rows (1, 2, 3, 4).
  Each row has: [row number] | [CREW NAME] | [EMP NO.] | [DUTY CODE col 1] | [col 2] | [col 3] | [col 4]
  - CREW NAME: handwritten Korean name (2~3 characters). Read carefully.
  - EMP NO.: 7-digit number starting with 3 (e.g. 3330510). READ CAREFULLY.
  - DUTY CODE columns 1/2/3/4: letter codes (C, F, EC, EF, etc.) per leg

MAIN TABLE columns (left to right):
LEG | FLT NO. | FROM | TO | R/O | R/I | B/T | T/O | L/D | A/T | NIGHT TIME | INST TIME | ...
- R/O: Ramp Out time (HH:MM UTC, e.g. "06:35")
- R/I: Ramp In time (HH:MM UTC)
- B/T: Block Time duration (H+MM)
- T/O: Take Off time (HH:MM UTC)
- L/D: Landing time (HH:MM UTC)
- A/T: Actual Touchdown time (HH:MM UTC)

=== CRITICAL FIELD RULES ===
1. "block_ro" = R/O column (Ramp Out time). Format HH:MM (e.g. "06:35"). Empty string if blank.
2. "block_ri" = R/I column (Ramp In time). Format HH:MM. Empty string if blank.
3. "block_bt" = B/T column value (total block time). Format H+MM (e.g. "2+43"). Do NOT use R/I value.
4. "block_to" = T/O column (Take Off time). Format HH:MM. Empty string if blank.
5. "block_ld" = L/D column (Landing time). Format HH:MM. Empty string if blank.
6. "block_at" = A/T column (Actual Touchdown time). Format HH:MM. Empty string if blank.
7. "night_time" = NIGHT TIME column (after A/T). Often blank.
8. "inst_time" = INST TIME column. Often blank.
9. "crew_to_day" = CREW T/O Day — position number (1 or 2) of who did daytime takeoff, or "".
10. "crew_to_night" = CREW T/O Night — position number or "".
11. "crew_ld_day" = CREW L/D Day — position number or "".
12. "crew_ld_night" = CREW L/D Night — position number or "".
    NOTE: These are crew row numbers (1=first crew, 2=second crew), NOT landing counts.
13. Block time format (block_bt): convert dots/colons to + sign, drop leading zero on hours.
    "05.48"→"5+48", "02.43"→"2+43", "08.31"→"8+31"
14. FUEL data (TTL IN TANK, REMAIN etc.) are large Kg numbers — NEVER put in time fields.

=== JSON FORMAT ===
{
  "date_utc": "15-MAY-26",
  "ac_no": "8542",
  "ac_type": "B737-800",
  "log_page": "5426136",
  "crew": [
    {
      "position": 1,
      "name": "Korean name here",
      "emp_no": "3330510",
      "duty_codes": {"1":"C","2":"","3":"","4":""}
    },
    {
      "position": 2,
      "name": "Korean name here",
      "emp_no": "3240526",
      "duty_codes": {"1":"F","2":"","3":"","4":""}
    }
  ],
  "legs": [
    {
      "leg": 1,
      "flt_no": "951",
      "from": "PUS",
      "to": "CTS",
      "block_ro": "06:35",
      "block_ri": "09:18",
      "block_bt": "2+43",
      "block_to": "06:50",
      "block_ld": "09:05",
      "block_at": "09:08",
      "night_time": "",
      "inst_time": "",
      "crew_to_day": "1",
      "crew_to_night": "",
      "crew_ld_day": "2",
      "crew_ld_night": ""
    }
  ]
}

Return ONLY the JSON object. Start with { end with }.`;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. .env.local 파일을 확인하세요.' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: '이미지 파일이 없습니다.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'JPEG, PNG, WEBP, GIF 형식만 지원됩니다.' },
        { status: 400 }
      );
    }

    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PARSE_PROMPT },
          ],
        },
      ],
    });

    const responseText = (message.content[0] as { type: string; text: string }).text;
    const jsonMatch = responseText.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: '응답에서 JSON을 추출할 수 없습니다.', raw: responseText },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
