import { describe, expect, it } from "vitest";

import {
  canTransitionListing,
  getListingNextStep,
  getSpecFields,
  listingConditionSchema,
  listingImagePath,
  listingInventorySchema,
  listingStatusCopy,
  suggestListingTitle,
  validateListingImage,
  validateListingImageSignature,
} from "@/lib/marketplace/listing-rules";

describe("Marketplace listing rules", () => {
  it("maps every workflow status and exposes explicit transitions", () => {
    expect(Object.keys(listingStatusCopy)).toHaveLength(11);
    expect(canTransitionListing("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionListing("SUBMITTED", "APPROVED")).toBe(false);
    expect(canTransitionListing("UNDER_REVIEW", "CHANGES_REQUESTED")).toBe(
      true,
    );
    expect(canTransitionListing("APPROVED", "PUBLISHED")).toBe(false);
  });

  it("builds category-specific club fields instead of a universal form", () => {
    const driver = getSpecFields({
      family: "club",
      club_type: "driver",
      bag_type: null,
      set_type: null,
    });
    const putter = getSpecFields({
      family: "club",
      club_type: "putter",
      bag_type: null,
      set_type: null,
    });
    const bag = getSpecFields({
      family: "bag",
      club_type: null,
      bag_type: "stand_bag",
      set_type: null,
    });
    expect(driver.map((field) => field.key)).toEqual(
      expect.arrayContaining(["loftDegrees", "shaftFlex", "handedness"]),
    );
    expect(putter.map((field) => field.key)).toEqual(
      expect.arrayContaining(["lengthInches", "putterHeadType"]),
    );
    expect(putter.map((field) => field.key)).not.toContain("loftDegrees");
    expect(bag.map((field) => field.key)).toContain("dividerCount");
  });

  it("requires declared used condition and accepts new condition without grade", () => {
    expect(
      listingConditionSchema.safeParse({
        condition: "used",
        condition_grade: "",
        condition_notes: "Marcas visibles",
        declared_defects: [],
        defects_acknowledged: true,
      }).success,
    ).toBe(false);
    expect(
      listingConditionSchema.safeParse({
        condition: "new",
        condition_grade: "",
        condition_notes: "Nuevo en empaque",
        declared_defects: [],
        defects_acknowledged: true,
      }).success,
    ).toBe(true);
  });

  it("supports unique and multi-unit inventory without zero or negative values", () => {
    for (const quantity of [1, 25]) {
      expect(
        listingInventorySchema.safeParse({
          quantity,
          custody: "PARTNER_CUSTODY",
          fulfillment: "PARTNER_FULFILLED",
        }).success,
      ).toBe(true);
    }
    expect(
      listingInventorySchema.safeParse({
        quantity: 0,
        custody: "PARTNER_CUSTODY",
        fulfillment: "PARTNER_FULFILLED",
      }).success,
    ).toBe(false);
  });

  it("normalizes a deterministic suggested title", () => {
    expect(
      suggestListingTitle([
        " Titleist ",
        "GT3",
        "Driver",
        "9°",
        "Regular",
        "Right",
      ]),
    ).toBe("Titleist GT3 Driver 9° Regular Right");
  });

  it("validates listing image metadata, signatures and safe paths", () => {
    expect(
      validateListingImage({
        name: "driver.jpg",
        type: "image/jpeg",
        size: 100,
      }),
    ).toBeNull();
    expect(
      validateListingImage({
        name: "driver.svg",
        type: "image/svg+xml",
        size: 100,
      }),
    ).not.toBeNull();
    expect(
      validateListingImageSignature(
        "image/png",
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(
      listingImagePath(
        "42000000-0000-4000-8000-000000000001",
        "42000000-0000-4000-8000-000000000002",
        "42000000-0000-4000-8000-000000000003",
        "42000000-0000-4000-8000-000000000004",
        "image/jpeg",
      ),
    ).toBe(
      "listings/42000000-0000-4000-8000-000000000001/42000000-0000-4000-8000-000000000002/42000000-0000-4000-8000-000000000003/42000000-0000-4000-8000-000000000004.jpg",
    );
  });

  it("maps partner next steps without implying approved means live", () => {
    expect(getListingNextStep("DRAFT")).toBe("Continuar borrador");
    expect(getListingNextStep("CHANGES_REQUESTED")).toBe(
      "Corregir publicación",
    );
    expect(getListingNextStep("APPROVED")).toBe("Ver publicación");
  });
});
