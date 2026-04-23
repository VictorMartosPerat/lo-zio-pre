// Online reservation tables: Mesa 1-8, capacity 1-6 each
export const ONLINE_TABLES = 8;
export const MAX_ONLINE_GUESTS = 15;
export const CALL_PHONE = "+34 682239035";
export const ONLINE_TABLE_NAMES = ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Mesa 7", "Mesa 8"];

/**
 * Fixed duration: 90 minutes (1h 30min) for all reservations.
 */
export function estimatedDuration(_guests: number): number {
  return 90;
}

// Keep legacy exports for backward compat
export const TABLES_PER_LOCATION = 15;
export const TABLE_CAPACITY = 6;

export function tablesNeeded(guests: number): number {
  return guests <= 6 ? 1 : 2;
}

interface Reservation {
  reservation_time: string;
  guests: string;
  table_id?: string | null;
  table_ids?: string[] | null;
}

interface TableInfo {
  id: string;
  name: string;
  capacity: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Given existing reservations for a location+date and available tables,
 * compute which time slots are unavailable because no suitable table(s)
 * (with enough combined capacity for the requested guests) are free.
 */
export function getUnavailableSlots(
  existingReservations: Reservation[],
  timeSlots: string[],
  requestedGuests: number,
  tables?: TableInfo[],
): Set<string> {
  const unavailable = new Set<string>();
  const requestedDuration = estimatedDuration(requestedGuests);

  // Filter to only online tables
  const onlineTables = tables ? tables.filter((t) => ONLINE_TABLE_NAMES.includes(t.name)) : null;

  if (onlineTables && onlineTables.length === 0) {
    for (const slot of timeSlots) unavailable.add(slot);
    return unavailable;
  }

  for (const slot of timeSlots) {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + requestedDuration;

    if (onlineTables) {
      // Find all free tables during this slot
      const freeTables = onlineTables.filter((table) => {
        const isOccupied = existingReservations.some((res) => {
          const usesTable = res.table_id === table.id || res.table_ids?.includes(table.id);
          if (!usesTable) return false;
          const resStart = timeToMinutes(res.reservation_time);
          const resEnd = resStart + 90;
          return slotStart < resEnd && resStart < slotEnd;
        });
        return !isOccupied;
      });

      if (requestedGuests <= 6) {
        // Single table: need one table with enough capacity
        const hasTable = freeTables.some((t) => t.capacity >= requestedGuests);
        if (!hasTable) unavailable.add(slot);
      } else {
        // Multi-table: need enough combined capacity from free tables
        // Sort by capacity desc and greedily pick
        const sorted = [...freeTables].sort((a, b) => b.capacity - a.capacity);
        let totalCap = 0;
        for (const t of sorted) {
          totalCap += t.capacity;
          if (totalCap >= requestedGuests) break;
        }
        if (totalCap < requestedGuests) unavailable.add(slot);
      }
    } else {
      // Fallback: count total tables in use
      let tablesInUse = 0;
      for (const res of existingReservations) {
        const resStart = timeToMinutes(res.reservation_time);
        const resEnd = resStart + 90;
        if (slotStart < resEnd && resStart < slotEnd) {
          tablesInUse += 1;
        }
      }
      if (tablesInUse >= ONLINE_TABLES) {
        unavailable.add(slot);
      }
    }
  }

  return unavailable;
}
