import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('checkbox-and-radio', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
