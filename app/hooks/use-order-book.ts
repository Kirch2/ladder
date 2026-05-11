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

// Exponential backoff bounds for reconnect attempts. Capped so a long
// outage doesn't push the next attempt out by hours.
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30_000;
// How long the tab must be hidden before we proactively force-reconnect on
// return. Browsers throttle background sockets and may leave us holding a
// silently-dead connection; this guards against that.
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

  // Refs (not state) because mutating them must not retrigger a render — the
  // socket and the active subscription get read inside event handlers and
  // the second effect on every keystroke of (coin, nSigFigs).
  const wsRef = useRef<WebSocket | null>(null);
  const activeSubRef = useRef<L2BookSubscription | null>(null);

  // Effect 1: own the socket's lifetime. Empty deps so it runs once on mount
  // and tears down on unmount; reconnects happen via the `close` handler.
  useEffect(() => {
    // Per-effect-instance state — captured by closures below. Resetting on
    // unmount happens by re-creating the variables when the effect re-runs
    // (it won't, since deps are empty, but the structure stays correct under
    // StrictMode's double-invoke).
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let hiddenAt: number | null = null;

    function connect() {
      // If the cleanup has already run, abandon — protects against a stale
      // reconnectTimer firing after unmount.
      if (stopped) return;
      setConnectionState("connecting");
      const ws = new WebSocket(HYPERLIQUID_WS_URL);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        // A clean open resets the backoff so the next reconnect (if any)
        // starts at the base delay again.
        attempts = 0;
        // The second effect may have already stashed the desired subscription
        // before the socket was open. Replay it now so the server starts
        // streaming from the right shape immediately.
        const sub = activeSubRef.current;
        if (sub) {
          ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
        }
        setConnectionState("live");
      });

      ws.addEventListener("message", (event) => {
        // The WS data type is string | ArrayBuffer | Blob. Hyperliquid only
        // ever sends text, but the guard keeps a stray binary frame from
        // tripping JSON.parse.
        if (typeof event.data !== "string") return;
        let parsed: L2BookMessage;
        try {
          parsed = JSON.parse(event.data) as L2BookMessage;
        } catch {
          // Malformed JSON: drop it silently. The next frame will arrive
          // shortly with valid state.
          return;
        }
        // The socket multiplexes channels (l2Book, subscriptionResponse, …).
        // Ignore everything that isn't a book update.
        if (parsed.channel !== "l2Book") return;
        // Coin filter: when the user switches coins, the OLD subscription's
        // last few frames may still be in flight before the server's
        // unsubscribe lands. Discarding by coin avoids briefly painting the
        // wrong asset's prices into the rows.
        const sub = activeSubRef.current;
        if (!sub || parsed.data?.coin !== sub.coin) return;
        const [bids, asks] = parsed.data.levels;
        setBook({ bids, asks });
        setLastMessageAt(Date.now());
      });

      // `error` fires for transport-level problems and is usually followed
      // by `close`. We only update the UI state here; the actual reconnect
      // is driven by `close` so we always run through the same path.
      ws.addEventListener("error", () => setConnectionState("error"));

      ws.addEventListener("close", () => {
        wsRef.current = null;
        if (stopped) return;
        // Exponential backoff: 1.5s, 3s, 6s, 12s, 24s, then capped at 30s.
        // Reset on a successful `open`.
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempts);
        attempts++;
        reconnectTimer = setTimeout(connect, delay);
      });
    }

    // Force-reconnect on return from a long-hidden tab. Mobile browsers and
    // some desktop ones suspend background sockets without sending `close`,
    // so on the foreground transition we close ourselves and let the close
    // handler walk the normal reconnect path with backoff.
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (hiddenFor > HIDDEN_RECONNECT_THRESHOLD_MS) {
        wsRef.current?.close();
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      // Order matters: flip `stopped` first so any in-flight `close` handler
      // skips its reconnect-timer scheduling.
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      // Closing here triggers the close handler too, but `stopped` prevents
      // it from setting up another reconnect. No explicit unsubscribe — the
      // server cleans up subscriptions when the socket closes.
      wsRef.current?.close();
    };
  }, []);

  // Effect 2: react to subscription-shape changes from props. Runs whenever
  // the parent picks a different coin or precision. The socket from Effect 1
  // stays put; only the subscription on it gets swapped.
  useEffect(() => {
    const next: L2BookSubscription = { type: "l2Book", coin, nSigFigs };
    const ws = wsRef.current;
    // Snapshot the previous sub so we can unsubscribe it below. Updating the
    // ref must happen BEFORE we send, in case any message arrives between
    // our send() calls — the message handler filters against this ref.
    const previous = activeSubRef.current;
    activeSubRef.current = next;
    // Clear the displayed book so the rows don't briefly show stale levels
    // aggregated at the OLD precision while we wait for the new feed.
    // Intentional UX reset on subscription-shape change — not derivable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBook(EMPTY_BOOK);

    // If the socket hasn't opened yet (first render) the open-handler in
    // Effect 1 will replay activeSubRef.current once it does. Nothing to do
    // here in that case.
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
