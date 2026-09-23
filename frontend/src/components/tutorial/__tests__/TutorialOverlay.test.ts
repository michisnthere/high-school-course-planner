import { describe, it, expect } from "vitest";
import { computePopupPosition } from "@/components/tutorial/TutorialOverlay";

function makeTargetRect(
  top: number,
  left: number,
  width: number,
  height: number
): DOMRect {
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
    x: left,
    y: top,
    toJSON() {},
  } as DOMRect;
}

describe("computePopupPosition", () => {
  const popupHeight = 200;
  const popupWidth = 360;

  describe("viewport clamping", () => {
    it("clamps popup above viewport when target is near top", () => {
      const target = makeTargetRect(10, 400, 100, 40);
      const result = computePopupPosition(target, "top", popupHeight, popupWidth, 1280, 720);

      // Popup must not extend above EDGE_MARGIN (16)
      expect(result.top).toBeGreaterThanOrEqual(16);
    });

    it("clamps popup below viewport when target is near bottom", () => {
      const target = makeTargetRect(660, 400, 100, 40);
      const result = computePopupPosition(target, "bottom", popupHeight, popupWidth, 1280, 720);

      // Popup bottom must not exceed viewport height - EDGE_MARGIN
      expect(result.top + popupHeight).toBeLessThanOrEqual(720 - 16);
    });

    it("clamps popup beyond left edge when target is near left", () => {
      const target = makeTargetRect(300, 10, 100, 40);
      const result = computePopupPosition(target, "left", popupHeight, popupWidth, 1280, 720);

      // With translate(0, -50%), rendered left = left, must be >= EDGE_MARGIN
      expect(result.left).toBeGreaterThanOrEqual(16);
    });

    it("clamps popup beyond right edge when target is near right", () => {
      const target = makeTargetRect(300, 1180, 100, 40);
      const result = computePopupPosition(target, "right", popupHeight, popupWidth, 1280, 720);

      // With translate(0, -50%), rendered right = left + popupWidth, must be <= vw - EDGE_MARGIN
      expect(result.left + popupWidth).toBeLessThanOrEqual(1280 - 16);
    });

    it("clamps centered popup within viewport", () => {
      const target = makeTargetRect(300, 590, 100, 40);
      const result = computePopupPosition(target, "bottom", popupHeight, popupWidth, 1280, 720);

      expect(result.top).toBeGreaterThanOrEqual(16);
      expect(result.left).toBeGreaterThanOrEqual(16);
    });
  });

  describe("transform-aware clamping", () => {
    it("accounts for translate(-50%, 0) when clamping horizontally", () => {
      // Target centered horizontally, popup should be centered on target
      const target = makeTargetRect(300, 600, 80, 40);
      const result = computePopupPosition(target, "bottom", popupHeight, popupWidth, 1280, 720);

      // With translate(-50%, 0), rendered left = left - popupWidth/2
      const renderedLeft = result.left - popupWidth / 2;
      const renderedRight = result.left + popupWidth / 2;

      expect(renderedLeft).toBeGreaterThanOrEqual(16);
      expect(renderedRight).toBeLessThanOrEqual(1280 - 16);
    });

    it("accounts for translate(0, -50%) when clamping vertically", () => {
      // Target centered vertically, popup to the right
      const target = makeTargetRect(340, 600, 80, 40);
      const result = computePopupPosition(target, "right", popupHeight, popupWidth, 1280, 720);

      // With translate(0, -50%), rendered top = top - popupHeight/2
      const renderedTop = result.top - popupHeight / 2;
      const renderedBottom = result.top + popupHeight / 2;

      expect(renderedTop).toBeGreaterThanOrEqual(16);
      expect(renderedBottom).toBeLessThanOrEqual(720 - 16);
    });

    it("clamps popup at top-left corner with both transforms", () => {
      const target = makeTargetRect(10, 10, 80, 40);
      const result = computePopupPosition(target, "top", popupHeight, popupWidth, 1280, 720);

      // translate(-50%, 0): rendered left = left - popupWidth/2
      const renderedLeft = result.left - popupWidth / 2;
      expect(renderedLeft).toBeGreaterThanOrEqual(16);
      expect(result.top).toBeGreaterThanOrEqual(16);
    });

    it("clamps popup at bottom-right corner", () => {
      const target = makeTargetRect(670, 1200, 80, 40);
      const result = computePopupPosition(target, "bottom", popupHeight, popupWidth, 1280, 720);

      const renderedRight = result.left + popupWidth / 2;
      expect(renderedRight).toBeLessThanOrEqual(1280 - 16);
      expect(result.top + popupHeight).toBeLessThanOrEqual(720 - 16);
    });
  });

  describe("position fallback", () => {
    it("falls back to bottom when top does not fit", () => {
      const target = makeTargetRect(10, 600, 80, 40);
      const result = computePopupPosition(target, "top", popupHeight, popupWidth, 1280, 720);

      // Should fall back to bottom since there's no room above
      expect(result.position).toBe("bottom");
    });

    it("falls back to top when bottom does not fit", () => {
      const target = makeTargetRect(680, 600, 80, 40);
      const result = computePopupPosition(target, "bottom", popupHeight, popupWidth, 1280, 720);

      expect(result.position).toBe("top");
    });

    it("falls back to centered when no side fits on small screen", () => {
      const target = makeTargetRect(300, 10, 80, 40);
      // 320px wide, popup 288px — left/right don't fit
      // 400px tall popup in 568px viewport — top/bottom also too tight
      const result = computePopupPosition(target, "left", 400, 288, 320, 568);

      expect(result.position).toBe("centered");
    });
  });

  describe("small screen behavior", () => {
    it("prefers centered on narrow viewport when no position fits at all", () => {
      const target = makeTargetRect(300, 180, 60, 40);
      // 320px wide, popup is 300px — left/right don't fit
      // Popup 600px tall in 667px viewport — top/bottom barely fit
      const result = computePopupPosition(target, "right", 600, 300, 320, 667);

      // Neither side fits (300px popup in 320px viewport with margins)
      expect(result.position).toBe("centered");
    });
  });

  describe("centered position", () => {
    it("returns centered position with no transform", () => {
      const target = makeTargetRect(300, 600, 80, 40);
      // Force centered by using a huge popup
      const result = computePopupPosition(target, "top", 700, 1200, 1280, 720);

      expect(result.position).toBe("centered");
      expect(result.transform).toBe("");
    });

    it("clamps centered popup within viewport", () => {
      const target = makeTargetRect(300, 600, 80, 40);
      // Popup 400px tall in 720px viewport: fits with margins
      const result = computePopupPosition(target, "top", 400, 1200, 1280, 720);

      expect(result.top).toBeGreaterThanOrEqual(16);
      expect(result.left).toBeGreaterThanOrEqual(16);
      expect(result.top + 400).toBeLessThanOrEqual(720 - 16);
      expect(result.left + 1200).toBeLessThanOrEqual(1280 - 16);
    });

    it("clamps oversized centered popup to top-left corner", () => {
      const target = makeTargetRect(300, 600, 80, 40);
      // Popup 700px tall in 720px viewport: can't fit vertically, clamped to margin
      // Popup 1200px wide in 1280px viewport: centered at 40px
      const result = computePopupPosition(target, "top", 700, 1200, 1280, 720);

      expect(result.position).toBe("centered");
      expect(result.top).toBe(16);
      expect(result.left).toBe(40);
    });
  });

  describe("popup width capping", () => {
    it("caps popup width to viewport minus margins", () => {
      const target = makeTargetRect(300, 600, 80, 40);
      const result = computePopupPosition(target, "bottom", popupHeight, 500, 400, 720);

      // popupWidth should be capped to vw - 2*EDGE_MARGIN = 400 - 32 = 368
      const renderedRight = result.left + 368 / 2;
      expect(renderedRight).toBeLessThanOrEqual(400 - 16);
    });
  });
});
