import { icon, escape as esc, closeMenus } from './ui.js';

// One surface, two levels: choose a dimension, then choose its value.
export function createFilters({ getDefinitions, getState, onChange }) {
  const trigger = document.querySelector('#filters-toggle');
  const panel = document.querySelector('#filters-popover');
  const chips = document.querySelector('#filter-chips');
  let dimension = null;

  const isOpen = () => panel.matches(':popover-open');
  const definition = () => getDefinitions().find(item => item.key === dimension);
  const valueLabel = (item, value) => item.values.find(option => option.id === value)?.name || value;
  const valueIcon = (item, value) => item.values.find(option => option.id === value)?.icon || icon(item.icon);

  function position() {
    if (!isOpen()) return;
    const anchor = trigger.getBoundingClientRect();
    const gap = 8, edge = 12;
    const below = innerHeight - anchor.bottom - gap - edge;
    const above = anchor.top - gap - edge;
    const placeBelow = below >= Math.min(panel.scrollHeight, 300) || below >= above;
    panel.style.maxHeight = Math.min(420, Math.max(120, placeBelow ? below : above)) + 'px';
    panel.style.left = Math.max(edge, Math.min(anchor.right - panel.offsetWidth, innerWidth - panel.offsetWidth - edge)) + 'px';
    panel.style.top = Math.max(edge, placeBelow ? anchor.bottom + gap : anchor.top - panel.offsetHeight - gap) + 'px';
  }

  function close(restoreFocus = false) {
    if (isOpen()) panel.hidePopover();
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function renderValues(query = '') {
    const item = definition();
    const options = item.values.filter(option => option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    panel.querySelector('.filter-options').innerHTML = options.map(option => {
      const selected = getState()[item.key] === option.id;
      return `<button type="button" class="filter-option" data-filter-value="${esc(option.id)}" aria-pressed="${selected}">${option.icon || icon(item.icon)}<span>${esc(option.name)}</span>${selected ? icon('check', 'filter-check') : ''}</button>`;
    }).join('') || '<p class="filter-empty" role="status">No matches</p>';
    position();
  }

  function renderPanel() {
    const item = definition();
    panel.innerHTML = `<div class="filter-popover-heading">${item ? `<button type="button" class="filter-back" data-filter-back aria-label="Back to filters">${icon('right')}</button>` : ''}<h2 id="filters-heading">${item ? esc(item.label) : 'Filter by'}</h2><button type="button" class="filter-close" data-filter-close aria-label="Close filters">${icon('close')}</button></div>`;
    if (!item) {
      panel.innerHTML += `<div class="filter-options">${getDefinitions().map(entry => `<button type="button" class="filter-option filter-category" data-filter-dimension="${entry.key}">${icon(entry.icon)}<span>${esc(entry.label)}</span>${getState()[entry.key] ? '<span class="filter-applied-dot" aria-hidden="true"></span>' : ''}${icon('right')}</button>`).join('')}</div>`;
      return;
    }
    if (item.values.length > 5) {
      panel.innerHTML += `<label class="filter-search">${icon('search')}<input type="search" autocomplete="off" placeholder="Search" aria-label="Search ${esc(item.label.toLowerCase())}" /></label>`;
    }
    panel.innerHTML += '<div class="filter-options"></div>';
    renderValues();
  }

  function open(key = null) {
    closeMenus();
    dimension = key;
    renderPanel();
    if (!isOpen()) panel.showPopover();
    trigger.setAttribute('aria-expanded', 'true');
    position();
    (panel.querySelector('input') || panel.querySelector('[aria-pressed="true"]') || panel.querySelector('.filter-option'))?.focus({ preventScroll: true });
  }

  function render() {
    const active = getDefinitions().filter(item => getState()[item.key]);
    trigger.classList.toggle('has-filters', active.length > 0);
    trigger.setAttribute('aria-label', active.length ? `Filters, ${active.length} active` : 'Filters');
    trigger.title = active.length ? `Filters · ${active.length} active` : 'Filters';
    chips.innerHTML = active.map(item => {
      const value = getState()[item.key], label = valueLabel(item, value);
      return `<span class="active-filter"><button type="button" class="filter-chip-edit" data-filter-edit="${item.key}" aria-label="Edit ${esc(item.label.toLowerCase())} filter: ${esc(label)}">${valueIcon(item, value)}<span class="filter-chip-label">${esc(item.label)} is</span><span class="filter-chip-value">${esc(label)}</span></button><button type="button" class="filter-chip-remove" data-filter-remove="${item.key}" aria-label="Remove ${esc(item.label.toLowerCase())} filter">${icon('close')}</button></span>`;
    }).join('') + (active.length > 1 ? '<button type="button" class="text-button filter-clear" data-filter-clear>Clear all</button>' : '');
  }

  trigger.addEventListener('click', event => {
    event.preventDefault();
    isOpen() ? close() : open();
  });
  panel.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(isOpen())));
  panel.addEventListener('input', event => {
    if (event.target.matches('input')) renderValues(event.target.value);
  });
  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-filter-close')) return close(true);
    if (button.hasAttribute('data-filter-back')) {
      const previous = dimension;
      open();
      panel.querySelector(`[data-filter-dimension="${previous}"]`)?.focus();
    } else if (button.dataset.filterDimension) open(button.dataset.filterDimension);
    else if (button.hasAttribute('data-filter-value')) {
      const key = dimension, value = button.dataset.filterValue;
      close(true);
      onChange({ [key]: value });
    }
  });
  chips.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.filterEdit) open(button.dataset.filterEdit);
    else if (button.dataset.filterRemove) {
      onChange({ [button.dataset.filterRemove]: '' });
      trigger.focus({ preventScroll: true });
    } else if (button.hasAttribute('data-filter-clear')) {
      onChange(Object.fromEntries(getDefinitions().map(item => [item.key, ''])));
      trigger.focus({ preventScroll: true });
    }
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button,input')];
      if ((event.shiftKey && event.target === controls[0]) || (!event.shiftKey && event.target === controls.at(-1))) {
        event.preventDefault();
        close(true);
      }
      return;
    }
    const options = [...panel.querySelectorAll('.filter-option')];
    if (!options.length) return;
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const index = options.indexOf(document.activeElement);
      const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus();
    } else if (['Home', 'End'].includes(event.key) && event.target.tagName !== 'INPUT') {
      event.preventDefault();
      options[event.key === 'Home' ? 0 : options.length - 1].focus();
    } else if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault();
      options[0].click();
    }
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { passive: true });
  return { render, close };
}
