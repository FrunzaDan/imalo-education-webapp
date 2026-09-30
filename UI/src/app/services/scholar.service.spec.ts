import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Gender, Scholar } from '../interfaces/scholar';
import { NotificationService } from './notification.service';
import { ScholarService } from './scholar.service';

describe('ScholarService', () => {
  let service: ScholarService;
  let httpMock: HttpTestingController;
  let show: ReturnType<typeof vi.fn>;

  const API_URL = `${environment.apiUrl}/api/scholars`;

  const buildScholar = (overrides: Partial<Scholar> = {}): Scholar => ({
    scholarId: 'scholar-1',
    firstName: 'Ana',
    lastName: 'Pop',
    gender: Gender.Female,
    pickupSchedule: null,
    schoolId: 1,
    grade: 2,
    birthDate: '2018-05-01',
    motherFirstName: null,
    motherLastName: null,
    motherPhoneNumber: null,
    fatherFirstName: null,
    fatherLastName: null,
    fatherPhoneNumber: null,
    ...overrides,
  });

  beforeEach(() => {
    show = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: { show } },
      ],
    });
    service = TestBed.inject(ScholarService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getScholars and getScholar read from the scholars endpoint', () => {
    let all: Scholar[] | undefined;
    let one: Scholar | undefined;

    service.getScholars().subscribe((s) => (all = s));
    httpMock.expectOne(API_URL).flush([buildScholar()]);
    service.getScholar('scholar-1').subscribe((s) => (one = s));
    httpMock.expectOne(`${API_URL}/scholar-1`).flush(buildScholar());

    expect(all).toEqual([buildScholar()]);
    expect(one).toEqual(buildScholar());
  });

  it('createScholar POSTs the scholar and confirms with a toast', () => {
    const scholar = buildScholar();

    service.createScholar(scholar).subscribe();
    const req = httpMock.expectOne(API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(scholar);
    req.flush(scholar);

    expect(show).toHaveBeenCalledWith('Scholar added successfully.');
  });

  it('createScholarSilently POSTs without a toast', () => {
    service.createScholarSilently(buildScholar()).subscribe();
    httpMock.expectOne(API_URL).flush(buildScholar());

    expect(show).not.toHaveBeenCalled();
  });

  it('updateScholar PUTs to the scholar URL and confirms with a toast', () => {
    const scholar = buildScholar({ firstName: 'Ioana' });

    service.updateScholar(scholar).subscribe();
    const req = httpMock.expectOne(`${API_URL}/scholar-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(scholar);
    req.flush(scholar);

    expect(show).toHaveBeenCalledWith('Scholar updated successfully.');
  });

  it('deleteScholar DELETEs and confirms; the silent variant does not toast', () => {
    service.deleteScholar('scholar-1').subscribe();
    const req = httpMock.expectOne(`${API_URL}/scholar-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(show).toHaveBeenCalledWith('Scholar deleted successfully.');

    show.mockClear();
    service.deleteScholarSilently('scholar-2').subscribe();
    httpMock.expectOne(`${API_URL}/scholar-2`).flush(null);
    expect(show).not.toHaveBeenCalled();
  });

  it('does not toast when a save fails', () => {
    service.updateScholar(buildScholar()).subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${API_URL}/scholar-1`)
      .flush(null, { status: 400, statusText: 'Bad Request' });

    expect(show).not.toHaveBeenCalled();
  });
});
