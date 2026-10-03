import { NextRequest, NextResponse } from "next/server";
import { analyzeSaju } from "@/lib/saju/manse";
import { generateFortune } from "@/lib/ai/doryeong-ai";
import { db, DataStoreError } from "@/lib/db/store";
import { parseJsonBody, parseSajuInput, SajuInputError } from "@/lib/saju/input";
import type { FortuneResult } from "@/lib/saju/types";

// Stored results must be read per request, not prerendered into a shared build cache.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);
    const input = parseSajuInput(body);
    const category = body.category === undefined ? "overall" : body.category;
    const categories = ["overall", "love", "match", "career", "year", "daewun", "consult"];
    if (typeof category !== "string" || !categories.includes(category)) {
      throw new SajuInputError("풀이 분야 입력값을 확인해주세요.");
    }
    if (body.customQuestion !== undefined && typeof body.customQuestion !== "string") {
      throw new SajuInputError("질문은 글자로 입력해주세요.");
    }
    const customQuestion = typeof body.customQuestion === "string" ? body.customQuestion.trim().slice(0, 500) : undefined;
    const analysis = analyzeSaju(input);

    // 2. 도령 AI / 감성 템플릿 엔진 실행
    const fortune = await generateFortune(analysis, category as FortuneResult["category"], customQuestion);

    // 3. DB 저장
    await db.saveFortune(fortune);

    return NextResponse.json({ success: true, fortune });
  } catch (error: any) {
    if (error instanceof DataStoreError) return NextResponse.json({error:error.message},{status:error.status});
    if (error instanceof SajuInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("사주 풀이 또는 저장 실패");
    return NextResponse.json({ error: "사주 풀이를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const list = await db.listFortunes();
    return NextResponse.json({ fortunes: list });
  } catch (error: any) {
    if (error instanceof DataStoreError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({ error: "저장소를 사용할 수 없습니다. 입력을 보존하고 다시 시도해주세요." }, { status: 500 });
  }
}
