import { GuinPerson } from "@/lib/saju/types";
import { analyzeSaju } from "@/lib/saju/manse";
import { SajuInputError } from "@/lib/saju/input";
import * as THREE from "three";

import { getSpiralArmPosition } from "./spiral-galaxy";

export interface GalaxyNode {
  person: GuinPerson;
  isOwner: boolean;
  armIndex: number;        // 배치된 나선팔 (0~3)
  baseRadius: number;      // 은하 중심(0,0,0)으로부터의 궤도 반경
  baseAngle: number;       // 초기 나선 각도
  worldPos: THREE.Vector3; // 은하 내 3D 초기 좌표
  verticalOffset: number;  // 3D 은하 원반 두께감
  dayKey: string;          // SLOT-D (주 표면 70%)
  monthKey: string;        // SLOT-M (보조 표면 30%)
  yearKey: string;         // SLOT-Y (고리)
  hourKey?: string;        // SLOT-H (위성)
}

// 등록된 인연 데이터를 기반으로 4대 나선팔 3D 은하 노드 좌표를 산출합니다.
export function buildGalaxyNodes(
  guins: GuinPerson[],
  distanceScale: number = 1.0
): GalaxyNode[] {
  const nodes: GalaxyNode[] = [];
  const friendList = guins.filter((g) => !g.isMe);
  const ownerPerson = guins.find((g) => g.isMe) || guins[0];

  // 1. 나의 중심별 (지도 소유자 행성)
  // 나선은하의 제1주요나선팔(Arm 0) 반경 5.8 지점에 안착 (은하핵 0,0,0을 중심으로 은하 전체와 함께 공전)
  const ownerBaseRadius = 5.8;
  const ownerRadius = ownerBaseRadius * distanceScale;
  const ownerArm = 0;
  const ownerPos = getSpiralArmPosition(ownerArm, ownerRadius, 0, 0.1);

  if (ownerPerson) {
    const ownerPillars = resolvePersonPillars(ownerPerson);
    nodes.push({
      person: withCalculationWarning(ownerPerson, ownerPillars.validationError),
      isOwner: true,
      armIndex: ownerArm,
      baseRadius: ownerRadius,
      baseAngle: 0,
      worldPos: ownerPos.clone(),
      verticalOffset: 0.1,
      dayKey: ownerPillars.dayKey,
      monthKey: ownerPillars.monthKey,
      yearKey: ownerPillars.yearKey,
      hourKey: ownerPillars.hourKey,
    });
  }

  // 2. 인연 행성들 (지인들의 독립 행성 노드)
  // '나를 중심으로 공전하는 것이 아니라 거리를 유지하며 은하 내에서 함께 공전'
  // 케미/궁합 점수에 따라 같은 나선팔(인접 성단) 또는 조화 나선팔에 배치
  friendList.forEach((friend, idx) => {
    const pillars = resolvePersonPillars(friend);
    const score = friend.affinityScore || 90;

    // 궁합 점수에 따른 나선팔 선택 및 반경 오프셋
    let armIndex = 0;
    let radius = ownerRadius;
    let angleOffset = 0;

    if (score >= 94) {
      // 천생연분/깊은 인연: 나와 같은 나선팔(Arm 0)의 인접 성단
      armIndex = 0;
      const step = (idx % 2 === 0 ? 1 : -1) * (1.2 + (idx * 0.5));
      radius = Math.max(3.5, Math.min(14.0, ownerRadius + step * distanceScale));
      angleOffset = (idx % 2 === 0 ? 0.22 : -0.22);
    } else if (score >= 87) {
      // 좋은 인연: 인접한 조화 나선팔 (Arm 1 또는 Arm 3)
      armIndex = (idx % 2 === 0) ? 1 : 3;
      radius = (ownerBaseRadius + (idx * 0.8 - 0.4)) * distanceScale;
      angleOffset = (idx * 0.15) - 0.1;
    } else {
      // 거리감 있는 인연: 반대편 나선팔 (Arm 2) 또는 외곽 성단
      armIndex = 2;
      radius = (ownerBaseRadius + 2.5 + idx * 1.1) * distanceScale;
      angleOffset = 0.2;
    }

    const verticalJitter = Math.sin(idx * 1.7) * 0.35;
    const friendPos = getSpiralArmPosition(armIndex, radius, angleOffset, verticalJitter);

    nodes.push({
      person: withCalculationWarning(friend, pillars.validationError),
      isOwner: false,
      armIndex,
      baseRadius: radius,
      baseAngle: angleOffset,
      worldPos: friendPos,
      verticalOffset: verticalJitter,
      dayKey: pillars.dayKey,
      monthKey: pillars.monthKey,
      yearKey: pillars.yearKey,
      hourKey: pillars.hourKey,
    });
  });

  return nodes;
}

function withCalculationWarning(person: GuinPerson, warning?: string): GuinPerson {
  if (!warning) return person;
  return {
    ...person,
    name: `${person.name} (생년월일 확인 필요)`,
    relationTitle: "생년월일 확인 필요 · 기본 표시",
    advice: `${warning} 현재 행성은 계산 결과가 아닌 기본 표시입니다.`,
  };
}

// 인연 객체로부터 4기둥 간지 조합 추출 (없을 경우 생년월일 또는 일간 기반 안전 산출)
export function resolvePersonPillars(person: GuinPerson): {
  dayKey: string;
  monthKey: string;
  yearKey: string;
  hourKey?: string;
  validationError?: string;
} {
  if (person.pillars) {
    return person.pillars;
  }

  // 생년월일 파싱
  if (person.birthDate) {
    const parts = person.birthDate.split(".").map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      try {
        const saju = analyzeSaju({
          name: person.name,
          gender: "female",
          birthYear: parts[0],
          birthMonth: parts[1],
          birthDay: parts[2],
          calendarType: person.calendarType ?? "solar",
          isUnknownTime: true,
        });
        return {
          dayKey: `${saju.dayPillar.gan}${saju.dayPillar.ji}`,
          monthKey: `${saju.monthPillar.gan}${saju.monthPillar.ji}`,
          yearKey: `${saju.yearPillar.gan}${saju.yearPillar.ji}`,
          hourKey: undefined,
        };
      } catch (error) {
        if (!(error instanceof SajuInputError)) throw error;
        // Invalid legacy dates fall through to a visibly marked default appearance.
      }
    }
  }

  // 기본 간지 안전 폴백
  return {
    dayKey: "갑자",
    monthKey: "병인",
    yearKey: "을축",
    hourKey: undefined,
    validationError: "유효한 생년월일을 확인할 수 없습니다.",
  };
}
