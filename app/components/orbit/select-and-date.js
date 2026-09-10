import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('select-and-date', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
