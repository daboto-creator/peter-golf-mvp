import type { CategoryMatchProfile, MatchCategory } from "@/lib/mi-golf/domain";

export const CATEGORY_MATCH_PROFILES: Readonly<
  Record<MatchCategory, CategoryMatchProfile>
> = {
  DRIVER: {
    category: "DRIVER",
    ruleVersion: "driver-v1",
    baseScore: 78,
    weights: {
      HANDEDNESS: 10,
      PLAYER_LEVEL: 8,
      SHAFT: 8,
      LOFT: 8,
      SHOT_TENDENCY: 8,
      BAG_GAP: 3,
      CONFIGURATION: 5,
    },
  },
  FAIRWAY_WOOD: {
    category: "FAIRWAY_WOOD",
    ruleVersion: "fairway-v1",
    baseScore: 78,
    weights: {
      HANDEDNESS: 10,
      PLAYER_LEVEL: 7,
      SHAFT: 7,
      LOFT: 7,
      SHOT_TENDENCY: 3,
      BAG_GAP: 10,
      CONFIGURATION: 5,
    },
  },
  HYBRID: {
    category: "HYBRID",
    ruleVersion: "hybrid-v1",
    baseScore: 78,
    weights: {
      HANDEDNESS: 10,
      PLAYER_LEVEL: 7,
      SHAFT: 7,
      LOFT: 7,
      SHOT_TENDENCY: 2,
      BAG_GAP: 10,
      CONFIGURATION: 7,
    },
  },
  IRON: {
    category: "IRON",
    ruleVersion: "irons-v1",
    baseScore: 76,
    weights: {
      HANDEDNESS: 10,
      PLAYER_LEVEL: 12,
      SHAFT: 8,
      LOFT: 2,
      SHOT_TENDENCY: 2,
      BAG_GAP: 5,
      CONFIGURATION: 9,
    },
  },
  WEDGE: {
    category: "WEDGE",
    ruleVersion: "wedge-v1",
    baseScore: 78,
    weights: {
      HANDEDNESS: 10,
      PLAYER_LEVEL: 3,
      SHAFT: 3,
      LOFT: 9,
      SHOT_TENDENCY: 1,
      BAG_GAP: 12,
      CONFIGURATION: 10,
    },
  },
  PUTTER: {
    category: "PUTTER",
    ruleVersion: "putter-v1",
    baseScore: 80,
    weights: {
      HANDEDNESS: 10,
      PLAYER_LEVEL: 1,
      SHAFT: 0,
      LOFT: 0,
      SHOT_TENDENCY: 0,
      BAG_GAP: 2,
      CONFIGURATION: 15,
    },
  },
};
