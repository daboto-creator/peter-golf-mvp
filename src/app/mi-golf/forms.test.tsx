import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mi-golf/actions", () => ({
  addMiGolfEquipmentAction: vi.fn(async () => ({ ok: true, message: "Equipo agregado" })),
  addMiGolfObjectiveAction: vi.fn(),
  deactivateMiGolfEquipmentAction: vi.fn(),
  saveMiGolfProfileAction: vi.fn(),
  updateMiGolfEquipmentAction: vi.fn(),
  updateMiGolfObjectiveStatusAction: vi.fn(),
}));

import { addMiGolfEquipmentAction } from "@/lib/mi-golf/actions";
import { EquipmentForm } from "./forms";

describe("Mi Golf canonical equipment selectors", () => {
  it("renders dependent canonical brand/model selectors and submits IDs", async () => {
    render(
      <EquipmentForm
        categories={[{ id: "putter-category", slug: "putter", label: "Putter", family: "club", kind: "putter" }]}
        brands={[{ id: "taylormade", name: "TaylorMade", slug: "taylormade" }]}
        models={[{ id: "spider-tour", brandId: "taylormade", categoryId: "putter-category", name: "Spider Tour", normalizedName: "spider-tour" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /agregar equipo/i }));
    const selectors = screen.getAllByRole("combobox");
    fireEvent.change(selectors[0], { target: { value: "putter-category" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "taylormade" } });

    expect(screen.getByRole("option", { name: "Spider Tour" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Modelo"), { target: { value: "spider-tour" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar a mi equipo/i }));

    expect(addMiGolfEquipmentAction).toHaveBeenCalled();
    const data = (addMiGolfEquipmentAction as unknown as { mock: { calls: Array<[FormData]> } }).mock.calls[0][0];
    expect(data.get("canonicalBrandId")).toBe("taylormade");
    expect(data.get("canonicalModelId")).toBe("spider-tour");
    expect(data.get("categoryId")).toBe("putter-category");
  });
});
