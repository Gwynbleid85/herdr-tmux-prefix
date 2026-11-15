const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the actual mod. Only the native GPUI renderer and Herdr process API
// are replaced: neither is available in Node.
function setup(viewport = { width: 1800, height: 1130 }) {
  const calls = [], timers = [];
  // Chainable renderer with inspectable output, not a mock of the mod itself.
  function node() {
    const data = { items: [], attrs: {} };
    const proxy = new Proxy(data, { get(target, name) {
      if (name in target) return target[name];
      return (...args) => {
        if (name === 'child') target.items.push(args[0]);
        else if (name === 'children') target.items.push(...args[0]);
        else target.attrs[name] = args;
        return proxy;
      };
    }});
    return proxy;
  }
  const context = {
    View: class {}, div: node, v_flex: node, h_flex: node,
    window: { viewport_size: () => viewport },
    closeOverlay: id => calls.push(['close', id]),
    focused: () => ({ terminal: 't1' }),
    hc: args => { calls.push(['hc', ...args]); return Promise.resolve({ code: 0, stderr: '' }); },
    nextCommand: () => new Promise(() => {}), props: () => ({ overlay: 'prefix' }),
    run: (command, args) => calls.push(['run', command, JSON.parse(JSON.stringify(args))]),
    theme: () => ({ popover: '#111', foreground: '#fff', accent: '#aaf', muted: '#999', dim: '#666' }), console,
  };
  const source = readFileSync(path.join(__dirname, '../mods/tmux-prefix/main.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default class TmuxPrefix', 'globalThis.TmuxPrefix = class TmuxPrefix');
  vm.runInNewContext(source, context);
  const cx = { focus_handle: () => ({ focus() {} }), spawn() {}, notify() {}, stop_propagation() {}, timer: { after: (ms, fn) => timers.push({ ms, fn }) } };
  const view = new context.TmuxPrefix();
  view.init({}, cx);
  function press(key, extra = {}) {
    view.key({ key, key_char: key.length === 1 ? key : null, modifiers: { control: false, alt: false, platform: false, shift: false, ...extra } }, cx);
  }
  return { view, calls, timers, press };
}
function text(tree) {
  return typeof tree === 'string' ? tree : tree.items.map(text).join(' ');
}

test('prefix shows only a bottom-right indicator and keeps a key handler', () => {
  const { view } = setup();
  const tree = view.render();
  assert.equal(text(tree), '[prefix]');
  const indicator = tree.items[0];
  assert.deepEqual(indicator.attrs.right, [14]);
  assert.deepEqual(indicator.attrs.bottom, [0]);
  assert.deepEqual(indicator.attrs.h, [28]);
  assert.ok(indicator.attrs.items_center);
  assert.deepEqual(indicator.attrs.text_color, ['#999']);
  assert.deepEqual(indicator.attrs.text_size, [11.8]);
  assert.equal(indicator.attrs.bg, undefined);
  assert.equal(indicator.attrs.rounded, undefined);
  assert.ok(indicator.attrs.absolute);
  assert.deepEqual(tree.attrs.left, [-8]);
  assert.deepEqual(tree.attrs.top, [-8]);
  assert.deepEqual(tree.attrs.w, [1800]);
  assert.deepEqual(tree.attrs.h, [1130]);
  assert.ok(tree.attrs.track_focus);
  assert.ok(tree.attrs.on_key_down);
  assert.equal(tree.attrs.bg, undefined);
});
test('? shows full help and a second ? hides it', () => {
  const { view, press } = setup();
  press('?');
  assert.match(text(view.render()), /Split right/);
  assert.match(text(view.render()), /Tab 10/);
  assert.match(text(view.render()), /\[prefix\]/);
  press('?');
  assert.equal(text(view.render()), '[prefix]');
});
test('manifest removes the host frame and spans the window', () => {
  const manifest = JSON.parse(readFileSync(path.join(__dirname, '../mods/tmux-prefix/mod.json')));
  assert.equal(manifest.overlay.frame, 'none');
  assert.equal(manifest.overlay.width, 1);
  assert.equal(manifest.overlay.height, 1);
  assert.equal(manifest.overlay.offset, 0);
});
test('split and Escape still dismiss prefix mode', () => {
  const { press, calls } = setup();
  press('%');
  assert.deepEqual(calls, [['close', 'prefix'], ['run', 'pane.split', { direction: 'right' }]]);
  const second = setup(); second.press('escape');
  assert.deepEqual(second.calls, [['close', 'prefix']]);
});
test('repeat restarts 500ms timer and keeps only the indicator', () => {
  const { view, press, timers, calls } = setup();
  press('j'); press('j');
  assert.deepEqual(timers.map(t => t.ms), [500, 500]);
  timers[0].fn(); assert.equal(calls.filter(c => c[0] === 'close').length, 0);
  assert.equal(text(view.render()), '[prefix]');
  timers[1].fn(); assert.deepEqual(calls.at(-1), ['close', 'prefix']);
});
test('help cancels a pending repeat timeout', () => {
  const { view, press, timers, calls } = setup();
  press('j'); press('?'); timers[0].fn();
  assert.equal(calls.filter(c => c[0] === 'close').length, 0);
  assert.match(text(view.render()), /Split right/);
});
test('indicator root uses current window dimensions on each render', () => {
  const viewport = { width: 900, height: 600 };
  const { view } = setup(viewport);
  assert.deepEqual(view.render().attrs.w, [900]);
  viewport.width = 1200; viewport.height = 800;
  const resized = view.render();
  assert.deepEqual(resized.attrs.w, [1200]);
  assert.deepEqual(resized.attrs.h, [800]);
});
test('outside click dismisses while help clicks stop propagation', () => {
  const { view, press, calls } = setup();
  view.render().attrs.on_mouse_down[1]();
  assert.deepEqual(calls, [['close', 'prefix']]);
  const second = setup(); second.press('?');
  const help = second.view.render().items[1];
  let stopped = false;
  help.attrs.on_mouse_down[1]({}, { stop_propagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.deepEqual(second.calls, []);
});
test('Ctrl+B forwards a literal prefix to the terminal', () => {
  const { press, calls } = setup();
  press('b', { control: true });
  assert.deepEqual(calls, [['hc', 'keys', 't1', 'ctrl+b'], ['close', 'prefix']]);
});
