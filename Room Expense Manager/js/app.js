import { loadState, normalizeState, saveState, resetState } from './storage.js';
import { categories, createExpense, filterExpenses, sortExpenses, getExpenseById, removeExpense, updateExpense, calculateSplit, validateSplit } from './expense.js';
import { createRoommate, removeRoommate, updateRoommate, getRoommateDropdownOptions, findRoommate } from './roommate.js';
import { calculateBalances, simplifyTransactions, getPendingBalance } from './settlement.js';
import { getMonthlyReport, getRoommateReport, getCategoryReport, buildCsv } from './report.js';
import { createId, formatCurrency, formatDate, getInitials } from './utils.js';
import { createDoughnutChart, createLineChart, createBarChart } from './chart.js';
import {
  personalExpenseCategories,
  getCurrentUserId,
  getPersonalOverview,
  getRoomMemberBreakdown,
  getTopSpenders,
  getTimeSeries,
  getCategoryTotals,
  getSpendingInsights,
  getBudgetStatus,
  getPersonalMonthlyReport,
  getPersonDetail,
  getPaymentMethodBreakdown,
  getPeriodComparison,
  getPersonalTransactions,
  getRangeLabel,
} from './personal.js';

const state = loadState();
let reportPieChart = null;
let reportBarChart = null;
let personalTrendChart = null;
let personalCategoryChart = null;
let editExpenseId = null;
const pageSize = 6;
let currentHistoryPage = 1;
let personalTrackerRange = 'thisMonth';
const descriptionOptions = ['Breakfast', 'Lunch', 'Dinner', 'Groceries', 'Rent', 'Electricity bill', 'Water bill', 'Internet bill', 'Gas', 'Travel', 'Medicine', 'Entertainment', 'Other'];
let activeFeature = 'room';

const featureConfigs = {
  room: {
    title: 'Room profile', description: 'Keep the shared home details and joining information in one place.', collection: null, addLabel: 'Edit room',
    fields: [
      ['name', 'Room name', 'text'], ['number', 'Room number', 'text'], ['hostel', 'Hostel or apartment', 'text'],
      ['address', 'Address', 'text', true], ['maxMembers', 'Maximum members', 'number'], ['monthlyRent', 'Monthly rent', 'number'], ['description', 'Description', 'textarea', true],
    ],
  },
  recurringExpenses: { title: 'Recurring bills', description: 'Track rent, WiFi, utilities, and other scheduled charges.', collection: 'recurringExpenses', fields: [['title', 'Bill title', 'text'], ['amount', 'Amount', 'number'], ['category', 'Category', 'select', false, categories.map((item) => [item.id, item.label])], ['paidBy', 'Paid by', 'select', false, 'roommates'], ['frequency', 'Frequency', 'select', false, [['Weekly', 'Weekly'], ['Monthly', 'Monthly'], ['Custom', 'Custom']]], ['nextDate', 'Next due date', 'date']] },
  meals: { title: 'Meal tracker', description: 'Record who ate each meal and understand shared mess costs.', collection: 'meals', fields: [['date', 'Date', 'date'], ['memberId', 'Roommate', 'select', false, 'roommates'], ['mealType', 'Meal type', 'select', false, [['Breakfast', 'Breakfast'], ['Lunch', 'Lunch'], ['Dinner', 'Dinner'], ['Snacks', 'Snacks']]], ['ate', 'Attendance', 'select', false, [['true', 'Ate'], ['false', "Didn't eat"]]]] },
  shoppingItems: { title: 'Shared shopping list', description: 'Keep household purchases visible and mark them complete.', collection: 'shoppingItems', fields: [['item', 'Item', 'text'], ['quantity', 'Quantity', 'text'], ['estimatedPrice', 'Estimated price', 'number'], ['priority', 'Priority', 'select', false, [['Normal', 'Normal'], ['High', 'High']]], ['status', 'Status', 'select', false, [['Pending', 'Pending'], ['Purchased', 'Purchased']]]] },
  chores: { title: 'Chores', description: 'Assign household work, due dates, and completion status.', collection: 'chores', fields: [['title', 'Chore', 'text'], ['assignedTo', 'Assigned to', 'select', false, 'roommates'], ['dueDate', 'Due date', 'date'], ['priority', 'Priority', 'select', false, [['Normal', 'Normal'], ['High', 'High']]], ['status', 'Status', 'select', false, [['Pending', 'Pending'], ['In Progress', 'In Progress'], ['Completed', 'Completed']]]] },
  deposits: { title: 'Security deposits', description: 'Track each member’s deposit, outstanding amount, and refund.', collection: 'deposits', fields: [['memberId', 'Member', 'select', false, 'roommates'], ['amount', 'Deposit amount', 'number'], ['paidAmount', 'Paid amount', 'number'], ['paymentDate', 'Payment date', 'date'], ['refundStatus', 'Refund status', 'select', false, [['Not due', 'Not due'], ['Pending', 'Pending'], ['Refunded', 'Refunded']]]] },
  inventory: { title: 'Room inventory', description: 'Record shared items, condition, ownership, and repair notes.', collection: 'inventory', fields: [['item', 'Item name', 'text'], ['quantity', 'Quantity', 'number'], ['condition', 'Condition', 'select', false, [['New', 'New'], ['Good', 'Good'], ['Damaged', 'Damaged'], ['Needs repair', 'Needs repair']]], ['assignedTo', 'Assigned member', 'select', false, 'roommates'], ['notes', 'Notes', 'textarea', true]] },
  maintenanceRequests: { title: 'Maintenance', description: 'Log room issues and move them from pending to resolved.', collection: 'maintenanceRequests', fields: [['title', 'Issue title', 'text'], ['description', 'Description', 'textarea', true], ['priority', 'Priority', 'select', false, [['Normal', 'Normal'], ['High', 'High'], ['Urgent', 'Urgent']]], ['status', 'Status', 'select', false, [['Pending', 'Pending'], ['In Progress', 'In Progress'], ['Resolved', 'Resolved']]]] },
  notifications: { title: 'Notifications', description: 'A local activity inbox for reminders and room updates.', collection: 'notifications', addLabel: '', fields: [] },
};

const views = {
  dashboard: document.getElementById('dashboardView'),
  personal: document.getElementById('personalView'),
  expense: document.getElementById('expenseView'),
  history: document.getElementById('historyView'),
  roommates: document.getElementById('roommatesView'),
  reports: document.getElementById('reportsView'),
  settlements: document.getElementById('settlementsView'),
  budget: document.getElementById('budgetView'),
  feature: document.getElementById('featureView'),
  settings: document.getElementById('settingsView'),
};

const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.querySelector('.sidebar');
const viewTitle = document.getElementById('viewTitle');
const toastContainer = document.getElementById('toastContainer');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalFooter = document.getElementById('modalFooter');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const globalSearch = document.getElementById('globalSearch');
const quickAddBtn = document.getElementById('quickAddBtn');
const historySearch = document.getElementById('historySearch');
const historyFilterCategory = document.getElementById('historyFilterCategory');
const historyFilterRoommate = document.getElementById('historyFilterRoommate');
const historyFilterMethod = document.getElementById('historyFilterMethod');
const historySort = document.getElementById('historySort');
const historyTableBody = document.getElementById('historyTableBody');
const historyPagination = document.getElementById('historyPagination');
const expenseForm = document.getElementById('expenseForm');
const expenseAmount = document.getElementById('expenseAmount');
const expenseCategory = document.getElementById('expenseCategory');
const expenseDescription = document.getElementById('expenseDescription');
const expenseDate = document.getElementById('expenseDate');
const expensePaidBy = document.getElementById('expensePaidBy');
const expenseMethod = document.getElementById('expenseMethod');
const expenseNotes = document.getElementById('expenseNotes');
const splitRoommates = document.getElementById('splitRoommates');
const splitTypeContainer = document.getElementById('splitTypeContainer');
const splitDetails = document.getElementById('splitDetails');
const budgetAmount = document.getElementById('budgetAmount');
const budgetNotes = document.getElementById('budgetNotes');
const budgetSaveBtn = document.getElementById('budgetSaveBtn');
const roommateList = document.getElementById('roommateList');
const addRoommateBtn = document.getElementById('addRoommateBtn');
const historyFilterForm = { category: historyFilterCategory, roommate: historyFilterRoommate, method: historyFilterMethod, search: historySearch, sort: historySort };
const budgetValue = document.getElementById('budgetValue');
const budgetStatus = document.getElementById('budgetStatus');
const budgetProgress = document.getElementById('budgetProgress');
const budgetRemaining = document.getElementById('budgetRemaining');
const statMonthly = document.getElementById('statMonthly');
const statPaid = document.getElementById('statPaid');
const statPending = document.getElementById('statPending');
const statRoommates = document.getElementById('statRoommates');
const summaryTransactions = document.getElementById('summaryTransactions');
const activityTimeline = document.getElementById('activityTimeline');
const activityFilterType = document.getElementById('activityFilterType');
const activityFilterDate = document.getElementById('activityFilterDate');
const dashboardRecurringList = document.getElementById('dashboardRecurringList');
const settlementHistoryList = document.getElementById('settlementHistoryList');
const settlementFilterStatus = document.getElementById('settlementFilterStatus');
const settlementFilterPerson = document.getElementById('settlementFilterPerson');
const personalSpendingValue = document.getElementById('personalSpendingValue');
const personalRoomPaidValue = document.getElementById('personalRoomPaidValue');
const personalMyExpensesValue = document.getElementById('personalMyExpensesValue');
const personalIOweValue = document.getElementById('personalIOweValue');
const personalIReceiveValue = document.getElementById('personalIReceiveValue');
const personalMemberBreakdown = document.getElementById('personalMemberBreakdown');
const personalTopSpenders = document.getElementById('personalTopSpenders');
const personalInsights = document.getElementById('personalInsights');
const personalRecentList = document.getElementById('personalRecentList');
const personalCategoryList = document.getElementById('personalCategoryList');
const personalPaymentList = document.getElementById('personalPaymentList');
const personalTransactionList = document.getElementById('personalTransactionList');
const personalTransactionSearch = document.getElementById('personalTransactionSearch');
const personalTransactionCategory = document.getElementById('personalTransactionCategory');
const personalTransactionMethod = document.getElementById('personalTransactionMethod');
const personalTransactionType = document.getElementById('personalTransactionType');
const personalComparisonTitle = document.getElementById('personalComparisonTitle');
const personalComparisonChange = document.getElementById('personalComparisonChange');
const personalComparisonCurrent = document.getElementById('personalComparisonCurrent');
const personalComparisonPrevious = document.getElementById('personalComparisonPrevious');
const personalMoneyPersonal = document.getElementById('personalMoneyPersonal');
const personalMoneyRoom = document.getElementById('personalMoneyRoom');
const personalMoneyTotal = document.getElementById('personalMoneyTotal');
const personalMoneyPersonalBar = document.getElementById('personalMoneyPersonalBar');
const personalMoneyRoomBar = document.getElementById('personalMoneyRoomBar');
const personalBudgetProgress = document.getElementById('personalBudgetProgress');
const personalBudgetUsed = document.getElementById('personalBudgetUsed');
const personalBudgetLimit = document.getElementById('personalBudgetLimit');
const personalBudgetPercent = document.getElementById('personalBudgetPercent');
const personalBudgetAmount = document.getElementById('personalBudgetAmount');
const personalBudgetAlert = document.getElementById('personalBudgetAlert');
const personalFromDate = document.getElementById('personalFromDate');
const personalToDate = document.getElementById('personalToDate');
const reportMonthlyTotal = document.getElementById('reportMonthlyTotal');
const reportTopContributor = document.getElementById('reportTopContributor');
const reportTopCategory = document.getElementById('reportTopCategory');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const printReportBtn = document.getElementById('printReportBtn');
const themeModeToggle = document.getElementById('themeMode');
const currencySelect = document.getElementById('currencySelect');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const resetDataBtn = document.getElementById('resetDataBtn');
const shareSettlementBtn = document.getElementById('shareSettlementBtn');
const featureEyebrow = document.getElementById('featureEyebrow');
const featureTitle = document.getElementById('featureTitle');
const featureDescription = document.getElementById('featureDescription');
const featureAddBtn = document.getElementById('featureAddBtn');
const featureStats = document.getElementById('featureStats');
const featureFormWrap = document.getElementById('featureFormWrap');
const featureForm = document.getElementById('featureForm');
const featureList = document.getElementById('featureList');

const reportPieChartElement = document.getElementById('reportPieChart').getContext('2d');
const reportBarChartElement = document.getElementById('reportBarChart').getContext('2d');
const personalTrendChartElement = document.getElementById('personalTrendChart').getContext('2d');
const personalCategoryChartElement = document.getElementById('personalCategoryChart').getContext('2d');

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function openView(viewName) {
  Object.values(views).forEach((view) => view.classList.add('hidden'));
  const view = views[viewName];
  if (view) {
    view.classList.remove('hidden');
  }
  navLinks.forEach((link) => link.classList.toggle('active', link.dataset.view === viewName));
  viewTitle.textContent = viewName === 'feature' ? (featureConfigs[activeFeature]?.title || 'Workspace') : viewName.charAt(0).toUpperCase() + viewName.slice(1);
  if (window.innerWidth < 860) {
    sidebar.classList.remove('open');
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function recordActivity(type, text, visibility = 'room') {
  state.activities = [...(state.activities || []), { id: createId(), type, text, visibility, date: new Date().toISOString(), createdAt: new Date().toISOString() }].slice(-100);
}

function advanceRecurringDate(value, frequency) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (frequency === 'Weekly') date.setDate(date.getDate() + 7);
  else if (frequency === 'Monthly') date.setMonth(date.getMonth() + 1);
  else date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function generateDueRecurringExpenses() {
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  state.recurringExpenses = (state.recurringExpenses || []).map((bill) => {
    if ((bill.status || 'active') !== 'active' || !bill.nextDate || bill.nextDate > today) return bill;
    const alreadyGenerated = state.expenses.some((expense) => expense.recurringExpenseId === bill.id && expense.occurrenceDate === bill.nextDate);
    const nextDate = advanceRecurringDate(bill.nextDate, bill.frequency);
    if (!alreadyGenerated) {
      const paidBy = bill.paidBy || getCurrentUserId(state);
      const memberIds = state.roommates.map((member) => member.id);
      const split = calculateSplit(bill.amount, 'equal', memberIds);
      const generated = createExpense({ amount: bill.amount, category: bill.category || 'Other', description: bill.title || 'Recurring bill', date: bill.nextDate, paidBy, method: 'Other', notes: `Generated from recurring bill ${bill.title || ''}`.trim(), split });
      state.expenses = [...state.expenses, { ...generated, recurringExpenseId: bill.id, occurrenceDate: bill.nextDate }];
      recordActivity('recurring', `${bill.title || 'Recurring bill'} was generated — ${formatCurrency(bill.amount, state.settings.currency)}`);
      changed = true;
    }
    return { ...bill, lastGeneratedDate: bill.nextDate, nextDate };
  });
  if (changed || state.recurringExpenses.some((bill) => bill.lastGeneratedDate)) saveCurrentState();
}

function featureRecords(config) {
  return config.collection ? state[config.collection] : [state.room];
}

function featureFieldMarkup(field, record = {}) {
  const [key, label, type, fullWidth = false, options = []] = field;
  const value = record[key] ?? '';
  const className = fullWidth || type === 'textarea' ? 'input-group full-width' : 'input-group';
  if (type === 'select') {
    const values = options === 'roommates' ? state.roommates.map((member) => [member.id, member.name]) : options;
    return `<div class="${className}"><label for="feature-${key}">${label}</label><select id="feature-${key}" name="${key}" required>${values.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? 'selected' : ''}>${escapeHtml(optionLabel)}</option>`).join('')}</select></div>`;
  }
  if (type === 'textarea') {
    return `<div class="${className}"><label for="feature-${key}">${label}</label><textarea id="feature-${key}" name="${key}" rows="3" ${key === 'description' ? '' : ''}>${escapeHtml(value)}</textarea></div>`;
  }
  return `<div class="${className}"><label for="feature-${key}">${label}</label><input id="feature-${key}" name="${key}" type="${type}" value="${escapeHtml(value)}" ${type === 'number' ? 'min="0" step="0.01"' : ''} required /></div>`;
}

function renderFeatureForm(record = {}) {
  const config = featureConfigs[activeFeature];
  featureForm.innerHTML = config.fields.map((field) => featureFieldMarkup(field, record)).join('') + `<div class="form-actions full-width"><button class="button button-primary" type="submit">Save ${config.title.toLowerCase()}</button><button class="button button-secondary" id="featureCancelBtn" type="button">Cancel</button></div>`;
  featureForm.dataset.editId = record.id || '';
  featureFormWrap.classList.remove('hidden');
  document.getElementById('featureCancelBtn').addEventListener('click', () => featureFormWrap.classList.add('hidden'));
}

function featureSummary(config, records) {
  if (activeFeature === 'meals') {
    const eaten = records.filter((record) => record.ate === true || record.ate === 'true').length;
    return `<span class="chip">${eaten} meals recorded</span>`;
  }
  if (activeFeature === 'shoppingItems') {
    return `<span class="chip">${records.filter((record) => record.status !== 'Purchased').length} pending</span>`;
  }
  if (activeFeature === 'maintenanceRequests') {
    return `<span class="chip">${records.filter((record) => record.status !== 'Resolved').length} open requests</span>`;
  }
  if (activeFeature === 'deposits') {
    const outstanding = records.reduce((sum, record) => sum + Math.max(0, Number(record.amount || 0) - Number(record.paidAmount || 0)), 0);
    return `<span class="chip">${formatCurrency(outstanding, state.settings.currency)} outstanding</span>`;
  }
  return `<span class="chip">${records.length} ${records.length === 1 ? 'record' : 'records'}</span>`;
}

function renderFeature() {
  const config = featureConfigs[activeFeature];
  const records = featureRecords(config);
  featureEyebrow.textContent = activeFeature === 'room' ? 'Shared home' : 'Hostel workspace';
  featureTitle.textContent = config.title;
  featureDescription.textContent = config.description;
  featureAddBtn.textContent = config.addLabel || 'Add item';
  featureAddBtn.classList.toggle('hidden', !config.addLabel && config.fields.length === 0);
  featureStats.innerHTML = featureSummary(config, records);
  featureFormWrap.classList.add('hidden');
  if (activeFeature === 'room') {
    featureList.innerHTML = `<div class="feature-card room-summary"><div><span class="eyebrow">Join code</span><strong>${escapeHtml(state.room.joinCode || 'Create a code in room settings')}</strong></div><p>${escapeHtml(state.room.address || 'Add an address to help roommates find the room.')}</p></div>`;
  } else if (records.length === 0) {
    const emptyMessage = activeFeature === 'notifications' ? 'Updates from your shared workspace will appear here.' : 'Add the first record to start building your shared workspace.';
    featureList.innerHTML = `<div class="empty-state"><strong>No ${config.title.toLowerCase()} yet</strong><p>${emptyMessage}</p></div>`;
  } else {
    featureList.innerHTML = records.map((record) => {
      const details = config.fields.slice(0, 3).map(([key, label]) => {
        let value = record[key];
        const member = state.roommates.find((roommate) => roommate.id === value);
        if (member) value = member.name;
        if (key === 'amount' || key === 'paidAmount' || key === 'estimatedPrice' || key === 'monthlyRent') value = formatCurrency(value, state.settings.currency);
        if (key === 'date' || key === 'nextDate' || key === 'dueDate' || key === 'paymentDate') value = formatDate(value);
        if (key === 'ate') value = value === true || value === 'true' ? 'Ate' : "Didn't eat";
        return `<span><small>${escapeHtml(label)}</small><b>${escapeHtml(value || '—')}</b></span>`;
      }).join('');
      const recurringAction = activeFeature === 'recurringExpenses' ? `<button class="button button-secondary" data-feature-action="toggle" data-id="${escapeHtml(record.id)}">${record.status === 'paused' ? 'Resume' : 'Pause'}</button>` : '';
      const status = activeFeature === 'recurringExpenses' ? `<span class="badge">${escapeHtml((record.status || 'active').toUpperCase())}</span>` : '';
      return `<article class="feature-card"><div class="feature-card-main"><div class="feature-details">${details}${status}</div><div class="action-buttons">${recurringAction}<button class="button button-secondary" data-feature-action="edit" data-id="${escapeHtml(record.id)}">Edit</button><button class="button button-danger" data-feature-action="delete" data-id="${escapeHtml(record.id)}">Delete</button></div></div></article>`;
    }).join('');
  }
}

function openFeature(featureName) {
  if (!featureConfigs[featureName]) return;
  activeFeature = featureName;
  openView('feature');
  renderFeature();
}

function handleFeatureSubmit(event) {
  event.preventDefault();
  const config = featureConfigs[activeFeature];
  const formData = new FormData(featureForm);
  const record = Object.fromEntries(formData.entries());
  config.fields.forEach(([key, , type]) => {
    if (type === 'number') record[key] = Number(record[key]) || 0;
    if (key === 'ate') record[key] = record[key] === 'true';
  });
  if (activeFeature === 'room') {
    state.room = { ...state.room, ...record, joinCode: state.room.joinCode || createId().slice(-6).toUpperCase() };
    saveCurrentState();
    featureFormWrap.classList.add('hidden');
    renderFeature();
    showToast('Room details saved.');
    return;
  }
  record.id = featureForm.dataset.editId || createId();
  if (activeFeature === 'recurringExpenses') {
    record.status = featureForm.dataset.editId ? (state.recurringExpenses.find((item) => item.id === record.id)?.status || 'active') : 'active';
    record.lastGeneratedDate = featureForm.dataset.editId ? (state.recurringExpenses.find((item) => item.id === record.id)?.lastGeneratedDate || null) : null;
  }
  record.createdAt = featureForm.dataset.editId ? (state[config.collection].find((item) => item.id === record.id)?.createdAt || new Date().toISOString()) : new Date().toISOString();
  state[config.collection] = featureForm.dataset.editId ? state[config.collection].map((item) => item.id === record.id ? { ...item, ...record } : item) : [...state[config.collection], record];
  saveCurrentState();
  if (activeFeature === 'recurringExpenses') recordActivity('recurring', `${record.title || 'Recurring bill'} was added or updated.`);
  featureFormWrap.classList.add('hidden');
  renderFeature();
  showToast(`${config.title} saved.`);
}

function buildCategoryOptions() {
  expenseCategory.innerHTML = categories
    .map((category) => `<option value="${category.id}">${category.icon} ${category.label}</option>`)
    .join('');

  historyFilterCategory.innerHTML = '<option value="">All categories</option>' + categories.map((category) => `<option value="${category.id}">${category.label}</option>`).join('');
}

function buildDescriptionOptions(selectedDescription = '') {
  const options = [...descriptionOptions];
  if (selectedDescription && !options.includes(selectedDescription)) {
    options.unshift(selectedDescription);
  }
  expenseDescription.innerHTML = '<option value="" disabled>Select description</option>' + options
    .map((description) => `<option value="${description}">${description}</option>`)
    .join('');
  expenseDescription.value = selectedDescription;
}

function renderRoommateDropdown() {
  expensePaidBy.innerHTML = getRoommateDropdownOptions(state.roommates);
  historyFilterRoommate.innerHTML = '<option value="">All roommates</option>' + state.roommates.map((roommate) => `<option value="${roommate.id}">${roommate.name}</option>`).join('');
}

function renderSplitControls() {
  splitRoommates.innerHTML = state.roommates
    .map(
      (roommate) => `
      <label class="split-toggle">
        <input type="checkbox" name="splitMember" value="${roommate.id}" checked />
        <span>${roommate.name}</span>
      </label>`
    )
    .join('');
  updateSplitDetails();
}

function updateSplitDetails() {
  const splitType = document.querySelector('input[name="splitType"]:checked')?.value || 'equal';
  const selectedRoommates = Array.from(document.querySelectorAll('input[name="splitMember"]:checked')).map((input) => input.value);
  const amount = Number(expenseAmount.value) || 0;

  if (splitType === 'custom') {
    splitDetails.innerHTML = selectedRoommates
      .map((roommateId) => {
        const roommate = state.roommates.find((member) => member.id === roommateId);
        return `
          <label class="input-group">
            <span>${roommate?.name || 'Roommate'}</span>
            <input type="number" name="customSplit_${roommateId}" min="0" step="0.01" placeholder="0.00" />
          </label>`;
      })
      .join('');
  } else if (splitType === 'percentage') {
    splitDetails.innerHTML = selectedRoommates
      .map((roommateId) => {
        const roommate = state.roommates.find((member) => member.id === roommateId);
        return `
          <label class="input-group">
            <span>${roommate?.name || 'Roommate'}</span>
            <input type="number" name="percentageSplit_${roommateId}" min="0" max="100" step="0.01" placeholder="0" />
          </label>`;
      })
      .join('');
  } else {
    splitDetails.innerHTML = `<p class="card-copy">Expense will be split equally among selected roommates.</p>`;
  }
}

function resetExpenseForm() {
  expenseForm.reset();
  if (!expenseDate.value) {
    expenseDate.value = new Date().toISOString().slice(0, 10);
  }
  editExpenseId = null;
  updateSplitDetails();
}

function buildSplitPayload() {
  const splitType = document.querySelector('input[name="splitType"]:checked')?.value || 'equal';
  const selectedRoommates = Array.from(document.querySelectorAll('input[name="splitMember"]:checked')).map((input) => input.value);
  const customValues = {};
  const percentageValues = {};

  if (splitType === 'custom') {
    selectedRoommates.forEach((roommateId) => {
      const field = expenseForm.querySelector(`[name="customSplit_${roommateId}"]`);
      customValues[roommateId] = Number(field?.value) || 0;
    });
  }

  if (splitType === 'percentage') {
    selectedRoommates.forEach((roommateId) => {
      const field = expenseForm.querySelector(`[name="percentageSplit_${roommateId}"]`);
      percentageValues[roommateId] = Number(field?.value) || 0;
    });
  }

  return calculateSplit(expenseAmount.value, splitType, selectedRoommates, customValues, percentageValues);
}

function renderHistory() {
  const filters = {
    search: historySearch.value,
    category: historyFilterCategory.value,
    roommate: historyFilterRoommate.value,
    method: historyFilterMethod.value,
  };
  const filtered = filterExpenses(state.expenses, filters);
  const sorted = sortExpenses(filtered, historySort.value || 'newest');
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  currentHistoryPage = Math.min(currentHistoryPage, pageCount);
  const pageItems = sorted.slice((currentHistoryPage - 1) * pageSize, currentHistoryPage * pageSize);

  historyTableBody.innerHTML = pageItems
    .map((expense) => {
      const roommate = state.roommates.find((member) => member.id === expense.paidBy);
      const splitText = expense.split?.type === 'equal' ? 'Equal' : expense.split?.type === 'custom' ? 'Custom' : 'Percentage';
      return `
        <tr>
          <td>${formatDate(expense.date)}</td>
          <td>${expense.description}</td>
          <td>${expense.category}</td>
          <td>${formatCurrency(expense.amount, state.settings.currency)}</td>
          <td>${roommate?.name || 'Unknown'}</td>
          <td>${splitText}</td>
          <td>
            <div class="action-buttons">
              <button class="button button-secondary" data-entity="expense" data-action="view" data-id="${expense.id}">View</button>
              <button class="button button-secondary" data-entity="expense" data-action="edit" data-id="${expense.id}">Edit</button>
              <button class="button button-danger" data-entity="expense" data-action="delete" data-id="${expense.id}">Delete</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');

  historyPagination.innerHTML = Array.from({ length: pageCount }, (_, index) => `
    <button class="button button-secondary ${currentHistoryPage === index + 1 ? 'active' : ''}" data-page="${index + 1}">${index + 1}</button>
  `).join('');
}

function renderRoommates() {
  roommateList.innerHTML = state.roommates
    .map(
      (roommate) => `
      <div class="roommate-card">
        <div class="avatar" style="background:${roommate.color}">${getInitials(roommate.name)}</div>
        <div>
          <h3>${roommate.name}</h3>
          <p class="badge">Joined ${new Date(roommate.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="action-buttons">
          <button class="button button-secondary" data-entity="roommate" data-action="edit" data-id="${roommate.id}">Edit</button>
          <button class="button button-danger" data-entity="roommate" data-action="delete" data-id="${roommate.id}">Delete</button>
        </div>
      </div>`
    )
    .join('');
}

function renderDashboard() {
  const balances = calculateBalances(state.expenses, state.roommates);
  const transactions = simplifyTransactions(balances);
  const pending = getPendingBalance(balances);
  const monthlyReport = getMonthlyReport(state.expenses);
  const paidTotal = state.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  statMonthly.textContent = formatCurrency(monthlyReport.total, state.settings.currency);
  statPaid.textContent = formatCurrency(paidTotal, state.settings.currency);
  statPending.textContent = formatCurrency(pending, state.settings.currency);
  statRoommates.textContent = `${state.roommates.length}`;

  const budgetTotal = Number(state.budget.amount || 0);
  budgetValue.textContent = formatCurrency(budgetTotal, state.settings.currency);
  const remaining = budgetTotal - monthlyReport.total;
  budgetRemaining.textContent = formatCurrency(Math.max(remaining, 0), state.settings.currency);
  const percent = budgetTotal > 0 ? Math.min(100, (monthlyReport.total / budgetTotal) * 100) : 0;
  budgetProgress.style.width = `${percent}%`;
  budgetStatus.textContent = remaining < 0 ? 'Exceeded' : 'On track';
  budgetStatus.className = 'chip';
  if (remaining < 0) {
    budgetStatus.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    budgetStatus.style.color = '#b91c1c';
  } else {
    budgetStatus.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
    budgetStatus.style.color = 'var(--primary)';
  }

  summaryTransactions.innerHTML = transactions
    .slice(0, 4)
    .map(
      (tx) => `
      <div class="small-list-item">
        <strong>${tx.from.name}</strong> pays <strong>${tx.to.name}</strong>
        <p>${formatCurrency(tx.amount, state.settings.currency)}</p>
      </div>`
    )
    .join('');

  const expenseActivities = state.expenses.slice(-6).map((expense) => ({ date: expense.createdAt || expense.date, text: `${findRoommate(state.roommates, expense.paidBy)?.name || 'Someone'} added ${expense.description || 'an expense'} — ${formatCurrency(expense.amount, state.settings.currency)}`, type: 'expense' }));
  const activities = [...expenseActivities, ...(state.activities || []).filter((item) => item.visibility !== 'private')].filter((item) => (!activityFilterType.value || item.type === activityFilterType.value) && (!activityFilterDate.value || String(item.date).slice(0, 10) === activityFilterDate.value)).sort((a, b) => new Date(b.date) - new Date(a.date));
  activityTimeline.innerHTML = activities.slice(0, 6).map((item) => `
      <div class="timeline-card">
        <time>${formatDate(item.date)}</time>
        <p>${escapeHtml(item.text)}</p>
      </div>`
    ).join('') || '<div class="small-list-item"><p>No room activity yet.</p></div>';

  dashboardRecurringList.innerHTML = (state.recurringExpenses || []).filter((bill) => (bill.status || 'active') === 'active').sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate)).slice(0, 4).map((bill) => `<div class="small-list-item"><strong>${escapeHtml(bill.title || 'Recurring bill')}</strong><p>${formatCurrency(bill.amount, state.settings.currency)} · Due ${formatDate(bill.nextDate)}</p></div>`).join('') || '<div class="small-list-item"><p>No upcoming bills.</p></div>';

  renderDashboardCharts();
}

function renderSettlementHistory() {
  settlementFilterPerson.innerHTML = '<option value="">All people</option>' + state.roommates.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`).join('');
  const status = settlementFilterStatus.value;
  const person = settlementFilterPerson.value;
  const rows = (state.settlements || []).filter((item) => (!status || item.status === status) && (!person || item.fromUserId === person || item.toUserId === person)).sort((a, b) => new Date(b.date) - new Date(a.date));
  settlementHistoryList.innerHTML = rows.map((item) => `<button class="settlement-list-item settlement-history-item" data-settlement-id="${escapeHtml(item.id)}" type="button"><div><strong>${escapeHtml(findRoommate(state.roommates, item.fromUserId)?.name || 'Unknown')}</strong> → <strong>${escapeHtml(findRoommate(state.roommates, item.toUserId)?.name || 'Unknown')}</strong><p>${formatDate(item.date)} · ${escapeHtml(item.paymentMethod || 'Not specified')}</p></div><div><strong>${formatCurrency(item.amount, state.settings.currency)}</strong><span class="badge">${escapeHtml(item.status)}</span></div></button>`).join('') || '<div class="small-list-item"><p>No recorded settlements.</p></div>';
}

function openAddSettlementModal() {
  const form = document.createElement('form');
  form.id = `settlement-form-${Date.now()}`;
  form.className = 'form-grid';
  form.innerHTML = `<div class="input-group"><label>From</label><select name="fromUserId" required>${state.roommates.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`).join('')}</select></div><div class="input-group"><label>To</label><select name="toUserId" required>${state.roommates.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`).join('')}</select></div><div class="input-group"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div><div class="input-group"><label>Date</label><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></div><div class="input-group"><label>Payment method</label><select name="paymentMethod"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Other</option></select></div><div class="input-group full-width"><label>Note</label><textarea name="note" rows="2"></textarea></div>`;
  const cancel = document.createElement('button'); cancel.className = 'button button-secondary'; cancel.textContent = 'Cancel'; cancel.type = 'button'; cancel.addEventListener('click', closeModal);
  const save = document.createElement('button'); save.className = 'button button-primary'; save.textContent = 'Save settlement'; save.type = 'submit'; save.setAttribute('form', form.id);
  form.addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); if (data.fromUserId === data.toUserId || Number(data.amount) <= 0 || Number.isNaN(new Date(data.date).getTime())) { showToast('Choose two people and a valid amount and date.'); return; } state.settlements = [...state.settlements, { id: createId(), roomId: state.room.joinCode || 'room', fromUserId: data.fromUserId, toUserId: data.toUserId, amount: Number(data.amount), date: data.date, paymentMethod: data.paymentMethod, transactionId: createId(), note: data.note.trim(), status: 'Pending', createdAt: new Date().toISOString() }]; recordActivity('settlement', `${findRoommate(state.roommates, data.fromUserId)?.name || 'Someone'} recorded a settlement with ${findRoommate(state.roommates, data.toUserId)?.name || 'a roommate'}`); saveCurrentState(); renderSettlementHistory(); renderDashboard(); closeModal(); showToast('Settlement recorded.'); });
  openModal('Add settlement', form, [cancel, save]);
}

function renderPersonalTracker() {
  const userId = getCurrentUserId(state);
  const overview = getPersonalOverview(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value);
  personalSpendingValue.textContent = formatCurrency(overview.personalSpending + overview.roomSpendingPaidByMe, state.settings.currency);
  personalRoomPaidValue.textContent = formatCurrency(overview.roomSpendingPaidByMe, state.settings.currency);
  personalMyExpensesValue.textContent = formatCurrency(overview.myPersonalExpenses, state.settings.currency);
  personalIOweValue.textContent = formatCurrency(overview.iOwe, state.settings.currency);
  personalIReceiveValue.textContent = formatCurrency(overview.iWillReceive, state.settings.currency);
  personalMoneyPersonal.textContent = formatCurrency(overview.personalSpending, state.settings.currency);
  personalMoneyRoom.textContent = formatCurrency(overview.roomSpendingPaidByMe, state.settings.currency);
  personalMoneyTotal.textContent = formatCurrency(overview.totalOutflow, state.settings.currency);
  const moneyTotal = overview.totalOutflow || 1;
  personalMoneyPersonalBar.style.width = `${(overview.personalSpending / moneyTotal) * 100}%`;
  personalMoneyRoomBar.style.width = `${(overview.roomSpendingPaidByMe / moneyTotal) * 100}%`;

  const comparison = getPeriodComparison(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value);
  personalComparisonTitle.textContent = `${getRangeLabel(personalTrackerRange, personalFromDate.value, personalToDate.value)} vs previous period`;
  personalComparisonCurrent.textContent = formatCurrency(overview.totalOutflow, state.settings.currency);
  if (!comparison) {
    personalComparisonPrevious.textContent = 'Not enough data';
    personalComparisonChange.textContent = '—';
  } else {
    personalComparisonPrevious.textContent = formatCurrency(comparison.previous, state.settings.currency);
    personalComparisonChange.textContent = comparison.change === null ? 'New spending' : `${comparison.change >= 0 ? '+' : ''}${comparison.change.toFixed(2)}%`;
    personalComparisonChange.style.color = comparison.change > 0 ? 'var(--danger)' : 'var(--success)';
  }

  const breakdown = getRoomMemberBreakdown(state, personalTrackerRange, personalFromDate.value, personalToDate.value);
  const topSpenders = getTopSpenders(state, personalTrackerRange, personalFromDate.value, personalToDate.value);
  const categoryData = getCategoryTotals((state.personalExpenses || []).filter((expense) => expense.personId === userId));
  const totalCategory = Object.values(categoryData).reduce((sum, value) => sum + Number(value || 0), 0);

  personalMemberBreakdown.innerHTML = breakdown
    .slice(0, 6)
    .map((entry) => `
      <button class="personal-list-item personal-member" data-member-id="${escapeHtml(entry.roommate.id)}" type="button">
        <div class="meta">
          <strong>${entry.roommate.name}</strong>
          <small>${entry.transactionCount} expenses</small>
        </div>
        <div>
          <strong>${formatCurrency(entry.totalSpent, state.settings.currency)}</strong>
        </div>
      </button>
    `)
    .join('') || '<div class="small-list-item"><p>No spending in this range.</p></div>';

  personalTopSpenders.innerHTML = topSpenders
    .slice(0, 5)
    .map((entry, index) => `
      <div class="personal-list-item">
        <div class="meta">
          <strong>${index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : `#${index + 1}`} ${entry.roommate.name}</strong>
          <small>${Math.round(entry.percentage)}% of room spending</small>
        </div>
        <div>
          <strong>${formatCurrency(entry.total, state.settings.currency)}</strong>
        </div>
      </div>
    `)
    .join('') || '<div class="small-list-item"><p>No top spenders yet.</p></div>';

  personalTransactionCategory.innerHTML = '<option value="">All categories</option>' + Object.keys(categoryData).sort().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  personalCategoryList.innerHTML = Object.entries(categoryData)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => `
      <button class="personal-list-item personal-category-filter" data-category="${escapeHtml(category)}" type="button">
        <div class="meta">
          <strong>${category}</strong>
          <small>${totalCategory > 0 ? `${Math.round((value / totalCategory) * 100)}%` : '0%'} of personal spending</small>
        </div>
        <div>
          <strong>${formatCurrency(value, state.settings.currency)}</strong>
        </div>
      </button>
    `)
    .join('') || '<div class="small-list-item"><p>No category totals yet.</p></div>';

  const personalExpenses = getPersonalTransactions(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value)
    .filter((expense) => expense.kind === 'personal');
  const recent = [...personalExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  personalRecentList.innerHTML = recent
    .map((expense) => `
      <div class="personal-list-item">
        <div class="meta">
          <strong>${expense.name || expense.description || 'Expense'}</strong>
          <small>${formatDate(expense.date)} · ${expense.category}</small>
        </div>
        <div>
          <strong>${formatCurrency(expense.amount, state.settings.currency)}</strong>
        </div>
      </div>
    `)
    .join('') || '<div class="small-list-item"><p>No recent personal expenses.</p></div>';

  personalPaymentList.innerHTML = getPaymentMethodBreakdown(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value)
    .map(([method, value]) => `<div class="personal-list-item"><div class="meta"><strong>${escapeHtml(method)}</strong><small>Personal expenses</small></div><strong>${formatCurrency(value, state.settings.currency)}</strong></div>`)
    .join('') || '<div class="small-list-item"><p>No payment data in this range.</p></div>';

  const transactions = getPersonalTransactions(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value, {
    search: personalTransactionSearch.value,
    category: personalTransactionCategory.value,
    method: personalTransactionMethod.value,
    kind: personalTransactionType.value,
  });
  personalTransactionList.innerHTML = transactions.map((expense) => `<button class="personal-list-item personal-transaction" data-personal-id="${escapeHtml(expense.id)}" data-personal-kind="${expense.kind}" type="button"><div class="meta"><strong>${escapeHtml(expense.title)}</strong><small>${formatDate(expense.date)} · ${escapeHtml(expense.category || 'Other')} · ${expense.kind === 'shared' ? 'Shared' : 'Personal'}</small></div><strong>${formatCurrency(expense.amount, state.settings.currency)}</strong></button>`).join('') || '<div class="small-list-item"><p>No transactions match these filters.</p></div>';

  const budgetStatus = getBudgetStatus(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value);
  personalBudgetAmount.value = String(budgetStatus.budget || 0);
  personalBudgetAlert.value = String(budgetStatus.alertAt || 75);
  personalBudgetUsed.textContent = formatCurrency(budgetStatus.used, state.settings.currency);
  personalBudgetLimit.textContent = formatCurrency(budgetStatus.budget, state.settings.currency);
  const percent = budgetStatus.budget > 0 ? Math.min(100, (budgetStatus.used / budgetStatus.budget) * 100) : 0;
  personalBudgetProgress.style.width = `${percent}%`;
  personalBudgetPercent.textContent = `${Math.round(percent)}%`;

  const insights = getSpendingInsights(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value);
  personalInsights.innerHTML = insights.map((item) => `<li>${item}</li>`).join('');

  const trendData = getTimeSeries(state, userId, personalTrackerRange, personalFromDate.value, personalToDate.value, 'daily');
  renderPersonalCharts(trendData, Object.entries(categoryData));
}

function renderPersonalCharts(trendData, categoryEntries = []) {
  if (personalTrendChart) {
    personalTrendChart.destroy();
  }
  if (personalCategoryChart) {
    personalCategoryChart.destroy();
  }

  const labels = trendData.map((entry) => entry.key.slice(-2));
  const values = trendData.map((entry) => entry.value);
  personalTrendChart = createLineChart(personalTrendChartElement, labels.length ? labels : ['No data'], values.length ? values : [0], '#2563EB');

  const categoryLabels = categoryEntries.map(([label]) => label);
  const categoryValues = categoryEntries.map(([, value]) => value);
  if (categoryLabels.length === 0) {
    personalCategoryChart = createDoughnutChart(personalCategoryChartElement, ['No data'], [1], ['#e2e8f0']);
    return;
  }
  personalCategoryChart = createDoughnutChart(
    personalCategoryChartElement,
    categoryLabels,
    categoryValues,
    categoryLabels.map((_, index) => ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#fb7185', '#818cf8'][index % 8])
  );
}

function renderCharts() {
  const categoryData = state.expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});
  const categoryLabels = Object.keys(categoryData);
  const categoryValues = Object.values(categoryData);
  const categoryColors = categoryLabels.map((label, index) => [`#3b82f6`, `#10b981`, `#f59e0b`, `#ef4444`, `#8b5cf6`, `#14b8a6`, `#f97316`, `#fb7185`, `#0ea5e9`, `#60a5fa`][index % 10]);

  const report = getRoommateReport(state.expenses, state.roommates);
  const categoryReport = getCategoryReport(state.expenses);

  reportMonthlyTotal.textContent = formatCurrency(report.breakdown.reduce((sum, item) => sum + item.totalPaid, 0), state.settings.currency);
  reportTopContributor.textContent = report.topContributor;
  reportTopCategory.textContent = categoryReport.topCategory;
}

function destroyDashboardCharts() {
  // Dashboard no longer renders category charts.
}

function destroyReportCharts() {
  if (reportPieChart) {
    reportPieChart.destroy();
    reportPieChart = null;
  }
  if (reportBarChart) {
    reportBarChart.destroy();
    reportBarChart = null;
  }
}

function renderDashboardCharts() {
  destroyDashboardCharts();
}

function renderReportCharts() {
  destroyReportCharts();
  const categoryData = state.expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});
  const categoryLabels = Object.keys(categoryData);
  const categoryValues = Object.values(categoryData);
  const categoryColors = categoryLabels.map((label, index) => [`#3b82f6`, `#10b981`, `#f59e0b`, `#ef4444`, `#8b5cf6`, `#14b8a6`, `#f97316`, `#fb7185`, `#0ea5e9`, `#60a5fa`][index % 10]);

  reportPieChart = createDoughnutChart(reportPieChartElement, categoryLabels, categoryValues, categoryColors);
  reportBarChart = createBarChart(reportBarChartElement, categoryLabels, categoryValues, '#2563EB');

  const report = getRoommateReport(state.expenses, state.roommates);
  const categoryReport = getCategoryReport(state.expenses);

  reportMonthlyTotal.textContent = formatCurrency(report.breakdown.reduce((sum, item) => sum + item.totalPaid, 0), state.settings.currency);
  reportTopContributor.textContent = report.topContributor;
  reportTopCategory.textContent = categoryReport.topCategory;
}

function renderSettlements() {
  const balances = calculateBalances(state.expenses, state.roommates);
  const transactions = simplifyTransactions(balances);
  const list = document.getElementById('settlementList');
  list.innerHTML = transactions
    .map(
      (tx) => `
      <div class="settlement-list-item">
        <div>
          <strong>${tx.from.name}</strong> → <strong>${tx.to.name}</strong>
        </div>
        <div>${formatCurrency(tx.amount, state.settings.currency)}</div>
      </div>`
    )
    .join('');
  if (transactions.length === 0) {
    list.innerHTML = '<div class="small-list-item"><p>No settlements needed right now.</p></div>';
  }
}

function getSettlementShareText() {
  const balances = calculateBalances(state.expenses, state.roommates);
  const transactions = simplifyTransactions(balances);
  const title = 'Room expense hisab';
  if (transactions.length === 0) {
    return `${title}\nNo settlements needed right now.`;
  }
  const lines = transactions.map(
    (tx) => `${tx.from.name} pays ${tx.to.name}: ${formatCurrency(tx.amount, state.settings.currency)}`
  );
  return `${title}\n${lines.join('\n')}`;
}

async function shareSettlements() {
  const text = getSettlementShareText();
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Room expense hisab', text });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('Hisab copied to clipboard.');
  } catch (error) {
    showToast('Unable to share hisab.');
  }
}

function openSettlementLink(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function shareOnWhatsApp() {
  openSettlementLink(`https://wa.me/?text=${encodeURIComponent(getSettlementShareText())}`);
}

function shareByMessage() {
  window.location.href = `sms:?body=${encodeURIComponent(getSettlementShareText())}`;
}

function openShareOptions() {
  const content = document.createElement('div');
  content.innerHTML = '<p>Choose how you want to share the current hisab.</p>';

  const whatsappBtn = document.createElement('button');
  whatsappBtn.className = 'button button-secondary';
  whatsappBtn.textContent = 'WhatsApp';
  whatsappBtn.addEventListener('click', () => {
    closeModal();
    shareOnWhatsApp();
  });

  const messageBtn = document.createElement('button');
  messageBtn.className = 'button button-secondary';
  messageBtn.textContent = 'Message';
  messageBtn.addEventListener('click', () => {
    closeModal();
    shareByMessage();
  });

  const moreBtn = document.createElement('button');
  moreBtn.className = 'button button-primary';
  moreBtn.textContent = 'More apps';
  moreBtn.addEventListener('click', () => {
    closeModal();
    shareSettlements();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'button button-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeModal);

  openModal('Share hisab', content, [whatsappBtn, messageBtn, moreBtn, cancelBtn]);
}

function saveCurrentState() {
  saveState(state);
}

function switchTheme(theme) {
  document.documentElement.dataset.theme = theme;
  state.settings.theme = theme;
  themeModeToggle.checked = theme === 'dark';
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function applySettings() {
  currencySelect.value = state.settings.currency;
  budgetAmount.value = Number(state.budget.amount || 0);
  budgetNotes.value = state.budget.notes || '';
  switchTheme(state.settings.theme || 'light');
}

function handleFormSubmit(event) {
  event.preventDefault();
  const expensePayload = {
    amount: expenseAmount.value,
    category: expenseCategory.value,
    description: expenseDescription.value,
    date: expenseDate.value,
    paidBy: expensePaidBy.value,
    method: expenseMethod.value,
    notes: expenseNotes.value,
    split: buildSplitPayload(),
  };

  if (!expensePayload.amount || !expensePayload.category || !expensePayload.description || !expensePayload.date || !expensePayload.paidBy) {
    showToast('Please complete all required fields before saving.');
    return;
  }

  const splitError = validateSplit(expensePayload.amount, expensePayload.split);
  if (splitError) {
    showToast(splitError);
    return;
  }

  if (editExpenseId) {
    state.expenses = updateExpense(state.expenses, editExpenseId, expensePayload);
    showToast('Expense updated successfully.');
  } else {
    state.expenses = [...state.expenses, createExpense(expensePayload)];
    recordActivity('expense', `${findRoommate(state.roommates, expensePayload.paidBy)?.name || 'Someone'} added ${expensePayload.description} — ${formatCurrency(expensePayload.amount, state.settings.currency)}`);
    showToast('Expense added successfully.');
  }

  saveCurrentState();
  resetExpenseForm();
  renderHistory();
  renderDashboard();
  renderSettlements();
  renderReportCharts();
}

function openModal(title, contentElement, footerElements = []) {
  modalTitle.textContent = title;
  modalBody.innerHTML = '';
  modalBody.appendChild(contentElement);
  modalFooter.innerHTML = '';
  footerElements.forEach((button) => modalFooter.appendChild(button));
  modalOverlay.classList.remove('hidden');
  modalOverlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalOverlay.setAttribute('aria-hidden', 'true');
}

function confirmAction(message, onConfirm) {
  const content = document.createElement('div');
  content.className = 'confirm-panel';
  content.innerHTML = `<p>${message}</p>`;
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'button button-secondary';
  cancelBtn.textContent = 'Cancel';
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'button button-danger';
  confirmBtn.textContent = 'Confirm';
  cancelBtn.addEventListener('click', closeModal);
  confirmBtn.addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
  openModal('Confirm action', content, [cancelBtn, confirmBtn]);
}

function openConversionModal(personalExpense) {
  if (personalExpense.convertedToSharedId || personalExpense.isShared) {
    showToast('This personal expense has already been converted.');
    return;
  }
  const form = document.createElement('form');
  form.id = `conversion-form-${Date.now()}`;
  form.className = 'form-grid';
  form.innerHTML = `<div class="input-group full-width"><label>Participants</label><div class="split-grid">${state.roommates.map((member) => `<label class="split-toggle"><input type="checkbox" name="member" value="${escapeHtml(member.id)}" checked />${escapeHtml(member.name)}</label>`).join('')}</div></div><div class="input-group"><label>Split method</label><select name="splitType"><option value="equal">Equal</option><option value="percentage">Percentage</option><option value="custom">Exact amount</option></select></div><div class="input-group full-width" id="conversionDetails"><p class="card-copy">Split equally among selected members.</p></div>`;
  const updateDetails = () => {
    const type = form.splitType.value;
    const members = Array.from(form.querySelectorAll('[name="member"]:checked'));
    if (type === 'equal') form.querySelector('#conversionDetails').innerHTML = '<p class="card-copy">Split equally among selected members.</p>';
    else form.querySelector('#conversionDetails').innerHTML = members.map((input) => `<label class="input-group"><span>${escapeHtml(state.roommates.find((member) => member.id === input.value)?.name || 'Member')}</span><input name="${type}_${input.value}" type="number" min="0" step="0.01" required /></label>`).join('');
  };
  form.addEventListener('change', updateDetails); updateDetails();
  const cancel = document.createElement('button'); cancel.className = 'button button-secondary'; cancel.textContent = 'Cancel'; cancel.type = 'button'; cancel.addEventListener('click', closeModal);
  const confirm = document.createElement('button'); confirm.className = 'button button-primary'; confirm.textContent = 'Confirm conversion'; confirm.type = 'submit'; confirm.setAttribute('form', form.id);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const type = form.splitType.value;
    const members = Array.from(form.querySelectorAll('[name="member"]:checked')).map((input) => input.value);
    if (!members.length) { showToast('Select at least one participant.'); return; }
    const custom = {}; const percentages = {};
    members.forEach((memberId) => { if (type === 'custom') custom[memberId] = Number(form[`custom_${memberId}`]?.value) || 0; if (type === 'percentage') percentages[memberId] = Number(form[`percentage_${memberId}`]?.value) || 0; });
    const split = calculateSplit(personalExpense.amount, type, members, custom, percentages);
    const splitError = validateSplit(personalExpense.amount, split);
    if (splitError) { showToast(splitError); return; }
    const shared = createExpense({ amount: personalExpense.amount, category: personalExpense.category || 'Other', description: personalExpense.name || 'Personal expense', date: personalExpense.date, paidBy: personalExpense.personId, method: personalExpense.method || 'Other', notes: personalExpense.notes || '', split });
    const sharedId = shared.id;
    state.expenses = [...state.expenses, { ...shared, convertedFromPersonalId: personalExpense.id }];
    state.personalExpenses = state.personalExpenses.map((item) => item.id === personalExpense.id ? { ...item, isShared: true, convertedToSharedId: sharedId, convertedAt: new Date().toISOString() } : item);
    recordActivity('conversion', `${findRoommate(state.roommates, personalExpense.personId)?.name || 'Someone'} converted an expense into a shared expense.`);
    saveCurrentState(); renderPersonalTracker(); renderDashboard(); renderHistory(); renderSettlements(); closeModal(); showToast('Personal expense converted to shared.');
  });
  openModal('Convert to shared expense', form, [cancel, confirm]);
}

function attachNavListeners() {
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (link.dataset.view === 'feature') {
        openFeature(link.dataset.feature);
        return;
      }
      openView(link.dataset.view);
      if (link.dataset.view === 'dashboard') renderDashboard();
      if (link.dataset.view === 'history') renderHistory();
      if (link.dataset.view === 'roommates') renderRoommates();
      if (link.dataset.view === 'reports') renderReportCharts();
      if (link.dataset.view === 'settlements') renderSettlements();
      if (link.dataset.view === 'settlements') renderSettlementHistory();
    });
  });
}

function attachGlobalListeners() {
  const personalExpenseCategory = document.getElementById('personalExpenseCategory');
  personalExpenseCategory.innerHTML = personalExpenseCategories
    .map((category) => `<option value="${category.id}">${category.icon} ${category.label}</option>`)
    .join('');

  mobileMenuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  quickAddBtn.addEventListener('click', () => {
    openView('expense');
    resetExpenseForm();
  });
  themeToggleBtn.addEventListener('click', () => {
    switchTheme(state.settings.theme === 'dark' ? 'light' : 'dark');
    saveCurrentState();
  });
  shareSettlementBtn.addEventListener('click', openShareOptions);
  document.getElementById('addSettlementBtn').addEventListener('click', openAddSettlementModal);
  [settlementFilterStatus, settlementFilterPerson].forEach((element) => element.addEventListener('change', renderSettlementHistory));
  document.getElementById('dashboardRecurringBtn').addEventListener('click', () => openFeature('recurringExpenses'));
  activityFilterType.addEventListener('change', renderDashboard);
  activityFilterDate.addEventListener('change', renderDashboard);
  expenseForm.addEventListener('submit', handleFormSubmit);
  document.getElementById('expenseCancelBtn').addEventListener('click', () => {
    resetExpenseForm();
    openView('dashboard');
  });
  splitTypeContainer.addEventListener('change', updateSplitDetails);
  splitRoommates.addEventListener('change', updateSplitDetails);
  expenseAmount.addEventListener('input', updateSplitDetails);
  document.addEventListener('click', (event) => {
    const target = event.target;
    const entity = target.dataset.entity;
    const action = target.dataset.action;
    const itemId = target.dataset.id;

    if (target.closest('[data-settlement-id]')) {
      const settlement = state.settlements.find((item) => item.id === target.closest('[data-settlement-id]').dataset.settlementId);
      if (!settlement) return;
      const content = document.createElement('div');
      content.innerHTML = `<p><strong>From:</strong> ${escapeHtml(findRoommate(state.roommates, settlement.fromUserId)?.name || 'Unknown')}</p><p><strong>To:</strong> ${escapeHtml(findRoommate(state.roommates, settlement.toUserId)?.name || 'Unknown')}</p><p><strong>Amount:</strong> ${formatCurrency(settlement.amount, state.settings.currency)}</p><p><strong>Date:</strong> ${formatDate(settlement.date)}</p><p><strong>Payment method:</strong> ${escapeHtml(settlement.paymentMethod || 'Not specified')}</p><p><strong>Transaction ID:</strong> ${escapeHtml(settlement.transactionId || '—')}</p><p><strong>Status:</strong> ${escapeHtml(settlement.status)}</p><p><strong>Note:</strong> ${escapeHtml(settlement.note || '—')}</p>`;
      const close = document.createElement('button'); close.className = 'button button-secondary'; close.textContent = 'Close'; close.addEventListener('click', closeModal);
      const actions = [close];
      if (settlement.status === 'Pending') {
        const paid = document.createElement('button'); paid.className = 'button button-primary'; paid.textContent = 'Mark as paid'; paid.addEventListener('click', () => confirmAction('Mark this settlement as paid?', () => { settlement.status = 'Paid'; recordActivity('settlement', `${findRoommate(state.roommates, settlement.fromUserId)?.name || 'Someone'} settled with ${findRoommate(state.roommates, settlement.toUserId)?.name || 'a roommate'}.`); saveCurrentState(); renderSettlementHistory(); renderDashboard(); showToast('Settlement marked as paid.'); }));
        const cancel = document.createElement('button'); cancel.className = 'button button-danger'; cancel.textContent = 'Cancel settlement'; cancel.addEventListener('click', () => confirmAction('Cancel this settlement?', () => { settlement.status = 'Cancelled'; saveCurrentState(); renderSettlementHistory(); renderDashboard(); showToast('Settlement cancelled.'); }));
        actions.push(paid, cancel);
      }
      openModal('Settlement details', content, actions);
      return;
    }

    if (entity === 'expense' && action === 'view') {
      const expense = getExpenseById(state.expenses, itemId);
      if (!expense) return;
      const content = document.createElement('div');
      content.innerHTML = `
        <p><strong>Description:</strong> ${expense.description}</p>
        <p><strong>Category:</strong> ${expense.category}</p>
        <p><strong>Amount:</strong> ${formatCurrency(expense.amount, state.settings.currency)}</p>
        <p><strong>Date:</strong> ${formatDate(expense.date)}</p>
        <p><strong>Paid by:</strong> ${findRoommate(state.roommates, expense.paidBy)?.name || 'Unknown'}</p>
        <p><strong>Payment method:</strong> ${expense.method}</p>
        <p><strong>Notes:</strong> ${expense.notes || 'No notes'}</p>
        <p><strong>Split:</strong> ${expense.split?.type || 'Equal'}</p>
      `;
      const closeBtn = document.createElement('button');
      closeBtn.className = 'button button-primary';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', closeModal);
      openModal('Expense details', content, [closeBtn]);
    }

    if (entity === 'expense' && action === 'edit') {
      editExpenseId = itemId;
      const expense = getExpenseById(state.expenses, editExpenseId);
      if (!expense) return;
      openView('expense');
      expenseAmount.value = expense.amount;
      expenseCategory.value = expense.category;
      buildDescriptionOptions(expense.description);
      expenseDescription.value = expense.description;
      expenseDate.value = expense.date;
      expensePaidBy.value = expense.paidBy;
      expenseMethod.value = expense.method;
      expenseNotes.value = expense.notes;
      renderSplitControls();
      const selectedRoommateIds = expense.split?.shares?.map((share) => share.roommateId) || state.roommates.map((roommate) => roommate.id);
      document.querySelectorAll('input[name="splitMember"]').forEach((checkbox) => {
        checkbox.checked = selectedRoommateIds.includes(checkbox.value);
      });
      document.querySelector(`input[name="splitType"][value="${expense.split?.type || 'equal'}"]`).checked = true;
      updateSplitDetails();
      if (expense.split?.type === 'custom') {
        expense.split.shares.forEach((share) => {
          const field = expenseForm.querySelector(`[name="customSplit_${share.roommateId}"]`);
          if (field) field.value = share.amount;
        });
      }
      if (expense.split?.type === 'percentage') {
        expense.split.shares.forEach((share) => {
          const field = expenseForm.querySelector(`[name="percentageSplit_${share.roommateId}"]`);
          if (field) field.value = share.percent;
        });
      }
    }

    if (entity === 'expense' && action === 'delete') {
      const id = itemId;
      confirmAction('Delete this expense permanently?', () => {
        state.expenses = removeExpense(state.expenses, id);
        saveCurrentState();
        renderHistory();
        renderDashboard();
        renderSettlements();
        showToast('Expense deleted successfully.');
      });
    }

    if (entity === 'roommate' && action === 'edit') {
      const roommate = findRoommate(state.roommates, itemId);
      if (!roommate) return;
      const form = document.createElement('form');
      form.className = 'form-grid';
      form.innerHTML = `
        <div class="input-group full-width">
          <label for="editRoommateName">Roommate name</label>
          <input id="editRoommateName" name="editRoommateName" type="text" value="${roommate.name}" required />
        </div>`;
      const submitBtn = document.createElement('button');
      submitBtn.className = 'button button-primary';
      submitBtn.type = 'submit';
      submitBtn.textContent = 'Save changes';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'button button-secondary';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', closeModal);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
          state.roommates = updateRoommate(state.roommates, itemId, form.editRoommateName.value);
          saveCurrentState();
          renderRoommates();
          renderRoommateDropdowns();
          renderDashboard();
          closeModal();
          showToast('Roommate updated successfully.');
        } catch (error) {
          showToast(error.message);
        }
      });
      openModal('Edit roommate', form, [cancelBtn, submitBtn]);
    }

    if (entity === 'roommate' && action === 'delete') {
      confirmAction('Remove this roommate from the workspace?', () => {
        state.roommates = removeRoommate(state.roommates, itemId);
        saveCurrentState();
        renderRoommates();
        renderRoommateDropdowns();
        renderDashboard();
        renderHistory();
        renderSettlements();
        showToast('Roommate removed.');
      });
    }

    if (target.closest('.nav-link')) {
      sidebar.classList.remove('open');
    }
  });

  historyPagination.addEventListener('click', (event) => {
    const target = event.target;
    if (target.matches('[data-page]')) {
      currentHistoryPage = Number(target.dataset.page);
      renderHistory();
    }
  });

  [historySearch, historyFilterCategory, historyFilterRoommate, historyFilterMethod, historySort].forEach((element) => {
    element.addEventListener('input', () => {
      currentHistoryPage = 1;
      renderHistory();
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openView('expense');
      resetExpenseForm();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      historySearch.focus();
    }
    if (event.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
      closeModal();
    }
  });

  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  budgetSaveBtn.addEventListener('click', () => {
    state.budget.amount = Number(budgetAmount.value) || 0;
    state.budget.notes = budgetNotes.value.trim();
    saveCurrentState();
    renderDashboard();
    showToast('Budget saved.');
  });

  currencySelect.addEventListener('change', () => {
    state.settings.currency = currencySelect.value;
    saveCurrentState();
    renderHistory();
    renderDashboard();
    renderReportCharts();
    renderSettlements();
    showToast('Currency updated.');
  });

  themeModeToggle.addEventListener('change', () => {
    switchTheme(themeModeToggle.checked ? 'dark' : 'light');
    saveCurrentState();
  });

  globalSearch.addEventListener('input', () => {
    historySearch.value = globalSearch.value;
    openView('history');
    renderHistory();
  });

  addRoommateBtn.addEventListener('click', () => openAddRoommateModal());
  featureAddBtn.addEventListener('click', () => renderFeatureForm(activeFeature === 'room' ? state.room : {}));
  featureForm.addEventListener('submit', handleFeatureSubmit);

  document.querySelectorAll('.personal-range').forEach((button) => {
    button.addEventListener('click', () => {
      personalTrackerRange = button.dataset.range || 'thisMonth';
      document.querySelectorAll('.personal-range').forEach((item) => item.classList.toggle('active', item === button));
      personalFromDate.value = '';
      personalToDate.value = '';
      renderPersonalTracker();
    });
  });

  personalFromDate.addEventListener('change', () => {
    if (personalFromDate.value || personalToDate.value) {
      personalTrackerRange = 'custom';
      renderPersonalTracker();
    }
  });

  personalToDate.addEventListener('change', () => {
    if (personalFromDate.value || personalToDate.value) {
      personalTrackerRange = 'custom';
      renderPersonalTracker();
    }
  });

  [personalTransactionSearch, personalTransactionCategory, personalTransactionMethod, personalTransactionType].forEach((element) => {
    element.addEventListener('input', renderPersonalTracker);
    element.addEventListener('change', renderPersonalTracker);
  });

  document.getElementById('personalClearFiltersBtn').addEventListener('click', () => {
    personalTransactionSearch.value = '';
    personalTransactionCategory.value = '';
    personalTransactionMethod.value = '';
    personalTransactionType.value = '';
    renderPersonalTracker();
  });

  document.getElementById('personalPrintBtn').addEventListener('click', () => window.print());

  document.getElementById('personalExportCsvBtn').addEventListener('click', () => {
    const rows = getPersonalTransactions(state, getCurrentUserId(state), personalTrackerRange, personalFromDate.value, personalToDate.value, {
      search: personalTransactionSearch.value, category: personalTransactionCategory.value, method: personalTransactionMethod.value, kind: personalTransactionType.value,
    });
    const csvRows = [['Date', 'Expense', 'Category', 'Amount', 'Paid By', 'Type', 'Payment Method', 'Notes'], ...rows.map((expense) => [expense.date, expense.title, expense.category || 'Other', expense.amount, findRoommate(state.roommates, expense.paidBy)?.name || 'You', expense.kind, expense.method || 'Not specified', expense.notes || ''])];
    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'personal-transactions.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Personal transactions exported.');
  });

  document.getElementById('personalBudgetSaveBtn').addEventListener('click', () => {
    const userId = getCurrentUserId(state);
    state.personalBudget = {
      amount: Number(personalBudgetAmount.value) || 0,
      enabled: true,
      alertAt: Number(personalBudgetAlert.value) || 75,
    };
    saveCurrentState();
    renderPersonalTracker();
    showToast('Personal budget saved.');
  });

  document.getElementById('personalExpenseResetBtn').addEventListener('click', () => {
    document.getElementById('personalExpenseForm').reset();
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('personalExpenseDate').value = today;
  });

  document.getElementById('personalExpenseForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const userId = getCurrentUserId(state);
    const form = event.currentTarget;
    const payload = {
      id: createId(),
      name: form.name.value.trim(),
      amount: Number(form.amount.value) || 0,
      category: form.category.value,
      method: form.method.value,
      date: form.date.value,
      notes: form.notes.value.trim(),
      personId: userId,
      receipt: form.receipt.files?.[0]?.name || '',
      isShared: false,
      createdAt: new Date().toISOString(),
    };

    if (!payload.name || payload.amount <= 0 || !payload.category || !payload.date || !userId) {
      showToast('Please fill in a valid expense name, amount, category, and date.');
      return;
    }

    state.personalExpenses = [...(state.personalExpenses || []), payload];
    saveCurrentState();
    form.reset();
    document.getElementById('personalExpenseDate').value = new Date().toISOString().slice(0, 10);
    renderPersonalTracker();
    renderDashboard();
    showToast('Personal expense saved.');
  });

  personalMemberBreakdown.addEventListener('click', (event) => {
    const button = event.target.closest('[data-member-id]');
    if (!button) return;
    const member = state.roommates.find((item) => item.id === button.dataset.memberId);
    const detail = getPersonDetail(state, button.dataset.memberId, personalTrackerRange, personalFromDate.value, personalToDate.value);
    if (!member) return;
    const amounts = detail.history.map((item) => Number(item.amount || 0));
    const average = detail.transactionCount ? detail.totalSpent / detail.transactionCount : 0;
    const content = document.createElement('div');
    content.innerHTML = `<p><strong>Total spent:</strong> ${formatCurrency(detail.totalSpent, state.settings.currency)}</p><p><strong>Room expenses:</strong> ${formatCurrency(detail.roomExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0), state.settings.currency)}</p><p><strong>Transactions:</strong> ${detail.transactionCount}</p><p><strong>Average:</strong> ${formatCurrency(average, state.settings.currency)}</p><p><strong>Highest:</strong> ${formatCurrency(Math.max(...amounts, 0), state.settings.currency)}</p><p><strong>Lowest:</strong> ${formatCurrency(amounts.length ? Math.min(...amounts) : 0, state.settings.currency)}</p><h3>Transaction history</h3>${detail.history.map((item) => `<p>${formatDate(item.date)} · ${escapeHtml(item.title)} · ${escapeHtml(item.category || 'Other')} · <strong>${formatCurrency(item.amount, state.settings.currency)}</strong></p>`).join('') || '<p>No transactions in this range.</p>'}`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'button button-primary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    openModal(`${member.name} details`, content, [closeBtn]);
  });

  personalCategoryList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    personalTransactionCategory.value = button.dataset.category;
    renderPersonalTracker();
  });

  personalTransactionList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-personal-id]');
    if (!button) return;
    const source = button.dataset.personalKind === 'personal' ? state.personalExpenses : state.expenses;
    const expense = source.find((item) => item.id === button.dataset.personalId);
    if (!expense) return;
    const content = document.createElement('div');
    content.innerHTML = `<p><strong>Expense:</strong> ${escapeHtml(expense.name || expense.description || 'Expense')}</p><p><strong>Amount:</strong> ${formatCurrency(expense.amount, state.settings.currency)}</p><p><strong>Date:</strong> ${formatDate(expense.date)}</p><p><strong>Category:</strong> ${escapeHtml(expense.category || 'Other')}</p><p><strong>Type:</strong> ${button.dataset.personalKind === 'personal' ? 'Personal' : 'Shared'}</p><p><strong>Payment method:</strong> ${escapeHtml(expense.method || 'Not specified')}</p><p><strong>Notes:</strong> ${escapeHtml(expense.notes || 'No notes')}</p>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'button button-primary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', closeModal);
    const actions = [closeBtn];
    if (button.dataset.personalKind === 'personal' && !expense.convertedToSharedId && !expense.isShared) {
      const convertBtn = document.createElement('button');
      convertBtn.className = 'button button-primary';
      convertBtn.textContent = 'Convert to shared';
      convertBtn.addEventListener('click', () => { closeModal(); confirmAction('Convert this personal expense into a shared room expense?', () => openConversionModal(expense)); });
      actions.push(convertBtn);
    }
    openModal('Expense details', content, actions);
  });

  document.getElementById('personalViewAllBtn').addEventListener('click', () => {
    openView('history');
  });
  featureList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-feature-action]');
    if (!button) return;
    const config = featureConfigs[activeFeature];
    const record = featureRecords(config).find((item) => item.id === button.dataset.id);
    if (!record) return;
    if (button.dataset.featureAction === 'edit') {
      renderFeatureForm(record);
      return;
    }
    if (button.dataset.featureAction === 'toggle') {
      record.status = record.status === 'paused' ? 'active' : 'paused';
      saveCurrentState();
      renderFeature();
      renderDashboard();
      showToast(record.status === 'paused' ? 'Recurring bill paused.' : 'Recurring bill resumed.');
      return;
    }
    confirmAction(`Delete this ${config.title.toLowerCase()} record?`, () => {
      state[config.collection] = state[config.collection].filter((item) => item.id !== record.id);
      saveCurrentState();
      renderFeature();
      showToast('Record deleted.');
    });
  });
  exportJsonBtn.addEventListener('click', () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'room-expense-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported.');
  });

  importJsonInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (imported && typeof imported === 'object' && !Array.isArray(imported)) {
        Object.assign(state, normalizeState(imported));
        saveCurrentState();
        renderApplication();
        showToast('Backup imported successfully.');
      } else {
        showToast('Invalid backup file.');
      }
    } catch {
      showToast('Unable to parse imported file.');
    }
    event.target.value = '';
  });

  downloadCsvBtn.addEventListener('click', () => {
    const csv = buildCsv(state.expenses, state.roommates, state.settings.currency);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'room-expense-report.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('CSV report downloaded.');
  });

  printReportBtn.addEventListener('click', () => {
    window.print();
  });

  resetDataBtn.addEventListener('click', () => {
    confirmAction('This will clear all data and reset the app. Continue?', () => {
      const freshState = resetState();
      Object.assign(state, freshState);
      applySettings();
      renderApplication();
      showToast('Application reset complete.');
    });
  });
}

function openAddRoommateModal() {
  const form = document.createElement('form');
  form.id = `roommate-form-${Date.now()}`;
  form.className = 'form-grid';
  form.innerHTML = `
    <div class="input-group full-width">
      <label for="roommateName">Roommate name</label>
      <input id="roommateName" name="roommateName" type="text" required />
    </div>`;
  const submitBtn = document.createElement('button');
  submitBtn.className = 'button button-primary';
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Add roommate';
  submitBtn.setAttribute('form', form.id);
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'button button-secondary';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = form.roommateName.value;
    try {
      state.roommates = createRoommate(state.roommates, name);
      recordActivity('room', `${name.trim()} joined the room.`);
      saveCurrentState();
      renderRoommates();
      renderRoommateDropdowns();
      renderSplitControls();
      renderDashboard();
      closeModal();
      showToast('Roommate added successfully.');
    } catch (error) {
      showToast(error.message);
    }
  });

  openModal('Add roommate', form, [cancelBtn, submitBtn]);
}

function renderRoommateDropdowns() {
  renderRoommateDropdown();
  renderSplitControls();
}

function renderApplication() {
  generateDueRecurringExpenses();
  buildCategoryOptions();
  buildDescriptionOptions();
  renderRoommateDropdown();
  renderSplitControls();
  applySettings();
  renderHistory();
  renderRoommates();
  renderDashboard();
  renderSettlements();
  renderSettlementHistory();
  renderPersonalTracker();
  renderFeature();
}

function init() {
  const today = new Date().toISOString().slice(0, 10);
  const personalDateInput = document.getElementById('personalExpenseDate');
  if (personalDateInput) personalDateInput.value = today;
  renderApplication();
  attachNavListeners();
  attachGlobalListeners();
  openView('dashboard');
}

init();
