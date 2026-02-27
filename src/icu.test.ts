import { describe, it, expect } from 'vitest';
import { parseICU, formatICU } from '../src/icu.js';

describe('ICU MessageFormat', () => {
  const locale = 'en-US';

  it('should handle simple interpolation', () => {
    const msg = 'Hello, {name}!';
    const parts = parseICU(msg);
    expect(formatICU(parts, { name: 'World' }, locale)).toBe('Hello, World!');
  });

  it('should handle plurals', () => {
    const msg = '{count, plural, =0{no items} one{one item} other{# items}}';
    const parts = parseICU(msg);
    expect(formatICU(parts, { count: 0 }, locale)).toBe('no items');
    expect(formatICU(parts, { count: 1 }, locale)).toBe('one item');
    expect(formatICU(parts, { count: 10 }, locale)).toBe('10 items');
  });

  it('should handle select', () => {
    const msg = '{gender, select, male{He} female{She} other{They}} liked this.';
    const parts = parseICU(msg);
    expect(formatICU(parts, { gender: 'male' }, locale)).toBe('He liked this.');
    expect(formatICU(parts, { gender: 'female' }, locale)).toBe('She liked this.');
    expect(formatICU(parts, { gender: 'other' }, locale)).toBe('They liked this.');
  });

  it('should handle nested structures', () => {
    const msg = '{count, plural, one{{gender, select, male{He} female{She} other{They}} has one item} other{# items}}';
    const parts = parseICU(msg);
    expect(formatICU(parts, { count: 1, gender: 'male' }, locale)).toBe('He has one item');
    expect(formatICU(parts, { count: 2, gender: 'female' }, locale)).toBe('2 items');
  });

  it('should handle number formatting', () => {
    const msg = 'Price: {val, number, currency}';
    const parts = parseICU(msg);
    const result = formatICU(parts, { val: 100, currency: 'USD' }, 'en-US');
    expect(result).toContain('$100.00');
  });

  it('should handle date formatting', () => {
    const msg = 'Date: {val, date, short}';
    const parts = parseICU(msg);
    const date = new Date(2023, 0, 1);
    const result = formatICU(parts, { val: date }, 'en-US');
    expect(result).toMatch(/Date: \d{1,2}\/\d{1,2}\/\d{2,4}/);
  });

  it('should handle ordinals', () => {
    const msg = 'That is my {pos, selectordinal, one{#st} two{#nd} few{#rd} other{#th}} project.';
    const parts = parseICU(msg);
    expect(formatICU(parts, { pos: 1 }, 'en-US')).toBe('That is my 1st project.');
    expect(formatICU(parts, { pos: 2 }, 'en-US')).toBe('That is my 2nd project.');
    expect(formatICU(parts, { pos: 3 }, 'en-US')).toBe('That is my 3rd project.');
    expect(formatICU(parts, { pos: 4 }, 'en-US')).toBe('That is my 4th project.');
  });
});
