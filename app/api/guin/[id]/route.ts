import { NextRequest, NextResponse } from "next/server";
import { analyzeSaju } from "@/lib/saju/manse";
import { parseJsonBody, parseSajuInput, SajuInputError } from "@/lib/saju/input";
import { db, DataStoreError } from "@/lib/db/store";
import { GuinPerson } from "@/lib/saju/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const map = await db.getGuinMap(id);
    if (!map) {
      return NextResponse.json({ error: "귀인 지도를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ guinMap: map });
  } catch (err: any) {
    if (err instanceof DataStoreError) return NextResponse.json({error:err.message},{status:err.status});
    return NextResponse.json({ error: "저장소를 사용할 수 없습니다. 입력을 보존하고 다시 시도해주세요." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const map = await db.getGuinMap(id);
    if (!map) {
      return NextResponse.json({ error: "귀인 지도를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await parseJsonBody(req);
    const input = parseSajuInput({ ...body, name: body.friendName, gender: "female" });
    const friendSaju = analyzeSaju(input);

    const relationTitles = [
      "막힌 길을 시원하게 터주는 길잡이 귀인",
      "지친 마음을 든든하게 받쳐주는 안식처 귀인",
      "서로의 장점을 북돋아주는 성장의 동반자",
      "함께 있으면 재물과 복을 부르는 복덩이 인연",
      "숨겨진 잠재력을 깨워주는 지혜의 등불",
    ];

    const randomTitle = relationTitles[Math.floor(Math.random() * relationTitles.length)];
    const affinityScore = Math.floor(Math.random() * 15) + 85; // 85 ~ 99점

    const yKey = `${friendSaju.yearPillar.gan}${friendSaju.yearPillar.ji}`;
    const mKey = `${friendSaju.monthPillar.gan}${friendSaju.monthPillar.ji}`;
    const dKey = `${friendSaju.dayPillar.gan}${friendSaju.dayPillar.ji}`;
    const hKey = friendSaju.hourPillar ? `${friendSaju.hourPillar.gan}${friendSaju.hourPillar.ji}` : undefined;

    const newPerson: GuinPerson = {
      id: "friend_" + crypto.randomUUID(),
      name: input.name,
      relationType: "supporter",
      relationTitle: "체험용 예시 · " + randomTitle,
      birthDate: `${input.birthYear}.${input.birthMonth}.${input.birthDay}`,
      calendarType: input.calendarType,
      solarBirthDate: input.solarBirthDate,
      dayMaster: friendSaju.dayMaster,
      elementMatch: `${friendSaju.dominantElement} 기운`,
      affinityScore,
      advice: "관계 점수와 설명은 체험용 임의 예시이며 실제 궁합 계산 결과가 아닙니다.",
      isMe: false,
      pillars: {
        dayKey: dKey,
        monthKey: mKey,
        yearKey: yKey,
        hourKey: hKey,
      },
    };

    const updated = await db.addFriendToGuinMap(id, newPerson);

    return NextResponse.json({ success: true, guinMap: updated, newPerson });
  } catch (err: any) {
    if (err instanceof DataStoreError) return NextResponse.json({error:err.message},{status:err.status});
    if (err instanceof SajuInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "저장소를 사용할 수 없습니다. 입력을 보존하고 다시 시도해주세요." }, { status: 500 });
  }
}
