import { CsvExportService } from './csv-export.service';

describe('CsvExportService', () => {
  let service: CsvExportService;

  beforeEach(() => {
    service = new CsvExportService();
  });

  const escape = (
    service: CsvExportService,
    value: string | number | null | undefined,
  ) => (service as any).escape(value);

  it('leaves plain values unquoted', () => {
    expect(escape(service, 'hello')).toBe('hello');
    expect(escape(service, 42)).toBe('42');
  });

  it('renders null/undefined as an empty string', () => {
    expect(escape(service, null)).toBe('');
    expect(escape(service, undefined)).toBe('');
  });

  it('quotes and escapes values containing commas', () => {
    expect(escape(service, 'Doe, John')).toBe('"Doe, John"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escape(service, 'He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes values containing newlines', () => {
    expect(escape(service, 'line1\nline2')).toBe('"line1\nline2"');
    expect(escape(service, 'line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('builds a timestamped filename with no colons or dots', () => {
    const filename = (service as any).buildFilename('scholars');
    expect(filename).toMatch(/^scholars_[0-9T-]+Z\.csv$/);
    expect(filename).not.toContain(':');
    expect(filename.replace(/\.csv$/, '')).not.toContain('.');
  });
});
