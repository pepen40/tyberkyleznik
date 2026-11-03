// Peer delivery for the existing private room. This is not a trusted result engine.
function createChessDelivery(options) {
  const { roomId, from, peer, send, history, applyMove, status, chat, resign, isCurrent } = options;
  const pending = new Map(), seen = new Set();
  let timer = null, connected = false, disposed = false, synchronized = false, missed = 0;
  const current = () => !disposed && isCurrent();
  function report(text, kind = 'delivery') { if (current()) status(text, kind); }
  function transmit(packet) {
    if (!current() || !connected) return;
    Promise.resolve().then(() => current() && send({ ...packet, roomId, from }))
      .catch(() => report('Ошибка отправки. Ожидаем подтверждения получателя.'));
  }
  function sync(request = true) { transmit({ kind: 'sync', moves: history(), request }); }
  function tick() {
    timer = null;
    if (!current()) return dispose();
    if (!connected) return;
    missed++;
    if (missed >= 3) { synchronized = false; report('Соперник не отвечает. Восстанавливаем связь…', 'sync'); }
    sync();
    for (const [id, packet] of pending) {
      if (++packet.attempts > 5) {
        pending.delete(id); report('Получатель не подтвердил сообщение. Можно отправить повторно.');
      } else transmit(packet);
    }
    timer = options.setTimer(tick, 3000);
  }
  function queue(kind, text, id = options.newId()) {
    if (!current() || (!connected && kind !== 'resign') || pending.size >= 20) return false;
    if (kind === 'chat' && (typeof text !== 'string' || !text.trim() || text.length > 1000)) return false;
    const packet = { kind, text, id, attempts: 1 };
    pending.set(id, packet); transmit(packet);
    report(connected ? 'Отправлено в канал. Ожидаем подтверждения получателя.' : 'Ответ сохранён. Ожидаем восстановления связи для отправки.');
    return true;
  }
  function receive(packet) {
    if (!current() || !connected || !packet || packet.roomId !== roomId || packet.from !== peer) return;
    if (packet.kind === 'sync') {
      const moves = packet.moves, own = history();
      if (!Array.isArray(moves) || moves.length > 1200 || !moves.every(move => typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))) return;
      if (own.some((move, i) => i < moves.length && moves[i] !== move)) {
        synchronized = false; report('Истории ходов расходятся. Ходы заблокированы.', 'sync'); return;
      }
      // A peer may extend our prefix only with its own next legal move. It
      // cannot invent our missing moves or replace an already accepted prefix.
      if (moves.length > own.length && (moves.length !== own.length + 1 || applyMove(moves[own.length]) !== true)) {
        synchronized = false; report('Не удалось проверить ход соперника.', 'sync'); return;
      }
      missed = 0;
      synchronized = history().length === moves.length;
      if (synchronized) report('Ходы синхронизированы.', 'sync');
      if (packet.request || moves.length !== own.length) sync(false);
      return;
    }
    if (typeof packet.id !== 'string' || packet.id.length > 80 || !packet.id) return;
    if (packet.kind === 'ack') {
      if (pending.delete(packet.id)) report('Получатель подтвердил сообщение.');
      return;
    }
    if (!['chat', 'resign'].includes(packet.kind)) return;
    if (packet.kind === 'chat' && (typeof packet.text !== 'string' || !packet.text.trim() || packet.text.length > 1000)) return;
    if (seen.has(packet.id)) { transmit({ kind: 'ack', id: packet.id }); return; }
    // Bound memory; stop accepting rather than evict IDs and duplicate old chat.
    if (seen.size >= 2000) { report('Лимит сообщений этой партии достигнут.'); return; }
    seen.add(packet.id);
    if (packet.kind === 'chat') chat(peer, packet.text); else resign();
    transmit({ kind: 'ack', id: packet.id });
  }
  function dispose() {
    disposed = true; synchronized = false;
    if (timer !== null) options.clearTimer(timer);
    timer = null; pending.clear();
  }
  return {
    receive, queue, dispose,
    changed() { synchronized = false; missed = 0; sync(); },
    setConnected(value) {
      connected = value; synchronized = false; missed = 0;
      if (timer !== null) options.clearTimer(timer);
      timer = null;
      if (current() && value) { sync(); pending.forEach(transmit); timer = options.setTimer(tick, 3000); }
    },
    canPlay: () => current() && connected && synchronized,
    isActive: current,
  };
}

// Compatibility adapter for the existing chess invitation UI. No shared
// Realtime topic is opened: all event-shaped data comes from authenticated SQL.
function createServerChessInvitations(options) {
  const handlers = new Map();
  let timer = null, polling = false, stopped = false, readyAccount = null, lastDeadline = null, onState = () => {};
  async function command(op, topic = '', value = '') {
    const result = await options.invoke({ action: 'game_invitation', data: { op, topic, value } });
    if (result.error || !result.data?.success) throw new Error('Invitation server unavailable');
    return result.data;
  }
  function emit(event, payload) { handlers.get(event)?.({ payload }); }
  async function poll() {
    if (stopped || polling) return;
    polling = true;
    const account = options.account();
    try {
      if (!account) return;
      const result = await command('list');
      if (stopped || options.account() !== account) return;
      if (readyAccount !== account) { readyAccount = account; onState('SUBSCRIBED'); }
      for (const row of result.invitations || []) {
        if (row.kind !== 'chess' || !row.topic?.startsWith('chess-room-')) continue;
        const id = row.topic.slice('chess-room-'.length);
        if (row.invitee_id === account && ['pending','received'].includes(row.status)) {
          // Translate server lifetime, not the sender browser's clock.
          const remaining = Math.max(0, Date.parse(row.expires_at) - Date.parse(result.server_now));
          if (remaining) emit('chess_invite', { id, target: options.username(), from: row.host, expiresAt: Date.now() + Math.min(30000, remaining) });
        } else if (row.host_id === account && row.status !== 'pending') {
          emit('chess_invite_answer', { id, target: options.username(), from: row.invitee,
            accepted: row.status === 'accepted', reason: row.status });
        }
      }
    } catch (_) { if (!stopped && options.account() === account) onState('CHANNEL_ERROR'); }
    finally {
      polling = false;
      if (!stopped) timer = options.setTimer(poll, 2000);
    }
  }
  return {
    on(_type, filter, fn) { handlers.set(filter.event, fn); return this; },
    subscribe(fn) { onState = fn; poll(); return this; },
    async send(message) {
      const account = options.account(), packet = message.payload;
      if (!account || !packet || stopped) return 'error';
      try {
        if (message.event === 'chess_invite') {
          const state = await command('create', 'chess-room-' + packet.id);
          lastDeadline = { id: packet.id, time: Date.now() + Math.max(0, Date.parse(state.invitation.expires_at) - Date.parse(state.server_now)) };
        }
        else if (message.event === 'chess_invite_answer') await command('reply', 'chess-room-' + packet.id, packet.reason || (packet.accepted ? 'accepted' : 'declined'));
        else return 'error';
        return !stopped && options.account() === account ? 'ok' : 'error';
      } catch (_) { return 'error'; }
    },
    deadline(id) { return lastDeadline?.id === id ? lastDeadline.time : null; },
    async cancel(id) { try { await command('cancel', 'chess-room-' + id); } catch (_) {} },
    stop() { stopped = true; if (timer !== null) options.clearTimer(timer); },
  };
}
