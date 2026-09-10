/** Orbit 0.2 · HTML, CSS and DOM interactions. No framework runtime required. */
const base = new URL('.', import.meta.url);
let ready;
const scripts = ['motion.js', 'numbers.js', 'app.js', 'controls.js', 'starter.js', 'agents.js', 'extras.js'];
const styles = ['tokens.css', 'styles.css', 'motion.css', 'numbers.css', 'controls.css', 'starter.css', 'agents.css', 'extras.css'];
export const slugify = name => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function initialize() {
  return ready ??= (async () => {
    window.OrbitEmbed = true;
    const css = styles.map(file => new Promise((resolve, reject) => {
      if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => new URL(link.href).pathname === new URL(file, base).pathname)) { resolve(); return; }
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL(file, base);
      link.onload = resolve; link.onerror = () => reject(new Error(`Could not load ${file}`)); document.head.append(link);
    }));
    const support = await fetch(new URL('support.html', base));
    if (!support.ok) throw new Error('Could not load Orbit overlay templates.');
    const host = document.createElement('div'); host.dataset.orbitSupport = ''; host.innerHTML = await support.text(); document.body.append(host);
    for (const file of scripts) await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = new URL(file, base);
      script.onload = resolve; script.onerror = () => reject(new Error(`Could not load ${file}`)); document.head.append(script);
    });
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('cancel', event => { if (!event.defaultPrevented) { event.preventDefault(); window.OrbitMotion.closeDialog(dialog); } });
      dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) window.OrbitMotion.closeDialog(dialog); });
    });
    window.OrbitIcon && host.querySelectorAll('[data-icon]').forEach(el => el.outerHTML = window.OrbitIcon(el.dataset.icon));
    await Promise.all(css);
    return window.OrbitCatalog;
  })();
}
export async function getComponents() { return (await initialize()).map(c => ({ ...c, slug: slugify(c.name) })); }
/** Enhance copied component HTML. Call once for each newly inserted subtree. */
export async function prepare(root) {
  await initialize();
  if (!(root instanceof Element)) throw new TypeError('Orbit prepare() needs an Element.');
  root.classList.add('specimen-body', 'orbit-component');
  const scope = `orbit-${crypto.randomUUID()}`;
  root.querySelectorAll('input[type="radio"][name]').forEach(input => { if (!input.form) input.name = `${scope}-${input.name}`; });
  window.OrbitPrepare(root);
  window.OrbitNumbers.prepare(root);
  window.OrbitMotion.prepare(root);
  return root;
}
/** Mount a working example by slug. Configure its real DOM; connect application services in your handlers. */
export async function mount(slug, target, options = {}) {
  const catalog = await getComponents();
  const component = catalog.find(c => c.slug === slug);
  if (!component) throw new RangeError(`Unknown Orbit component: ${slug}`);
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(container instanceof Element)) throw new TypeError('Orbit mount() needs a matching selector or Element.');
  let element, controller, destroyed = false;
  async function render() {
    controller?.abort();
    if (element) element.remove();
    element = document.createElement('div'); element.dataset.orbitComponent = slug; element.innerHTML = component.html;
    container.append(element); await prepare(element);
    if (destroyed) { element.remove(); return; }
    options.configure?.(element);
    controller = new AbortController();
    for (const [event, callback] of [['input', options.onInput], ['change', options.onChange], ['click', options.onAction]]) {
      if (callback) element.addEventListener(event, e => queueMicrotask(() => { if (!destroyed) callback(e, element); }), { signal: controller.signal });
    }
  }
  await render();
  return {
    get element() { return element; },
    async reset() { if (destroyed) throw new Error('Cannot reset a destroyed Orbit component.'); await render(); },
    destroy() { destroyed = true; controller?.abort(); element.querySelectorAll(':popover-open').forEach(p => p.hidePopover()); element.getAnimations({subtree:true}).forEach(a => a.cancel()); element.remove(); }
  };
}
export function setTheme(theme) {
  if (!['light', 'dark'].includes(theme)) throw new RangeError('Theme must be light or dark.');
  document.documentElement.dataset.theme = theme;
}
