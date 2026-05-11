"use client";

import { useEffect, useRef, useState } from "react";
import {
  HYPERLIQUID_WS_URL,
  type Coin,
  type ConnectionState,
  type L2BookMessage,
  type L2BookSubscription,
  type Mantissa,
  type NSigFigs,
  type RawLevel,
} from "@/app/lib/hyperliquid";

const RECONNECT_DELAY_MS = 1500;

type Book = {
  bids: RawLevel[];
  asks: RawLevel[];
};

type OrderBookSnapshot = Book & {
  connectionState: ConnectionState;
  lastMessageAt: number | null;
};

const EMPTY_BOOK: Book = { bids: [], asks: [] };

/**
 * Maintains a single WebSocket for the lifetime of the hook. When `coin`,
 * `nSigFigs`, or `mantissa` changes we send unsubscribe + subscribe over the
 * same socket rather than tearing it down — Hyperliquid identifies
 * subscriptions by their full shape, so the server resumes streaming at the
 * new precision without a reconnect round-trip.
 */
export function useOrderBook(
  coin: Coin,
  nSigFigs: NSigFigs,
  mantissa: Mantissa,
): OrderBookSnapshot {
  const [book, setBook] = useState<Book>(EMPTY_BOOK);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const activeSubRef = useRef<L2BookSubscription | null>(null);

  // Open the socket once for the lifetime of the hook.
  useEffect(() => {
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (stopped) return;
      setConnectionState("connecting");
      const ws = new WebSocket(HYPERLIQUID_WS_URL);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        const sub = activeSubRef.current;
        if (sub) {
          ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
        }
        setConnectionState("live");
      });

      ws.addEventListener("message", (event) => {
        let parsed: L2BookMessage;
        try {
          parsed = JSON.parse(event.data as string) as L2BookMessage;
        } catch {
          return;
        }
        if (parsed.channel !== "l2Book") return;
        const sub = activeSubRef.current;
        if (!sub || parsed.data?.coin !== sub.coin) return;
        const [bids, asks] = parsed.data.levels;
        setBook({ bids, asks });
        setLastMessageAt(Date.now());
      });

      ws.addEventListener("error", () => setConnectionState("error"));

      ws.addEventListener("close", () => {
        wsRef.current = null;
        if (stopped) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      });
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      const sub = activeSubRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && sub) {
        ws.send(JSON.stringify({ method: "unsubscribe", subscription: sub }));
      }
      ws?.close();
    };
  }, []);

  // Re-subscribe on any precision-shape change without tearing down the socket.
  useEffect(() => {
    const next: L2BookSubscription = { type: "l2Book", coin, nSigFigs };
    if (mantissa !== 1) next.mantissa = mantissa;
    const ws = wsRef.current;
    const previous = activeSubRef.current;

    activeSubRef.current = next;
    setBook(EMPTY_BOOK); // clear stale levels while the new feed warms up

    if (ws && ws.readyState === WebSocket.OPEN) {
      if (previous) {
        ws.send(
          JSON.stringify({ method: "unsubscribe", subscription: previous }),
        );
      }
      ws.send(JSON.stringify({ method: "subscribe", subscription: next }));
    }
  }, [coin, nSigFigs, mantissa]);

  return { ...book, connectionState, lastMessageAt };
}
