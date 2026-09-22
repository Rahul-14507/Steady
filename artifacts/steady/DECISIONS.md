# Steady decisions

- Steady is local-first by design: profiles, derived metrics, quality scores, and report inputs stay in IndexedDB. No backend is required for the MVP.
- Signal processing lives in pure TypeScript modules so the same calculations can later move into native Android or iOS wrappers.
- Demo data is explicitly marked and is not included in clinician reports by default.
- The UI uses supportive comparisons against a person's own baseline and avoids clinical labels or medication advice.