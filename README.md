# blockgame-book-editor

High-fidelity WYSIWYG studio web book editor for Minecraft written books, powered by [blockgame-book-viewer](https://github.com/witch-craftmagazine/blockgame-book-viewer).

[**Launch Live Studio on GitHub Pages →**](https://witch-craftmagazine.github.io/blockgame-book-editor/)

## Dev

```bash
bun install
bun run dev
```

Build and test:
```bash
bun test
bun run typecheck
bun run build
```

## Stack

- **Bun** — runtime, package manager, and test runner
- **Vite** — bundler/dev server
- **TypeScript** — strict typing
- **blockgame-book-viewer** — rendering engine, parser, exporter, and inlined zero-config vanilla asset delivery

## Features

| Feature | Status | Notes |
|---|---|---|
| **Zero-Config Asset Delivery** | ✅ Done | Core vanilla assets inlined into `blockgame-book-viewer`, zero network 404s |
| **Full-Width Unicode Matrix Selector** | ✅ Done | 1px-12px glyph advance indexer with ▲/▼ width stepper and ◀/▶ pagination |
| **Exact 14-Line Minecraft Mechanics** | ✅ Done | Strict 14 lines/page, 1024 chars/page, 114px word wrapping, row 5 newline spacing |
| **In-Book Page Advancement** | ✅ Done | Forward arrow on last page appends blank pages up to 100 pages, matching vanilla `BookEditScreen` |
| **Page & Line Gallery** | ✅ Done | Full page organizer, visual card grid, and reusable ASCII art / border presets |
| **Collapsible Art & Pastes Deck** | ✅ Done | Sleek bottom dock bar with 1-click ASCII art preset stamping and row/page saving |
| **Visual 16-Color Swatches** | ✅ Done | Authentic inventory slot styling for 16 colors + style codes (`§l`, `§o`, `§n`, `§m`, `§k`, `§r`) |
| **Live Diagnostics & Ruler** | ✅ Done | Minecraft XP-bar progress gauges measuring advance vs 114px (Java) / 122px (Bedrock) |
| **Full Import & Export** | ✅ Done | Stendhal, Scribble, BookCopy, CMI, Modern `/give` (SNBT), Legacy `/give`, `.mcfunction` |
| **Autosave & History** | ✅ Done | LocalStorage autosave with live timestamp and full Undo/Redo stack |
