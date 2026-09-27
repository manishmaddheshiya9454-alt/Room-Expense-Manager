export const paletteColors = ['#2563EB', '#1D4ED8', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6'];

export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatCurrency(value, currencySymbol = '₹') {
  const amount = Number(value) || 0;
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol}${formatted}`;
}

export function formatDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0].toUpperCase())
    .join('');
}

export function getColorFromName(name) {
  const hash = [...name.toLowerCase()].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return paletteColors[hash % paletteColors.length];
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function sortByDate(expenses, direction = 'desc') {
  return [...expenses].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return direction === 'desc' ? -diff : diff;
  });
}

export function parseNumber(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function genderedNumber(value) {
  return Number.isFinite(value) ? value : 0;
}
