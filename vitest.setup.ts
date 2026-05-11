// jsdom doesn't implement the Web Animations API or matchMedia. Stub the
// ones our components reach for so tests can render without throwing.
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// With globals: false, testing-library's auto-cleanup is off; wire it up
// manually so DOM state doesn't leak between tests.
afterEach(() => {
  cleanup();
});

if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.animate) {
  HTMLElement.prototype.animate = vi.fn().mockReturnValue({
    cancel: vi.fn(),
    finish: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as Element["animate"];
}

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}
