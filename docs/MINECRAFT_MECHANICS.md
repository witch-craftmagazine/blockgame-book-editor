# Minecraft Book Mechanics & Technical Specification

**Blockgame Book Studio** is engineered to mirror the exact internal font rendering, text layout, and NBT data constraints of vanilla Minecraft. This reference maps studio behaviors directly to official vanilla mechanics documented on the [Minecraft Wiki](https://minecraft.wiki/).

---

## 1. Page and Book Limits

Vanilla Minecraft enforces strict limits inside `BookEditScreen`, `BookViewScreen`, and `WritableBookContent`:

| Property | Vanilla Value | Specification & Wiki Link | Studio Enforcement |
|---|---|---|---|
| **Lines Per Page** | Exactly **14 lines** | [minecraft.wiki/w/Book_and_Quill#Writing](https://minecraft.wiki/w/Book_and_Quill#Writing) | Enforced via the 14-Line Book View. Each line is strictly bounded to row height. |
| **Characters Per Page** | **1,024 characters** | [minecraft.wiki/w/Book_and_Quill](https://minecraft.wiki/w/Book_and_Quill) (`WritableBookContent.PAGE_EDIT_LENGTH`) | Live counter highlights warning when approaching 950c and warns if 1,024c is exceeded. |
| **Maximum Pages** | **100 pages** | [minecraft.wiki/w/Book_and_Quill](https://minecraft.wiki/w/Book_and_Quill) (`WritableBookContent.MAX_PAGES`) | Advancement button and Gallery cap additions at exactly 100 pages. |
| **Book Title Length** | **32 characters** | [minecraft.wiki/w/Written_Book](https://minecraft.wiki/w/Written_Book) | Header title input has `maxlength="32"`. |
| **Author Name Length** | **16 characters** | [minecraft.wiki/w/Written_Book](https://minecraft.wiki/w/Written_Book) (Minecraft username limit) | Author input has `maxlength="16"`. |

---

## 2. Font Advances and Line Widths

Minecraft does not wrap text based on character counts; it wraps text based on **accumulated pixel advance widths** rendered by the game's font providers.

- **Java Edition Book Line Target:** **`114 pixels`** ([minecraft.wiki/w/Formatting_codes#Font_advance](https://minecraft.wiki/w/Formatting_codes#Font_advance))
  - In vanilla Java Edition, book text starts at $X = 36$ and wraps before reaching the right page margin at 114px.
  - The studio automatically word-wraps overflowing text at exactly 114px.
- **Bedrock Edition Book Line Target:** **`122 pixels`** ([minecraft.wiki/w/Bedrock_Edition](https://minecraft.wiki/w/Bedrock_Edition))
  - Bedrock Edition uses slightly wider internal margins ($122\text{px}$). The studio includes an engine switch to toggle between 114px (Java) and 122px (Bedrock).

---

## 3. Formatting Codes & Color System

Minecraft uses the section symbol (`§`) followed by a hexadecimal or style code ([minecraft.wiki/w/Formatting_codes](https://minecraft.wiki/w/Formatting_codes)):

### Colors (`§0` – `§f`)
| Code | Color Name | Hex Code | Visual Swatch |
|---|---|---|---|
| `§0` | Black | `#000000` | Dark text |
| `§1` | Dark Blue | `#0000AA` | Primary Blue |
| `§2` | Dark Green | `#00AA00` | Forest Green |
| `§3` | Dark Aqua | `#00AAAA` | Teal / Cyan |
| `§4` | Dark Red | `#AA0000` | Crimson Red |
| `§5` | Dark Purple | `#AA00AA` | Nether Purple |
| `§6` | Gold | `#FFAA00` | Warm Gold |
| `§7` | Gray | `#AAAAAA` | Light Gray |
| `§8` | Dark Gray | `#555555` | Charcoal |
| `§9` | Blue | `#5555FF` | Sky Blue |
| `§a` | Green | `#55FF55` | Lime Green |
| `§b` | Aqua | `#55FFFF` | Bright Aqua |
| `§c` | Red | `#FF5555` | Light Red |
| `§d` | Light Purple | `#FF55FF` | Magenta |
| `§e` | Yellow | `#FFFF55` | Sunlight Yellow |
| `§f` | White | `#FFFFFF` | Bright White |

### Styles (`§k` – `§r`)
- **`§l` (Bold):** Increases glyph advance by **`+1px`** (adding 1px shadow offset) across vanilla glyphs.
- **`§o` (Italic):** Slants the glyph horizontally without altering advance.
- **`§n` (Underline):** Draws an underline 1px beneath the baseline.
- **`§m` (Strikethrough):** Draws a strike line across the middle.
- **`§k` (Obfuscated):** Renders random animating glyphs of equal width.
- **`§r` (Reset):** Clears all active styles and resets text color back to default black (`§0`).

---

## 4. Why Bold Spaces (`§l §r`) Are Used for Pixel Centering & Margin Alignment

When using **`[≡ Center]`** or **`[⇤⇥ Margin]`**, you may notice formatting like `§l  §r` inserted between spaces:

1. **Standard Space Advance:**
   - In Minecraft, a regular space character (`' '`) is **4 pixels wide** (3px character advance + 1px spacing).
2. **Bold Space Advance:**
   - Applying `§l` to a space (`§l `) adds a 1px bold offset, giving it an advance of **5 pixels**.
3. **The Discrete Alignment Problem:**
   - If a line needs 21px or 37px of padding to be perfectly centered, standard 4px spaces alone cannot land on the exact number ($4 \times 5 = 20\text{px}$, leaving 1px off).
   - By combining **4px regular spaces** with **5px bold spaces (`§l §r`)**, the mathematical solver can land within **1 pixel** of exact center for any integer remainder.
   - The trailing `§r` is required by Minecraft to stop bold formatting from continuing onto the following text.

---

## 5. Unicode Glyph Compatibility (BMP vs. SMP Emojis)

Minecraft font rendering is defined in [minecraft.wiki/w/Font](https://minecraft.wiki/w/Font) and [minecraft.wiki/w/Resource_pack#Fonts](https://minecraft.wiki/w/Resource_pack#Fonts):

### Supported: Basic Multilingual Plane (BMP, `U+0000` – `U+FFFF`)
Vanilla Minecraft ships with Unifont covering the BMP:
- **Dingbats & Symbols (`U+2600` – `U+27BF`):** `★`, `☆`, `⚔`, `⛏`, `⚒`, `⚖`, `⚗`, `⚙`, `⚚`, `⚛`, `⚜`, `⚡`, `☕`, `☠`, `⚰`, `⚱`, `☘`, `❄`, `✓`, `✕`, `•`
- **Box Drawing & Double Borders (`U+2500` – `U+257F`):** `━`, `┃`, `┏`, `┓`, `┗`, `┛`, `═`, `║`, `╔`, `╗`, `╚`, `╝`, `─`, `│`, `┌`, `┐`, `└`, `┘`
- **Block Elements & Shading (`U+2580` – `U+259F`):** `█`, `▓`, `▒`, `░`, `▀`, `▄`, `▌`, `▐`, `■`, `□`, `▪`, `▫`, `▬`, `▭`, `▮`, `▯`, `▰`, `▱`
- **Arrows (`U+2190` – `U+21FF`):** `←`, `→`, `↑`, `↓`, `↔`, `↕`, `➔`, `➜`, `◄`, `►`, `▲`, `▼`
- **Runes (`U+16A0` – `U+16FF`):** `ᚠ`, `ᚡ`, `ᚢ`, `ᚣ`, `ᚤ`, `ᚥ`, `ᚦ`, `ᚨ`, `ᛏ`, `ᛋ`, `ᛚ`
- **Braille Patterns (`U+2800` – `U+28FF`):** Full 256-cell bitmap matrix.

### Unsupported: Supplementary Multilingual Plane (SMP, `> U+FFFF`)
- Modern color emojis (such as 😀 `U+1F600`, 🍎 `U+1F34E`, 🔥 `U+1F525`, 💀 `U+1F480`) have codepoints above `0xFFFF`.
- **Vanilla Minecraft Java Edition cannot render SMP characters.** They will appear in-game as missing glyph boxes (`[]`) or question marks.
- The studio includes a real-time diagnostic scanner: if you paste emojis `> U+FFFF`, an active alert notifies you that vanilla Minecraft will render them as missing glyphs.

---

## 6. Command & Data Component Interoperability

The studio exports written books directly into Minecraft command formats:

- **Modern Minecraft (1.20.5+ SNBT Data Components):**
  - Specified in [minecraft.wiki/w/Data_component_format#written_book_content](https://minecraft.wiki/w/Data_component_format#written_book_content).
  - Uses `minecraft:written_book[written_book_content={...}]`.
- **JSON-Pages `/give` Command:**
  - Formats pages as raw JSON text objects (`pages:['"Page 1"','{"text":"Page 2"}']`) compatible with modern command blocks.
- **Legacy Minecraft `/give` Command:**
  - Formats books using pre-1.20.5 NBT tags (`{title:"...",author:"...",pages:[...]}`) compatible with 1.14 – 1.20.4.
- **Stendhal Format (`.stendhal`):**
  - Compatible with the popular Spigot/Paper server book management plugin.
