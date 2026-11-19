Help me fix the outdated glyph warning. Plan the fix.

  The warning:
    ⚠ 23 SMP char(s) >U+FFFF (𝒯𝔢𝔞) render as [] in MC

  originates in
  ~/Documents/Applications/minecraftwebsites/blockgame-book-viewer/src/engine/Typography.ts:13
  -27 (detectUnsupportedMinecraftChars()), which flags any codepoint above the Basic
  Multilingual Plane (codePoint > 0xFFFF).
  This warning is accurate for legacy Minecraft (< 1.20) and Bedrock Edition, but outdated for
  modern Minecraft Java Edition (1.20+), which added native Plane 1 (SMP) support via
  UnihexProvider and modern GNU Unifont.
  ──────
  ### 1. Where the Warning Comes From

  In
  ~/Documents/Applications/minecraftwebsites/blockgame-book-viewer/src/engine/Typography.ts:13
  -27:

    /**
     * Checks if a string contains Unicode characters above U+FFFF (Supplementary Multilingual
     Plane, SMP).
     * In vanilla Minecraft Java Edition, bitmap/unifont providers only render 16-bit BMP
     characters (U+0000 to U+FFFF).
     * Characters above U+FFFF (modern emoji like 😀, 🍎, 🔥, 💀, etc.) render as missing
     glyph boxes ([]).
     */
    export function detectUnsupportedMinecraftChars(text: string): { count: number; chars:
    string[] } {
      const chars: string[] = [];
      for (const ch of text) {
        const code = ch.codePointAt(0);
        if (code && code > 0xFFFF) {
          if (!chars.includes(ch)) chars.push(ch);
        }
      }
      return { count: chars.length, chars };
    }

  The stylized fonts (fraktur, script, double_struck, bold_serif, squared, circled_black) map
  standard Latin letters into the Mathematical Alphanumeric Symbols Unicode block:
  • 𝒯 is U+1D4AF (Mathematical Script Capital T)
  • 𝔢 is U+1D522 (Mathematical Fraktur Small E)
  • 𝔞 is U+1D51E (Mathematical Fraktur Small A)

  Because all these codepoints are > 0xFFFF, the validator flags every stylized letter as an
  "SMP character" that renders as [].
  ──────
  ### 2. What the Minecraft Source Code Actually Does
  Examining decompiled Minecraft Java source code:
  #### A. Codepoint Range Support (CodepointMap.java)
  In net.minecraft.client.gui.font.CodepointMap:

  • Allocates 4,352 blocks of 256 slots each:
    4, 352 × 256 = 1, 114, 112 = 𝟎𝐱𝟏𝟏𝟎𝟎𝟎𝟎

  • This covers the entire 17-plane Unicode code space (U+000000 to U+10FFFF), not just 16-bit
  BMP.

  #### B. Unihex Hex Parser
  (~/Documents/Applications/minecraftwebsites/mcfont/net/minecraft/client/gui/font/providers/U
  nihexProvider.java:87-95)

  Lines 87–95 explicitly parse 4, 5, or 6 hex digits:
    boolean foundColon = copyUntil(input, buffer, 58);
    int codepointDigitCount = buffer.size();
    if (!foundColon || codepointDigitCount != 4 && codepointDigitCount != 5 &&
    codepointDigitCount != 6) {
        throw new IllegalArgumentException("expected 4, 5 or 6 hex digits followed by a
	       colon");
    }
  • 4 digits: BMP Plane 0 (U+0000 to U+FFFF)
  • 5 digits: SMP Planes 1–15 (U+10000 to U+FFFFF, including 1D4AF, 1D522, 1D51E)
  • 6 digits: Plane 16 (U+100000 to U+10FFFF)
  #### C. GNU Unifont Asset Data
  In modern Minecraft (and verified in
  ~/Documents/Applications/minecraftwebsites/mcfont/unifont_advances_26.2.json):

  • Total Unifont glyphs: 114,432
  • Maximum codepoint: U+FFFFF
  • Glyphs > U+FFFF: 57,346 glyphs in the Supplementary Plane
  • Pixel advances for 𝒯𝔢𝔞:
      • 𝒯 (U+1D4AF): 7.5 px
      • 𝔢 (U+1D522): 4.0 px
      • 𝔞 (U+1D51E): 4.5 px


  In modern vanilla Java Edition (1.20+), these glyphs do render as monochrome Unifont pixel
  art without mods.
  ──────
  ### 3. What Symbol Chat Mod Does

  Checking the ~/Documents/Applications/minecraftprojects/bookstuff/symbol-chat/ source in
  /bookstuff/symbol-chat:

  1. In ~/Documents/Applications/minecraftprojects/bookstuff/symbol-chat/README.md:13-15:
  │ "Additionally, you can select a unicode font that is supported by minecraft, and your
  typed
  │ text will automatically get converted into the supported characters. All symbols are
  │ unifont symbols supported by minecraft, meaning all other players can see them without
  │ needing the mod on their client or the server."

  2. In symbol-chat/src/main/resources/assets/symbol-chat/symbol_fonts/:
      •
      ~/Documents/Applications/minecraftprojects/bookstuff/symbol-chat/src/main/resources/asse
      ts/symbol-chat/symbol_fonts/mathematical_script.json: maps A..Z and a..z to 𝒜𝐵𝒞𝒟... and
      𝒶𝒷𝒸... (U+1D49C–U+1D4CF)
      •
      ~/Documents/Applications/minecraftprojects/bookstuff/symbol-chat/src/main/resources/asse
      ts/symbol-chat/symbol_fonts/mathematical_bold_fraktur.json: maps A..Z and a..z to 𝕬..
      and 𝖆.. (U+1D56C–U+1D59F)
      •
      ts/symbol-chat/symbol_fonts/mathematical_double_struck.json: maps to blackboard bold 𝔸𝔹.
      ..


  Symbol Chat intentionally uses these SMP codepoints because modern vanilla Minecraft Java
  clients can render them through Unifont.
  ──────
  ### 4. Which Characters Work vs. Don't Work

   Character Ca… │ Codepoint R… │ Java Editio… │ Legacy Java… │ Bedrock Edit… │ Notes
  ───────────────┼──────────────┼──────────────┼──────────────┼───────────────┼───────────────
   Basic Latin & │ U+0020–U+007 │    Works     │    Works     │     Works     │ Bitmap sheets
   ASCII         │ E            │              │              │               │ (ascii.png),
                 │              │              │              │               │ 2–6px.
   Latin         │ U+00A1–U+024 │    Works     │    Works     │     Works     │ nonlatin_euro
   Extended &    │ F            │              │              │               │ pean.png.
   Accents       │              │              │              │               │
   Small Caps (ᴀ │ U+1D00–U+1D2 │    Works     │    Works     │     Works     │ In BMP; fully
   ʙ ᴄ)          │ 2            │              │              │               │ cross-
                 │              │              │              │               │ platform.
   Circled       │ U+24B6–U+24E │    Works     │    Works     │     Works     │ In BMP; fully
   Letters (Ⓐ Ⓑ  │ 9            │              │              │               │ cross-
   Ⓒ)            │	     	       │              │              │               │ platform.
   Fullwidth     │ U+FF01–U+FF5 │    Works     │    Works     │     Works     │ In BMP; 8–9px
   (Ｆｕｌｌ)    │ E            │              │              │               │ advance.
   Sub /         │ U+2070–U+209 │    Works     │    Works     │     Works     │ In BMP; fully
   Superscripts  │ C            │              │              │               │ cross-
   (¹²³ ₁₂₃)     │	     	       │              │              │               │ platform.
   Box / Block   │ U+2500–U+259 │    Works     │    Works     │     Works     │ In BMP; 8–9px
   Elements (█   │ F            │              │              │               │ advance.
   ╔═╗)          │	     	       │              │              │               │
   Braille       │ U+2800–U+28F │    Works     │    Works     │    Partial    │ In BMP; used
   Patterns (⠋   │ F            │              │              │               │ for pixel
   ⠙)            │	     	       │              │              │               │ art.
   SMP Fraktur & │ U+1D400–U+1D │    Works     │  Fails ([])  │  Fails ([])   │ Works via
   Script (𝒯 𝔢   │ 7FF          │   (1.20+)    │              │               │ Unihex in
   𝔞)            │	     	       │              │              │               │ modern Java;
	       	        │	     	       │              │              │               │ fails in
	       	        │	     	       │              │              │               │ Bedrock/Legac
                 │              │              │              │               │ y.
   SMP Circled   │ U+1F100–U+1F │    Works     │  Fails ([])  │  Fails ([])   │ Works via
   Black &       │ 1FF          │   (1.20+)    │              │               │ Unihex in
   Squared (🅐 🄰) │              │              │              │               │ modern Java;
	       	        │	     	       │              │              │               │ fails in
	       	        │	     	       │              │              │               │ Bedrock/Legac
	       	        │	     	       │              │              │               │ y.
   Standard      │ U+1F300–U+1F │  Monochrome  │  Fails ([])  │     Color     │ Renders 1-bit
   Emoji (😀 🍎  │ AFF          │              │              │               │ monochrome
   🔥 💀)        │              │              │              │               │ Unifont in
                 │              │              │              │               │ Java; no
	       	        │	     	       │              │              │               │ color emoji
	       	        │	     	       │              │              │               │ support in
	       	        │	     	       │              │              │               │ Java without
	       	        │	     	       │              │              │               │ resource
	       	        │	     	       │              │              │               │ packs.
   SMP > U+FFFFF │ > U+FFFFF    │  Fails ([])  │  Fails ([])  │  Fails ([])   │ Outside
	       	        │	     	       │              │              │               │ Unifont zip
	       	        │	     	       │              │              │               │ coverage.
  ──────
  ### Conclusion & Recommendation

  1. Why the warning showed up: detectUnsupportedMinecraftChars uses a hardcoded check
  (codePoint > 0xFFFF) that treats all SMP characters as unsupported based on legacy pre-1.20
  Minecraft mechanics.
  2. Reality in Modern Java (1.20+): Characters like 𝒯𝔢𝔞 do work in modern vanilla Java
  Edition because Mojang's UnihexProvider indexes GNU Unifont up to U+FFFFF.
  3. Where they still break: They will fail (render as []) on:
      • Minecraft Bedrock Edition.
      • Servers running Minecraft versions 1.19.4 or earlier (e.g. 1.12 or 1.16 through
      ViaVersion).
      • Character counts: in book authoring, each SMP character takes 2 UTF-16 code units
      (surrogate pair), consuming 2 of the 1024 characters allowed per page.

Write plan to fix. Should the fix be in the npm package or the editor only? Do we need to fix
  rendering of any glyphs?