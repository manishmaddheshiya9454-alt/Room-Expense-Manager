import { createId, parseNumber } from './utils.js';

export const categories = [
  { id: 'Food', label: 'Food', icon: '🍽️', color: '#f0abfc' },
  { id: 'Rent', label: 'Rent', icon: '🏠', color: '#60a5fa' },
  { id: 'Electricity', label: 'Electricity', icon: '💡', color: '#fb923c' },
  { id: 'Water', label: 'Water', icon: '🚰', color: '#38bdf8' },
  { id: 'Internet', label: 'Internet', icon: '🌐', color: '#818cf8' },
  { id: 'Gas', label: 'Gas', icon: '🧯', color: '#f97316' },
  { id: 'Travel', label: 'Travel', icon: '🧳', color: '#22c55e' },
  { id: 'Shopping', label: 'Shopping', icon: '🛍️', color: '#fb7185' },
  { id: 'Medicine', label: 'Medicine', icon: '💊', color: '#34d399' },
  { id: 'Entertainment', label: 'Entertainment', icon: '🎬', color: '#a78bfa' },
  { id: 'Other', label: 'Other', icon: '🗂️', color: '#94a3b8' },
];

export function createExpense(payload) {
  return {
    id: createId(),
    amount: parseNumber(payload.amount),
    category: payload.category,
    description: payload.description.trim(),
    date: payload.date,
    paidBy: payload.paidBy,
    method: payload.method,
    notes: payload.notes.trim(),
    split: payload.split,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

export function updateExpense(expenses, id, payload) {
  return expenses.map((expense) =>
    expense.id === id
      ? {
          ...expense,
          amount: parseNumber(payload.amount),
          category: payload.category,
          description: payload.description.trim(),
          date: payload.date,
          paidBy: payload.paidBy,
          method: payload.method,
          notes: payload.notes.trim(),
          split: payload.split,
          updatedAt: new Date().toISOString(),
        }
      : expense
  );
}

export function removeExpense(expenses, id) {
  return expenses.filter((expense) => expense.id !== id);
}

export function getExpenseById(expenses, id) {
  return expenses.find((expense) => expense.id === id) ?? null;
}

export function calculateSplit(amount, splitType, selectedRoommateIds, customValues = {}, percentageValues = {}) {
  const value = parseNumber(amount);
  const includedIds = Array.from(new Set(selectedRoommateIds.filter(Boolean)));
  if (includedIds.length === 0 || value <= 0) {
    return { type: splitType, shares: [] };
  }

  const shares = [];
  if (splitType === 'equal') {
    const shareAmount = parseNumber(value / includedIds.length);
    const remainder = value - shareAmount * includedIds.length;
    includedIds.forEach((roommateId, index) => {
      shares.push({ roommateId, amount: index === 0 ? shareAmount + remainder : shareAmount, percent: Number((100 / includedIds.length).toFixed(2)) });
    });
    return { type: 'equal', shares };
  }

  if (splitType === 'custom') {
    includedIds.forEach((roommateId) => {
      const amountShare = parseNumber(customValues[roommateId]);
      shares.push({ roommateId, amount: amountShare, percent: 0 });
    });
    shares.forEach((share) => {
      share.percent = value > 0 ? Number(((share.amount / value) * 100).toFixed(2)) : 0;
    });
    return { type: 'custom', shares };
  }

  const percentages = [];
  let percentTotal = 0;
  includedIds.forEach((roommateId) => {
    const sharePercent = parseNumber(percentageValues[roommateId]);
    percentTotal += sharePercent;
    percentages.push({ roommateId, percent: sharePercent });
  });
  const distribution = percentages.map((item) => {
    const amount = Number(((item.percent / 100) * value).toFixed(2));
    return { roommateId: item.roommateId, amount, percent: item.percent };
  });
  return { type: 'percentage', shares: distribution };
}

export function validateSplit(amount, split) {
  const value = parseNumber(amount);
  if (!split || !Array.isArray(split.shares) || split.shares.length === 0) {
    return 'Select at least one roommate for this expense.';
  }
  if (split.shares.some((share) => !Number.isFinite(Number(share.amount)) || Number(share.amount) < 0)) {
    return 'Split amounts cannot be negative.';
  }
  const total = split.shares.reduce((sum, share) => sum + Number(share.amount), 0);
  if (Math.abs(total - value) > 0.01) {
    return `Split amounts must add up to ${value.toFixed(2)}.`;
  }
  if (split.type === 'percentage') {
    const percentTotal = split.shares.reduce((sum, share) => sum + Number(share.percent || 0), 0);
    if (Math.abs(percentTotal - 100) > 0.01) {
      return 'Percentage splits must add up to 100%.';
    }
  }
  return '';
}

export function filterExpenses(expenses, filters = {}) {
  return expenses.filter((expense) => {
    const searchText = String(filters.search ?? '').trim().toLowerCase();
    const categoryMatch = !filters.category || expense.category === filters.category;
    const roommateMatch = !filters.roommate || expense.paidBy === filters.roommate;
    const methodMatch = !filters.method || expense.method === filters.method;
    const searchMatch =
      !searchText ||
      expense.description.toLowerCase().includes(searchText) ||
      expense.category.toLowerCase().includes(searchText) ||
      expense.method.toLowerCase().includes(searchText);
    return categoryMatch && roommateMatch && methodMatch && searchMatch;
  });
}

export function sortExpenses(expenses, sortKey = 'newest') {
  return [...expenses].sort((a, b) => {
    if (sortKey === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortKey === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
    if (sortKey === 'highest') return b.amount - a.amount;
    if (sortKey === 'lowest') return a.amount - b.amount;
    return 0;
  });
}
