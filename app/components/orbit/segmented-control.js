import { mount as mountPattern } from './runtime/orbit.js';

export function mount(target, options = {}) {
  return mountPattern('segmented-control', target, options);
}

export { prepare, setTheme } from './runtime/orbit.js';
