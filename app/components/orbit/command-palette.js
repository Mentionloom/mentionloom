import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('command-palette', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
