import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOrderBook } from "./use-order-book";

type SubscribeMsg = {
  method: "subscribe" | "unsubscribe";
  subscription: { type: "l2Book"; coin: string; nSigFigs: number };
};

class MockWebSocket extends EventTarget {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: SubscribeMsg[] = [];

  constructor(url: string) {
    super();
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  // Test helpers
  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }
  emitMessage(data: unknown) {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(data) }),
    );
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
    MockWebSocket as unknown as typeof WebSocket;
});

describe("useOrderBook", () => {
  it("opens a socket and subscribes on open", () => {
    const { result } = renderHook(() => useOrderBook("BTC", 5));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(result.current.connectionState).toBe("connecting");

    const ws = MockWebSocket.instances[0]!;
    act(() => ws.emitOpen());

    expect(result.current.connectionState).toBe("live");
    expect(ws.sent[0]).toEqual({
      method: "subscribe",
      subscription: { type: "l2Book", coin: "BTC", nSigFigs: 5 },
    });
  });

  it("populates bids and asks from an l2Book frame", () => {
    const { result } = renderHook(() => useOrderBook("BTC", 5));
    const ws = MockWebSocket.instances[0]!;
    act(() => ws.emitOpen());

    act(() =>
      ws.emitMessage({
        channel: "l2Book",
        data: {
          coin: "BTC",
          time: Date.now(),
          levels: [
            [{ px: "42000", sz: "1.0", n: 1 }],
            [{ px: "42001", sz: "0.5", n: 1 }],
          ],
        },
      }),
    );

    expect(result.current.bids).toHaveLength(1);
    expect(result.current.asks).toHaveLength(1);
    expect(result.current.bids[0]?.px).toBe("42000");
    expect(result.current.lastMessageAt).not.toBeNull();
  });

  it("ignores frames for the wrong coin", () => {
    const { result } = renderHook(() => useOrderBook("BTC", 5));
    const ws = MockWebSocket.instances[0]!;
    act(() => ws.emitOpen());

    act(() =>
      ws.emitMessage({
        channel: "l2Book",
        data: { coin: "ETH", time: 0, levels: [[], []] },
      }),
    );

    expect(result.current.bids).toEqual([]);
    expect(result.current.asks).toEqual([]);
  });

  it("ignores malformed messages without crashing", () => {
    renderHook(() => useOrderBook("BTC", 5));
    const ws = MockWebSocket.instances[0]!;
    act(() => ws.emitOpen());

    // Should swallow JSON-parse errors silently
    expect(() =>
      act(() =>
        ws.dispatchEvent(new MessageEvent("message", { data: "not json" })),
      ),
    ).not.toThrow();
  });

  it("re-subscribes when nSigFigs changes", () => {
    const { rerender } = renderHook(
      ({ n }: { n: 5 | 4 }) => useOrderBook("BTC", n),
      { initialProps: { n: 5 as 5 | 4 } },
    );
    const ws = MockWebSocket.instances[0]!;
    act(() => ws.emitOpen());

    const initialSends = ws.sent.length;
    act(() => rerender({ n: 4 }));

    const afterChange = ws.sent.slice(initialSends);
    expect(
      afterChange.find((m) => m.method === "unsubscribe"),
    ).toBeDefined();
    expect(
      afterChange.find(
        (m) => m.method === "subscribe" && m.subscription.nSigFigs === 4,
      ),
    ).toBeDefined();
  });
});
