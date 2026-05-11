"use client";

import { useEffect, useRef, useState } from "react";
import {
  HYPERLIQUID_WS_URL,
  type Coin,
  type ConnectionState,
  type L2BookMessage,
  type L2BookSubscription,
  type NSigFigs,
  type RawLevel,
} from "@/app/lib/hyperliquid";

const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30_000;
const HIDDEN_RECONNECT_THRESHOLD_MS = 5_000;

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
 * Maintains a single WebSocket for the lifetime of the hook. When `coin` or
 * `nSigFigs` changes we send unsubscribe + subscribe over the same socket
 * rather than tearing it down — Hyperliquid identifies subscriptions by their
 * full shape, so the server resumes streaming at the new precision without a
 * reconnect round-trip.
 */
export function useOrderBook(coin: Coin, nSigFigs: NSigFigs): OrderBookSnapshot {
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
    let attempts = 0;
    let hiddenAt: number | null = null;

    function connect() {
      if (stopped) return;
      setConnectionState("connecting");
      const ws = new WebSocket(HYPERLIQUID_WS_URL);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        attempts = 0;
        const sub = activeSubRef.current;
        if (sub) {
          ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
        }
        setConnectionState("live");
      });

      ws.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        let parsed: L2BookMessage;
        try {
          parsed = JSON.parse(event.data) as L2BookMessage;
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
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempts);
        attempts++;
        reconnectTimer = setTimeout(connect, delay);
      });
    }

    // Force-reconnect on return from a long-hidden tab: browsers throttle
    // background sockets and may leave us with a silently-dead connection.
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (hiddenFor > HIDDEN_RECONNECT_THRESHOLD_MS) {
        wsRef.current?.close(); // the close handler reconnects with backoff
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Re-subscribe on coin or nSigFigs change without tearing down the socket.
  useEffect(() => {
    const next: L2BookSubscription = { type: "l2Book", coin, nSigFigs };
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
  }, [coin, nSigFigs]);

  return { ...book, connectionState, lastMessageAt };
}
