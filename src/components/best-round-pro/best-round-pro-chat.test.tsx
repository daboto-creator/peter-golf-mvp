import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BestRoundProChat } from "./best-round-pro-chat";
import { initialConversationState } from "@/lib/best-round-pro/conversation";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Best Round Pro request page context", () => {
  it("sends the authoritative current-page DTO on the turn", async () => {
    const currentPageProduct = {
      id: "vokey-id",
      slug: "titleist-vokey-sm10-wedge-56",
      name: "Titleist Vokey SM10 Wedge 56",
      productFamily: "WEDGE",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      state: initialConversationState(),
      reply: "Respuesta",
      recommendation: null,
      catalogProducts: null,
      outcome: null,
    }), { status: 200, headers: { "content-type": "application/json" } }));

    render(<BestRoundProChat embedded currentPageProduct={currentPageProduct} />);
    fireEvent.change(screen.getByPlaceholderText(/Pregúntame por drivers/), { target: { value: "este equipo me sirve?" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.currentPageProduct).toEqual(currentPageProduct);
    expect(body.message).toBe("este equipo me sirve?");
  });
});
