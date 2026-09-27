export const personalExpenseCategories = [
  { id: 'Food', label: 'Food', icon: '🍽️' },
  { id: 'Shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'Travel', label: 'Travel', icon: '🚕' },
  { id: 'Entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'Education', label: 'Education', icon: '📚' },
  { id: 'Health', label: 'Health', icon: '💊' },
  { id: 'Bills', label: 'Bills', icon: '💡' },
  { id: 'Subscription', label: 'Subscription', icon: '📦' },
  { id: 'Personal', label: 'Personal', icon: '👤' },
  { id: 'Other', label: 'Other', icon: '🧾' },
];

export const personalRangeOptions = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'last3Months',
  'thisYear',
  'allTime',
];

export function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function getCurrentUserId(state) {
  if (!state || !Array.isArray(state.roommates) || state.roommates.length === 0) return '';
  return state.currentUserId || state.roommates[0].id || '';
}

export function normalizeRange(rangeKey, customFrom = '', customTo = '') {
  const now = new Date();
  const end = endOfDay(now);
  let start = new Date(0);

  if (customFrom || customTo) {
    const from = customFrom ? startOfDay(new Date(customFrom)) : new Date(0);
    const to = customTo ? endOfDay(new Date(customTo)) : end;
    return { start: from, end: to, rangeKey: 'custom' };
  }

  switch (rangeKey) {
    case 'today': {
      start = startOfDay(now);
      break;
    }
    case 'yesterday': {
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'thisWeek': {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1 - day);
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday));
      break;
    }
    case 'lastWeek': {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - 7);
      start = startOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 1));
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'thisMonth': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case 'lastMonth': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end.setTime(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime());
      break;
    }
    case 'last3Months': {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    }
    case 'thisYear': {
      start = new Date(now.getFullYear(), 0, 1);
      break;
    }
    case 'allTime':
    default: {
      start = new Date(0);
      break;
    }
  }

  return { start, end, rangeKey };
}

export function filterByRange(items, rangeKey = 'thisMonth', customFrom = '', customTo = '') {
  if (!Array.isArray(items)) return [];
  const { start, end } = normalizeRange(rangeKey, customFrom, customTo);
  return items.filter((item) => {
    const date = toDateOnly(item.date);
    if (!date) return false;
    return date >= start && date <= end;
  });
}

export function getPersonalExpensesByUser(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  return filterByRange(
    (state.personalExpenses || []).filter((expense) => expense.personId === userId && !expense.isShared),
    range,
    customFrom,
    customTo
  );
}

export function getRoomExpensesPaidByUser(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  return filterByRange(
    (state.expenses || []).filter((expense) => expense.paidBy === userId),
    range,
    customFrom,
    customTo
  );
}

export function getUserOwe(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  const expenses = filterByRange(state.expenses || [], range, customFrom, customTo);
  return expenses.reduce((total, expense) => {
    if (expense.paidBy === userId || !expense.split || !Array.isArray(expense.split.shares)) return total;
    const share = expense.split.shares.find((entry) => entry.roommateId === userId);
    return total + Number(share?.amount || 0);
  }, 0);
}

export function getUserWillReceive(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  const expenses = filterByRange(state.expenses || [], range, customFrom, customTo);
  return expenses.reduce((total, expense) => {
    if (expense.paidBy !== userId || !expense.split || !Array.isArray(expense.split.shares)) return total;
    const otherShares = expense.split.shares.filter((entry) => entry.roommateId !== userId);
    return total + otherShares.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }, 0);
}

export function getPersonalOverview(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  const personalExpenses = getPersonalExpensesByUser(state, userId, range, customFrom, customTo);
  const roomPaid = getRoomExpensesPaidByUser(state, userId, range, customFrom, customTo);
  const personalSpending = personalExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const roomSpendingPaidByMe = roomPaid.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const iOwe = getUserOwe(state, userId, range, customFrom, customTo);
  const iWillReceive = getUserWillReceive(state, userId, range, customFrom, customTo);

  return {
    personalSpending,
    roomSpendingPaidByMe,
    myPersonalExpenses: personalSpending,
    iOwe,
    iWillReceive,
    totalOutflow: personalSpending + roomSpendingPaidByMe,
    personalTransactionCount: personalExpenses.length,
    roomTransactionCount: roomPaid.length,
  };
}

export function getCategoryTotals(items = []) {
  return items.reduce((map, item) => {
    const key = item.category || 'Other';
    map[key] = (map[key] || 0) + Number(item.amount || 0);
    return map;
  }, {});
}

export function getRoomMemberBreakdown(state, range = 'thisMonth', customFrom = '', customTo = '') {
  const roommates = Array.isArray(state.roommates) ? state.roommates : [];
  const expenses = filterByRange(state.expenses || [], range, customFrom, customTo);
  const personalExpenses = filterByRange(state.personalExpenses || [], range, customFrom, customTo);

  return roommates
    .map((roommate) => {
      const roomTotal = expenses
        .filter((expense) => expense.paidBy === roommate.id)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const personalTotal = personalExpenses
        .filter((expense) => expense.personId === roommate.id)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const totalSpent = roomTotal + personalTotal;
      const transactionCount = expenses.filter((expense) => expense.paidBy === roommate.id).length + personalExpenses.filter((expense) => expense.personId === roommate.id).length;
      return {
        roommate,
        roomTotal,
        personalTotal,
        totalSpent,
        transactionCount,
        averageExpense: transactionCount > 0 ? totalSpent / transactionCount : 0,
        highestExpense: [...expenses.filter((e) => e.paidBy === roommate.id), ...personalExpenses.filter((e) => e.personId === roommate.id)]
          .reduce((highest, item) => Math.max(highest, Number(item.amount || 0)), 0),
        lowestExpense: [...expenses.filter((e) => e.paidBy === roommate.id), ...personalExpenses.filter((e) => e.personId === roommate.id)]
          .reduce((lowest, item) => {
            const amount = Number(item.amount || 0);
            if (lowest === null || amount < lowest) return amount;
            return lowest;
          }, null),
      };
    })
    .filter((entry) => entry.totalSpent > 0 || entry.transactionCount > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export function getPersonDetail(state, personId, range = 'thisMonth', customFrom = '', customTo = '') {
  const personalExpenses = getPersonalExpensesByUser(state, personId, range, customFrom, customTo);
  const roomExpenses = getRoomExpensesPaidByUser(state, personId, range, customFrom, customTo);
  const roomOwes = getUserOwe(state, personId, range, customFrom, customTo);
  const roomReceives = getUserWillReceive(state, personId, range, customFrom, customTo);
  const history = [
    ...personalExpenses.map((expense) => ({ ...expense, kind: 'personal', title: expense.name || expense.description || 'Personal expense' })),
    ...roomExpenses.map((expense) => ({ ...expense, kind: 'room', title: expense.description })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const categoryTotals = getCategoryTotals(personalExpenses);
  const totalSpent = personalExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) + roomExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return {
    personalExpenses,
    roomExpenses,
    roomOwes,
    roomReceives,
    totalSpent,
    transactionCount: history.length,
    categoryTotals,
    history,
  };
}

export function getPersonalTransactions(state, userId, range = 'thisMonth', customFrom = '', customTo = '', filters = {}) {
  const personal = getPersonalExpensesByUser(state, userId, range, customFrom, customTo)
    .map((expense) => ({ ...expense, kind: 'personal', title: expense.name || expense.description || 'Personal expense', paidBy: userId }));
  const room = getRoomExpensesPaidByUser(state, userId, range, customFrom, customTo)
    .map((expense) => ({ ...expense, kind: 'shared', title: expense.description || 'Room expense' }));
  const query = String(filters.search || '').trim().toLowerCase();
  return [...personal, ...room]
    .filter((expense) => !filters.category || (expense.category || 'Other') === filters.category)
    .filter((expense) => !filters.method || (expense.method || 'Not specified') === filters.method)
    .filter((expense) => !filters.kind || expense.kind === filters.kind)
    .filter((expense) => !query || [expense.title, expense.category, expense.method, expense.notes].some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getTopSpenders(state, range = 'thisMonth', customFrom = '', customTo = '') {
  const expenses = filterByRange(state.expenses || [], range, customFrom, customTo);
  const totals = state.roommates.map((roommate) => {
    const total = expenses
      .filter((expense) => expense.paidBy === roommate.id)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    return { roommate, total };
  });
  const totalRoomSpending = totals.reduce((sum, item) => sum + item.total, 0);
  return totals
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((item) => ({ ...item, percentage: totalRoomSpending > 0 ? (item.total / totalRoomSpending) * 100 : 0 }));
}

export function getTimeSeries(state, personId, range = 'thisMonth', customFrom = '', customTo = '', granularity = 'daily') {
  const expenses = [
    ...getPersonalExpensesByUser(state, personId, range, customFrom, customTo).map((item) => ({ ...item, kind: 'personal' })),
    ...getRoomExpensesPaidByUser(state, personId, range, customFrom, customTo).map((item) => ({ ...item, kind: 'room' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const dayMap = new Map();
  expenses.forEach((expense) => {
    const date = new Date(expense.date);
    if (granularity === 'weekly') {
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      const diffToMonday = (day === 0 ? -6 : 1 - day);
      weekStart.setDate(date.getDate() + diffToMonday);
      const key = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      dayMap.set(key, (dayMap.get(key) || 0) + Number(expense.amount || 0));
      return;
    }
    if (granularity === 'monthly') {
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      dayMap.set(key, (dayMap.get(key) || 0) + Number(expense.amount || 0));
      return;
    }
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    dayMap.set(key, (dayMap.get(key) || 0) + Number(expense.amount || 0));
  });

  return Array.from(dayMap.entries()).map(([key, value]) => ({ key, value }));
}

export function getPaymentMethodBreakdown(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  const personalExpenses = getPersonalExpensesByUser(state, userId, range, customFrom, customTo);
  return Object.entries(
    personalExpenses.reduce((map, expense) => {
      const method = expense.method || 'Not specified';
      map[method] = (map[method] || 0) + Number(expense.amount || 0);
      return map;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
}

export function getPersonalMonthlyReport(state, userId, referenceDate = new Date()) {
  const monthFilter = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const personalExpenses = (state.personalExpenses || []).filter(
    (expense) => expense.personId === userId && new Date(expense.date) >= monthFilter && new Date(expense.date) <= monthEnd
  );
  const roomExpenses = (state.expenses || []).filter(
    (expense) => expense.paidBy === userId && new Date(expense.date) >= monthFilter && new Date(expense.date) <= monthEnd
  );
  const totals = getCategoryTotals(personalExpenses);
  return {
    monthLabel: monthFilter.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    totalPersonalSpending: personalExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    roomExpensesPaid: roomExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    totalTransactions: personalExpenses.length + roomExpenses.length,
    categories: totals,
  };
}

export function comparePreviousPeriod(total, rangeKey, customFrom = '', customTo = '') {
  if (!total && total !== 0) return null;
  if (customFrom || customTo) return null;
  const now = new Date();
  const { start: currentStart, end: currentEnd } = normalizeRange(rangeKey, '', '');
  const currentSpan = Math.max(1, currentEnd - currentStart);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(currentStart.getTime() - currentSpan);
  const previousRange = previousStart > new Date(0) ? previousStart : new Date(0);
  return { current: total, previousRange, previousEnd };
}

export function getPreviousPeriodItems(items, rangeKey = 'thisMonth', customFrom = '', customTo = '') {
  if (customFrom || customTo || !Array.isArray(items)) return [];
  const { start: currentStart, end: currentEnd } = normalizeRange(rangeKey);
  const currentSpan = Math.max(1, currentEnd.getTime() - currentStart.getTime());
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(Math.max(0, currentStart.getTime() - currentSpan));
  return items.filter((item) => {
    const date = toDateOnly(item.date);
    return date && date >= previousStart && date <= previousEnd;
  });
}

export function getPeriodComparison(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  if (customFrom || customTo) return null;
  const current = getPersonalOverview(state, userId, range);
  const personalPrevious = getPreviousPeriodItems(
    (state.personalExpenses || []).filter((expense) => expense.personId === userId),
    range
  );
  const roomPrevious = getPreviousPeriodItems(
    (state.expenses || []).filter((expense) => expense.paidBy === userId),
    range
  );
  const previous = personalPrevious.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    + roomPrevious.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (personalPrevious.length === 0 && roomPrevious.length === 0) return null;
  return {
    current: current.totalOutflow,
    previous,
    change: previous > 0 ? ((current.totalOutflow - previous) / previous) * 100 : null,
  };
}

export function getBudgetStatus(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  const current = getPersonalOverview(state, userId, range, customFrom, customTo);
  const budget = Number(state.personalBudget?.amount || 0);
  const totalSpent = current.personalSpending;
  return {
    budget,
    used: totalSpent,
    remaining: Math.max(budget - totalSpent, 0),
    percentage: budget > 0 ? (totalSpent / budget) * 100 : 0,
    enabled: Boolean(state.personalBudget?.enabled),
    alertAt: Number(state.personalBudget?.alertAt || 75),
  };
}

export function getSpendingInsights(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  const personalExpenses = getPersonalExpensesByUser(state, userId, range, customFrom, customTo);
  const totalPersonal = personalExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const categoryTotals = getCategoryTotals(personalExpenses);
  const categoryLeader = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const highestExpense = personalExpenses.reduce((max, expense) => Math.max(max, Number(expense.amount || 0)), 0);
  const totalTransactions = personalExpenses.length;

  const insights = [];

  if (personalExpenses.length === 0) {
    return ['Not enough data to generate this insight.'];
  }

  const rangeDays = Math.max(1, (Math.max(...personalExpenses.map((item) => new Date(item.date).getTime())) - Math.min(...personalExpenses.map((item) => new Date(item.date).getTime()))) / 86400000 + 1);
  const averageDaily = totalPersonal / rangeDays;
  insights.push(`Your average daily spending is ₹${averageDaily.toFixed(0)}.`);

  if (categoryLeader) {
    insights.push(`${categoryLeader[0]} is your highest spending category.`);
  }

  if (highestExpense > 0) {
    insights.push(`Your highest single expense was ₹${highestExpense.toFixed(0)}.`);
  }

  if (totalTransactions > 0) {
    insights.push(`You made ${totalTransactions} transactions in this period.`);
  }

  if (totalPersonal > 0) {
    const allDates = personalExpenses.map((expense) => new Date(expense.date).getTime());
    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const windowDays = Math.max(1, (maxDate - minDate) / 86400000 + 1);
    const dailyAverage = totalPersonal / windowDays;
    insights.push(`Your average daily spending is ₹${dailyAverage.toFixed(0)}.`);
  }

  return insights;
}

export function buildPersonalCsv(state, userId, range = 'thisMonth', customFrom = '', customTo = '') {
  const rows = getPersonalExpensesByUser(state, userId, range, customFrom, customTo);
  const header = ['Date', 'Expense', 'Category', 'Amount', 'Payment Method', 'Type', 'Notes'];
  const csvRows = rows.map((entry) => [
    entry.date,
    entry.name || entry.description || '',
    entry.category || 'Other',
    Number(entry.amount || 0).toFixed(2),
    entry.method || 'Other',
    entry.isShared ? 'Shared' : 'Personal',
    entry.notes || '',
  ]);

  return [header, ...csvRows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function getRangeLabel(rangeKey = 'thisMonth', customFrom = '', customTo = '') {
  if (customFrom || customTo) {
    return `${customFrom || 'Start'} to ${customTo || 'End'}`;
  }
  const labels = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    last3Months: 'Last 3 Months',
    thisYear: 'This Year',
    allTime: 'All Time',
  };
  return labels[rangeKey] || 'This Month';
}

export function calculatePercentage(value, total) {
  if (!total) return 0;
  return (value / total) * 100;
}
