const BLACK = '#000000';
const WHITE = '#ffffff';

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

export function contrastTextColor(backgroundHex: string): string {
  const luminance = relativeLuminance(backgroundHex);
  if (luminance === null) return BLACK;

  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithBlack >= contrastWithWhite ? BLACK : WHITE;
}
