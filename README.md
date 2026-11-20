# Blockgame Book Studio 📖

<p align="center">
  <a href="https://witch-craftmagazine.github.io/blockgame-book-editor/">
    <img src="https://raw.githubusercontent.com/witch-craftmagazine/blockgame-book-editor/main/public/favicon.svg" alt="Blockgame Book Studio Logo" width="96" height="96" onerror="this.src='https://raw.githubusercontent.com/witch-craftmagazine/blockgame-book-editor/main/public/favicon.ico'" />
  </a>
</p>

<h3 align="center">High-Fidelity WYSIWYG Web Studio for Minecraft Written Books</h3>

<p align="center">
  Author, format, and illustrate authentic Minecraft books with pixel-exact font advances, sub-pixel centering, 16-color formatting, Symbol Chat Unicode glyphs, and 1-click <code>/give</code> command exports.
</p>

<p align="center">
  <a href="https://github.com/witch-craftmagazine/blockgame-book-editor/actions/workflows/deploy.yml"><img src="https://github.com/witch-craftmagazine/blockgame-book-editor/actions/workflows/deploy.yml/badge.svg" alt="Deploy Studio to GitHub Pages" /></a>
  <a href="https://github.com/witch-craftmagazine/blockgame-book-editor/blob/main/LICENSE"><img src="https://img.shields.io/github/license/witch-craftmagazine/blockgame-book-editor?color=blue" alt="License: MIT" /></a>
  <a href="https://minecraft.wiki/w/Book_and_Quill"><img src="https://img.shields.io/badge/Minecraft-Java%201.20.5%2B%20%7C%201.21%2B%20%7C%20Bedrock-brightgreen?logo=minecraft&logoColor=white" alt="Minecraft Compatibility" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-1.4-fbf0df?logo=bun&logoColor=black" alt="Bun" /></a>
  <a href="https://witch-craftmagazine.github.io/blockgame-book-editor/"><img src="https://img.shields.io/badge/GitHub%20Pages-Launch%20Live%20Studio-orange?logo=githubpages&logoColor=white" alt="Launch Live Studio" /></a>
</p>

<p align="center">
  <a href="https://witch-craftmagazine.github.io/blockgame-book-editor/"><strong>🚀 Launch Live Studio in Browser →</strong></a>
</p>

---

> [!TIP]
> **Recommended Environment: Desktop Browser**  
> Minecraft written book authoring relies on strict **114-pixel line budgeting**, sub-pixel space balancing (`[≡ Center]`), and high-density Unicode matrix palettes (19 Symbol Chat categories). While Blockgame Book Studio includes a handheld mobile companion mode for quick page-flipping and line edits, **a desktop browser provides the optimal creative experience** for authoring books and ASCII art.

---

## Highlights

- 📐 **Pixel-Exact 14-Line Canvas:** Enforces vanilla Minecraft constraints: 14 lines per page, 1024 characters per page, and automatic word-wrapping at 114px (Java) or 122px (Bedrock).
- ⚖️ **Pixel-Balanced Centering (`[≡ Center]`):** Computes exact combinations of regular 4px spaces and 5px bold spaces (`§l §r`) to center text lines with sub-pixel balance.
- 🔣 **Symbol Chat & Unicode Matrix:** Integrated browser for authentic Minecraft BMP glyphs across 19 categories (`★ Favs`, `━ Borders`, `⚔ RPG`, `➔ Arrows`, `█ Blocks`, `✨ Decor`), with real-time pixel-width filtering (1px–12px) and 12 Unicode stylized font transforms.
- 🎨 **16 Minecraft Colors & Style Tags:** Instant palette toolbar for `§0`–`§f` color codes and `§l` (bold), `§o` (italic), `§n` (underline), `§m` (strikethrough), `§k` (obfuscated), and `§r` (reset).
- 📋 **1-Click Copy & Multi-Format Exports:** Copy active page or full books directly to clipboard (<kbd>Ctrl+Shift+C</kbd>) ready for in-game paste (<kbd>Ctrl+V</kbd>), modern single-page `/give` commands, or legacy server plugin formats.
- 📚 **Bookshelf Library & Undo History:** Multi-book management in local storage with automatic snapshot history, visual timeline navigation, and 50-step undo/redo (<kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd>).
- 🖼 **Collapsible Snippet Drawer:** Instant-stamp ASCII art presets, page borders, decorative banners, and user-saved templates.
- 🔍 **SMP & Emoji Diagnostic Checker:** Catches characters above `U+FFFF` that vanilla Minecraft font renderers cannot display, alerting you before you paste in-game.

---

## Documentation

Comprehensive guides and technical specifications are maintained in the repository:

| Document | Purpose |
| :--- | :--- |
| 📖 [**User Guide (`docs/USER_GUIDE.md`)**](docs/USER_GUIDE.md) | Complete walkthrough of editing modes, alignment tools, Unicode matrix, presets, and library management. |
| ⚙️ [**Minecraft Mechanics (`docs/MINECRAFT_MECHANICS.md`)**](docs/MINECRAFT_MECHANICS.md) | Technical mapping of studio typography rules to vanilla Java & Bedrock Edition font advances and limits. |
| 🔤 [**Unicode Font Audit (`docs/UNICODE_FONT_AUDIT.md`)**](docs/UNICODE_FONT_AUDIT.md) | Audit of Symbol Chat font transformations and vanilla Unicode coverage. |

---

## Interoperability & Supported Formats

Blockgame Book Studio supports bi-directional import and export across the Minecraft ecosystem:

| Format | Source / Target | Support |
| :--- | :--- | :---: |
| **Modern `/give` Command** | Java 1.20.5+ / 1.21+ SNBT component format (`minecraft:written_book[written_book_content=...]`) | Import & Export |
| **Legacy `/give` Command** | Java 1.13–1.20.4 SNBT tag format (`pages:['{"text":"..."}']`) | Import & Export |
| **Book & Quill Raw Text** | Vanilla Book & Quill clipboard buffer with raw `§` formatting codes | Import & Export |
| **Ampersand (`&`) Format** | EssentialsX, CMI, and Spigot/Paper server plugins using `&0`–`&f` codes | Import & Export |
| **Stendhal (`.stendhal`)** | Open-source Minecraft book format by [stendhal-editor](https://github.com) | Import & Export |
| **Scribble JSON** | Structured JSON format used by web-based book archives | Import & Export |
| **BookCopy JSON** | Spigot BookCopy plugin export format | Import & Export |
| **CMI BookExport** | CMI server plugin book configuration blocks | Import & Export |

---

## Development

Blockgame Book Studio is built with [TypeScript](https://www.typescriptlang.org/), [Svelte](https://svelte.dev/), and [Vite](https://vitejs.dev/), powered by [`blockgame-book-viewer`](https://github.com/witch-craftmagazine/blockgame-book-viewer).

### Prerequisites

- [Bun](https://bun.sh/) (v1.4+) or Node.js (v20+)

### Setup & Run Locally

```bash
# Clone the repository
git clone https://github.com/witch-craftmagazine/blockgame-book-editor.git
cd blockgame-book-editor

# Install dependencies
bun install

# Start local development server
bun run dev
```

### Verification & Testing

```bash
# Run test suite (68 unit tests)
bun test

# Type-check TypeScript codebase
bun run typecheck

# Build production bundle
bun run build
```

---

## Contributing

Pull requests and feature suggestions are welcome! Please make sure that all unit tests pass (`bun test`) and TypeScript compiles cleanly (`bun run typecheck`) before submitting PRs.

---

## License

MIT © [witch-craftmagazine](https://github.com/witch-craftmagazine)
