export interface School {
  id: number;
  name: string;
  color: string;
  // Standard per-day lunch/transport cost applied when marking attendance
  // for a day that has no existing record yet.
  lunchPrice: number;
  transportPrice: number;
}
