import { describe, expect, it } from 'vitest';
import { contrastTextColor } from './contrast-color';

describe('contrastTextColor', () => {
  it('uses black text on bright fills', () => {
    expect(contrastTextColor('#FFC107')).toBe('#000000'); // amber
    expect(contrastTextColor('#CDDC39')).toBe('#000000'); // lime
    expect(contrastTextColor('#2196F3')).toBe('#000000'); // blue
    expect(contrastTextColor('#ffffff')).toBe('#000000');
  });

  it('uses white text on dark fills', () => {
    expect(contrastTextColor('#4E342E')).toBe('#ffffff'); // dark brown
    expect(contrastTextColor('#1B5E20')).toBe('#ffffff'); // dark green
    expect(contrastTextColor('#3F51B5')).toBe('#ffffff'); // indigo
    expect(contrastTextColor('#000000')).toBe('#ffffff');
  });

  it('picks the higher-contrast side for mid-tones', () => {
    // Red sits near the boundary: black (~5.7:1) beats white (~3.7:1).
    expect(contrastTextColor('#F44336')).toBe('#000000');
  });

  it('accepts 3-digit hex and a missing #', () => {
    expect(contrastTextColor('#fff')).toBe('#000000');
    expect(contrastTextColor('000')).toBe('#ffffff');
  });

  it('falls back to black for unparseable input', () => {
    expect(contrastTextColor('not-a-color')).toBe('#000000');
    expect(contrastTextColor('')).toBe('#000000');
  });
});
