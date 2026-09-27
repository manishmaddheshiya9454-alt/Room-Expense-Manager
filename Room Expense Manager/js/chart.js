export function createDoughnutChart(context, labels, values, colors) {
  return new window.Chart(context, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true } },
      },
    },
  });
}

export function createLineChart(context, labels, values, color) {
  return new Chart(context, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Expense',
          data: values,
          borderColor: color,
          backgroundColor: `${color}33`,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#e2e8f0' }, beginAtZero: true },
      },
    },
  });
}

export function createBarChart(context, labels, values, color) {
  return new Chart(context, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Amount',
          data: values,
          backgroundColor: color,
          borderRadius: 12,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#e2e8f0' }, beginAtZero: true },
      },
    },
  });
}
