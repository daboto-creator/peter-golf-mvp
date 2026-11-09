import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BestRoundProChat } from "./best-round-pro-chat";
import { initialConversationState } from "@/lib/best-round-pro/conversation";

const auth = vi.hoisted(() => ({ listener: null as ((event: string, session: { user: { id: string } } | null) => void) | null }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (listener: typeof auth.listener) => {
        auth.listener = listener;
        listener?.("INITIAL_SESSION", { user: { id: "buyer-a" } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  auth.listener = null;
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

  it("resets visible conversation on an authenticated identity change", async () => {
    const state = initialConversationState();
    state.messages = [{ role: "user", content: "A private fact: handicap 8" }];
    sessionStorage.setItem("best-round-pro:v2:user:buyer-a:session", JSON.stringify(state));
    sessionStorage.setItem("best-round-pro:v2:active-identity", "user:buyer-a");
    const { rerender } = render(<BestRoundProChat embedded />);
    expect(await screen.findByText("A private fact: handicap 8")).toBeInTheDocument();

    auth.listener?.("SIGNED_IN", { user: { id: "buyer-b" } });
    rerender(<BestRoundProChat embedded />);
    await waitFor(() => expect(screen.queryByText("A private fact: handicap 8")).not.toBeInTheDocument());
  });
});
