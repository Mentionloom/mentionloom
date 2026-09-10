import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('tabs', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
