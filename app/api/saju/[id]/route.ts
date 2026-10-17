import { NextRequest, NextResponse } from "next/server";
import { db, DataStoreError } from "@/lib/db/store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fortune = await db.getFortune(id);
    if (!fortune) {
      return NextResponse.json({ error: "사주 결과를 찾을 수 없습니다." }, { status: 404 });
    }
    const responseOptions = { headers: { Vary: "X-Saju-View" } };
    if (req.headers.get("x-saju-view") === "fortune") {
      return NextResponse.json({ fortune }, responseOptions);
    }
    const chats = await db.getChat(id);
    return NextResponse.json({ fortune, chats }, responseOptions);
  } catch (error: unknown) {
    if (error instanceof DataStoreError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({ error: "저장소를 사용할 수 없습니다. 입력을 보존하고 다시 시도해주세요." }, { status: 500 });
  }
}
