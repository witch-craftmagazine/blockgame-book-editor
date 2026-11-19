# glyphfix plan: modern-Java SMP glyph support

Plan for `docs/glyphfix.md`. Written from the editor working tree in `Archive.zip` (includes uncommitted changes shown by `git status`). The viewer repo (`blockgame-book-viewer`, linked via `link:../blockgame-book-viewer`) was NOT in the zip, so every viewer-side statement is marked Unverified or Unknown. Nothing was built, typechecked or tested (no bun, no viewer checkout). Only two throwaway Node scripts ran against `src/data/*.ts`.

Revision 2 (web research folded in, 16 Nov 2026): sections 2, 4, 5 and 7 changed; section 9 added with sources. Web sources are the Minecraft Wiki, Mojang snapshot notes and Unifont project pages, not decompiled jars, so version claims are 'Verified (wiki)' and should still be spot-checked against a jar when cheap.

Read first: the project `CLAUDE.md` rules apply (no em-dashes or emojis, Verified/Unverified labels, incremental plus combined diff after every pass, stop and ask on design-doc conflicts, new dependencies, persisted-format changes).

## 1. Answers to the three questions in glyphfix.md

### 1.1 npm package or editor only: both, split by concern

The warning predicate lives in the package (`detectUnsupportedMinecraftChars`, `Typography.ts`) and the editor only re-exports and displays it (`src/editor.ts:29,66`, `src/state/bookStore.svelte.ts:6`). The package already owns edition concepts (`BookEngine`, `JAVA_MAX_CHARS_PER_PAGE`, `BEDROCK_MAX_CHARS_PER_PAGE`, widths), and the glyph advance and drawing code (`defaultGlyphAtlas`) that the preview canvas uses. So:

- Package owns: "is this codepoint renderable on target X" (pure classifier), SMP advances, SMP glyph drawing, a corrected JSDoc.
- Editor owns: wording and severity per engine, tile/inspector behavior, the font-map data, docs, and its tests.

Editor-only is a viable interim (a local classifier in `src/utils/`) but it leaves the package's function and JSDoc wrong for every other consumer and duplicates the rule. Recommended: package first. Sequencing is cheap because CI (`ci.yml`, `deploy.yml`) checks out viewer `main` and builds it before the editor, so merge viewer passes before editor passes that import new symbols.

### 1.2 Do any glyphs need rendering fixes: yes

Confirmed in this repo (Verified, see section 2):

1. Data bug: `DOUBLE_STRUCK_MAP['2']` is `𝕚` (U+1D55A, double-struck small i) instead of `𝟚` (U+1D7DA).
2. Data/flag bug: `INVERTED_MAP.B` is `𐐒` (U+10412, Deseret, SMP) inside a font flagged `isSmp: false` and commented "BMP <= 0xFFFF" (`symbolChatFonts.ts:115,120`). It renders as `[]` on legacy and Bedrock even when the font is labeled safe.
3. UI behavior bug: in the Svelte app every SMP tile is inert. `GlyphTile.svelte` `.glyph-tile.is-smp { pointer-events: none; opacity: 0.75 }` blocks click, hover inspector and right-click favorite for 1,298 of 2,051 catalog glyphs and for the Fraktur, Script, Double Struck, Bold Serif, Circled Black and Squared alphabets. The vanilla UI (`editor.ts`) still allows insertion, so the two UIs disagree.
4. Misleading metadata: SMP tiles show the text `SMP` instead of a pixel advance (`GlyphTile.svelte:75-77`, `editor.ts:2236,2336`), and inspector text says "Vanilla Java renders []" (`editor.ts:2164`, `GlyphBrowser.svelte:329`).

5. Data bug (new, Verified): `DEFAULT_FAVORITES` contains `❤️` as U+2764 U+FE0F. Per the Minecraft Wiki, Java does not support emoji presentation selectors and draws variation selectors as dotted boxes labeled VS16. The heart itself is in Mojangles, so the plain `❤` (U+2764) is correct and the favorite should drop the selector.
6. Model bug (new): "SMP means 1.20+ Unifont" is incomplete. The default font (Mojangles, `nonlatin_european.png`) itself bitmaps 13 SMP emoji and the Gothic block, so those render on older Java too. See section 4.1.

Probable, needs viewer evidence (Unknown): whether the viewer atlas can measure and draw SMP at all. `renderGlyphToCanvas` in `glyphRenderer.ts:114-123` falls back to `ctx.fillText` with system fonts and then thresholds alpha into a flat silhouette. If `getGlyphDrawInfo` returns nothing for SMP, the tiles and the preview do not show what Minecraft shows (monochrome Unifont bitmap), and line widths for SMP text are guesses. Run probe P1 (section 5, pass V0) before committing to passes V2 and V3.

Not needed: the 23 kaomoji entries (all BMP), and the catalog's emoji are all single codepoints (no VS16 or ZWJ in `ALL_GLYPHS`). User-pasted sequences are still a caveat (section 4.3).

## 2. Evidence

Verified by me in this session (zip contents, or Node run on `src/data`):

- Warning text is produced at `editor.ts:2010-2013` (diagSummary) and `EditorPanel.svelte:279-283`, both fed by `detectUnsupportedMinecraftChars`. Also used at `editor.ts:3499-3502` (custom char inspector).
- `count` is the number of distinct characters (the brief's "23" is distinct, not occurrences).
- Catalog: 2,051 glyphs, 1,298 SMP (`faces` 273/285, `nature` 324/348, `things` 289/305, `activities` 228/246, `symbols` 151/250, `shapes` 33/107). Distinct SMP codepoints used by catalog plus font maps: 1,555, in only these blocks: Misc Symbols and Pictographs 741, Suppl Symbols and Pictographs 240, Math Alphanumeric 204, Transport and Map 118, Ext-A 109, Emoticons 80, Enclosed Alphanumeric Supplement 62, Deseret 1. This sizes the minimum rendering subset.
- NFKC round-trip over every font map: fraktur, script, bold_serif, circled, fullwidth have 0 mismatches; double_struck has exactly one (`2`). Small caps, inverted, superscript, subscript, circled_black, squared mismatch by design (not letter-for-letter compatibility forms), so the check is only valid for the math-style fonts plus circled and fullwidth.
- `DEFAULT_FAVORITES` contains `😀` and `🗡`, which are SMP and currently inert in the Svelte grid.
- Existing test `tests/editor.test.ts:414-429` pins emoji as unsupported (`count === 4`); it must change.
- 4,352 x 256 = 1,114,112 = 0x110000 (arithmetic in the brief checks out).

Resolved by web research (see section 9 for sources; all from wiki or Mojang notes, none from a jar):

- Java version boundary: Unifont via the `unihex` provider replaced `legacy_unicode` in snapshot 23w17a (1.20). That snapshot's notes list MC-127394 "does not render characters in Unicode mb4 range" as fixed. Before it, vanilla glyph pages were BMP-only. Boundary for the Unifont tier: Java 1.20. D2 is resolved.
- Bedrock: the wiki states Bedrock does not support any character above U+FFFF and has no emoji textures below it either (only Unifont BMP plus its own private-use emoji U+E000-E10D). The brief's "Bedrock color emoji" row is wrong for Unicode emoji. D4 is resolved: every SMP char is `no-glyph` on Bedrock.
- Emoji sequences on Java: no skin-tone modifiers (shown as separate Unifont glyphs), no ZWJ joining (shown with dotted ZWJ boxes), variation selectors shown as dotted VS boxes.
- Unifont license: dual SIL OFL 1.1 and GPL-2.0-or-later with the font embedding exception (OFL since 13.0.04). Derived hex subsets can ship if the license text is included. D3 licensing question is resolved; delivery choice remains.
- Unifont coverage: "Upper" covers significant parts of the SMP, not all of it, and Unifont is updated by Minecraft over time (15.0.01 in 1.20, 15.1.04 in 1.20.3, 16.0.01 in 1.21.4, 16.0.03 in 1.21.6). So support is per Unifont version, and a pure range rule over-reports. Coverage must come from actual hex data.

Still unverified:

- Per-glyph introduction versions for the Mojangles SMP emoji. Wiki: the 1.16 pre-release 7 notes add the weather, fire and wave emoji, and the Mojangles page says 43 emoji as of 1.20.2. Treat "Java 1.16+" as a lower bound for all 13 and verify the later ones before copy says otherwise.
- Whether an SMP char counts 2 toward the page limit. No source found. The editor counts `.length` (UTF-16 units); keep and test in game.
- Java GUI page limit is 1023, not 1024, per the wiki ("up to 1023 characters per page"), while the book edit packet and component limit is 1024 (24w34a). The editor counter and `MINECRAFT_PAGE_MAX_CHARS` use 1024 and one constant is used for both engines. Bedrock is 256 per page per the wiki. These are outside glyphfix but are cheap follow-ups: check `JAVA_MAX_CHARS_PER_PAGE`, `BEDROCK_MAX_CHARS_PER_PAGE` in the viewer and use them in `editor.ts:2000-2007` by engine.

Unknown (needs viewer source): `Typography.ts` details, `GlyphAtlas.getAdvance/getGlyphDrawInfo` behavior above U+FFFF, how `measureLineWidth` iterates (code points vs UTF-16 units), what `glyphs.json` and `glyph_sizes.bin` contain, and whether BMP advances are already half-pixel.

## 3. Current-state map (editor)

| Concern | Location |
|---|---|
| Re-export and import of predicate | `src/editor.ts:29,66`; `src/state/bookStore.svelte.ts:6,110-112,284` |
| Page badge, vanilla | `src/editor.ts:2004-2018` |
| Page badge, Svelte | `src/components/editor/EditorPanel.svelte:279-283` |
| Custom char inspector | `src/editor.ts:3499-3506` |
| Inspector compat text | `src/editor.ts:2163-2169`; `GlyphBrowser.svelte:328-332` |
| Font chips and tags | `src/editor.ts:2207`; `GlyphBrowser.svelte:219-226,702-705` |
| Tile badge and inert style | `GlyphTile.svelte:49,75-77,110-114,175-178`; `editor.ts:2235-2236,2335-2336`; `editor.css:2134` |
| `isSmp` derivation (pure codepoint fact) | `symbolChatDataset.ts:88,2276`; `GlyphBrowser.svelte:55`; `editor.ts:2247` |
| Canvas draw and advance | `src/components/glyphs/glyphRenderer.ts:84-123,125-132` |
| Font maps | `src/data/symbolChatFonts.ts` (`INVERTED_MAP` line 116, `DOUBLE_STRUCK_MAP` line 138) |
| Engine state (vanilla only) | `src/editor.ts:91,3324-3329`; Svelte app has no engine selector, so it is Java-only |
| Tests to change | `tests/editor.test.ts:414-429`; `tests/glyphDataset.test.ts` (font and advance tests) |
| Docs that state the old rule | `README.md:27`; `docs/MINECRAFT_MECHANICS.md:82-98` (section 5) |

## 4. Design

### 4.1 Viewer API (additive, no removals)

```ts
export type GlyphTarget = 'java-modern' | 'java-legacy' | 'bedrock';
export type GlyphSupport = 'ok' | 'needs-java-1.16' | 'needs-java-1.20' | 'no-glyph';

export function classifyCodePoint(cp: number, target: GlyphTarget): GlyphSupport;

export interface TextCompatReport {
  target: GlyphTarget;
  versionGated: { char: string; minJava: '1.16' | '1.20' }[]; // distinct chars that need a newer Java than the oldest supported
  noGlyph: string[];         // distinct chars that render as [] on this target
  sequenceCaveats: string[]; // VS16, ZWJ, regional-indicator pairs, tag chars, skin-tone modifiers present
  utf16Units: number;        // text.length, for the 1024 budget
}
export function analyzeMinecraftText(text: string, target: GlyphTarget): TextCompatReport;
```

Rules, in order (coverage-driven, replacing the earlier range-only draft):

1. U+0000-U+FFFF: `ok` on all targets, except variation selectors (U+FE00-U+FE0F, U+E0100-U+E01EF) and U+200D, which are `no-glyph`-class "visible box" characters (they draw dotted boxes on Java, section 4.3).
2. `bedrock`: any codepoint above U+FFFF is `no-glyph` (Verified wiki).
3. Default-font SMP set, `needs-java-1.16` (lower bound, see section 2): 🌧 U+1F327, 🔥 U+1F525, 🌊 U+1F30A, 🗡 U+1F5E1, 🏹 U+1F3F9, 🪓 U+1FA93, 🔱 U+1F531, 🎣 U+1F3A3, 🧪 U+1F9EA, 🛡 U+1F6E1, 🍖 U+1F356, 🪣 U+1FAA3, 🔔 U+1F514, and Gothic U+10330-U+1034A. Derive the list from the viewer's `font/default.json` plus the `nonlatin_european` char grid, not from this plan, so it tracks the sheet.
4. Other SMP in the Unifont coverage ranges for the pinned Minecraft Unifont version: `needs-java-1.20`.
5. Everything else above U+FFFF, above U+FFFFF, lone surrogates, noncharacters: `no-glyph`.

The Java tiers are why the old rule was wrong in both directions: it flagged the 13 emoji that Mojangles draws natively, and it flagged Unifont SMP that modern Java draws. `java-legacy` therefore means "oldest supported Java is below 1.20": tier 3 is `ok`, tier 4 is `no-glyph`.

Keep `detectUnsupportedMinecraftChars(text)` returning `{count, chars}` with its literal "above U+FFFF" behavior for old callers, with JSDoc corrected to say it implements the pre-1.16 and Bedrock rule only, `@deprecated` in favor of `analyzeMinecraftText`. Do not silently change its default (decision D1). Put both minimum versions in exported constants (`MIN_JAVA_DEFAULT_FONT_SMP = '1.16'`, `MIN_JAVA_UNIFONT_SMP = '1.20'`) so copy cannot drift from the verified values.

### 4.2 Editor behavior

Severity by engine (vanilla uses its engine select; Svelte uses `java-modern`):

| Engine | SMP in coverage | No glyph |
|---|---|---|
| Java | info badge: `N chars need Java 1.20+ (𝒯𝔢𝔞); they show as [] on Bedrock and older Java` (chars in the 1.16 tier say `1.16+`) | warn: `N chars have no Minecraft glyph (...)` |
| Bedrock | warn: `N chars render as [] on Bedrock (...)` | warn, same |

- Replace the three call sites with one shared helper `src/utils/glyphCompatMessages.ts` (pure, returns `{level, text, title}`) used by `editor.ts` and `bookStore`/`EditorPanel`, so the two UIs cannot diverge again.
- Tiles: remove `pointer-events: none` and the 0.75 opacity; show the advance (fractional, e.g. `7.5px`) instead of `SMP`; mark modern-only tiles with a small `1.20+` tag in the style of the existing chip tags. Fonts chips: `SMP` tag becomes `1.20+`.
- Keep `GlyphItem.isSmp` as a pure codepoint fact. Compatibility is derived at render time from the target, never stored (no persisted-format change; favorites and saved templates store plain strings).
- Page counter: unchanged (`.length`). Optional follow-up, not in this plan: show "+N UTF-16 units from SMP" next to `x / 1024`.

### 4.3 Sequences (Verified wiki)

Java draws each codepoint separately. Skin-tone modifiers show as their own Unifont glyphs, ZWJ sequences show dotted ZWJ boxes between the parts, and variation selectors show dotted VS boxes. So VS16, other variation selectors and ZWJ are warnings ("shows a visible box in Minecraft"), not info, and the classifier returns them in `sequenceCaveats` with the offending codepoints. Skin-tone modifiers and flag pairs are info ("shows as separate glyphs"). Fix `DEFAULT_FAVORITES` (`❤️` becomes `❤`) and add a test that no catalog entry or default favorite contains U+FE00-U+FE0F or U+200D. Existing user favorites in localStorage may already contain `❤️`; normalize on load by stripping selectors (no format change, strings stay strings).

### 4.4 SMP glyph data (only if probe P1 shows it is missing)

- Advances: generate a compact table from `mcfont/unifont_advances_26.2.json` with a script committed in the viewer (`scripts/`), range-compress, load lazily, and fix `getAdvance` for `cp > 0xFFFF` including half-pixel values and the bold +1 offset. Verify `measureLineWidth('𝒯𝔢𝔞')` equals 16 (7.5 + 4.0 + 4.5) before rounding.
- Bitmaps: ship a lazy Unifont `.hex` subset (at least the 1,555 codepoints above, preferably whole Math Alphanumeric, Enclosed Alphanumeric Supplement and emoji blocks) as a separate chunk, drawn through the same monochrome path as BMP glyphs. Remove reliance on system-font fallback for SMP so tiles match the game.
- Keep it out of `CORE_ASSETS` and the 400 KB inline budget from `docs/blockgame-book-viewer npm install and asset delivery plan.md`; it must be a lazy import or opt-in. Source the bitmaps from the official GNU Unifont release that matches the Unifont in the target Minecraft version (16.0.03 as of 1.21.6; the owner's 26.x jar will say), not from extracted Mojang assets, and ship the OFL/GPL font-exception license text with the chunk (license Verified, section 2). Do not take SMP bitmaps from the Mojangles sheets: Mojangles is all rights reserved (usable under the Minecraft Usage Guidelines per the wiki). The 13 default-font SMP emoji are already in the `nonlatin_european` sheet the viewer inlines, so they need no new data, only correct routing (default font first, Unifont second). No new npm dependency; data is generated offline.

## 5. Passes

Each pass: one concern, tests included, docs updated, then incremental `passN-slug.diff` plus `combined-through-passN.diff`, both checked with `git apply --check`. Viewer passes need a viewer zip as their base; editor passes use this zip. Merge viewer passes before editor passes that import new symbols.

| Pass | Repo | Concern | Main files | Tests |
|---|---|---|---|---|
| V0 | viewer | Probe, no diff. Report findings. | none | Probe P1: for `𝒯 𝔢 𝔞 😀 🅐` print `defaultGlyphAtlas.getAdvance`, whether `getGlyphDrawInfo` is non-null, `measureLineWidth(parseFormattedText('𝒯𝔢𝔞'))`, and render a page in `BookCanvas`. Expected from the brief: 7.5, 4.0, 4.5, sum 16. |
| V1 | viewer | Classifier API (four tiers, sequence rules) and corrected docs | `src/engine/Typography.ts`, `src/index.ts`, `CHANGELOG.md` | boundaries 0xFFFF/0x10000/0xFFFFF/0x100000, lone surrogate, each target, the 13 default-font emoji are `needs-java-1.16` not 1.20, Bedrock marks all SMP `no-glyph`, VS16/ZWJ flagged, back-compat of the old function, distinct-count semantics |
| V2 | viewer | SMP advances and coverage ranges from the pinned Unifont hex (skip if P1 shows correct) | `scripts/`, atlas, data chunk | `𝒯𝔢𝔞` = 16; bold offset; wrapping at 114 with SMP; coverage ranges include all 1,555 editor codepoints |
| V3 | viewer | SMP glyph bitmaps, lazy chunk (skip if P1 shows correct) | atlas, build config | `getGlyphDrawInfo` non-null for the 1,555 set; no fetch to `./assets` for default config; chunk size budget |
| V4 | viewer | Bedrock policy after in-game results | classifier table | updated Bedrock expectations |
| E1 | editor | Adopt API; shared message helper; engine-based severity | `editor.ts`, `bookStore.svelte.ts`, `EditorPanel.svelte`, new `src/utils/glyphCompatMessages.ts` | replace `tests/editor.test.ts:414-429`; helper unit tests for each engine and level |
| E2 | editor | Tiles, inspector, chips: re-enable SMP, show advance, `1.20+` tag | `GlyphTile.svelte`, `GlyphBrowser.svelte`, `editor.ts`, `editor.css` | pure helpers for tag/label text; manual QA list (clicking an SMP tile inserts it; hover updates inspector) since no DOM tests exist |
| E3 | editor | Font-map and favorites data fixes | `symbolChatFonts.ts` | NFKC round-trip for math fonts, circled, fullwidth; per-font `isSmp` equals "any value above U+FFFF" (replace the hand-set flag by a derived value); `2` maps to `𝟚`; `DEFAULT_FAVORITES` and persisted favorites contain no U+FE00-U+FE0F or U+200D; `B` in Inverted becomes a verified BMP glyph (check it exists in the advance data) |
| E4 | editor | Docs | `README.md:27`, `docs/MINECRAFT_MECHANICS.md` section 5 (rewrite as a per-target table), `docs/USER_GUIDE.md` if it mentions the checker | none |

E3 can ship first and independently of every viewer pass. E1 and E2 depend on V1 only; they should work with whatever V2/V3 delivers because they read advances through `getCharPixelAdvance`.

## 6. Verification the implementer must do (cannot be done from this zip)

- Run `bun run typecheck`, `bun test`, `bun run build` in both repos and report actual output.
- Manual: Java engine with `𝒯𝔢𝔞` shows the info badge, not a warning; Bedrock engine shows the warning; clicking SMP tiles inserts them; Fraktur alphabet tiles work in the Svelte app; preview canvas draws pixel-accurate glyphs.
- In game: Java 1.19.4 and 1.20+ (and the current 26.x) with a book containing `𝒯𝔢𝔞 😀 🅐`, one VS16 emoji, one ZWJ family, one flag, and U+FFFFF; Bedrock with the same. Record results in `docs/MINECRAFT_MECHANICS.md`.

## 7. Decisions

Resolved by research (confirm only if you disagree):

- D2: Unifont SMP starts at Java 1.20 (23w17a); default-font SMP emoji start at 1.16 (lower bound).
- D3: license is clear; deliver SMP bitmaps as a lazy chunk from the matching official Unifont release (recommended over a full table or system-font approximation).
- D4: Bedrock treats all SMP as `no-glyph`.

Still yours to decide:

- D1: keep the old function's behavior and add `analyzeMinecraftText` (recommended), or change the default to modern. Changing the default is a behavior change for any consumer of 1.0.0.
- D5: `docs/MINECRAFT_MECHANICS.md` section 5 and the README row currently state the opposite of this plan; `docs/glyphfix.md` implies they should be rewritten. Confirm.
- D6 (new): fix the page-limit constants (Java 1023 in the GUI, Bedrock 256, engine-aware) in a separate small pass, or leave out of this change.

## 8. Risks

- Unifont version drift: Minecraft updates Unifont across releases, so a glyph can be `needs-java-1.20` in the coverage file but absent from an older 1.20.x. Pin the coverage to the newest Unifont and word the badge as "Java 1.20+ (newer symbols may need a newer version)" if the coverage diff between versions matters.
- Range-based coverage over-reports support for unassigned codepoints; mitigated by V2 coverage data.
- Fractional advances (x.5) change line-fit decisions at 114 px; the badge rounds (`Math.round`) but wrapping must use the float. Check this in V2.
- Lazy SMP chunk adds a first-use delay for glyph tiles; needs a loading state rather than a flash of system-font glyphs.
- Both UIs must keep consuming the shared helper; add a lint-style test that no file outside `glyphCompatMessages.ts` hardcodes "SMP" warning copy.

## 9. Sources for section 2 (web research)

- Mojang snapshot 23w17a notes (minecraft.net): unihex provider added, legacy_unicode removed, Unifont 15.0.01, fix for MC-127394 (characters outside BMP).
- Minecraft Wiki, GNU Unifont: version history (15.0.01 in 1.20, 15.1.04 in 1.20.3, 16.0.01 in 1.21.4, 16.0.03 in 1.21.6; 114,398 glyphs, `unifont_all_no_pua-16.0.03.hex`).
- Minecraft Wiki, Font: Bedrock does not support characters above U+FFFF; Java does not support skin tones, ZWJ joining or emoji presentation; ZWJ and variation selectors drawn as dotted boxes.
- Minecraft Wiki, Mojangles: emoji list and `nonlatin_european` contents (Gothic block, 13 SMP emoji); font license "all rights reserved; usable under the Minecraft Usage Guidelines".
- Minecraft Wiki, Book and Quill, and Minecraft Discontinued Features Wiki, Invalid Written Book: 1023 characters per page in the Java GUI, 1024 component limit since 24w34a, Bedrock 256 per page.
- Wikipedia and unifoundry.com, GNU Unifont: GPL-2.0-or-later with font embedding exception, plus SIL OFL 1.1 since 13.0.04; Upper covers significant parts of the SMP.

I'll research the open questions from the plan: the Java version where SMP support starts, Bedrock behavior, Unifont coverage and licensing, emoji sequence handling, and how the page limit counts characters.

The Java boundary looks settled. Now the Unifont license and whether emoji are in the Minecraft hex data.

License is clear. Now Bedrock: does it render supplementary-plane characters, math alphanumerics, and emoji?

Bedrock is answered. Now the Java side: how the page limit counts characters, and whether surrogate pairs, VS16 and ZWJ behave in books.

The wiki says the Java GUI limit is 1023 per page, not 1024, which matters for the editor's counter. I'll try to confirm how the limit is computed in the game code.

I couldn't confirm UTF-16 counting from game source via search, so that stays open. Now Unifont emoji coverage and how Minecraft renders ZWJ/VS16 sequences.

I'll fetch the Mojangles page to see the exact emoji list (which codepoints the default font draws itself) and the Font page to quote precisely.

Last check before updating the plan: how the new findings intersect the editor's data (the `❤️` default favorite and the Mojangles SMP subset).

Research is done. I'll fold the findings into the plan (resolved decisions, a corrected support model, and two new editor findings).

I researched the open questions and revised `glyphfix-plan.md` with the results. Sources are the Minecraft Wiki, Mojang snapshot notes and Unifont pages, not decompiled jars. It's still plan mode, with no diffs, builds or tests.

**Resolved**
- **Java boundary (D2):** Unifont support for characters above U+FFFF starts in Java 1.20. Snapshot 23w17a removed the legacy_unicode provider, added the new unihex provider, and fixed MC-127394, which covered characters in the Unicode mb4 range.
- **Bedrock (D4):** The wiki says Bedrock Edition does not support any character above U+FFFF, which includes many modern emoji. So all SMP on Bedrock is a warning. The brief's "color emoji on Bedrock" row is wrong for Unicode emoji.
- **Unifont license (D3):** The font is GPL-2.0-or-later with the font embedding exception, and also SIL OFL 1.1 since 13.0.04. Shipping a Unifont subset is fine if the license text goes with it.
- **Sequences:** Java shows ZWJ sequences with dotted boxes between the parts, and variation selectors as dotted boxes labeled VS plus a number. Skin tones render as separate Unifont glyphs.

**New findings that change the plan**
1. **"SMP means 1.20+" is wrong in both directions.** Mojangles, the default font, draws 13 SMP emoji from its own bitmap sheet: 🌧 🔥 🌊 🗡 🏹 🪓 🔱 🎣 🧪 🛡 🍖 🪣 🔔. It also draws the Gothic block (𐌰–𐍊, U+10330–1034A). Those render on older Java than 1.20, and all 13 are in the editor's catalog. The classifier now has tiers: 1.16+ for default-font glyphs (a lower bound), 1.20+ for Unifont, and no glyph.
2. **Coverage must be data-driven.** Unifont Upper covers only parts of the SMP, and Minecraft's Unifont version changes across releases. A plain range rule over-reports support.
3. **`DEFAULT_FAVORITES` has a real bug.** It contains `❤️` as U+2764 plus U+FE0F, which would show a VS16 box in game. I confirmed this in the data. The heart is already in Mojangles, so the fix is to drop the selector and strip it from saved favorites on load.
4. **Page limits look off.** The Java GUI allows up to 1023 characters per page, with the 1024 limit applying to the packet and component. Bedrock allows 256 per page. The editor's counter and `MINECRAFT_PAGE_MAX_CHARS` use 1024 for both engines. I added this to the plan as an optional separate pass (D6).

**Still unconfirmed**
- Exact introduction versions for each of the 13 default-font emoji. The wiki gives 1.16 for 🌧 🔥 🌊 and 1.20.2 for the 43-emoji total, so "1.16+" is only a lower bound.
- Whether a surrogate pair counts as 2 toward the page limit. I found no source; the editor already counts UTF-16 units, so test it in game.
- All viewer-side behavior still needs the viewer source (probe P1).

**Your call**
- **D1:** Add `analyzeMinecraftText` and leave `detectUnsupportedMinecraftChars` unchanged but deprecated (my recommendation), or change its default?
- **D5:** Confirm that README and MINECRAFT_MECHANICS §5 should be rewritten, since they currently say the opposite.
- **D6:** Fix the page-limit constants in this change or in a separate pass.
