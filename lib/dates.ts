export const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getMonthFromDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length >= 2) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return monthNames[monthIndex];
    }
  }
  return '-';
}

export function getMonthYearFromDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length >= 3) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]} ${year}`;
    }
  }
  return 'Unknown';
}

export const parseDate = (dateStr: string): Date | null => {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };
