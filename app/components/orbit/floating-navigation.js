import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('floating-navigation', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
