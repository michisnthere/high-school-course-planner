# i18n Migration Checklist

## Migrated Components

### Phase 2 — Navigation
| Component | File | Keys Used | Status |
|---|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` | `nav.*` (6 keys) | ✅ Done |
| MobileNav | `components/layout/MobileNav.tsx` | `nav.*` (6) + `mobileNav.*` (7) | ✅ Done |
| MobileAppBar | `components/layout/MobileAppBar.tsx` | `nav.*` (6) + `mobileAppBar.*` (2) + `aria.*` (2) | ✅ Done |

### Phase 3A — Shared Layout
| Component | File | Keys Used | Dynamic Content? | Status |
|---|---|---|---|---|
| Header | `components/layout/Header.tsx` | `header.siteTitle`, `aria.stevensonHighSchool` | No | ✅ Done |
| SidebarFooter | `components/layout/SidebarFooter.tsx` | `footer.*` (7 keys) | No | ✅ Done |

### Phase 3B — Dashboard
| Component | File | Keys Used | Dynamic Content? | Status |
|---|---|---|---|---|
| Dashboard page | `app/page.tsx` | `dashboard.*` (18 keys) + `year.*` (4) | Some (user name) | ✅ Done |
| SavedCoursesSection | `components/dashboard/SavedCoursesSection.tsx` | `savedCourses.*` (4 keys) | No | ✅ Done |

### Phase 3C — Planner
| Component | File | Keys Used | Dynamic Content? | Status |
|---|---|---|---|---|
| Planner page | `app/planner/page.tsx` | `planner.*` (10 keys) + `year.*` (4) | No | ✅ Done |

### Phase 3D — Requirements + Completed
| Component | File | Keys Used | Dynamic Content? | Status |
|---|---|---|---|---|
| Requirements page | `app/requirements/page.tsx` | `requirements.*` (8 keys) + `auth.loading` | Some (dynamic data) | ✅ Done |
| Completed page | `app/completed/page.tsx` | `completedCourses.*` (6 keys) | No | ✅ Done |

### Phase 3E — Informational/Auth
| Component | File | Keys Used | Dynamic Content? | Status |
|---|---|---|---|---|
| About page | `app/about/page.tsx` | `about.*` (10 keys) | No | ✅ Done |
| Privacy page | `app/privacy/page.tsx` | `privacy.*` (10 keys) | No | ✅ Done |
| Login page | `app/login/page.tsx` | `login.*` (5 keys) + `aria.stevensonHighSchool` | No | ✅ Done |

## Translation Keys in `locales/en.json`

~350 keys across these categories:
- `nav.*` — Navigation labels (6)
- `mobileNav.*` — Mobile navigation (7)
- `mobileAppBar.*` — Mobile app bar titles (3)
- `aria.*` — Accessibility labels (6)
- `header.*` — Header (1)
- `footer.*` — Footer/sidebar footer (7)
- `dashboard.*` — Dashboard page (18)
- `year.*` — Year labels (8)
- `planner.*` — Planner page (10)
- `requirements.*` — Requirements page (8+)
- `completedCourses.*` — Completed courses page (6+)
- `savedCourses.*` — Saved courses (4)
- `about.*` — About page (10)
- `privacy.*` — Privacy page (10)
- `login.*` — Login page (5)
- `auth.*` — Auth strings (5)
- `a11y.*` — Accessibility settings (20+)
- `catalog.*` — Catalog (3)
- `status.*` — Status labels (3)
- `language.*` — Language selector (2)
- `errors.*` — Error messages (6)
- `guestUpgrade.*` — Guest upgrade prompt (3)
- `guestEmptyState.*` — Guest empty state (1)
- `authToast.*` — Auth toast (2)
- `tutorial.*` — Interactive tutorial (50+)
  - `tutorial.actions.*` — Button labels (4)
  - `tutorial.chapters.*` — Chapter names (7)
  - `tutorial.steps.*` — Step titles and descriptions (22 steps × 2 = 44 keys)

## Strings That Should NEVER Be Auto-Translated

- Course codes (e.g., "MATH 100", "ENG 101")
- Course titles (official academic names like "AP Calculus AB")
- Database IDs, credit values, grade levels
- Planner calculations, prerequisite logic
- Graduation requirement logic, PE waiver logic
- Auth/session info
- Brand name: "Stevenson Course Planner"
- Version: "Beta v1.0"
- URLs, form links
- School name: "Stevenson High School"

## Dynamic Content (Phase 4+ — backend-mediated)

- Course descriptions (from API, cached in Translation table)
- Requirement descriptions
- Division/department names

## Test Coverage

| Test File | Tests | Status |
|---|---|---|
| `lib/__tests__/i18n.test.ts` | 13 tests (translate, isValidLocale, key existence) | ✅ Passing |
| `lib/__tests__/preferences.test.ts` | 6 tests (locale persistence) | ✅ Passing |
| `lib/__tests__/tutorial.test.ts` | 35 tests (step definitions, chapters, navigation, persistence) | ✅ Passing |

## Build Status

- `npm run build` — ✅ Passes
- `npm test` — ✅ 322 tests, 21 files, 0 failures

## Locale Files

| Locale | File | Status |
|--------|------|--------|
| English | `locales/en.json` | ✅ Complete — all keys |
| Spanish | `locales/es.json` | ✅ Complete — all UI keys translated |
| Simplified Chinese | `locales/zh-CN.json` | ✅ Complete — all UI keys translated |

**Note**: Course titles, course codes, brand names, and academic identifiers remain in English per i18n rules.

## Remaining Work (Phase 4+)

1. Migrate Catalog page (`app/catalog/page.tsx`)
2. Migrate course component labels (`components/catalog/*`, `components/planner/*`)
3. Migrate remaining deep components (CoursePicker, CourseDetailPopover, etc.)
4. Add Azure Translator backend (Phase 4)
5. Add dynamic content translation (Phase 5)
6. Build pre-generation CLI (Phase 6)

## Tutorial i18n Status

- **English (en)**: ✅ Complete — all 50+ tutorial keys in `locales/en.json`
- **Spanish (es)**: ✅ Complete — all tutorial keys in `locales/es.json`
- **Simplified Chinese (zh-CN)**: ✅ Complete — all tutorial keys in `locales/zh-CN.json`
- **Translation status**: All tutorial text uses `tutorial.chapters.*`, `tutorial.steps.*`, and `tutorial.actions.*` namespaces
