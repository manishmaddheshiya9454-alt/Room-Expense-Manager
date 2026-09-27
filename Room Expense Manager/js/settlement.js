export function calculateBalances(expenses, roommates) {
  const results = roommates.reduce((map, roommate) => {
    map[roommate.id] = { roommate, paid: 0, owed: 0, net: 0 };
    return map;
  }, {});

  expenses.forEach((expense) => {
    const amount = Number(expense.amount) || 0;
    if (results[expense.paidBy]) {
      results[expense.paidBy].paid += amount;
    }
    if (expense.split && Array.isArray(expense.split.shares)) {
      expense.split.shares.forEach((share) => {
        if (results[share.roommateId]) {
          results[share.roommateId].owed += Number(share.amount) || 0;
        }
      });
    }
  });

  Object.values(results).forEach((entry) => {
    entry.net = Number((entry.paid - entry.owed).toFixed(2));
  });

  return Object.values(results);
}

export function simplifyTransactions(balanceEntries) {
  const creditors = balanceEntries
    .filter((entry) => entry.net > 0)
    .map((entry) => ({ ...entry }))
    .sort((a, b) => b.net - a.net);
  const debtors = balanceEntries
    .filter((entry) => entry.net < 0)
    .map((entry) => ({ ...entry }))
    .sort((a, b) => a.net - b.net);

  const transactions = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.net, Math.abs(debtor.net));

    if (amount <= 0) break;

    transactions.push({
      from: debtor.roommate,
      to: creditor.roommate,
      amount: Number(amount.toFixed(2)),
    });

    creditor.net = Number((creditor.net - amount).toFixed(2));
    debtor.net = Number((debtor.net + amount).toFixed(2));

    if (creditor.net <= 0.01) creditorIndex += 1;
    if (debtor.net >= -0.01) debtorIndex += 1;
  }

  return transactions;
}

export function getPendingBalance(balanceEntries) {
  return balanceEntries.reduce((sum, entry) => sum + (entry.net < 0 ? Math.abs(entry.net) : 0), 0);
}
