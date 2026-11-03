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
