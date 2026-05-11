import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BookRow } from "./book-row";

describe("BookRow", () => {
  it("freezes displayed sz/total while hovered", () => {
    const { rerender } = render(
      <BookRow
        side="bid"
        px="100"
        sz="1.10"
        total={5}
        maxTotal={10}
        sizeDecimals={2}
      />,
    );
    expect(screen.getByText("1.10")).toBeDefined();
    expect(screen.getByText("5.00")).toBeDefined();

    fireEvent.mouseEnter(screen.getByRole("row"));
    // Live props change — frozen snapshot stays on screen.
    rerender(
      <BookRow
        side="bid"
        px="100"
        sz="2.50"
        total={8}
        maxTotal={10}
        sizeDecimals={2}
      />,
    );
    expect(screen.getByText("1.10")).toBeDefined();
    expect(screen.getByText("5.00")).toBeDefined();
    expect(screen.queryByText("2.50")).toBeNull();
    expect(screen.queryByText("8.00")).toBeNull();
  });

  it("returns to live values on mouseLeave", () => {
    const { rerender } = render(
      <BookRow
        side="bid"
        px="100"
        sz="1.10"
        total={5}
        maxTotal={10}
        sizeDecimals={2}
      />,
    );
    fireEvent.mouseEnter(screen.getByRole("row"));
    rerender(
      <BookRow
        side="bid"
        px="100"
        sz="2.50"
        total={8}
        maxTotal={10}
        sizeDecimals={2}
      />,
    );
    fireEvent.mouseLeave(screen.getByRole("row"));
    expect(screen.getByText("2.50")).toBeDefined();
    expect(screen.getByText("8.00")).toBeDefined();
  });

  it("suppresses the ▲/▼ tick arrow while hovered", () => {
    render(
      <BookRow
        side="bid"
        px="100"
        sz="1.10"
        total={5}
        maxTotal={10}
        sizeDecimals={2}
        tick={{ dir: "up", ts: 1 }}
      />,
    );
    expect(screen.getByText("▲")).toBeDefined();
    fireEvent.mouseEnter(screen.getByRole("row"));
    expect(screen.queryByText("▲")).toBeNull();
  });
});
