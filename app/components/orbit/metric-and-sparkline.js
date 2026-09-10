import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('metric-and-sparkline', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
