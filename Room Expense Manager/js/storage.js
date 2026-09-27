import { createId } from './utils.js';

const STORAGE_KEY = 'roomExpenseManager:data';

const DEFAULT_STATE = {
  expenses: [],
  personalExpenses: [],
  roommates: [
    {
      id: createId(),
      name: 'You',
      color: '#2563EB',
      createdAt: new Date().toISOString(),
    },
  ],
  currentUserId: '',
  settings: {
    theme: 'light',
    currency: '₹',
  },
  budget: {
    amount: 0,
    notes: '',
  },
  personalBudget: {
    amount: 0,
    enabled: false,
    alertAt: 75,
  },
  room: {
    name: 'My shared room',
    number: '',
    hostel: '',
    address: '',
    maxMembers: 4,
    monthlyRent: 0,
    description: '',
    joinCode: '',
  },
  recurringExpenses: [],
  settlements: [],
  shoppingItems: [],
  meals: [],
  chores: [],
  deposits: [],
  inventory: [],
  maintenanceRequests: [],
  notifications: [],
  activities: [],
};

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch (error) {
    return fallback;
  }
}

export function normalizeState(data) {
  const normalized = data && typeof data === 'object' ? data : {};
  if (!normalized.roommates || !Array.isArray(normalized.roommates) || normalized.roommates.length === 0) {
    normalized.roommates = structuredClone(DEFAULT_STATE.roommates);
  }

  if (!normalized.settings || typeof normalized.settings !== 'object') {
    normalized.settings = structuredClone(DEFAULT_STATE.settings);
  }

  if (!normalized.budget || typeof normalized.budget !== 'object') {
    normalized.budget = structuredClone(DEFAULT_STATE.budget);
  }

  if (!normalized.personalBudget || typeof normalized.personalBudget !== 'object') {
    normalized.personalBudget = structuredClone(DEFAULT_STATE.personalBudget);
  }

  if (!normalized.expenses || !Array.isArray(normalized.expenses)) {
    normalized.expenses = [];
  }

  if (!normalized.personalExpenses || !Array.isArray(normalized.personalExpenses)) {
    normalized.personalExpenses = [];
  }

  if (!normalized.settlements || !Array.isArray(normalized.settlements)) {
    normalized.settlements = [];
  }

  if (!normalized.activities || !Array.isArray(normalized.activities)) {
    normalized.activities = [];
  }

  normalized.recurringExpenses = Array.isArray(normalized.recurringExpenses) ? normalized.recurringExpenses.map((item) => ({
    ...item,
    id: item.id || createId(),
    status: item.status || (item.paused ? 'paused' : 'active'),
    frequency: item.frequency || 'Monthly',
    nextDate: item.nextDate || item.nextDueDate || '',
    lastGeneratedDate: item.lastGeneratedDate || null,
  })) : [];

  normalized.settlements = normalized.settlements.map((item) => ({
    ...item,
    id: item.id || createId(),
    status: item.status || 'Pending',
    paymentMethod: item.paymentMethod || item.method || 'Not specified',
    createdAt: item.createdAt || new Date().toISOString(),
  }));

  if (!normalized.currentUserId && normalized.roommates && normalized.roommates.length > 0) {
    normalized.currentUserId = normalized.roommates[0].id;
  }

  Object.entries(DEFAULT_STATE).forEach(([key, defaultValue]) => {
    if (key === 'room' && (!normalized.room || typeof normalized.room !== 'object' || Array.isArray(normalized.room))) {
      normalized.room = structuredClone(defaultValue);
    } else if (Array.isArray(defaultValue) && !Array.isArray(normalized[key])) {
      normalized[key] = [];
    }
  });

  normalized.settings = { ...structuredClone(DEFAULT_STATE.settings), ...normalized.settings };
  normalized.budget = { ...structuredClone(DEFAULT_STATE.budget), ...normalized.budget };
  normalized.personalBudget = { ...structuredClone(DEFAULT_STATE.personalBudget), ...normalized.personalBudget };
  normalized.room = { ...structuredClone(DEFAULT_STATE.room), ...normalized.room };
  normalized.currentUserId = normalized.currentUserId || normalized.roommates[0]?.id || '';

  return normalized;
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveState(DEFAULT_STATE);
    return structuredClone(DEFAULT_STATE);
  }

  return normalizeState(safeParse(raw, DEFAULT_STATE));
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return structuredClone(DEFAULT_STATE);
}
