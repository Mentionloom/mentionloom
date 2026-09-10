import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('icon-button', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
