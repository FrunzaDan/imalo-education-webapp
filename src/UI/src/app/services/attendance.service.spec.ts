import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AttendanceRecord } from '../interfaces/attendance-record';
import { AttendanceService } from './attendance.service';
import { NotificationService } from './notification.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let httpMock: HttpTestingController;
  let show: ReturnType<typeof vi.fn>;

  const API_URL = `${environment.apiUrl}/api/scholars`;

  const record: AttendanceRecord = {
    date: '2026-09-01',
    lunchCost: 15,
    transportCost: 0,
    present: true,
    lunchSelected: true,
    transportSelected: false,
  };

  beforeEach(() => {
    show = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: { show } },
      ],
    });
    service = TestBed.inject(AttendanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAllAttendance reads every scholar at once', () => {
    let result: unknown;

    service.getAllAttendance().subscribe((r) => (result = r));
    httpMock
      .expectOne(`${API_URL}/attendance`)
      .flush([{ scholarId: 'scholar-1', attendance: [record] }]);

    expect(result).toEqual([{ scholarId: 'scholar-1', attendance: [record] }]);
  });

  it("getAttendance reads one scholar's records", () => {
    let result: AttendanceRecord[] | undefined;

    service.getAttendance('scholar-1').subscribe((r) => (result = r));
    httpMock.expectOne(`${API_URL}/scholar-1/attendance`).flush([record]);

    expect(result).toEqual([record]);
  });

  it('saveAttendance POSTs the records and confirms with a toast', () => {
    service.saveAttendance('scholar-1', [record]).subscribe();
    const req = httpMock.expectOne(`${API_URL}/scholar-1/attendance`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual([record]);
    req.flush(null);

    expect(show).toHaveBeenCalledWith('Attendance saved successfully.');
  });

  it('saveAttendanceSilently POSTs without a toast', () => {
    service.saveAttendanceSilently('scholar-1', [record]).subscribe();
    httpMock.expectOne(`${API_URL}/scholar-1/attendance`).flush(null);

    expect(show).not.toHaveBeenCalled();
  });

  it('does not toast when the save fails', () => {
    service
      .saveAttendance('scholar-1', [record])
      .subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${API_URL}/scholar-1/attendance`)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(show).not.toHaveBeenCalled();
  });

  it("deleteAttendance DELETEs all of a scholar's records", () => {
    service.deleteAttendance('scholar-1').subscribe();
    const req = httpMock.expectOne(`${API_URL}/scholar-1/attendance`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
