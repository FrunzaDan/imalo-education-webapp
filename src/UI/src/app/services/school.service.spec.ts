import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { School } from '../interfaces/school';
import { SchoolService } from './school.service';

describe('SchoolService', () => {
  let service: SchoolService;
  let httpMock: HttpTestingController;

  const SCHOOLS_URL = '../../assets/schools.json';

  const schools: School[] = [
    {
      schoolId: 1,
      name: 'Scoala 1',
      color: '#ff0000',
      lunchPrice: 15,
      transportPrice: 5,
    },
    {
      schoolId: 2,
      name: 'Scoala 2',
      color: '#00ff00',
      lunchPrice: 17,
      transportPrice: 6,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SchoolService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches schools.json once and shares it with every caller', () => {
    let first: School[] | undefined;
    let second: School[] | undefined;

    service.getSchools().subscribe((s) => (first = s));
    httpMock.expectOne(SCHOOLS_URL).flush(schools);
    service.getSchools().subscribe((s) => (second = s));

    httpMock.expectNone(SCHOOLS_URL);
    expect(first).toEqual(schools);
    expect(second).toEqual(schools);
  });

  it('falls back to an empty list when schools.json cannot be loaded', () => {
    let result: School[] | undefined;

    service.getSchools().subscribe((s) => (result = s));
    httpMock
      .expectOne(SCHOOLS_URL)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(result).toEqual([]);
  });

  it('getSchool finds a school by id, accepting the id as text too', () => {
    let result: School | null | undefined;

    service.getSchool('2').subscribe((s) => (result = s));
    httpMock.expectOne(SCHOOLS_URL).flush(schools);

    expect(result).toEqual(schools[1]);
  });

  it('getSchool returns null and warns for an unknown id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let result: School | null | undefined;

    service.getSchool(99).subscribe((s) => (result = s));
    httpMock.expectOne(SCHOOLS_URL).flush(schools);

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'School with ID 99 not found in schools.json',
    );
    warn.mockRestore();
  });
});
