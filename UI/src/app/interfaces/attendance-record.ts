export interface AttendanceRecord {
  date: string; // 'YYYY-MM-DD' — the API serializes DateOnly this way
  lunchCost: number;
  transportCost: number;
  // Whether the scholar was present that day. Lunch/Transport can only be
  // selected while this is true.
  present: boolean;
  lunchSelected: boolean;
  transportSelected: boolean;
}
