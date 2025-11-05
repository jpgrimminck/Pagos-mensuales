const STATUS_STORAGE_KEY = 'manualCardStatus.v2';
let cardStatus = {};

function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function capitalize(text = '') {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function updateDateHeader() {
  const today = new Date();
  const dayNumberEl = document.getElementById('date-day-number');
  const dayNameEl = document.getElementById('date-day-name');
  const monthNameEl = document.getElementById('date-month-name');

  if (!dayNumberEl || !dayNameEl || !monthNameEl) return;

  const dayNumber = today.getDate();
  const dayName = new Intl.DateTimeFormat('es-CL', { weekday: 'long' }).format(today);
  const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(today);

  dayNumberEl.textContent = String(dayNumber).padStart(2, '0');
  dayNameEl.textContent = capitalize(dayName);
  monthNameEl.textContent = capitalize(monthName);
}

function loadStatusMap() {
  const currentMonth = getCurrentMonthKey();
  try {
    const stored = localStorage.getItem(STATUS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object') {
      if (parsed.monthKey && parsed.statuses) {
        return parsed.monthKey === currentMonth ? parsed.statuses : {};
      }
      // backward compatibility with previous format
      if (!Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Unable to parse card statuses from localStorage', error);
  }
  return {};
}

function saveStatusMap() {
  const payload = {
    monthKey: getCurrentMonthKey(),
    statuses: cardStatus
  };
  try {
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to save card statuses to localStorage', error);
  }
}

function makeStatusKey(item) {
  const baseLabel = (item.label || item.name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hrefPart = (item.href || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(-12);
  const composed = `${baseLabel}-${hrefPart || 'link'}`;
  return composed.replace(/^-+|-+$/g, '') || `item-${Math.random().toString(36).slice(2, 8)}`;
}

function updateStatusPill(pill, isPaid) {
  pill.textContent = isPaid ? 'Pagada' : 'Pendiente';
  pill.classList.toggle('is-paid', isPaid);
}

function updatePendingCounter() {
  const counterEl = document.getElementById('pending-count');
  if (!counterEl) return;
  const checkboxes = document.querySelectorAll('.card-status input[type="checkbox"]');
  let pending = 0;
  checkboxes.forEach(checkbox => {
    if (!checkbox.checked) pending += 1;
  });
  counterEl.textContent = pending;
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function createCard(item, options = {}) {
  const { withStatus = false } = options;
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'card-link';
  a.href = item.href || '#';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  // image: either svg markup (inline) or an URL
  if (item.svg) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = item.svg; // safe for controlled data
    const svg = wrapper.firstElementChild;
    svg.classList.add('card-img');
    a.appendChild(svg);
  } else {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = item.favicon || item.img || 'placeholder.jpg';
    img.alt = item.alt || '';
    a.appendChild(img);
  }

  const span = document.createElement('span');
  span.textContent = item.label || item.name || '';
  a.appendChild(span);
  li.appendChild(a);

  if (withStatus) {
    const statusKey = makeStatusKey(item);
    const statusWrap = document.createElement('div');
    statusWrap.className = 'card-status';

    const checkboxId = `status-${statusKey}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.setAttribute('aria-label', `Marcar ${item.label || 'cuenta'} como pagada`);
    checkbox.title = 'Marcar como pagada';

    const pill = document.createElement('span');
    pill.className = 'card-status-pill';

    const isPaid = !!cardStatus[statusKey];
    checkbox.checked = isPaid;
    updateStatusPill(pill, isPaid);
    li.classList.toggle('card--paid', isPaid);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        cardStatus[statusKey] = true;
      } else {
        delete cardStatus[statusKey];
      }
      updateStatusPill(pill, checkbox.checked);
      li.classList.toggle('card--paid', checkbox.checked);
      saveStatusMap();
      updatePendingCounter();
    });

    statusWrap.append(pill, checkbox);
    li.appendChild(statusWrap);
  }

  return li;
}

async function render() {
  try {
    cardStatus = loadStatusMap();
    saveStatusMap();

    const [auto, manual] = await Promise.all([
      loadJSON('automaticos.json'),
      loadJSON('manuales.json')
    ]);

    // expect arrays: auto.pagos, auto.auto, manual.cuentas, manual.auto
    const mount = (arr, selector, opts = {}) => {
      const container = document.getElementById(selector);
      if (!container) return;
      container.innerHTML = '';
      arr.forEach(item => container.appendChild(createCard(item, opts)));
    };

    mount(auto.pagos || [], 'automaticos', { withStatus: true });
    mount(auto.auto || [], 'automaticos-auto', { withStatus: true });
    mount(manual.cuentas || [], 'manuales', { withStatus: true });
    mount(manual.auto || [], 'manuales-auto', { withStatus: true });

    updatePendingCounter();
  } catch (err) {
    console.error(err);
  }
}

function resetAllStatuses() {
  const confirmed = window.confirm('¿Seguro que deseas borrar todos los estados de pago?');
  if (!confirmed) return;
  cardStatus = {};
  saveStatusMap();
  render();
}

function init() {
  updateDateHeader();

  const resetButton = document.getElementById('reset-status-btn');
  if (resetButton) {
    resetButton.addEventListener('click', resetAllStatuses);
  }

  render();
}

document.addEventListener('DOMContentLoaded', init);
