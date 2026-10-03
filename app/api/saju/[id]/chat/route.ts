import { NextRequest, NextResponse } from "next/server";
import { db, DataStoreError } from "@/lib/db/store";
import { askDoryeong } from "@/lib/ai/doryeong-ai";
import { parseJsonBody, SajuInputError } from "@/lib/saju/input";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { question } = await parseJsonBody(req);
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "질문 내용을 올바르게 입력해주세요." }, { status: 400 });
    }
    const cleanQuestion = question.trim().slice(0, 500);

    const fortune = await db.getFortune(id);
    if (!fortune) {
      return NextResponse.json({ error: "사주 결과를 찾을 수 없습니다." }, { status: 404 });
    }

    // 사용자 질문 저장
    await db.addChatMessage(id, "user", cleanQuestion);

    // AI 도령 답변 생성
    const reply = await askDoryeong(fortune, cleanQuestion);

    // 도령 답변 저장
    await db.addChatMessage(id, "doryeong", reply);

    return NextResponse.json({ success: true, reply });
  } catch (error: any) {
    if (error instanceof DataStoreError) return NextResponse.json({error:error.message},{status:error.status});
    if (error instanceof SajuInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("대화 답변 생성 또는 저장 실패");
    return NextResponse.json({ error: "답변을 저장하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
