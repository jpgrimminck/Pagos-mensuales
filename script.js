const STATUS_STORAGE_KEY = 'manualCardStatus.v1';
let manualStatus = {};

function loadStatusMap() {
  try {
    const stored = localStorage.getItem(STATUS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Unable to parse manual status from localStorage', error);
    return {};
  }
}

function saveStatusMap() {
  try {
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(manualStatus));
  } catch (error) {
    console.warn('Unable to save manual status to localStorage', error);
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

    const isPaid = !!manualStatus[statusKey];
    checkbox.checked = isPaid;
    updateStatusPill(pill, isPaid);
    li.classList.toggle('card--paid', isPaid);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        manualStatus[statusKey] = true;
      } else {
        delete manualStatus[statusKey];
      }
      updateStatusPill(pill, checkbox.checked);
      li.classList.toggle('card--paid', checkbox.checked);
      saveStatusMap();
    });

    statusWrap.append(pill, checkbox);
    li.appendChild(statusWrap);
  }

  return li;
}

async function render() {
  try {
    const auto = await loadJSON('automaticos.json');
    const manual = await loadJSON('manuales.json');
    manualStatus = loadStatusMap();

    // expect arrays: auto.pagos, auto.auto, manual.cuentas, manual.auto
    const mount = (arr, selector, opts = {}) => {
      const container = document.getElementById(selector);
      if (!container) return;
      container.innerHTML = '';
      arr.forEach(item => container.appendChild(createCard(item, opts)));
    };

    mount(auto.pagos || [], 'automaticos');
    mount(auto.auto || [], 'automaticos-auto');
    mount(manual.cuentas || [], 'manuales', { withStatus: true });
    mount(manual.auto || [], 'manuales-auto', { withStatus: true });

  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
