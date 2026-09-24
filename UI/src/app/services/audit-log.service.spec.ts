import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuditLogEntry } from '../interfaces/audit-log-entry';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let httpMock: HttpTestingController;

  const urlFor = (scholarId: string) =>
    `${environment.apiUrl}/api/scholars/${scholarId}/audit-log`;

  const buildEntry = (
    overrides: Partial<AuditLogEntry> = {},
  ): AuditLogEntry => ({
    scholarAuditLogId: 1,
    scholarId: 'scholar-1',
    actionType: 'Edited',
    details: 'Updated: first name, grade',
    occurredAt: '2026-01-01T10:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const load = (scholarId: string) => {
    service.loadAuditLog(scholarId);
    TestBed.tick();
  };

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  it('makes no request until a scholar is loaded', async () => {
    TestBed.tick();

    httpMock.expectNone(() => true);
    expect(service.entries()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('reports loading while the request is in flight', async () => {
    load('scholar-1');

    expect(service.loading()).toBe(true);

    httpMock.expectOne(urlFor('scholar-1')).flush([]);
    await settle();

    expect(service.loading()).toBe(false);
  });

  it('populates entries from a successful response and clears any error', async () => {
    const entry = buildEntry();

    load('scholar-1');
    httpMock.expectOne(urlFor('scholar-1')).flush([entry]);
    await settle();

    expect(service.entries()).toEqual([entry]);
    expect(service.error()).toBeNull();
  });

  it('surfaces the Problem Details detail when present', async () => {
    load('scholar-1');

    httpMock
      .expectOne(urlFor('scholar-1'))
      .flush(
        { status: 500, detail: 'boom' },
        { status: 500, statusText: 'Server Error' },
      );
    await settle();

    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('boom');
  });

  it('falls back to a generic message when the error has no body', async () => {
    load('scholar-1');

    httpMock
      .expectOne(urlFor('scholar-1'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(service.error()).toBe(
      'Failed to load the audit trail (500). Please try again.',
    );
  });

  it('re-requests when asked to load the same scholar again', async () => {
    load('scholar-1');
    httpMock.expectOne(urlFor('scholar-1')).flush([]);
    await settle();

    load('scholar-1');

    httpMock.expectOne(urlFor('scholar-1')).flush([buildEntry()]);
    await settle();
    expect(service.entries()).toHaveLength(1);
  });

  it('cancels the previous request when a different scholar is loaded', async () => {
    load('scholar-1');
    const first = httpMock.expectOne(urlFor('scholar-1'));

    load('scholar-2');

    expect(first.cancelled).toBe(true);
    httpMock
      .expectOne(urlFor('scholar-2'))
      .flush([buildEntry({ scholarId: 'scholar-2' })]);
    await settle();
    expect(service.entries()[0].scholarId).toBe('scholar-2');
  });
});
