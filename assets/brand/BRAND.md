# Larson Live Stats — visual design standard

## Approved identity
Use the owner-supplied official red Z mark, provided November 7, 2026 (source image `ZL LOGO - LIVE RED.png`). Shared vector rendering: `assets/brand/larson-z-mark.svg`. Preserve the distinctive nine-sided outline and interior Z cutouts; do not substitute a font-based letter or generic polygon. Official red is **#ED1E26** (RGB 237, 30, 38), combined with charcoal/black and white. The approved lockup uses the logo alongside **LIVE STATS**. Keep Larson branding independent of Jefferson High School branding.

## Canonical reference: soccer PDF reports
**The existing soccer report visual language is the standard for all Larson Live Stats sports and documentation.** Reference implementation: `soccer-report.js`. Preserve its compact, high-density box-score presentation, strong condensed headings, legible table text, disciplined spacing, and clear hierarchy. Adapt sport-specific fields rather than forcing identical tables.

### Exact font assets already in this repository
- `fonts/BarlowCondensed-Bold.ttf`: athletic, condensed display headings and major labels, as used in soccer reports.
- `fonts/Barlow-Bold.ttf`: table headers and emphasized labels.
- `fonts/Barlow-Regular.ttf`: body text and statistics.

Use these existing files rather than unrelated substitute typefaces. Barlow Condensed Bold Italic can be a future lockup variation, but it **is not** the font currently embedded by `soccer-report.js`; do not call it the existing soccer font.

## Implementation rules
- Every exported PDF reserves a header area for the Z + LIVE STATS lockup; never overlap the document title or essential instructions.
- Use brand red, charcoal and white for document headings and table headers. No default blue section headings.
- Preserve readable text at print size, avoid excessive blank space, and test PDF page boundaries.
- Primary scorekeeping means player-specific game essentials; Secondary means richer box-score stats and verification; Tertiary means advanced charting. A beginner basketball Primary records jersey numbers for points and fouls.
- Shared design system should cover basketball, soccer, volleyball and future sports, with staged changes and regression testing.
