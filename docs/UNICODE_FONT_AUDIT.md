# Unicode Font & Glyph Architecture Audit

This document records the exact sources, Minecraft versions, engine mechanics, mod implementations, limitations, and open questions established during the audit of the Minecraft Book Engine and Glyph Browser.

---

## 1. Information Sources & Exact Artifacts

### A. Official Minecraft Client (Gradle Cache)
Ground truth was established directly from the decompiled Minecraft Java Edition client jar and asset objects in the local Gradle cache (`~/.gradle/caches/fabric-loom/`):

1. **Client Deobfuscated Jars:**
   * `~/.gradle/caches/fabric-loom/minecraftMaven/net/minecraft/minecraft-merged-deobf/26.3/minecraft-merged-deobf-26.3.jar`
   * `~/.gradle/caches/fabric-loom/minecraftMaven/net/minecraft/minecraft-merged-deobf/26.2/minecraft-merged-deobf-26.2.jar`
   * Key decompiled classes inspected:
     * `net.minecraft.client.gui.font.providers.UnihexProvider`
     * `net.minecraft.client.gui.font.providers.UnihexProvider$Glyph`
     * `net.minecraft.client.gui.font.providers.UnihexProvider$Glyph$1`
     * `net.minecraft.client.gui.font.FontSet`
     * `com.mojang.blaze3d.font.GlyphInfo`

2. **Minecraft Asset Index & Hash Objects:**
   * **Asset Index:** `~/.gradle/caches/fabric-loom/assets/indexes/26.2-32.json`
   * **Font Manifest (`minecraft/font/include/unifont.json`):**
     * Hash: `402ded0eebd448033ef415e861a17513075f80e7`
     * Declares the `unihex` provider pointing to `minecraft:font/unifont.zip`.
   * **Unifont Asset Archive (`minecraft/font/unifont.zip`):**
     * Hash: `ccd5ac4767ce0a9c71d1dd62f2dc25449789b5dd` (1.56 MB zipped).
     * Shipped file: `unifont_all_no_pua-17.0.01.hex` (7,722,308 bytes).
     * Contains **114,432 codepoints** spanning Plane 0 (BMP) and Plane 1 (SMP) up to `U+FFFFF`.

3. **Official Bitmap Verification for `◯` (U+25EF):**
   * Extracted from `unifont_all_no_pua-17.0.01.hex`:
     ```text
     25EF:0000000001C00630080810041004200220022002100410040808063001C00000
     ```
   * Mask calculation:
     * 16 rows of 16-bit words.
     * `left = 2`, `right = 14`, `width = 13` bits.
     * Official Minecraft advance formula:
       $$\text{advance} = \lfloor \text{width} / 2 \rfloor + 1 = \lfloor 13 / 2 \rfloor + 1 = 7\text{px}$$
     * Bold offset: `0.5f` (advances to `7.5px` when bold).

---

### B. Symbol Chat Mod Source Code
Ground truth on why the editor was originally missing geometric shapes was found in the Symbol Chat repository:
* Path: `../../minecraftprojects/bookstuff/symbol-chat/`
* **Tab Definition:** `src/main/resources/assets/symbol-chat/symbol_tabs/shapes.json`
* **Raw Symbol File:** `src/main/resources/assets/symbol-chat/symbols/shapes.txt`
  * Contains emoji hearts/squares, box-drawing characters, and block-shading tiles.
  * **Completely omitted** the Unicode Geometric Shapes block (`U+25A0`–`U+25FF`).
* **In-Game Unicode Table:** `src/main/java/net/replaceitem/symbolchat/gui/widget/UnicodeTable.java` & `UnicodeTableScreen.java`
  * Demonstrates that the mod author bypassed their own curated files by providing an in-game GUI querying Minecraft's live `FontSet` at runtime.

---

### C. Upstream Web Engine (`blockgame-book-viewer`)
* Path: `../blockgame-book-viewer/`
* **Metrics Table:** `src/engine/unifontAdvancesData.ts` (114,432 entries encoded in LEB128 varints).
* **Generation Tooling:** `scripts/gen_unihex_advances.py` and `scripts/encode_unifont_advances.py`.
* **Runtime Resolver:** `src/engine/GlyphAtlas.ts` and `src/engine/UnifontAdvances.ts`.

---

## 2. Versions Referenced

| Component | Version / Build | Notes |
| :--- | :--- | :--- |
| **Minecraft Java Edition** | `26.2` & `26.3` (Fabric Loom merged client) | Modern Minecraft 1.21+ development branch using `UnihexProvider` |
| **GNU Unifont** | `17.0.01` (`unifont_all_no_pua-17.0.01.hex`, Oct 2025) | Bundled inside official Minecraft `unifont.zip` |
| **Symbol Chat** | Fabric 1.21 / 26.x branch | Client mod by ReplaceItem |
| **Unicode Standard** | Unicode 15.1 / 16.0 | Covering Basic Multilingual Plane (0) and SMP (1) |
| **Minecraft Bedrock** | 1.20 / 1.21 baseline | Referenced as contrast (Bedrock uses OS font fallback) |

---

## 3. Discovered Engine Rules & Metrics

Disassembled bytecode directly from `net.minecraft.client.gui.font.providers.UnihexProvider$Glyph$1`:

```bytecode
public float getAdvance();
  Code:
     0: aload_0
     1: getfield      #27 // Field this$0:UnihexProvider$Glyph
     4: invokevirtual #38 // Method UnihexProvider$Glyph.width:()I
     7: iconst_2
     8: idiv              // width / 2 (integer division)
     9: iconst_1
    10: iadd              // + 1
    11: i2f
    12: freturn

public float getBoldOffset();
  Code:
     0: ldc           #40 // float 0.5f
     2: freturn
```

### Ink Width vs. Advance Summary
* **Unifont 8-bit glyphs (e.g. `○` U+25CB):**
  * 32 hex chars $\implies$ 8-bit width.
  * Ink width $= 7$ bits $\implies \lfloor 7/2 \rfloor + 1 = \mathbf{4\text{px}}$ or with padding $\mathbf{6\text{px}}$.
* **Unifont 16-bit glyphs (e.g. `◯` U+25EF):**
  * 64 hex chars $\implies$ 16-bit width.
  * Ink width $= 13$ bits $\implies \lfloor 13/2 \rfloor + 1 = \mathbf{7\text{px}}$.

---

## 4. Known Limitations of the Minecraft Book Engine

1. **No Complex Text Shaping (No Ligatures):**
   * Minecraft Java's font engine renders glyphs tile-by-tile from bitmap textures and hex tables.
   * It **does not use HarfBuzz or OpenType GSUB/GPOS** engines.
   * **Arabic:** Characters render as isolated individual glyphs rather than connected cursive scripts.
   * **Devanagari / Indic:** Conjunct consonants and vowel matras do not reorder or stack into ligatures.
   * **Combining Diacritics:** Non-spacing combining marks (e.g. `e` + `\u0301`) render side-by-side as two distinct characters rather than combining.

2. **Bidirectional (Bidi) Reordering without Shaping:**
   * While Minecraft uses `com.ibm.icu.text.Bidi` to invert right-to-left character runs for display, lack of cursive shaping makes RTL scripts (Hebrew, Arabic) look disjointed in-game.

3. **Page & Book Hardware Limits:**
   * **Line Width:** 114 pixels (Java) vs. 122 pixels (Bedrock).
   * **Lines per Page:** 14 lines maximum.
   * **Characters per Page:** 1,024 code points / units (`PAGE_EDIT_LENGTH`).
   * **Pages per Book:** 100 pages (`MAX_PAGES`).

4. **Bedrock Cross-Platform Incompatibility:**
   * Minecraft Bedrock Edition **does not bundle GNU Unifont**.
   * On Bedrock, characters outside the ASCII/Mojangles bitmap sheets fall back to the host operating system's native fonts (DirectWrite on Windows, CoreText on iOS/macOS, FreeType on Android), resulting in different line widths and wrapping.

---

## 5. Further Unknowns & Edge Cases

1. **`unifont_jp.zip` Language Filtering:**
   * In `assets/minecraft/font/include/unifont.json`, Mojang defines:
     ```json
     {
       "type": "unihex",
       "hex_file": "minecraft:font/unifont_jp.zip",
       "size_overrides": [...],
       "filter": { "jp": true }
     }
     ```
   * When client language is set to Japanese, Minecraft replaces certain CJK Unified Ideographs (`U+3200`–`U+9FFF`) with Japanese JIS X 0213 variants. The exact pixel advance difference between standard Unifont and `unifont_jp` for edge ideographs remains to be fully audited.

2. **Server Resource Pack Hijacking:**
   * Multiplayer servers (e.g. MMORPG servers like Craftadia or Wynncraft) frequently map custom weapon, item, and GUI icons to standard Unicode symbols (e.g. `✯` U+272F) or Private Use Area (`U+E000`–`U+F8FF`) characters.
   * Books written using these characters on one server will render as custom textures, but render as Unifont symbols on vanilla servers.

3. **Surrogate Pair Serialization in Custom Spigot/Paper Servers:**
   * Modern Minecraft Java client supports SMP characters (Plane 1, `> U+FFFF`). However, older Spigot/Paper plugins or server-side anti-chat-exploit filters may strip or truncate 4-byte UTF-8 sequences when reading book packets.
