async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function createCard(item) {
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
  return li;
}

async function render() {
  try {
    const auto = await loadJSON('automaticos.json');
    const manual = await loadJSON('manuales.json');

    // expect arrays: auto.pagos, auto.auto, manual.cuentas, manual.auto
    const mount = (arr, selector) => {
      const container = document.getElementById(selector);
      if (!container) return;
      container.innerHTML = '';
      arr.forEach(it => container.appendChild(createCard(it)));
    };

    mount(auto.pagos || [], 'automaticos');
    mount(auto.auto || [], 'automaticos-auto');
    mount(manual.cuentas || [], 'manuales');
    mount(manual.auto || [], 'manuales-auto');

  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
