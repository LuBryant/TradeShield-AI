async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

function renderTimeline(steps) {
  const timeline = document.querySelector('#timeline');
  timeline.innerHTML = '';
  for (const step of steps) {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${step.state}</strong> · ${step.actor}<br>${step.event}`;
    timeline.appendChild(item);
  }
}

async function loadCase() {
  const demo = await fetchJson('/api/demo-data');
  document.querySelector('#case-card').textContent = JSON.stringify({
    bl_id: demo.bill_of_lading.bl_id,
    cargo: demo.bill_of_lading.cargo,
    route: `${demo.bill_of_lading.port_of_loading} → ${demo.bill_of_lading.port_of_discharge}`,
    requested_amount: `${demo.financing.requested_amount_usd} ${demo.financing.currency}`
  }, null, 2);
}

async function runDemo() {
  const result = await fetchJson('/api/workflow/simulate', { method: 'POST' });
  document.querySelector('#risk-card').textContent = JSON.stringify(result.risk_report, null, 2);
  renderTimeline(result.steps);
}

document.querySelector('#run-demo').addEventListener('click', runDemo);
loadCase().catch((error) => {
  document.querySelector('#case-card').textContent = error.message;
});
