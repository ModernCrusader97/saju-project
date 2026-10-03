import { NextRequest, NextResponse } from "next/server";
import { analyzeSaju } from "@/lib/saju/manse";
import { parseJsonBody, parseSajuInput, SajuInputError } from "@/lib/saju/input";
import { db, DataStoreError } from "@/lib/db/store";
import { GuinMapData, GuinPerson } from "@/lib/saju/types";

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);
    const input = parseSajuInput({ ...body, gender: "male" });
    const saju = analyzeSaju(input);

    const mapId = "gm_" + crypto.randomUUID();

    const yKey = `${saju.yearPillar.gan}${saju.yearPillar.ji}`;
    const mKey = `${saju.monthPillar.gan}${saju.monthPillar.ji}`;
    const dKey = `${saju.dayPillar.gan}${saju.dayPillar.ji}`;
    const hKey = saju.hourPillar ? `${saju.hourPillar.gan}${saju.hourPillar.ji}` : undefined;

    const guinMap: GuinMapData = {
      id: mapId,
      ownerName: input.name,
      ownerBirth: `${input.birthYear}.${input.birthMonth}.${input.birthDay}`,
      ownerCalendarType: input.calendarType,
      ownerSolarBirthDate: input.solarBirthDate,
      ownerDayMaster: saju.dayMaster,
      ownerTheme: saju.dayMasterMetaphor,
      createdAt: new Date().toISOString(),
      guins: [
        {
          id: "me",
          name: `${input.name} (나)`,
          birthDate: `${input.birthYear}.${input.birthMonth}.${input.birthDay}`,
          calendarType: input.calendarType,
          solarBirthDate: input.solarBirthDate,
          relationType: "mentor",
          relationTitle: "나의 중심 별",
          dayMaster: saju.dayMaster,
          elementMatch: saju.dominantElement,
          affinityScore: 100,
          advice: "내 사주의 고유한 빛이 주변의 좋은 인연들을 이끌어당깁니다.",
          isMe: true,
          pillars: {
            dayKey: dKey,
            monthKey: mKey,
            yearKey: yKey,
            hourKey: hKey,
          },
        },
      ],
    };

    await db.saveGuinMap(guinMap);

    return NextResponse.json({ success: true, guinMap });
  } catch (err: any) {
    if (err instanceof DataStoreError) return NextResponse.json({error:err.message},{status:err.status});
    if (err instanceof SajuInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "저장소를 사용할 수 없습니다. 입력을 보존하고 다시 시도해주세요." }, { status: 500 });
  }
}
