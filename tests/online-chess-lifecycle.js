async function runOnlineChessLifecycleTests(source) {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const cut = (a, b) => {
    const start = source.indexOf(a), end = source.indexOf(b, start);
    if (start < 0 || end < 0) throw new Error('Missing chess function boundary');
    return source.slice(start, end).trim();
  };
  const window = {};
  const env = { window, onlineChessMode: true, game: {}, ended: false,
    onlineChessRoomId: 'a', onlineChessOpponent: 'Trusted opponent', engineBusy: true,
    selectedSquare: 'e2', legalTargets: ['e3'], renderBoard() {}, setStatus(text) { env.status = text; }, setEngineStatus() {},
  };
  const finish = cut('window.finishOnlineChessFromOpponent = ', 'window.startOnlineChessBoard = ').replace(/^window.finishOnlineChessFromOpponent = /, '').replace(/;$/, '');
  window.finishOnlineChessFromOpponent = new Function('env', 'with(env){ return (' + finish + '); }')(env);
  window.finishOnlineChessFromOpponent('other');
  assert(!env.ended, 'Foreign room ended game');
  window.finishOnlineChessFromOpponent('a');
  assert(env.ended && !env.engineBusy && env.selectedSquare === null && env.legalTargets.length === 0, 'Resignation left game interactive');
  assert(env.status === 'Trusted opponent сдался. Ты победил!', 'Untrusted display name');
  let starts = 0;
  window.startOnlineChessBoard = async () => { starts++; };
  const rooms = [];
  const fixture = { window, currentUser: 'me', EDGE_FUNCTION_NAME: 'award-coins', activeChessRoomChannel: null,
    outgoingStatus: {}, status: {}, supabaseClient: {
      functions: { invoke: async () => ({ data: { success: true } }) },
      removeChannel: async () => {},
      channel: () => {
        const handlers = {};
        const room = { on(_type, filter, fn) { handlers[filter.event] = fn; return room; },
          subscribe(fn) { room.state = fn; }, handlers };
        rooms.push(room); return room;
      },
    },
  };
  const join = cut('window.joinChessRoom = async function', 'function renderChessOnlinePlayers()').replace(/^window.joinChessRoom = /, '').replace(/;$/, '');
  const joinRoom = new Function('env', 'with(env){ return (' + join + '); }')(fixture);
  await joinRoom('a', 'w', 'opponent');
  await rooms[0].state('SUBSCRIBED'); await rooms[0].state('SUBSCRIBED');
  assert(starts === 1, 'Reconnect reset board');
  await joinRoom('b', 'b', 'next');
  await rooms[0].state('SUBSCRIBED'); await rooms[1].state('SUBSCRIBED');
  assert(starts === 2, 'Removed room callback restarted old board');
  return { passed: 3, tests: ['foreign-room resignation ignored', 'resignation ends logical game', 'reconnect and removed channels preserve active board'] };
}
