async function runChessDeliveryTests(source) {
  const create = new Function(source + '\nreturn createChessDelivery;')();
  const results = [];
  const assert = (v, m) => { if (!v) throw new Error(m); };
  async function test(name, fn) { await fn(); results.push(name); }
  function pair() {
    const wire = [], sides = [], timers = new Map(); let next = 0;
    for (let i = 0; i < 2; i++) {
      const side = { moves: [], chats: [], statuses: [], active: true, resigns: 0 };
      side.api = create({ roomId: 'room', from: String(i), peer: String(1-i),
        send: packet => { wire.push({ to: 1-i, packet }); return Promise.resolve('ok'); },
        history: () => [...side.moves],
        applyMove: move => { if (side.moves.length % 2 === i) return false; side.moves.push(move); return true; },
        status: text => side.statuses.push(text), chat: (_, text) => side.chats.push(text), resign: () => side.resigns++,
        isCurrent: () => side.active, newId: () => 'msg-' + ++next,
        setTimer: fn => { timers.set(++next, fn); return next; }, clearTimer: id => timers.delete(id),
      });
      sides.push(side);
    }
    async function flush(drop = () => false) {
      for (let n = 0; n < 20; n++) {
        await Promise.resolve();
        if (!wire.length) { await Promise.resolve(); if (!wire.length) return; }
        for (const item of wire.splice(0)) if (!drop(item)) sides[item.to].api.receive(item.packet);
      }
      throw new Error('Protocol did not settle');
    }
    function tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); }
    return { sides, wire, timers, flush, tick };
  }
  await test('reconnect recovers a missed move exactly once without resetting history', async () => {
    const p = pair(), [a,b] = p.sides;
    a.api.setConnected(true); b.api.setConnected(true); await p.flush();
    assert(a.api.canPlay() && b.api.canPlay(), 'Initial synchronization failed');
    b.api.setConnected(false); a.moves.push('e2e4'); a.api.changed(); await p.flush();
    assert(b.moves.length === 0, 'Disconnected endpoint received move');
    b.api.setConnected(true); await p.flush();
    assert(b.moves.join() === 'e2e4' && a.api.canPlay(), 'Missed move not recovered/acknowledged');
    p.tick(); await p.flush(); assert(b.moves.length === 1, 'Sync duplicated move');
  });
  await test('conflicting or fabricated histories cannot replace accepted moves', async () => {
    const p = pair(), [a,b] = p.sides; a.api.setConnected(true); b.api.setConnected(true); await p.flush();
    a.moves.push('e2e4'); b.moves.push('d2d4'); a.api.changed(); await p.flush();
    assert(!b.api.canPlay() && b.moves[0] === 'd2d4', 'Conflict overwritten');
    b.api.receive({ kind: 'sync', moves: ['d2d4','e7e5','g1f3'], roomId: 'room', from: '0' });
    assert(b.moves.length === 1, 'Peer invented our moves');
  });
  await test('lost chat ACK retries the same ID and renders once', async () => {
    const p = pair(), [a,b] = p.sides; a.api.setConnected(true); b.api.setConnected(true); await p.flush();
    a.api.queue('chat', 'hello'); await p.flush(item => item.packet.kind === 'ack');
    p.tick(); await p.flush();
    assert(b.chats.length === 1 && a.statuses.some(text => text.includes('подтвердил')), 'ACK/deduplication failed');
  });
  await test('channel success never claims receipt from an unavailable peer', async () => {
    const p = pair(), [a,b] = p.sides; a.api.setConnected(true); b.api.setConnected(false);
    a.api.queue('chat', 'offline');
    for (let i = 0; i < 6; i++) { await p.flush(); p.tick(); }
    await p.flush();
    assert(!a.statuses.some(t => t === 'Получатель подтвердил сообщение.'), 'Transport ACK treated as peer ACK');
    assert(a.statuses.some(t => t.includes('не подтвердил')), 'No bounded delivery failure');
  });
  await test('wrong sender, room and duplicate resign are handled safely', async () => {
    const p = pair(), [a,b] = p.sides; a.api.setConnected(true); b.api.setConnected(true); await p.flush();
    b.api.receive({ kind: 'resign', id: 'x', roomId: 'elsewhere', from: '0' });
    b.api.receive({ kind: 'resign', id: 'x', roomId: 'room', from: 'outsider' });
    assert(b.resigns === 0, 'Invalid envelope accepted');
    const packet = { kind: 'resign', id: 'x', roomId: 'room', from: '0' };
    b.api.receive(packet); b.api.receive(packet); assert(b.resigns === 1, 'Duplicate resignation');
  });
  await test('account change and disposal stop pending callbacks and timers', async () => {
    const p = pair(), [a] = p.sides; a.api.setConnected(true); a.active = false;
    p.tick(); await p.flush(); assert(!a.api.canPlay() && !a.api.queue('chat','x'), 'Stale account active');
    assert(p.timers.size === 0, 'Stale account timer survived');
  });
  await test('resignation during disconnect is delivered once on reconnect', async () => {
    const p = pair(), [a,b] = p.sides; a.api.setConnected(false); b.api.setConnected(true);
    assert(a.api.queue('resign'), 'Offline resignation was silently dropped'); await p.flush();
    assert(b.resigns === 0, 'Disconnected sender transmitted');
    a.api.setConnected(true); await p.flush(); p.tick(); await p.flush();
    assert(b.resigns === 1, 'Reconnected resignation missing or duplicated');
  });
  return { passed: results.length, tests: results };
}
