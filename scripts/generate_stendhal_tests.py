#!/usr/bin/env python3
"""
Generate Stendhal (.stendhal) test books for verifying Unicode glyph rendering in Minecraft.

Outputs:
  - test_geometric_shapes.stendhal:
      Side-by-side comparison of all 96 Unicode Geometric Shapes (U+25A0..U+25FF),
      including ◯ (U+25EF) vs ○ (U+25CB), squares, triangles, diamonds, and circle sectors.
  - test_multilingual_scripts.stendhal:
      Multilingual world scripts supported by Minecraft's GNU Unifont:
      CJK, Hangul, Kana, Canadian Syllabics, Ogham, Tibetan, Cherokee, Indic, Cyrillic, etc.
  - Optional bulk mode: chunks all 114,432 Unifont glyphs into multi-volume books.

Usage:
  python3 scripts/generate_stendhal_tests.py
"""

import os
import sys
import unicodedata

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'tests', 'stendhal_output')

def make_stendhal(title: str, author: str, pages: list[list[str]]) -> str:
    """Format pages into valid Stendhal markup."""
    lines = [f"title: {title}", f"author: {author}", "pages:"]
    for page in pages:
        if not page:
            lines.append("#- ")
            continue
        lines.append(f"#- {page[0]}")
        for line in page[1:]:
            lines.append(line)
    return "\n".join(lines) + "\n"

def generate_geometric_shapes_book() -> str:
    """
    Generate a formatted Stendhal book containing all 96 Unicode Geometric Shapes (U+25A0..U+25FF).
    Each page contains a title, codepoint ranges, and glyphs paired with their hex codepoints.
    """
    pages: list[list[str]] = []
    
    # Page 1: Welcome & Highlights (◯ vs ○)
    page1 = [
        "§1§lGeometric Shapes§r",
        "§8Unicode U+25A0..U+25FF§r",
        "",
        "§0Highlighted Test:§r",
        "25CB: ○  (White)",
        "25EF: ◯  (Large)",
        "25CF: ●  (Black)",
        "25CE: ◎  (Bullseye)",
        "25C9: ◉  (Fisheye)",
        "25A0: ■  25A1: □",
        "25B2: ▲  25BC: ▼",
        "25C6: ◆  25C7: ◇",
        "",
        "§8Next: Full Catalog §r"
    ]
    pages.append(page1)

    # Chunk the 96 shapes into pages (12 items per page = 6 rows of 2 items)
    all_shapes = [chr(cp) for cp in range(0x25A0, 0x2600)]
    chunk_size = 12
    for page_idx, i in enumerate(range(0, len(all_shapes), chunk_size)):
        chunk = all_shapes[i:i + chunk_size]
        start_cp = ord(chunk[0])
        end_cp = ord(chunk[-1])
        
        page = [
            f"§1§lShapes {page_idx + 1}§r §8({start_cp:04X}..{end_cp:04X})§r",
            ""
        ]
        
        # Pair up items 2 per row: "25A0 ■   25A1 □"
        for j in range(0, len(chunk), 2):
            item1 = chunk[j]
            cp1 = ord(item1)
            if j + 1 < len(chunk):
                item2 = chunk[j + 1]
                cp2 = ord(item2)
                page.append(f"§0{cp1:04X}§r {item1}   §0{cp2:04X}§r {item2}")
            else:
                page.append(f"§0{cp1:04X}§r {item1}")
                
        pages.append(page)

    return make_stendhal("Geometric Shapes", "UnicodeAudit", pages)

def generate_multilingual_scripts_book() -> str:
    """
    Generate a Stendhal book sampling major world scripts and esoteric alphabets
    supported by Minecraft Java Edition's font engine.
    """
    pages: list[list[str]] = [
        # Page 1: Overview
        [
            "§1§lWorld Scripts§r",
            "§8Minecraft Unifont Test§r",
            "",
            "This book samples",
            "global languages and",
            "writing systems",
            "bundled in vanilla",
            "Minecraft Java Edition.",
            "",
            "§8Total Unifont glyphs:§r",
            "§2114,432 characters§r"
        ],
        # Page 2: CJK & Japanese Kana
        [
            "§1§lCJK & Kana§r",
            "Hiragana:",
            "あいうえお かきくけこ",
            "さしすせそ たちつてと",
            "Katakana:",
            "アイウエオ カキクケコ",
            "サシスセソ タチツテト",
            "Kanji / Hanzi:",
            "日本語 漢字 読書 魔法",
            "天地玄黃 宇宙洪荒",
            "日月盈昃 辰宿列張"
        ],
        # Page 3: Korean Hangul
        [
            "§1§lKorean Hangul§r",
            "Syllables:",
            "가나다라마바사아자차",
            "카타파하 거너더러머",
            "다람쥐 헌 쳇바퀴에",
            "타고파 (Pangram)",
            "",
            "Jamo:",
            "ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ",
            "ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ",
            "ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ"
        ],
        # Page 4: CJK Decorative & Circled Symbols
        [
            "§1§lCJK Decorative§r",
            "Brackets:",
            "【Notice】 『Book』",
            "「Quotation」 《Title》",
            "Circled Ideographs:",
            "㊤ ㊥ ㊦ ㊧ ㊨",
            "㊗ ㊙ ㊎ ㊍ ㊌ ㊋ ㊏",
            "Numerals:",
            "一 二 三 四 五 六 七",
            "八 九 十 百 千 万 億",
            "Marks: ※ 〒 々 〆 〇 〓"
        ],
        # Page 5: Indigenous & Lore Scripts (Canadian Aboriginal, Ogham)
        [
            "§1§lIndigenous & Lore§r",
            "Canadian Syllabics:",
            "ᐁ ᐂ ᐃ ᐄ ᐅ ᐆ ᐇ ᐈ ᐉ",
            "ᐊ ᐋ ᐌ ᐍ ᐎ ᐏ ᐐ ᐑ ᐒ",
            "ᐸ ᐹ ᐺ ᐻ ᐼ ᐽ ᐾ ᐿ ᑀ",
            "",
            "Ogham Alphabet:",
            "᚛ᚐ ᚑ ᚒ ᚓ ᚔ ᚕ ᚖ ᚗ ᚘ ᚙ ᚚ᚜",
            "᚛ᚁ ᚂ ᚃ ᚄ ᚅ ᚆ ᚇ ᚈ ᚉ ᚊ᚜"
        ],
        # Page 6: Ancient & Sacred Scripts (Tibetan, Cherokee, Georgian)
        [
            "§1§lSacred Scripts§r",
            "Tibetan:",
            "ༀ མ ཎི པ དྨེ ཧཱུྃ",
            "ཀ ཁ ག ང ཅ ཆ ཇ ཉ",
            "ཏ ཐ ད ན པ ཕ བ མ",
            "Cherokee:",
            "Ꭰ Ꭱ Ꭲ Ꭳ Ꭴ Ꭵ Ꭶ Ꭷ Ꭸ Ꭹ",
            "Georgian:",
            "Ⴀ Ⴁ Ⴂ Ⴃ Ⴄ Ⴅ Ⴆ Ⴇ Ⴈ Ⴉ",
            "Armenian:",
            "Ա Բ Գ Դ Ե Զ Է Ը Թ Ժ"
        ],
        # Page 7: Middle Eastern Scripts (Arabic, Hebrew)
        [
            "§1§lMiddle Eastern§r",
            "Arabic (Raw Unifont):",
            "ا ب ت ث ج ح خ د",
            "ذ ر ز س ش ص ض ط",
            "ظ ع غ ف ق ك ل م",
            "ن هـ و ي",
            "",
            "Hebrew:",
            "א ב ג ד ה ו ז ח",
            "ט י כ ל מ נ ס ע",
            "פ צ ק ר ש ת"
        ],
        # Page 8: Indic & South Asian
        [
            "§1§lSouth Asian§r",
            "Devanagari (Hindi):",
            "क ख ग घ ङ च छ ज",
            "झ ञ ट ठ ड ढ ण त",
            "थ द ध न प फ ब भ म",
            "Tamil:",
            "க ங ச ஞ ட ண த ந",
            "Thai:",
            "ก ข ฃ ค ฅ ฆ ง จ",
            "ฉ ช ซ ฌ ญ ฎ ฏ ฐ"
        ],
        # Page 9: European & Historical (Cyrillic, Greek, Archaic Latin)
        [
            "§1§lEuropean Scripts§r",
            "Cyrillic:",
            "А Б В Г Д Е Ж З И",
            "К Л М Н О П Р С Т",
            "Greek:",
            "Α Β Γ Δ Ε Ζ Η Θ Ι",
            "Κ Λ Μ Ν Ξ Ο Π Ρ Σ",
            "Old English / Archaic:",
            "Æ æ Œ œ Þ þ Ð ð Ȝ ȝ",
            "Punctuation: « » „ “ — –"
        ],
        # Page 10: Runic & Braille
        [
            "§1§lRunes & Braille§r",
            "Elder & Younger Runes:",
            "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ",
            "ᛁ ᛃ ᛇ ᛈ ᛉ ᛋ ᛏ ᛒ ᛖ ᛗ",
            "ᛚ ᛜ ᛞ ᛟ",
            "",
            "Braille Matrix:",
            "⠁ ⠃ ⠉ ⠙ ⠑ ⠋ ⠛ ⠓ ⠊ ⠚",
            "⠅ ⠇ ⠍ ⠝ ⠕ ⠏ ⠟ ⠗ ⠎ ⠞",
            "⠥ ⠧ ⠺ ⠭ ⠽ ⠵"
        ]
    ]

    return make_stendhal("World Scripts Test", "UnicodeAudit", pages)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    geo_path = os.path.join(OUTPUT_DIR, "test_geometric_shapes.stendhal")
    with open(geo_path, "w", encoding="utf-8") as f:
        f.write(generate_geometric_shapes_book())
    print(f"✓ Generated Geometric Shapes test book: {geo_path}")

    multi_path = os.path.join(OUTPUT_DIR, "test_multilingual_scripts.stendhal")
    with open(multi_path, "w", encoding="utf-8") as f:
        f.write(generate_multilingual_scripts_book())
    print(f"✓ Generated Multilingual Scripts test book: {multi_path}")

if __name__ == "__main__":
    main()
