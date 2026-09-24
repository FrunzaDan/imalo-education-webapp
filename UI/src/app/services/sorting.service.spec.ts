import { SortingService } from './sorting.service';

interface Row {
  name: string | null;
  age: number | null;
  joined: string | null;
}

describe('SortingService', () => {
  let service: SortingService;

  beforeEach(() => {
    service = new SortingService();
  });

  it('sorts strings ascending/descending, case-insensitively', () => {
    const data: Row[] = [
      { name: 'bob', age: null, joined: null },
      { name: 'Alice', age: null, joined: null },
      { name: 'charlie', age: null, joined: null },
    ];

    expect(
      service.sort(data, 'name', 'string', 'asc').map((r) => r.name),
    ).toEqual(['Alice', 'bob', 'charlie']);
    expect(
      service.sort(data, 'name', 'string', 'desc').map((r) => r.name),
    ).toEqual(['charlie', 'bob', 'Alice']);
  });

  it('sorts numbers ascending/descending', () => {
    const data: Row[] = [
      { name: '', age: 30, joined: null },
      { name: '', age: 10, joined: null },
      { name: '', age: 20, joined: null },
    ];

    expect(
      service.sort(data, 'age', 'number', 'asc').map((r) => r.age),
    ).toEqual([10, 20, 30]);
    expect(
      service.sort(data, 'age', 'number', 'desc').map((r) => r.age),
    ).toEqual([30, 20, 10]);
  });

  it('sorts dates ascending/descending', () => {
    const data: Row[] = [
      { name: '', age: null, joined: '2024-03-01' },
      { name: '', age: null, joined: '2024-01-01' },
      { name: '', age: null, joined: '2024-02-01' },
    ];

    expect(
      service.sort(data, 'joined', 'date', 'asc').map((r) => r.joined),
    ).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
    expect(
      service.sort(data, 'joined', 'date', 'desc').map((r) => r.joined),
    ).toEqual(['2024-03-01', '2024-02-01', '2024-01-01']);
  });

  it('does not mutate the input array', () => {
    const data: Row[] = [
      { name: 'b', age: null, joined: null },
      { name: 'a', age: null, joined: null },
    ];
    const original = [...data];

    service.sort(data, 'name', 'string', 'asc');

    expect(data).toEqual(original);
  });

  it('places nulls first when ascending and last when descending', () => {
    const data: Row[] = [
      { name: 'b', age: null, joined: null },
      { name: null, age: null, joined: null },
      { name: 'a', age: null, joined: null },
    ];

    expect(
      service.sort(data, 'name', 'string', 'asc').map((r) => r.name),
    ).toEqual([null, 'a', 'b']);
    expect(
      service.sort(data, 'name', 'string', 'desc').map((r) => r.name),
    ).toEqual(['b', 'a', null]);
  });

  it('keeps all-null columns stable (no crash, order-neutral)', () => {
    const data: Row[] = [
      { name: null, age: null, joined: null },
      { name: null, age: null, joined: null },
    ];

    expect(() => service.sort(data, 'name', 'string', 'asc')).not.toThrow();
    expect(service.sort(data, 'name', 'string', 'asc').length).toBe(2);
  });
});
