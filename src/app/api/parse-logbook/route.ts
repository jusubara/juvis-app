import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const PARSE_PROMPT = `이 이미지는 항공기 운항기록부(flight logbook page)입니다.
다음 JSON 형식으로 정보를 추출해 주세요. JSON 외에 다른 텍스트는 출력하지 마세요.

{
  "date": "YYYY-MM-DD",
  "flight_number": "편명 (예: KE123, OZ456)",
  "departure": "출발지 ICAO 4자리 코드 (예: RKSS, VHHH, RJTT)",
  "arrival": "도착지 ICAO 4자리 코드",
  "block_time": "블록타임 HH:MM 형식 (예: 02:35)",
  "night_time": "야간비행시간 HH:MM 형식, 없으면 00:00",
  "aircraft_type": "기종 코드 (예: B737, B738, A320, A321)",
  "aircraft_reg": "항공기 등록번호 (예: HL8000)"
}

읽을 수 없거나 해당 정보가 없는 필드는 빈 문자열("")로 반환하세요.`;

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
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: PARSE_PROMPT },
          ],
        },
      ],
    });

    const responseText = (message.content[0] as { type: string; text: string }).text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

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
