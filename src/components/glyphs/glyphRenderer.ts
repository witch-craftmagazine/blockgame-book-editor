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

function parseHexColor(colorHex: string): [number, number, number] {
  if (colorHex.startsWith('#')) {
    if (colorHex.length >= 7) {
      return [
        parseInt(colorHex.slice(1, 3), 16) || 0,
        parseInt(colorHex.slice(3, 5), 16) || 0,
        parseInt(colorHex.slice(5, 7), 16) || 0,
      ];
    }
    if (colorHex.length === 4) {
      return [
        parseInt(colorHex[1] + colorHex[1], 16) || 0,
        parseInt(colorHex[2] + colorHex[2], 16) || 0,
        parseInt(colorHex[3] + colorHex[3], 16) || 0,
      ];
    }
  }
  return [255, 255, 255];
}

export function recolorCanvasToMonochrome(canvas: HTMLCanvasElement, colorHex: string): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const [r, g, b] = parseHexColor(colorHex);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 40) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {}
}

export function renderGlyphToCanvas(
  canvas: HTMLCanvasElement,
  char: string,
  colorHex = '#f0e6d2',
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
    ctx.fillText(char, canvas.width / 2, canvas.height / 2);
    recolorCanvasToMonochrome(canvas, colorHex);
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

      // Force pixelated monochrome recolor so system color emojis never bleed through
      recolorCanvasToMonochrome(canvas, colorHex);
      return;
    }
  } catch (err) {
    console.debug('Error in getGlyphDrawInfo:', err);
  }

  // Graceful fallback if atlas not ready
  ctx.font = `${Math.floor(canvas.height * 0.6)}px "Minecraft", "Unifont", monospace, sans-serif`;
  ctx.fillStyle = colorHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, canvas.width / 2, canvas.height / 2 + 1);
  recolorCanvasToMonochrome(canvas, colorHex);
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
