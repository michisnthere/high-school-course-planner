export const breakpoints = {
  mobile: 768,
  tablet: 1024,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  h1: {
    fontSize: "1.75rem",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: "1.5rem",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h3: {
    fontSize: "1.25rem",
    fontWeight: 600,
    lineHeight: 1.4,
  },
  body: {
    fontSize: "0.9375rem",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  small: {
    fontSize: "0.8125rem",
    fontWeight: 400,
    lineHeight: 1.5,
  },
} as const;

export function mediaUp(breakpoint: keyof typeof breakpoints): string {
  return `(min-width: ${breakpoints[breakpoint]}px)`;
}

export function mediaDown(breakpoint: keyof typeof breakpoints): string {
  return `(max-width: ${breakpoints[breakpoint] - 1}px)`;
}

export function mediaBetween(lower: keyof typeof breakpoints, upper: keyof typeof breakpoints): string {
  return `(min-width: ${breakpoints[lower]}px) and (max-width: ${breakpoints[upper] - 1}px)`;
}
