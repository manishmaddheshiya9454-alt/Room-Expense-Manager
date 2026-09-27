import { formatCurrency } from './utils.js';

export function getMonthlyReport(expenses, referenceDate = new Date()) {
  const reference = new Date(referenceDate);
  const total = expenses
    .filter((expense) => {
      const date = new Date(expense.date);
      return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
    })
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  return { total: Number(total.toFixed(2)) };
}

export function getRoommateReport(expenses, roommates) {
  const summary = roommates.map((roommate) => ({
    roommate,
    totalPaid: 0,
    totalOwed: 0,
  }));

  const roommateMap = summary.reduce((map, entry) => {
    map[entry.roommate.id] = entry;
    return map;
  }, {});

  expenses.forEach((expense) => {
    if (roommateMap[expense.paidBy]) {
      roommateMap[expense.paidBy].totalPaid += Number(expense.amount || 0);
    }
    if (expense.split && Array.isArray(expense.split.shares)) {
      expense.split.shares.forEach((share) => {
        if (roommateMap[share.roommateId]) {
          roommateMap[share.roommateId].totalOwed += Number(share.amount || 0);
        }
      });
    }
  });

  const topContributor = summary.reduce((best, entry) =>
    entry.totalPaid > best.totalPaid ? entry : best,
    { roommate: null, totalPaid: 0, totalOwed: 0 }
  );

  return {
    topContributor: topContributor.roommate ? `${topContributor.roommate.name} (${formatCurrency(topContributor.totalPaid)})` : '—',
    breakdown: summary,
  };
}

export function getCategoryReport(expenses) {
  const categories = {};
  expenses.forEach((expense) => {
    categories[expense.category] = (categories[expense.category] || 0) + Number(expense.amount || 0);
  });
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  return {
    categories,
    topCategory: topCategory ? `${topCategory[0]} (${formatCurrency(topCategory[1])})` : '—',
  };
}

export function buildCsv(expenses, roommates, currency) {
  const header = ['Date', 'Description', 'Category', 'Amount', 'Paid By', 'Split Details', 'Method', 'Notes'];
  const rows = expenses.map((expense) => {
    const payer = roommates.find((roommate) => roommate.id === expense.paidBy)?.name ?? 'Unknown';
    const splitText = expense.split?.shares
      .map((share) => {
        const name = roommates.find((roommate) => roommate.id === share.roommateId)?.name ?? 'Unknown';
        return `${name}: ${currency}${Number(share.amount).toFixed(2)}`;
      })
      .join(' | ');
    return [expense.date, expense.description, expense.category, `${currency}${Number(expense.amount).toFixed(2)}`, payer, splitText, expense.method, expense.notes];
  });
  return [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
}
