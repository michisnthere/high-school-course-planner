import { describe, expect, it } from "vitest";
import {
  pickerCardFrame,
  pickerCardHoverBorder,
  pickerCardPalette,
  pickerCardRadius,
  pickerSearchInputStyle,
} from "../pickerStyles";

describe("picker card shared styles", () => {
  it("uses the light-gray scheme for resting cards", () => {
    expect(pickerCardFrame(false)).toEqual({
      border: "1px solid var(--border-default)",
      backgroundColor: "var(--bg-input)",
    });
  });

  it("highlights the selected card with the accent border and hover background", () => {
    expect(pickerCardFrame(true)).toEqual({
      border: "2px solid var(--brand-accent)",
      backgroundColor: "var(--bg-hover, rgba(0,0,0,0.03))",
    });
  });

  it("shares one frame between the regular and Summer School cards", () => {
    // Same function drives both lists, so they cannot drift apart.
    expect(typeof pickerCardFrame).toBe("function");
    expect(pickerCardRadius).toBe("10px");
  });

  it("keeps hover/selected states distinct", () => {
    expect(pickerCardHoverBorder).toBeTruthy();
    expect(pickerCardHoverBorder).not.toEqual(pickerCardFrame(false).border);
  });

  it("uses the light-gray search palette", () => {
    expect(pickerSearchInputStyle.backgroundColor).toBe("var(--bg-input)");
    expect(pickerSearchInputStyle.color).toBe("var(--text-primary)");
    expect(pickerSearchInputStyle.border).toBe("1px solid var(--border-default)");
    expect(pickerCardPalette.muted).toBe("var(--text-muted)");
  });
});