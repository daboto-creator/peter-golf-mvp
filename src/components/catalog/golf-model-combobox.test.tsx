import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GolfModelCombobox } from "@/components/catalog/golf-model-combobox";
import type { GolfModelSuggestion } from "@/lib/catalog/golf-equipment-reference";

const models: GolfModelSuggestion[] = [
  {
    id: "titleist-driver",
    brandId: "titleist",
    categoryId: "driver",
    name: "GT3",
    normalizedName: "gt3",
  },
  {
    id: "titleist-iron",
    brandId: "titleist",
    categoryId: "iron",
    name: "T100",
    normalizedName: "t100",
  },
  {
    id: "callaway-driver",
    brandId: "callaway",
    categoryId: "driver",
    name: "Elyte",
    normalizedName: "elyte",
  },
];

afterEach(cleanup);

describe("GolfModelCombobox", () => {
  it("filters by brand/category and resolves an exact model", () => {
    const onChange = vi.fn();
    const { container } = render(
      <GolfModelCombobox
        id="model"
        models={models}
        brandId="titleist"
        categoryId="driver"
        value=""
        canonicalModelId=""
        manualMode={false}
        onChange={onChange}
        onManualModeChange={vi.fn()}
      />,
    );
    expect(
      [...container.querySelectorAll("option")].map((item) => item.value),
    ).toEqual(["GT3"]);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "GT3" },
    });
    expect(onChange).toHaveBeenLastCalledWith("GT3", "titleist-driver");
  });

  it("supports manual fallback without a canonical reference", () => {
    function Harness() {
      const [manual, setManual] = useState(false);
      const [value, setValue] = useState("");
      return (
        <GolfModelCombobox
          id="model"
          models={models}
          brandId="titleist"
          categoryId="driver"
          value={value}
          canonicalModelId=""
          manualMode={manual}
          onChange={(next) => setValue(next)}
          onManualModeChange={setManual}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "No encuentro mi modelo" }),
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Modelo legado" },
    });
    expect(screen.getByRole("combobox")).toHaveValue("Modelo legado");
    expect(screen.getByText(/pendiente de revisión/i)).toBeInTheDocument();
  });

  it("hydrates legacy raw model text", () => {
    render(
      <GolfModelCombobox
        id="model"
        models={models}
        brandId="titleist"
        categoryId="driver"
        value="Modelo anterior"
        canonicalModelId=""
        manualMode
        onChange={vi.fn()}
        onManualModeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("Modelo anterior");
  });
});
