import en from "@/locales/en.json";
import es from "@/locales/es.json";
import zhCN from "@/locales/zh-CN.json";

export type Locale = "en" | "es" | "zh-CN";

export const AVAILABLE_LOCALES: { code: Locale; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "zh-CN", name: "简体中文" },
];

// The JSON files have nested objects with string leaves.
// We use a recursive type for the structure.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TranslationDict {
  [key: string]: string | TranslationDict;
}

// All locale modules are statically imported so they're bundled.
// Adding a new locale = add the JSON file + add the import here.
const localeModules: Record<Locale, { default: TranslationDict }> = {
  en: { default: en as unknown as TranslationDict },
  es: { default: es as unknown as TranslationDict },
  "zh-CN": { default: zhCN as unknown as TranslationDict },
};

function getNestedValue(
  dict: Record<string, unknown>,
  path: string
): string | undefined {
  const parts = path.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  params: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? params[key] : `{${key}}`
  );
}

/**
 * Look up a translation key for the given locale.
 * Falls back to English, then to the key itself.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string>
): string {
  const dict = localeModules[locale]?.default ?? localeModules.en.default;

  let value = getNestedValue(dict, key);

  // Fall back to English
  if (value === undefined && locale !== "en") {
    value = getNestedValue(localeModules.en.default, key);
  }

  // Fall back to the key itself
  if (value === undefined) {
    return key;
  }

  if (params) {
    return interpolate(value, params);
  }

  return value;
}

/**
 * Check if a locale code is supported.
 */
export function isValidLocale(code: string): code is Locale {
  return code in localeModules;
}
