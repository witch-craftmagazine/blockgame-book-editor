# blockgame-book-viewer: npm install and asset delivery plan

Prepared 12 November 2026 for an engineer who will audit the recent changes and implement the remaining work. Read the repo `CLAUDE.md` first and follow its rules; where this plan and `CLAUDE.md` conflict, stop and ask.

## 1. Summary

A developer who runs `bun add blockgame-book-viewer` and mounts a viewer gets a book with missing textures and fonts. The published package contains the assets, but the library requests them from `./assets/...` relative to the host page, and nothing serves them. This plan has three parts:

- **Part A**: audit the changes already made in this working session (Minecraft 26.x `/give` export, bold space width, test fixes). Some rest on assumptions that should be confirmed against Minecraft source.
- **Part B**: make the npm package work with zero configuration, offline, and under strict CSP, by inlining the core assets into the JS bundle. Resource packs and demo files become opt-in.
- **Part C**: add a consumer smoke test to CI so this class of bug cannot ship again.

The decision behind Part B is explained in section 3. A stopgap already exists (a version-pinned jsDelivr default). This plan replaces it for core assets and keeps it only for optional packs.

## 2. Evidence gathered so far

These facts were checked directly; treat them as the baseline and re-verify anything marked as an assumption.

- **Published tarball.** `blockgame-book-viewer@1.0.0` from npm has `files: ["dist"]` and contains `dist/assets` with 476 files, about 6.7 MB. Subfolders by size: `fonts` 2.9 MB (`unifont-latin-400-normal.woff2` 1.6 MB, `EBGaramond-Initials.otf` 0.8 MB and `.ttf` 0.5 MB), `packs` 2.8 MB (`lithos`, `craftadia`), `books` 0.5 MB, `textures` 0.34 MB (of which `starsweetpea.gif` 0.22 MB, `gui` 92 KB, `font` 24 KB), `font` 172 KB (`glyphs.json` 80 KB, `glyph_sizes.bin` 64 KB, `default.json` 20 KB, `space.json` 4 KB), `sounds` 56 KB (three `open_flip*` files, each in `.mp3` and `.ogg`).
- **Cause.** Every asset URL is built as `${baseAssetPath}/...` with the default `'./assets'`. A consuming site has no such folder, so requests return 404 (or `index.html` under a Vite dev server).
- **Hard-coded defaults** (line numbers are from the original upload and will have shifted): `src/ui/BlockgameBookViewer.ts` (option fallback), `src/engine/ResourcePackManager.ts` (constructor default and the vanilla pack texture URLs), `src/engine/GlyphAtlas.ts` (`load(basePath = './assets')`, which also fetches `font/default.json`), `src/presets/example-packs.ts` (`createLithosPack`, `createCraftadiaPack`), `src/render/SoundEffects.ts`, `src/render/BookCanvas.ts`, `src/component/blockgame-book.ts` (`base-path` attribute, two places), `src/plugins/WitchcraftPlugin.ts` (gif), and the demo in `src/playground.ts`.
- **Already bundled.** `GlyphAtlas.ts` imports `public/assets/font/glyphs.json` directly, so that file works for consumers today. A glyph size table also lives in `src/engine/glyphSizesData.ts`.
- **Package metadata drift.** The repo `package.json` has `types: ./dist/types/index.d.ts` and `files: ["dist", "public"]`. The published package has `types: ./dist/types/src/index.d.ts` and `files: ["dist"]`. Declarations land under `dist/types/src` because `tsconfig.build.json` includes a JSON file from `public/`, which moves the inferred root. Confirm which is correct for the current build and make the repo and the published output agree.
- **How assets reach `dist`.** `vite.config.lib.ts` does not disable `publicDir`, so Vite copies all of `public/` into `dist/`. That is why demo-only files shipped.
- **Test runners.** Locally `bun run test` runs vitest. CI (`.github/workflows/deploy.yml`) runs `bun test`, which is Bun's own runner and has no `vi.stubGlobal`. One test change passed locally and failed in CI for exactly this reason.
- **Lockfiles.** The repo has both `bun.lock` and `package-lock.json`. Pick one (Bun) and delete the other.
- **Environment caveat.** The archive given to the previous engineer lacked `public/` (so `glyphs.json` and all textures were missing and about ten rendering tests failed with an empty stub). Work from a full clone.
- **Repo instruction to respect.** `CLAUDE.md` contains project rules (for example a no-web-search rule for AI agents). Honor them; this plan does not require any web access except installing npm packages.

## 3. Design decision

Options considered for how an npm consumer gets assets:

- **Document that consumers must copy files.** Rejected: fails the goal that install just works.
- **Default to a CDN (jsDelivr, version-pinned).** Works, but every install depends on a third party at runtime. It fails offline, under strict CSP, and behind corporate proxies, and it needs CORS and `crossOrigin` handling to keep canvas export working.
- **Reference files with `new URL('./x.png', import.meta.url)` so each consumer bundler emits them.** Elegant, but only reliable in modern bundlers, requires an unbundled library build, and does not work for the UMD and plain `<script>` builds.
- **Inline the core assets as data URIs in the JS bundle.** Chosen. The core set is small (roughly 120 KB of textures and font sheets, 25 KB of JSON, and about 30 KB of sounds if only mp3 is kept), which is less than the glyph table already bundled. It works in every bundler, in UMD, offline, and under CSP that allows `data:` images and media.

Behavior after the change:

- No `baseAssetPath` and no `base-path`: use inlined core assets. No network.
- `baseAssetPath` set: load vanilla assets from that URL as today, and fall back to the inlined copy if a core asset fails to load (log one `console.warn` naming the failed URL).
- Resource packs (Lithos, Craftadia) and optional extras: opt-in only. Their helpers default to a version-pinned jsDelivr URL, because large optional files are where a CDN is reasonable, and accept any base path for self-hosting.

## 4. Part A: audit of changes already made

The previous diffs were applied by the project owner. Review each against the repo and, where noted, against Minecraft 26.3 source (a decompiled client jar is available to the owner). Do not rewrite these without evidence.

### A1. `/give` command export (Minecraft 1.21.5+ and 26.x)

Problem fixed: pages were emitted as JSON wrapped in strings, and raw `§` codes were put in the command. Since 1.21.5 text components are stored as NBT, so a JSON string displays literally, and the chat box strips `§`.

What changed:

- `src/io/BookExporter.ts`: `exportToGiveCommandModern` now emits SNBT components. Each page is `{text:"",extra:[{text:"...",color:dark_green,bold:true}, ...]}`, a plain string for unstyled single-run pages, and `""` for empty pages. Colors use names for the 16 vanilla colors and quoted `"#RRGGBB"` otherwise. Styles are `bold`, `italic`, `underlined`, `strikethrough`, `obfuscated` set to `true` only. Titles are capped at 32 characters and `generation` is written when non-zero. A new `exportToGiveCommandJsonPages` serves 1.20.5 to 1.21.4 (JSON-string pages). `exportToGiveCommandLegacy` (1.13 to 1.20.4) no longer writes `§`.
- `src/io/Snbt.ts` (new): minimal SNBT reader plus `snbtString` writer.
- `src/io/BookParser.ts`: `/give` import now parses real SNBT (unquoted keys, `{raw:...}`, nested lists). `componentToFormattedString` was rewritten to resolve style inheritance like Minecraft: a compound overrides inherited properties, `extra` children inherit from their parent, and in a list the first element is the parent of the rest. It then emits the minimum `§` codes (reset plus re-stated style when a color changes or a flag is removed).
- `src/ui/ExportModal.ts`: three version radios. `src/index.ts` exports the new function.
- Tests: `tests/GiveCommand.test.ts` (round trips, SNBT validity, the bold-bleed regression), `tests/BookIO.test.ts` (title assertion now uses double quotes).

Audit checklist:

- Confirm the 1.21.5 boundary for SNBT-in-components. It was set from memory; verify against release notes or source.
- Confirm that `{text:"",extra:[...]}` is accepted by 26.3 `/give` and displays correctly with no bold bleed. The previous list form `[{bold run},{plain run}]` was a real bug because the first list element is the parent. Test in game if possible.
- Verify the parser against vanilla for edge cases: nested `extra`, `{raw:...}` and `{filtered:...}` pages, booleans written as `1b`/`0b`, and hex colors.
- Check that default black ink omission is right for all themes and for Bedrock export paths.
- Check the SNBT string escaping (`\\`, `\"`, `\n`, `\r`, `\t`, other control characters as `\uXXXX`) against what the 26.3 chat parser accepts, and the command length limit for long books (mention a command block or function-file fallback in the UI).

### A2. Bold space width

Problem fixed: the emulator drew bold spaces at 4 px; Minecraft 26.3 uses 5 px (every glyph gets a 1 px bold offset, including spaces). Evidence: a bold 20-character title measured 117 px in game (wrapped at the 114 px limit) but 113 px in the emulator (fit). All other titles in the owner sample book agreed.

What changed: `GlyphAtlas.getAdvance` returns 5 for a bold space or non-breaking space; the old comment claiming a zero bold offset was removed; `CLAUDE.md` and `CHANGELOG.md` were updated; `tests/LithosFontAndSpacing.test.ts` now expects bold spaces of 5 and a line width of 105 (was 99) for the leading-space line; a wrap regression test was added.

Audit checklist:

- Verify in the decompiled 26.3 jar that the space glyph's bold offset is 1 (check `GlyphInfo.getBoldOffset` and the space provider), and note the version in the code comment.
- Check Bedrock: the Bedrock engine may differ. Do not assume the Java change applies.
- Check every width-dependent path uses `getAdvance` (line splitting, lossless split, ruler and stats in the separate editor app, underline and strikethrough span widths, centered-text helpers).
- Run the full suite with real glyph data and review any test that hard-coded bold spacing.

### A3. Test environment fixes

- `tests/PageExport.test.ts`: newer Node makes `globalThis.navigator` getter-only. A `stubNavigator` helper now uses `Object.defineProperty` with an `afterEach` restore. It deliberately avoids `vi.stubGlobal` so it works under both vitest and Bun's runner.
- Make CI run the same runner as local development. Recommended: change the workflow to `bun run test` (vitest). If Bun's runner is preferred, every test must be made compatible and `package.json`'s `test` script changed to match.

## 5. Part B: asset delivery work plan

### B1. Establish the authoritative core asset manifest

Do not guess the list. Serve the demo with assets mapped to a base path, run it in a Chromium instance with network logging, open a book in Java and Bedrock modes, exercise page turns (sound), themes, and the export modal, and record every request under the asset base. Cross-check with `grep` for `${...}/` patterns in `ResourcePackManager.ts`, `GlyphAtlas.ts`, `BookCanvas.ts`, `SoundEffects.ts`, and `blockgame-book.ts`. Commit the result as `docs/ASSET_MANIFEST.md` listing each file, what uses it, and whether it is core, pack, or demo-only. Expected core: `textures/gui/*` (book and page-turn sprites), `textures/font/{ascii,accented,nonlatin_european}.png`, `font/default.json`, `font/space.json`, and the page-turn sounds. Confirm whether `font/glyph_sizes.bin` is used at runtime or superseded by `glyphSizesData.ts`.

### B2. Create the inlined core asset module

- Move the core files to `src/assets/core/` (keep the same relative layout).
- Add `src/assets/core/index.ts` exporting a typed `CORE_ASSETS` object. Import binaries with the explicit `?inline` suffix (for example `import book from './textures/gui/book.png?inline'`) so Vite always produces a data URI regardless of size or mode. Import JSON normally so it is parsed at build time. Add `src/assets/core/vite-env` typings as needed for `*?inline`.
- Keep only `.mp3` for sounds in the inlined set (universal playback, smaller). Change the lookup order in `SoundEffects` accordingly, and keep `.ogg` support for the `baseAssetPath` override path.
- Add a size budget test (see B8): the entire inlined set must stay under an agreed limit (suggest 400 KB before gzip).

### B3. Wire the loaders to prefer inlined assets

- `ResourcePackManager`: the default vanilla pack uses `CORE_ASSETS` URLs when `baseAssetPath` is not provided. When it is provided, build URLs from it as today, with a per-asset fallback to the inlined copy on load failure.
- `GlyphAtlas.load(basePath?)`: with no argument, load the three font sheets from `CORE_ASSETS` and use the imported `default.json` instead of `fetch`. With an argument, keep current behavior plus fallback.
- `BookCanvas`, `SoundEffects`, `BlockgameBookViewer`, and `blockgame-book.ts`: remove the `'./assets'` string defaults. `baseAssetPath` becomes `string | undefined`; `undefined` means inlined. The web component `base-path` attribute with no value means inlined.
- `WitchcraftPlugin`: its gif default must not point at a file that may not exist. Make the gif an explicit option, or default it to the pinned CDN pack URL; do not inline the 220 KB gif.
- Public API: no removals. `baseAssetPath` and `base-path` keep working. Update `docs/EMBEDDING_GUIDE.md` and the README to describe the new default and the override.

### B4. Rework the stopgap CDN default

A previous diff added `src/engine/assetPath.ts` exporting `DEFAULT_ASSET_BASE` and a `define` in `vite.config.lib.ts` that injected a jsDelivr URL as the default for everything. Inspect git history to see whether it was applied. Then:

- Rename the concept to `PACKS_BASE_URL`. It applies only to `createLithosPack`, `createCraftadiaPack`, and other optional extras.
- In the lib build only, define it as `https://cdn.jsdelivr.net/npm/<name>@<version>/dist/assets/packs`. In the demo app and tests it resolves to `./assets/packs`. Read name and version from `package.json` at build time.
- Keep the `crossOrigin = 'anonymous'` assignment on every `new Image()` (GlyphAtlas, ResourcePackManager zip loader, BookCanvas) so canvas export works with cross-origin pack images. Verify that blob and data URLs are unaffected.
- Document the three ways to use packs: default CDN, self-host with a base path, or load a resource pack zip (the existing `jszip` flow).

### B5. Slim the published tarball

- In `vite.config.lib.ts` set `publicDir: false` so the whole `public/` tree is no longer copied into `dist`.
- Add `scripts/copy-package-assets.ts` (run with Bun as part of `build:lib`) that copies only the allowed set into `dist/assets`: initially `packs/` (needed by the CDN default and by self-hosters). Everything else is demo-only and stays in `public/` for the demo app build.
- Audit before deleting: confirm nothing in `src/` or `src/styles/viewer.css` references `fonts/unifont-latin-400-normal.woff2` (it duplicates the `@fontsource/unifont` dependency) or the EB Garamond files (believed to be used only by the witchcraft example). Move example-only assets to the examples folder.
- Set `files` to `["dist"]`, fix `types` to match the actual declaration output, and add `"sideEffects": ["**/*.css"]`, an `exports` entry for `./package.json`, and a `"./packs/*"` note if subpath access to pack files is wanted.
- Expected result: tarball well under 4 MB, installed size dominated by `packs/`. Decide in review whether packs should move to a companion package (`blockgame-book-viewer-packs`) in a later release; this plan keeps them in the main package for backward compatibility with people who already self-host from `dist/assets`.

### B6. Package manager hygiene

- Remove `package-lock.json`; keep `bun.lock`. CI uses `bun install --frozen-lockfile`.
- Make CI run `bun run test` (vitest) so local and CI agree, or fully port tests to Bun's runner.
- Add a `prepack` script that runs the library build and `tsc` so a stale `dist` can never be published.

### B7. Documentation

- README: replace the asset note with the new default (zero config), the override, and the pack options. Show a minimal Vite and a plain `<script>`/UMD example, both working with no extra files.
- `docs/EMBEDDING_GUIDE.md`: update the `base-path` row (empty means inlined core assets).
- `CHANGELOG.md`: list the asset behavior change, the `/give` and bold-space fixes from Part A, the new `exportToGiveCommandJsonPages`, and the package metadata fixes.

### B8. Tests for Part B

- Unit: with no `baseAssetPath`, no `fetch` or `Image` request is made to any relative `./assets` URL (spy on `fetch` and image `src`). With a bad `baseAssetPath`, the viewer still renders using the inlined fallback and warns once.
- Unit: `CORE_ASSETS` entries are all `data:` URIs and the total size is under the budget.
- Unit: pack helpers resolve to the CDN URL in a lib-style build and to `./assets/packs` in tests.
- Keep existing tests green with real glyph data.

## 6. Part C: consumer smoke test in CI

The bug existed because nothing in CI installs the package the way a developer does. Add a separate CI job:

- Build the library, run `bun pm pack`, and keep the `.tgz`.
- A fixture app at `tests/fixtures/consumer/` (Vite, TypeScript, no `public/assets`) installs that tarball with `bun add ./blockgame-book-viewer-*.tgz`, imports the viewer and `style.css`, mounts a two-page book (one page using bold, colors, and a long line), and builds.
- Serve the build and drive it with Playwright (Chromium). Assert: zero failed requests; zero requests to any host other than the local server (in particular none to jsdelivr in the default configuration); no console errors; the canvas is not blank (sample pixel regions); page-turn and export-image actions work.
- Add a second fixture case that loads the UMD build from a plain HTML file.
- Add a tarball check: fail if the tarball exceeds the agreed size or contains files outside the allowed set.
- Optional later: run the same fixture against the published tag after release.

## 7. Acceptance criteria

- A fresh project that runs `bun add blockgame-book-viewer` (new version) and mounts a viewer with no options renders the full book with correct textures, fonts, and sounds, with the network tab showing no asset requests.
- The same works from the UMD build in a plain HTML page.
- `baseAssetPath: '/my/assets'` still works and falls back cleanly when files are missing.
- Resource packs work through the CDN default and through a self-hosted base path.
- Tarball size and contents match the budget; `types` resolve in a TypeScript consumer without errors.
- Local `bun run test` and CI use the same runner and pass with real glyph data.
- Part A audit items are each marked verified, corrected, or deferred with a reason in the PR description.

## 8. Release and migration

- Version `1.1.0`: additive API (`exportToGiveCommandJsonPages`) and a default-behavior change for consumers who relied on `./assets`. Anyone who copied assets and passes `baseAssetPath` is unaffected. Anyone relying on the old implicit `./assets` default gets inlined assets instead, which is a superset of working behavior.
- Publish with provenance if the registry setup supports it, and tag the release so jsDelivr URLs for packs resolve.
- After publishing, update the separate test site (`blockgame-book-editor`) to the new version and delete its `sync-assets` workaround. It is the first real consumer and a useful manual check.

## 9. Risks and open questions

- **Bundle size.** Inlining adds roughly 150 to 250 KB of base64 text. Confirm against the budget and consider lazy sounds (a dynamic import of the sound module on first page turn).
- **CSP.** Data URLs need `img-src data:` and `media-src data:`. Document this. If a consumer cannot allow them, `baseAssetPath` still works.
- **Vite lib mode and `?inline`.** Confirm the exact behavior on the pinned Vite version; if any asset is emitted as a file instead of inlined, the manifest test will catch it.
- **Bedrock.** The Bedrock engine may need different textures or widths; the manifest in B1 must cover Bedrock mode explicitly.
- **Packs package split.** Decide whether to split packs out of the main package now or later.
- **Command length.** Very long `/give` commands can exceed what can be typed in chat on 26.x; decide whether the export modal should offer a function-file download.
- **Unknowns not verified here.** Minecraft 26.3 behavior was inferred from a third-party wiki and in-game reports from the owner, not from official release notes.

## 10. Suggested order of work

1. Fresh clone with `public/`, run the full suite, record the baseline.
2. Part A audit; fix or document each item.
3. B1 manifest, then B2 and B3 (inlining and loader wiring), then B8 tests.
4. B4 and B5 (packs default, tarball slimming), then B6 and B7.
5. Part C smoke test in CI; make it required.
6. Release 1.1.0; update the test site.
