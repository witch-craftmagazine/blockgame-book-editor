import { defaultGlyphAtlas } from 'blockgame-book-viewer';

let isAtlasLoaded = false;
let atlasLoadPromise: Promise<void> | null = null;

export async function ensureAtlasLoaded(): Promise<void> {
  if (isAtlasLoaded) return;
  if (!atlasLoadPromise) {
    atlasLoadPromise = defaultGlyphAtlas.load().then(() => {
      isAtlasLoaded = true;
    }).catch((err) => {
      console.warn('Failed to load defaultGlyphAtlas:', err);
      isAtlasLoaded = true;
    });
  }
  return atlasLoadPromise;
}

export function renderGlyphToCanvas(
  canvas: HTMLCanvasElement,
  char: string,
  colorHex = '#1D1D21',
  scale = 2
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // If multi-character string (such as Kaomoji), render as crisp mini text
  if (char.length > 2) {
    ctx.font = '10px "Minecraft", monospace, sans-serif';
    ctx.fillStyle = colorHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, canvas.width / 2, canvas.height / 2, canvas.width - 4);
    return;
  }

  try {
    const glyphInfo = defaultGlyphAtlas.getGlyphDrawInfo(char, colorHex, false);
    if (glyphInfo && glyphInfo.image) {
      const srcW = glyphInfo.sWidth || 8;
      const srcH = glyphInfo.sHeight || 8;
      const destW = (glyphInfo.dWidth ?? srcW) * scale;
      const destH = (glyphInfo.dHeight ?? srcH) * scale;

      const dx = Math.floor((canvas.width - destW) / 2);
      const dy = Math.floor((canvas.height - destH) / 2);

      ctx.drawImage(
        glyphInfo.image,
        glyphInfo.sx,
        glyphInfo.sy,
        srcW,
        srcH,
        dx,
        dy,
        destW,
        destH
      );
      return;
    }
  } catch (err) {
    console.debug('Error in getGlyphDrawInfo:', err);
  }

  // Graceful fallback if atlas not ready or glyph unsupported
  ctx.font = `${Math.floor(canvas.height * 0.6)}px "Minecraft", monospace, sans-serif`;
  ctx.fillStyle = colorHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, canvas.width / 2, canvas.height / 2 + 1);
}

export function getCharPixelAdvance(char: string): number {
  if (char.length > 2) {
    return char.length * 6;
  }
  try {
    return defaultGlyphAtlas.getAdvance(char, false);
  } catch {
    return 6;
  }
}
