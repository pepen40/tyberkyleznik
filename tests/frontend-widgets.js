// Dependency-free regression harness. Call runFrontendWidgetTests(indexHtml).
// Uses the actual inline scripts with small DOM/timer mocks; this is not browser E2E.
function runFrontendWidgetTests(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1])).map(match => match[2]);
  const results = [];
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function test(name, run) { run(); results.push(name); }
  function events(target = {}) {
    const listeners = new Map();
    target.addEventListener = (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
    };
    target.emit = (name, event = {}) => (listeners.get(name) || []).forEach(fn => fn(event));
    return target;
  }
  function monitor(saved, storageThrows = false) {
    const rows = Array.from({ length: 16 }, () => ({ textContent: '' }));
    const overlay = { dataset: {}, querySelectorAll: () => rows };
    const toggle = events();
    const document = events({ hidden: false, getElementById: id => id === 'performance-overlay' ? overlay : toggle });
    const frames = new Map(), timers = new Map();
    let nextId = 1;
    const localStorage = {
      getItem: () => { if (storageThrows) throw new Error('Storage denied'); return saved; },
      setItem: () => { if (storageThrows) throw new Error('Storage denied'); }
    };
    const run = () => new Function('document', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout',
      scripts.find(source => source.includes('function syncMonitor()')))(document, localStorage,
      fn => { const id = nextId++; frames.set(id, fn); return id; }, id => frames.delete(id),
      fn => { const id = nextId++; timers.set(id, fn); return id; }, id => timers.delete(id));
    run();
    return { overlay, toggle, document, frames, timers, run };
  }
  test('all inline scripts compile', () => scripts.forEach(source => new Function(source)));
  test('FPS starts exactly one frame loop and one simulation timer', () => {
    const m = monitor(null);
    assert(m.frames.size === 1 && m.timers.size === 1, 'Monitor did not start exactly once');
    m.run();
    assert(m.frames.size === 1 && m.timers.size === 1, 'Repeated initialization duplicated loops');
    const [id, frame] = [...m.frames][0]; m.frames.delete(id); frame(100);
    assert(m.frames.size === 1, 'Frame iteration duplicated or lost the loop');
  });
  test('FPS toggle and page visibility cancel and resume work', () => {
    const m = monitor(null);
    m.toggle.checked = false; m.toggle.emit('change');
    assert(m.overlay.hidden && !m.frames.size && !m.timers.size, 'Hidden monitor continues work');
    m.toggle.checked = true; m.toggle.emit('change');
    assert(m.frames.size === 1 && m.timers.size === 1, 'Enabled monitor did not resume');
    m.document.hidden = true; m.document.emit('visibilitychange');
    assert(!m.frames.size && !m.timers.size, 'Background tab continues work');
    m.document.hidden = false; m.document.emit('visibilitychange');
    assert(m.frames.size === 1 && m.timers.size === 1, 'Foreground monitor did not resume');
  });
  test('FPS respects saved disabled state and tolerates denied storage', () => {
    const disabled = monitor('false');
    assert(disabled.overlay.hidden && !disabled.frames.size, 'Saved setting ignored');
    const denied = monitor(null, true);
    denied.toggle.checked = false; denied.toggle.emit('change');
    assert(!denied.frames.size, 'Storage error prevented toggle');
  });
  function clock(saved = {}) {
    const nodes = new Map();
    for (const id of ['antique-hour', 'antique-minute', 'antique-second', 'antique-tick', 'antique-cuckoo', 'antique-clock', 'clock-bird', 'clock-toggle', 'clock-sound-toggle']) {
      nodes.set(id, events({ checked: true, paused: true, plays: 0, currentTime: 0,
        style: { setProperty(key, value) { this[key] = value; } },
        classList: { add() {}, remove() {} },
        play() { this.paused = false; this.plays++; return Promise.resolve(); },
        pause() { this.paused = true; }
      }));
    }
    const document = events({ hidden: false, getElementById: id => nodes.get(id) });
    const window = events();
    const localStorage = { getItem: key => saved[key] ?? null, setItem: (key, value) => { saved[key] = value; } };
    new Function('document', 'window', 'localStorage', 'setInterval',
      scripts.find(source => source.includes('function syncClockAudio()')))(document, window, localStorage, () => 1);
    return { nodes, document, window, saved };
  }
  test('clock does not autoplay and obeys sound/visibility toggles', () => {
    const c = clock(), tick = c.nodes.get('antique-tick');
    assert(tick.plays === 0, 'Clock autoplayed before gesture');
    c.document.emit('pointerdown'); assert(!tick.paused, 'Clock did not start after gesture');
    c.nodes.get('clock-toggle').checked = false; c.window.toggleAntiqueClock();
    assert(tick.paused, 'Hidden clock still ticking');
    c.nodes.get('clock-sound-toggle').checked = true; c.window.toggleAntiqueClockSound();
    assert(tick.paused, 'Sound toggle restarted a hidden clock');
    c.nodes.get('clock-toggle').checked = true; c.window.toggleAntiqueClock();
    assert(!tick.paused, 'Shown clock did not resume');
    c.document.hidden = true; c.document.emit('visibilitychange');
    assert(tick.paused, 'Clock ticks in background');
    c.document.hidden = false; c.document.emit('visibilitychange');
    assert(!tick.paused, 'Clock did not resume in foreground');
    c.nodes.get('clock-sound-toggle').checked = false; c.window.toggleAntiqueClockSound();
    assert(tick.paused && c.saved.antiqueClockSoundEnabled === 'false', 'Sound setting not applied/saved');
  });
  test('clock restores saved hidden and muted states', () => {
    const c = clock({ antiqueClockEnabled: 'false', antiqueClockSoundEnabled: 'false' });
    c.document.emit('pointerdown');
    assert(c.nodes.get('antique-clock').style.display === 'none', 'Hidden setting ignored');
    assert(c.nodes.get('antique-tick').plays === 0, 'Muted clock played');
  });
  return { passed: results.length, tests: results, inlineScripts: scripts.length };
}
