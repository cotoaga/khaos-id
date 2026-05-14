// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import MonadField from "./MonadField";

function stubCanvasContext() {
  const stub = {
    canvas: null as unknown,
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "center",
    textBaseline: "middle",
  };
  return stub;
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    this: HTMLCanvasElement,
  ) {
    const ctx = stubCanvasContext();
    ctx.canvas = this;
    return ctx as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  cleanup();
});

describe("MonadField", () => {
  it("mounts and renders a canvas without crashing", () => {
    const { container } = render(<MonadField />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("renders the KHAOS · Id heading and circumpunct glyph", () => {
    const { getByRole, getByText } = render(<MonadField />);
    expect(getByRole("heading", { level: 1 }).textContent).toMatch(/KHAOS/);
    expect(getByText("⊙")).toBeTruthy();
  });

  it("cancels its animation frame on unmount", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(<MonadField />);
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
