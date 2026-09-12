# Accessibility & Preferences Notes

The Course Planner is designed to be accessible to all users. The Accessibility
& Preferences panel provides optional settings that allow users to customize
certain aspects of the experience. It is not a separate accessible version of
the website.

These settings support accessibility but do not by themselves establish WCAG
2.2 conformance. The entire website must be evaluated against the applicable
WCAG Success Criteria.

| Feature | WCAG criterion | Level | What the feature does |
| --- | --- | --- | --- |
| Keyboard shortcuts | 2.1.4 Character Key Shortcuts | A | Allows application shortcuts to be disabled |
| Larger text | 1.4.4 Resize Text | AA | Provides an optional larger-text presentation while preserving browser zoom |
| Larger text | 1.4.10 Reflow | AA | Requires the layout to remain usable when content is enlarged |
| Reduce motion | 2.3.3 Animation from Interactions | AAA | Reduces unnecessary animation; respects system preference |

## Implementation Notes

- Keyboard shortcuts default to Off. A code audit found no current
  application-level single-character keyboard shortcuts; existing key handlers
  are limited to Enter submission, Escape dismissal, Tab focus management, and
  component-local button behavior.
- If application-level shortcuts are added later, they should read the saved
  `keyboardShortcuts` preference and ignore events from text-entry controls
  such as `input`, `textarea`, `select`, search fields, and content-editable
  regions.
- Larger text defaults to Off and applies a modest text increase without using
  transform-based page scaling. Browser zoom and text resizing remain available.
- Reduce motion defaults to Follow system. In that mode, CSS respects
  `prefers-reduced-motion: reduce`. Choosing On reduces non-essential
  animations regardless of system preference. Choosing Off keeps normal motion
  behavior unless motion reduction is needed for usability or safety.
- The Accessibility & Preferences dialog is modal, receives focus when opened,
  traps keyboard focus while open, closes with Escape or the Close button, and
  returns focus to the accessibility button after closing.
