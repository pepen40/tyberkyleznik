// Frozen vulnerable handler from 18f28dc; test fixture only, never loaded by site.
function vulnerableChessInviteAnswer(env, payload) {
  with (env) {

            const data = payload.payload;

            if (!data || !outgoingInvite) return;
            if (data.id !== outgoingInvite.id) return;
            if (data.target !== currentUser) return;
            if (data.from !== outgoingInvite.target || outgoingInvite.account !== currentAuthUserId || outgoingInvite.expiresAt <= Date.now()) return;
            if (!['received', 'accepted', 'declined', 'disabled', 'busy', 'expired'].includes(data.reason) || data.accepted !== (data.reason === 'accepted')) return;
            if (data.reason === 'received') {
                outgoingInvite.received = true;
                outgoingStatus.textContent = 'Получение подтверждено. Ожидаем решения…';
                return;
            }

            const target = outgoingInvite.target;
            clearTimeout(outgoingInvite.timer);
            clearTimeout(outgoingInvite.expiryTimer);
            outgoingInvite = null;

            if (outgoingStatus) {
                outgoingStatus.textContent = data.accepted
                    ? target + ' принял вызов! Подключаем шахматную комнату…'
                    : target + ({ disabled: ' отключил шахматные приглашения.', busy: ' занят другой игрой или приглашением.', expired: ': приглашение истекло.', declined: ' отклонил шахматный вызов.' }[data.reason] || ' не подтвердил вызов.');
            }
            if (data.accepted) {
                switchTab('chess');
                window.joinChessRoom(data.id, 'w', target);
            }
        
  }
}
