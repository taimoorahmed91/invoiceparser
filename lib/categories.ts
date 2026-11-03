export const UTILITY_CATEGORIES = [
  { key: 'Cold Water', color: '#3b82f6', label: 'Cold Water' },
  { key: 'Hot Water', color: '#fb923c', label: 'Hot Water' },
  { key: 'Electricity', color: '#f59e42', label: 'Electricity' },
  { key: 'Central Heating', color: '#10b981', label: 'Central Heating' },
  { key: 'Waste Management', color: '#6366f1', label: 'Waste Management' },
];

export function matchesUtilityCategory(description: string, category: string): boolean {
  const descLower = description.toLowerCase();
  if (category === 'Cold Water') {
    return descLower === 'cold water' || descLower.includes('zimnej wody') || descLower.includes('cold water');
  } else if (category === 'Hot Water') {
    return descLower === 'hot water' || descLower.includes('ciepłej wody') || descLower.includes('hot water');
  } else if (category === 'Electricity') {
    return descLower === 'electricity' || descLower.includes('energii elektrycznej') || descLower.includes('electricity');
  } else if (category === 'Central Heating') {
    return descLower === 'central heating' || descLower.includes('ciepła') || descLower.includes('heating');
  } else if (category === 'Waste Management') {
    return descLower.includes('odpadami') || descLower.includes('waste') || descLower.includes('gospodarka odpadami');
  }
  return false;
}

export function isManualRow(description: string): boolean {
  const lower = description.toLowerCase();
  return lower.includes('manual heating calculation') || lower.includes('manual calculation');
}

export function isParkingLine(description: string): boolean {
  return description.toLowerCase().includes('parking');
}

// Adjustment matching is intentionally narrower than chart-category matching.
export function isHeatingRow(description: string): boolean {
  const lower = description.toLowerCase();
  return lower === 'central heating' || lower.includes('central heating') || lower.includes('ciepła');
}
