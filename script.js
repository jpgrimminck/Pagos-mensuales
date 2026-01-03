const STATUS_STORAGE_KEY = 'manualCardStatus.v2';
let cardStatus = {};
let itemsRegistry = {};
let isDeleteMode = false;

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

function updateStatusPill(pill, isPaid, amount) {
  if (isPaid) {
    pill.textContent = amount ? `$ ${amount}` : 'Pagada';
  } else {
    pill.textContent = 'Pendiente';
  }
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

function updateTotalSum() {
  const totalEl = document.getElementById('total-amount');
  if (!totalEl) return;
  
  let total = 0;
  Object.values(cardStatus).forEach(status => {
    if (status && status.paid && status.amount) {
      total += parseInt(status.amount, 10) || 0;
    }
  });
  
  // Format with thousands separator
  totalEl.textContent = `$ ${total.toLocaleString('es-CL')}`;
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
    itemsRegistry[statusKey] = item;
    const statusWrap = document.createElement('div');
    statusWrap.className = 'card-status';

    // Retrieve and normalize status data
    let stored = cardStatus[statusKey];
    // If stored is just "true" (legacy), treat as { paid: true, amount: null }
    // If stored is undefined, treat as { paid: false, amount: null }
    // If stored is object, use it.
    let data = { paid: false, amount: null };
    if (stored === true) {
      data = { paid: true, amount: null };
    } else if (typeof stored === 'object' && stored !== null) {
      data = { ...stored };
    }

    const checkboxId = `status-${statusKey}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.setAttribute('aria-label', `Marcar ${item.label || 'cuenta'} como pagada`);
    checkbox.title = 'Marcar como pagada';
    checkbox.checked = data.paid;

    if (data.amount) {
      checkbox.style.display = 'none';
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-record-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Eliminar registro';
    deleteBtn.type = 'button';

    const pill = document.createElement('span');
    pill.className = 'card-status-pill';
    updateStatusPill(pill, data.paid, data.amount);

    // Input for amount
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'amount-input';
    amountInput.placeholder = '$';
    amountInput.style.display = 'none'; // hidden by default

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = 'Guardar';
    saveBtn.type = 'button';
    saveBtn.style.display = 'none'; // hidden by default

    li.classList.toggle('card--paid', data.paid);

    // Helper to save current state
    const persist = () => {
      if (data.paid) {
        cardStatus[statusKey] = data;
      } else {
        // If not paid, we still want to keep the amount if it exists?
        // The requirement says: "si le saco el check y vuelvo a activarlo, no me debe preguntar por el monto"
        // So we must persist the amount even if paid is false.
        // But previously we were deleting the key.
        // Let's store it with paid: false.
        cardStatus[statusKey] = data;
      }
      saveStatusMap();
      updatePendingCounter();
      updateTopPayments();
      updateTotalSum();
    };

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        // User checked the box
        if (data.amount) {
          // We have a stored amount, just restore it
          data.paid = true;
          updateStatusPill(pill, true, data.amount);
          li.classList.toggle('card--paid', true);
          persist();
        } else {
          // No stored amount, ask for it
          pill.style.display = 'none';
          amountInput.style.display = 'inline-block';
          saveBtn.style.display = 'inline-block';
          li.classList.add('is-editing');
          amountInput.focus();
          // Note: we don't set data.paid = true yet, or maybe we do but we wait for amount?
          // If user checks but doesn't save amount, what happens?
          // Let's assume we mark it as paid visually but wait for amount to finalize?
          // Or better: don't mark as paid fully until saved?
          // But the checkbox is checked.
          // Let's keep checkbox checked.
        }
      } else {
        // User unchecked
        data.paid = false;
        updateStatusPill(pill, false, data.amount);
        li.classList.toggle('card--paid', false);
        
        // Hide input/save if they were open
        amountInput.style.display = 'none';
        saveBtn.style.display = 'none';
        pill.style.display = 'inline-block'; // Show pill again
        li.classList.remove('is-editing');
        
        persist();
      }
    });

    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // prevent triggering other clicks if any
      const val = amountInput.value.trim();
      if (!val) {
        alert('Por favor ingresa un monto');
        return;
      }
      data.amount = val;
      data.paid = true;
      
      // Update UI
      amountInput.style.display = 'none';
      saveBtn.style.display = 'none';
      pill.style.display = 'inline-block';
      li.classList.remove('is-editing');
      
      checkbox.style.display = 'none';

      updateStatusPill(pill, true, data.amount);
      li.classList.toggle('card--paid', true);
      
      persist();
    });

    // Allow pressing Enter in input
    amountInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });
    
    // Prevent clicking input/button from toggling the link if it bubbled (though they are in statusWrap)
    amountInput.addEventListener('click', e => e.preventDefault());

    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm('¿Eliminar este registro de pago?')) {
        data.paid = false;
        data.amount = null;
        
        checkbox.checked = false;
        checkbox.style.display = 'inline-block';
        updateStatusPill(pill, false, null);
        li.classList.toggle('card--paid', false);
        
        persist();
      }
    });

    statusWrap.append(pill, amountInput, saveBtn, checkbox, deleteBtn);
    li.appendChild(statusWrap);
  }

  return li;
}

function updateTopPayments() {
  const container = document.getElementById('top-payments');
  if (!container) return;
  
  // Filter paid items with amount
  const paidItems = Object.entries(cardStatus)
    .filter(([key, status]) => status && status.paid && status.amount)
    .map(([key, status]) => {
      const item = itemsRegistry[key];
      return {
        key,
        amount: parseInt(status.amount, 10) || 0,
        label: item ? (item.label || item.name) : 'Unknown',
        svg: item ? item.svg : null,
        img: item ? (item.favicon || item.img) : null,
        formattedAmount: status.amount
      };
    });

  // Sort by amount desc
  paidItems.sort((a, b) => b.amount - a.amount);

  // Take top 3
  const top3 = paidItems.slice(0, 3);

  container.innerHTML = '';
  if (top3.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';

  top3.forEach(item => {
    const div = document.createElement('div');
    div.className = 'top-payment-card';
    
    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'top-payment-icon';
    if (item.svg) {
        iconDiv.innerHTML = item.svg;
    } else if (item.img) {
        const img = document.createElement('img');
        img.src = item.img;
        iconDiv.appendChild(img);
    }
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'top-payment-info';
    
    const amountSpan = document.createElement('span');
    amountSpan.className = 'top-payment-amount';
    amountSpan.textContent = `$ ${item.formattedAmount}`;
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'top-payment-label';
    labelSpan.textContent = item.label;
    
    infoDiv.append(amountSpan, labelSpan);
    div.append(iconDiv, infoDiv);
    container.appendChild(div);
  });
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
    mount(auto.anuales || [], 'automaticos-anuales', { withStatus: true });
    mount(manual.cuentas || [], 'manuales', { withStatus: true });
    mount(manual.auto || [], 'manuales-auto', { withStatus: true });

    updatePendingCounter();
    updateTopPayments();
    updateTotalSum();
  } catch (err) {
    console.error(err);
  }
}

function toggleDeleteMode() {
  isDeleteMode = !isDeleteMode;
  document.body.classList.toggle('delete-mode', isDeleteMode);
  
  const btn = document.getElementById('reset-status-btn');
  if (btn) {
    btn.textContent = isDeleteMode ? 'Terminar de borrar' : 'Borrar registros';
    btn.classList.toggle('active', isDeleteMode);
  }
}

function init() {
  updateDateHeader();

  const resetButton = document.getElementById('reset-status-btn');
  if (resetButton) {
    resetButton.addEventListener('click', toggleDeleteMode);
  }

  render();
}

document.addEventListener('DOMContentLoaded', init);
