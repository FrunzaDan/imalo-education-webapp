const BLACK = '#000000';
const WHITE = '#ffffff';

// WCAG 2.x relative luminance of an sRGB channel (0-255).
function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number | null {
  let digits = hex.trim().replace(/^#/, '');
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((d) => d + d)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(digits)) return null;

  const r = parseInt(digits.substring(0, 2), 16);
  const g = parseInt(digits.substring(2, 4), 16);
  const b = parseInt(digits.substring(4, 6), 16);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

// Picks whichever of black/white has the higher WCAG contrast ratio against
// the given hex background — so brighter fills get black text and darker
// fills get white text. A fixed luminance cut-off (the old approach) picks
// the wrong side for mid-tones such as red (#F44336), where black is the
// more legible choice. Unparseable input falls back to black.
export function contrastTextColor(backgroundHex: string): string {
  const luminance = relativeLuminance(backgroundHex);
  if (luminance === null) return BLACK;

  // Contrast ratio is (L1 + 0.05) / (L2 + 0.05); black's luminance is 0 and
  // white's is 1, so compare the two ratios directly.
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithBlack >= contrastWithWhite ? BLACK : WHITE;
}
