export const theme = {
  brand: {
    green: "#275D38",
    greenHover: "#367A4B",
    greenLight: "#E4EFE8",
    gold: "#ECBA2B",
    goldHover: "#D0A426",
    goldLight: "#FCF5DF",
  },
  bg: {
    page: "#FFFFFF",
    card: "#FFFFFF",
    cardHover: "#F9FAFB",
    sidebar: "#275D38",
    header: "#275D38",
    input: "#F9FAFB",
    muted: "#F3F4F6",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  text: {
    primary: "#111827",
    secondary: "#4B5563",
    muted: "#9CA3AF",
    onDark: "#FFFFFF",
    onAccent: "#FFFFFF",
  },
  border: {
    default: "#E5E7EB",
    light: "#F3F4F6",
  },
  status: {
    success: "#275D38",
    warning: "#ECBA2B",
    error: "#DC2626",
    info: "#ECBA2B",
  },
} as const;

export type Theme = typeof theme;
