# Blockgame Book Studio (`blockgame-book-editor`)

> High-fidelity WYSIWYG studio web editor for Minecraft written books, powered by [blockgame-book-viewer](https://github.com/witch-craftmagazine/blockgame-book-viewer).

[**🚀 Launch Live Studio on GitHub Pages →**](https://witch-craftmagazine.github.io/blockgame-book-editor/)

---

## Documentation

Comprehensive guides and technical references are maintained directly in the repository:

- 📖 [**User Guide (`docs/USER_GUIDE.md`)**](docs/USER_GUIDE.md) — Complete walkthrough of editing modes, formatting swatches, alignment tools, Unicode matrix, presets deck, and gallery organizer.
- ⚙️ [**Minecraft Mechanics & Technical Specification (`docs/MINECRAFT_MECHANICS.md`)**](docs/MINECRAFT_MECHANICS.md) — Detailed mapping of studio rules to vanilla Minecraft Java & Bedrock Edition font advances, page limits, and command syntax, cross-linked to the [Minecraft Wiki](https://minecraft.wiki/).

---

## Key Features

| Feature | Description | Minecraft Wiki Reference |
|---|---|---|
| **Exact 14-Line Book View** | Strict 14 lines per page, 1024 characters max per page, and automatic word-wrapping at 114px. | [Book & Quill](https://minecraft.wiki/w/Book_and_Quill) |
| **Pixel-Exact Centering (`[≡ Center]`)** | Prepend balanced spaces to center text within the line. Solves regular 4px spaces and 5px bold spaces (`§l §r`) to achieve sub-pixel balance. | [Formatting Codes](https://minecraft.wiki/w/Formatting_codes) |
| **Clear Page (`[🗑 Clear Page]`)** | Instant 1-click page reset with full Undo/Redo history protection. | — |
| **Unicode Character Sets & Matrix** | Top ribbon with curated sets (`★ Favs`, `━ Borders`, `⚔ RPG`, `➔ Arrows`, `█ Blocks`, `✨ Decor`), custom favorites, and pixel-width steppers. | [Fonts](https://minecraft.wiki/w/Font) |
| **Emoji & SMP Diagnostic Checker** | Scans text for characters `> U+FFFF` (modern emojis) that vanilla Minecraft cannot render, warning users in real time. | [Resource Pack Fonts](https://minecraft.wiki/w/Resource_pack#Fonts) |
| **Floating Presets Deck** | Zero-resize bottom drawer for 1-click ASCII art stamping, custom deletion, and built-in preset hiding/restoration. | — |
| **Page & Line Gallery** | Visual card organizer for duplicating, reordering, and exporting book pages or template libraries. | [Written Book](https://minecraft.wiki/w/Written_Book) |
| **Eye-Friendly Themes** | Dark Obsidian theme (zero eye strain) and Light Parchment & Stone theme with local persistence. | — |
| **Full Import & Export** | Modern `/give` (SNBT data components), JSON-pages, Legacy `/give`, Stendhal (`.stendhal`), Scribble, BookCopy, and CMI. | [Give Command](https://minecraft.wiki/w/Commands/give) |

---

## Development

```bash
bun install
bun run dev
```

### Build & Test

```bash
# Run 29 unit tests
bun test

# Typecheck with TypeScript
bun run typecheck

# Build optimized production bundle
bun run build
```

---

## License

MIT © [witch-craftmagazine](https://github.com/witch-craftmagazine)
