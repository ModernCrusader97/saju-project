import { GuinPerson } from "./types";
import { getDailyPillar } from "./manse";

/**
 * [Step 3] "오늘 우리 행성의 궤도 날씨" 데일리 관계 인사이트 엔진
 * 오늘의 일진(오늘의 천간/오행)과 나와 친구 행성의 오행 상생상극을 계산하여
 * 실시간 궤도 날씨 숏폼 카드를 생성합니다.
 */

export interface OrbitalWeatherInsight {
  friendId: string;
  friendName: string;
  weatherType: "super_charged" | "golden_rendezvous" | "caution_belt" | "gentle_breeze";
  badgeText: string;
  headline: string;
  actionTip: string;
  elementStatus: string;
}

// 오행 상생/상극 헬퍼
const ELEMENT_MAP: Record<string, "wood" | "fire" | "earth" | "metal" | "water"> = {
  갑: "wood", 을: "wood",
  병: "fire", 정: "fire",
  무: "earth", 기: "earth",
  경: "metal", 신: "metal",
  임: "water", 계: "water",
};

export function calculateDailyOrbitalWeather(
  ownerPerson: GuinPerson,
  friends: GuinPerson[]
): OrbitalWeatherInsight[] {
  const today = new Date();
  const { gan: todayStem, element: todayElement } = getDailyPillar(
    today.getFullYear(), today.getMonth() + 1, today.getDate()
  );

  const ownerStem = ownerPerson.pillars?.dayKey?.charAt(0) || "갑";
  const ownerElement = ELEMENT_MAP[ownerStem] || "wood";

  return friends
    .filter((f) => !f.isMe)
    .map((friend) => {
      const friendStem = friend.pillars?.dayKey?.charAt(0) || "을";
      const friendElement = ELEMENT_MAP[friendStem] || "fire";

      // 오행 상생/상극 관계 체크
      let weatherType: OrbitalWeatherInsight["weatherType"] = "gentle_breeze";
      let badgeText = "순항 궤도 🌤️";
      let headline = `${friend.name}님과 잔잔하고 편안한 궤도 비행 중입니다.`;
      let actionTip = "가벼운 안부 인사나 숏폼 릴스를 공유해보세요.";

      // 1. 오늘의 기운과 합/생
      if (
        (ownerElement === "wood" && friendElement === "fire") ||
        (ownerElement === "fire" && friendElement === "earth") ||
        (ownerElement === "earth" && friendElement === "metal") ||
        (ownerElement === "metal" && friendElement === "water") ||
        (ownerElement === "water" && friendElement === "wood")
      ) {
        weatherType = "golden_rendezvous";
        badgeText = "황금 랑데부 💫";
        headline = `오늘 ${friend.name}님과 행성 간 인력이 극대화되는 날입니다!`;
        actionTip = "오늘 먼저 연락하거나 약속을 잡으면 큰 시너지와 행운이 따릅니다.";
      } else if (
        (friendElement === "wood" && ownerElement === "fire") ||
        (friendElement === "fire" && ownerElement === "earth") ||
        (friendElement === "earth" && ownerElement === "metal") ||
        (friendElement === "metal" && ownerElement === "water") ||
        (friendElement === "water" && ownerElement === "wood")
      ) {
        weatherType = "super_charged";
        badgeText = "에너지 충전 궤도 ✨";
        headline = `${friend.name}님의 기운이 나의 중심별을 밝혀주는 날!`;
        actionTip = "오늘 커피 한 잔이나 밥 한 끼 사면 나에게 더 큰 복으로 돌아옵니다.";
      } else if (
        (ownerElement === "fire" && friendElement === "water") ||
        (ownerElement === "water" && friendElement === "fire") ||
        (ownerElement === "metal" && friendElement === "wood") ||
        (ownerElement === "wood" && friendElement === "metal")
      ) {
        weatherType = "caution_belt";
        badgeText = "소행성대 주의보 ⚡";
        headline = `두 행성 사이의 전기적 스파크가 튈 수 있는 날입니다.`;
        actionTip = "사소한 오해를 피하도록 다정하고 부드러운 말투를 의식해 보세요.";
      }

      return {
        friendId: friend.id,
        friendName: friend.name,
        weatherType,
        badgeText,
        headline,
        actionTip,
        elementStatus: `오늘의 우주 기운 [${todayStem}·${todayElement.toUpperCase()}] 영향권`,
      };
    });
}
