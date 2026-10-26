const SUPABASE_URL = 'https://zfvinbamwavibnhmfwnz.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmdmluYmFtd2F2aWJuaG1md256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4ODE2MjAsImV4cCI6MjEwODQ1NzYyMH0.FT5tlKgLUCrFs0zzY-BGimCmU9qNZmIzMW8LyysMmgE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const EDGE_FUNCTION_NAME = 'award-coins'; 
const battleBackgrounds = ['bg1.png', 'bg2.png', 'bg3.png', 'bg4.png', 'bg5.png', 'bg6.png'];

// === АВТОЛОГИН И ПОГОДА ===
window.addEventListener('load', () => {
    // Автологин
    const savedUser = localStorage.getItem('pepen_user');
    if (savedUser) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        document.getElementById('username').value = savedUser;
        login(); 
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-screen').classList.add('hidden');
    }

    // Загрузка настроек погоды
    const isWeatherOn = localStorage.getItem('pepen_weather') === 'true';
    const wt = document.getElementById('weather-toggle');
    if (wt) wt.checked = isWeatherOn;
    if (isWeatherOn) document.getElementById('weather-widget').classList.remove('hidden');
});

function toggleWeather() {
    const isChecked = document.getElementById('weather-toggle').checked;
    localStorage.setItem('pepen_weather', isChecked);
    if (isChecked) {
        document.getElementById('weather-widget').classList.remove('hidden');
    } else {
        document.getElementById('weather-widget').classList.add('hidden');
    }
}

function logout() {
    if (!confirm("Выйти с аккаунта?")) return;
    localStorage.removeItem('pepen_user');
    location.reload();
}

const itemDatabase = {
    "хуйня": { desc: "На самом деле это не хуйня а аппарат жизнеобеспечения. подключи ее в разьем и тебе начислится 20 хп", chance: "30-40%" },
    "картофель": { desc: "когда то давно влад пошел мыть картошку но так как леха занял все ведра головами рыб ,окурками, говном, щинячьими цоботами, цокольной хуйней, пастой, дрыном, рырями и прочим хламом ему пришлось мыть ее в ванне , но случилось так что он о ней забыл она проросла и синтезировала в себе ебанутый допинг который придает сил. Используй и получишь +10 к Аттаке!", chance: "25%" },
    "голова барана": { desc: "ее удалось спиздить у дяди мухмеда . если ебануть такую в кого нибудь то оно снесет 40 хп!", chance: "15%" },
    "коала": { desc: "коала. восстановит ману на 100%.", chance: "10%" },
    "apostol": { desc: "apostol. apostol! apostol!!!", chance: "3%" },
    "парашник": { desc: "ставишь его он пускает пары и отравляет противника также забирает его ману. наносит 10 урона и сжигает 15 маны в течение 3 ходов. имеет 30 хп.", chance: "20%" },
    "boris": { desc: "ставишь его и он поглощает в себя весь урон от врага. но он не вечный. у него 60 хп.", chance: "3%" },
    "шприц и лекарство": { desc: "100% лечение персонажа. восстанавливает все здоровье.", chance: "12%" },
    "Сбриватель хуйни": { desc: "с одного применения убирает всю хуйню которую поставил противник (boris, парашник). урон не наносит.", chance: "7%" },
    "Вам не повезло": { desc: "вам крупно повезло вам нихуя не выпало!", chance: "6-28%" }
};

let currentUser = null;
let currentHighScore = 0;
let currentCoins = 0;
let currentItemPoints = 0;
let currentPvpPts = 0;
let currentInventory = []; 
let currentUpgrades = {"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}};
let currentMaxFloors = {"ashab":0,"apostol":0,"mee":0};
const rarityWeight = { 'Легендарное': 5, 'Сверхредкое': 4, 'Эпическое': 3, 'Редкое': 2, 'Обычное': 1, 'Мусор': 0 };

let onlineChannel = null;
let lobbyChannel = null;
let roomChannel = null;
let myRoomId = null;
let pvpRooms = {};
let onlinePlayers = [];

let pendingChallengeTarget = null;
let pendingChallengeRoomId = null;
let pendingChallengeHost = null;

const soundCache = {};
function preloadSounds() {
    const sounds = { 'attack': 'attack.mp4', 'protection': 'protection.mp4', 'heal': 'heal.mp4', 'harmful': 'harmful.mp4', 'thing': 'thing.mp4', 'shaver': 'shaver.mp4', 'crit': 'crit.mp4' };
    for (let key in sounds) {
        let audio = new Audio(sounds[key]);
        audio.preload = 'auto';
        audio.volume = 1.0; 
        soundCache[key] = audio;
    }
}

function playSoundEffect(type) {
    if (soundCache[type]) {
        let clone1 = soundCache[type].cloneNode();
        clone1.volume = 1.0; 
        clone1.play().catch(e => console.log("Звук заблокирован:", e));

        if (type === 'shaver' || type === 'crit') {
            let clone2 = soundCache[type].cloneNode();
            clone2.volume = 1.0; 
            clone2.play().catch(e => console.log("Звук заблокирован:", e));
        }
    }
}

function triggerScreenShake() {
    const body = document.querySelector('.panel:not(.hidden)') || document.body;
    body.classList.add('shake');
    setTimeout(() => { body.classList.remove('shake'); }, 300);
}

function flashRedScreen() {
    const flash = document.createElement('div');
    flash.className = 'damage-flash';
    document.body.appendChild(flash);
    setTimeout(() => { flash.remove(); }, 400);
}

function initOnlineCounter() {
    onlineChannel = supabaseClient.channel('online-users', { config: { presence: { key: currentUser } } });
    onlineChannel.on('presence', { event: 'sync' }, () => {
        const state = onlineChannel.presenceState();
        onlinePlayers = Object.keys(state);
        document.getElementById('ui-online').innerText = onlinePlayers.length;
        if(!document.getElementById('pvp-lobby-modal').classList.contains('hidden')){ renderPvpRooms(); }
    }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await onlineChannel.track({ online_at: new Date().toISOString() });
            listenForChallenges();
        }
    });
}

function initLobby() {
    if(lobbyChannel) supabaseClient.removeChannel(lobbyChannel);
    lobbyChannel = supabaseClient.channel('pvp_lobby', { config: { presence: { key: currentUser } } });
    lobbyChannel.on('presence', { event: 'sync' }, () => {
        const state = lobbyChannel.presenceState();
        pvpRooms = {};
        for (const id in state) {
            state[id].forEach(presence => {
                if (presence.room) { pvpRooms[presence.room.roomId] = presence.room; }
            });
        }
        if(!document.getElementById('pvp-lobby-modal').classList.contains('hidden')){ renderPvpRooms(); }
    });
    lobbyChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { await lobbyChannel.track({ online: true }); }
    });
}

function initPvpChat(roomId) {
    const logBox = document.getElementById('pvp-log');
    if (logBox) logBox.innerHTML = '';
}

function addPvpChatMessage(nick, text) {
    const logBox = document.getElementById('pvp-log');
    if (!logBox) return;
    const msg = document.createElement('div');
    msg.style.color = '#00ffff';
    const nickSpan = document.createElement('span');
    nickSpan.style.fontWeight = 'bold';
    nickSpan.textContent = '[ЧАТ] ' + nick + ':';
    msg.appendChild(nickSpan);
    msg.appendChild(document.createTextNode(' ' + text));
    logBox.appendChild(msg);
    logBox.scrollTop = logBox.scrollHeight;
}

function sendPvpMessage() {
    const input = document.getElementById('pvp-chat-input');
    if (!input || !roomChannel) return;
    const text = input.value.trim();
    if (!text) return;
    roomChannel.send({ type: 'broadcast', event: 'chat_message', payload: { nick: currentUser, text: text } });
    addPvpChatMessage(currentUser, text);
    input.value = '';
}

function getImgTag(imgName) {
    if (!imgName) return '<span style="font-size: 20px;">📎</span>';
    return `<img src="${imgName}" class="inv-card-img" onerror="this.src='https://via.placeholder.com/50?text=NO'">`;
}

function getProcessedInventory() {
    let grouped = {};
    currentInventory.forEach(item => {
        if (!grouped[item.name]) grouped[item.name] = { ...item, qty: 0 };
        grouped[item.name].qty++;
    });
    return Object.values(grouped).sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));
}

async function register() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    if (!u || !p) return;
    if (!/^[a-zA-Zа-яА-Я0-9_]{3,20}$/.test(u)) { document.getElementById('auth-msg').textContent = "Ник: 3-20 символов, буквы/цифры/_"; return; }
    const { data: existing } = await supabaseClient.from('players').select('username').eq('username', u);
    if (existing && existing.length > 0) { document.getElementById('auth-msg').textContent = "Ник занят."; return; }
    const { error } = await supabaseClient.from('players').insert([{ 
        username: u, password: p, max_score: 0, coins: 200, inventory: [], item_points: 0,
        rpg_upgrades: {"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}},
        rpg_max_floors: {"ashab":0,"apostol":0,"mee":0}, pvp_pts: 0
    }]);
    if (error) document.getElementById('auth-msg').textContent = "Ошибка: " + error.message;
    else { document.getElementById('auth-msg').style.color = "green"; document.getElementById('auth-msg').textContent = "Успех! Жми Войти."; }
}

async function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    if (!u || !p) return;
    const { data, error } = await supabaseClient.from('players').select('*').eq('username', u).eq('password', p).single();
    if (error || !data) { document.getElementById('auth-msg').textContent = "Неверный ник или пароль."; }
    else {
        currentUser = data.username;
        currentHighScore = data.max_score || 0;
        currentCoins = data.coins || 0;
        currentInventory = data.inventory || [];
        currentItemPoints = data.item_points || 0;
        currentPvpPts = data.pvp_pts || 0;
        currentUpgrades = data.rpg_upgrades || {"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}};
        currentMaxFloors = data.rpg_max_floors || {"ashab":0,"apostol":0,"mee":0};
        await supabaseClient.from('players').update({ last_online: new Date().toISOString() }).eq('username', u);
        
        localStorage.setItem('pepen_user', currentUser);

        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        preloadSounds(); 
        initOnlineCounter();
        initLobby();
        updateUI();
        resetGame();
        renderCharStats();
        switchTab('game');
    }
}

function updateUI() {
    document.getElementById('ui-username').textContent = currentUser;
    document.getElementById('ui-highscore').textContent = currentHighScore;
    document.getElementById('ui-coins').textContent = currentCoins;
    let elItemPoints = document.getElementById('ui-item-points');
    if (elItemPoints) elItemPoints.textContent = currentItemPoints;
    let elPvp = document.getElementById('ui-pvp');
    if (elPvp) elPvp.textContent = currentPvpPts;
    ['ashab', 'apostol', 'mee'].forEach(c => {
        let u = currentUpgrades[c];
        let elHpLvl = document.getElementById(`lvl-${c}-hp`);
        let elAtkLvl = document.getElementById(`lvl-${c}-atk`);
        let btnHp = document.getElementById(`btn-${c}-hp`);
        let btnAtk = document.getElementById(`btn-${c}-atk`);
        if(elHpLvl) elHpLvl.innerText = u.hp;
        if(elAtkLvl) elAtkLvl.innerText = u.atk;
        if(btnHp) btnHp.innerText = `Качать HP (${100 + (u.hp * 50)}м)`;
        if(btnAtk) btnAtk.innerText = `Качать АТК (${150 + (u.atk * 50)}м)`;
    });
}

function renderCharStats() {
    ['ashab', 'apostol', 'mee'].forEach(c => {
        let maxF = currentMaxFloors[c] || 0;
        let el = document.getElementById(`max-floor-${c}`);
        if (el) el.innerText = `Рекорд: ${maxF > 0 ? maxF.toFixed(1) : '0.0'} этаж`;
    });
}

function switchTab(tab) {
    ['game', 'rpg', 'cases', 'inventory', 'market', 'leaderboard', 'howto', 'settings'].forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('tab-' + tab);
    if (target) target.classList.remove('hidden');
    const bgMusic = document.getElementById('battle-music');
    if (tab !== 'rpg') { bgMusic.pause(); bgMusic.currentTime = 0; }
    if (tab === 'inventory') renderInventory();
    if (tab === 'market') renderMarket();
    if (tab === 'leaderboard') renderLeaderboard();
    if (tab === 'rpg') renderCharStats();
}

async function buyUpgrade(charType, statType) {
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'buy_upgrade', username: currentUser, data: { charType, statType } }
        });
        if (error) { alert("Ошибка сети: " + error.message); return; }
        if (data.error) { alert(data.error); return; }
        currentCoins = data.newCoins; currentUpgrades = data.newUpgrades; updateUI();
    } catch(e) { alert("Фатальная ошибка: " + e.message); }
}

function openItemInfo(itemName) {
    const db = itemDatabase[itemName] || { desc: "Описание отсутствует.", chance: "???" };
    let rarity = "Мусор"; let img = "";
    let foundItem = currentInventory.find(i => i.name === itemName);
    if (foundItem) { rarity = foundItem.rarity; img = foundItem.img; } 
    else {
        const lootTable = {
            "хуйня": { r: "Обычное", i: "img_huynya.png" }, "картофель": { r: "Редкое", i: "img_kartofel.png" },
            "голова барана": { r: "Сверхредкое", i: "img_baran.png" }, "коала": { r: "Эпическое", i: "img_koala.png" },
            "apostol": { r: "Легендарное", i: "img_apostol.png" }, "парашник": { r: "Редкое", i: "img_parashnik.png" },
            "boris": { r: "Легендарное", i: "img_boris.png" }, "шприц и лекарство": { r: "Эпическое", i: "img_syringe.png" },
            "Сбриватель хуйни": { r: "Сверхредкое", i: "img_shaver.png" }, "Вам не повезло": { r: "Мусор", i: "" }
        };
        if (lootTable[itemName]) { rarity = lootTable[itemName].r; img = lootTable[itemName].i; }
    }
    document.getElementById('info-img').src = img || 'https://via.placeholder.com/100?text=ITEM';
    document.getElementById('info-img').onerror = function() { this.src = 'https://via.placeholder.com/100?text=NO+IMG'; };
    document.getElementById('info-name').innerText = itemName;
    document.getElementById('info-rarity').innerText = rarity;
    document.getElementById('info-rarity').className = `rarity-${rarity}`;
    document.getElementById('info-desc').innerHTML = `<b>Шанс выпадения:</b> ${db.chance}<br><br>${db.desc}`;
    document.getElementById('item-info-modal').classList.remove('hidden');
}

function closeItemInfo() { document.getElementById('item-info-modal').classList.add('hidden'); }

function openCaseContents(price) {
    const list = document.getElementById('case-contents-list');
    const title = document.getElementById('case-contents-title');
    list.innerHTML = '';
    let items = [];
    if(price === 250) {
        title.innerText = "Содержимое Стандартного Кейса";
        items = [
            { name: "хуйня", rarity: "Обычное", img: "img_huynya.png" }, { name: "картофель", rarity: "Редкое", img: "img_kartofel.png" },
            { name: "голова барана", rarity: "Сверхредкое", img: "img_baran.png" }, { name: "коала", rarity: "Эпическое", img: "img_koala.png" },
            { name: "apostol", rarity: "Легендарное", img: "img_apostol.png" }, { name: "Вам не повезло", rarity: "Мусор", img: "" }
        ];
    } else {
        title.innerText = "Содержимое Премиум Кейса";
        items = [
            { name: "хуйня", rarity: "Обычное", img: "img_huynya.png" }, { name: "парашник", rarity: "Редкое", img: "img_parashnik.png" },
            { name: "boris", rarity: "Легендарное", img: "img_boris.png" }, { name: "шприц и лекарство", rarity: "Эпическое", img: "img_syringe.png" },
            { name: "Сбриватель хуйни", rarity: "Сверхредкое", img: "img_shaver.png" }, { name: "Вам не повезло", rarity: "Мусор", img: "" }
        ];
    }
    items.forEach(item => {
        const db = itemDatabase[item.name];
        const div = document.createElement('div');
        div.className = 'case-item-row';
        div.innerHTML = `
            <div class="case-item-left">
                <img src="${item.img}" style="width: 40px; height: 40px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/40?text=NO'">
                <div><b class="rarity-${item.rarity}">${item.name}</b><div class="case-item-desc">Шанс: ${db.chance}</div></div>
            </div>
            <button class="info-btn" style="width: 100px;" onclick="openItemInfo('${item.name}')">Подробнее</button>
        `;
        list.appendChild(div);
    });
    document.getElementById('case-contents-modal').classList.remove('hidden');
}

function closeCaseContents() { document.getElementById('case-contents-modal').classList.add('hidden'); }

let currentPvpChar = null;
let isPvpHost = false;
let pvpGameState = { myHp: 0, enemyHp: 0, myMaxHp: 0, enemyMaxHp: 0, myMp: 0, enemyMp: 0, isMyTurn: false, myBorisHp: 0, enemyBorisHp: 0, myParashnikHp: 0, enemyParashnikHp: 0, myDefending: false, enemyDefending: false, myItemUsed: false };

function openPvpLobby() {
    document.getElementById('pvp-lobby-modal').classList.remove('hidden');
    renderPvpRooms();
}

function closePvpLobby() { document.getElementById('pvp-lobby-modal').classList.add('hidden'); }

function renderPvpRooms() {
    const list = document.getElementById('pvp-online-list');
    if (onlinePlayers.length === 0) { list.innerHTML = '<p style="text-align:center;">Нет онлайн игроков.</p>'; return; }
    list.innerHTML = '';
    onlinePlayers.forEach(player => {
        if (player === currentUser) return;
        const div = document.createElement('div');
        div.className = 'pvp-room-item';
        div.innerHTML = `
            <div>
                <b>${player}</b>
                ${pvpRooms[player] ? '<span style="color:green; font-size:12px;"> (Ждет боя)</span>' : ''}
            </div>
            <div style="display:flex; gap:5px;">
                <button onclick="viewProfile('${player}')" style="margin:0; font-size:14px; background:#87CEEB;">Профиль</button>
                <button onclick="challengePlayer('${player}')" style="margin:0; font-size:14px; background:#ffcccb;">Вызвать на бой</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function challengePlayer(targetUser) {
    pendingChallengeTarget = targetUser;
    document.getElementById('pvp-challenge-title').innerText = "Вызов игрока " + targetUser;
    document.getElementById('pvp-challenge-modal').classList.remove('hidden');
}

function closeChallengeModal() {
    document.getElementById('pvp-challenge-modal').classList.add('hidden');
    pendingChallengeTarget = null;
}

async function executeChallenge() {
    const targetUser = pendingChallengeTarget;
    if (!targetUser) return;
    closeChallengeModal();

    const charType = document.getElementById('pvp-challenge-char-select').value;
    let baseHp = charType === 'ashab' ? 150 : (charType === 'apostol' ? 80 : 110);
    let baseAtk = charType === 'ashab' ? 20 : (charType === 'apostol' ? 30 : 18);
    let hp = baseHp + (currentUpgrades[charType].hp * 20);
    let atk = baseAtk + (currentUpgrades[charType].atk * 5);
    let charName = charType === 'ashab' ? "Ашаб" : (charType === 'apostol' ? "Апостол" : "Мээ");
    let img = charType === 'ashab' ? "IMG_3545.jpeg" : (charType === 'apostol' ? "IMG_3544.jpeg" : "IMG_3546.jpeg");

    myRoomId = 'room_' + Math.random().toString(36).substr(2, 9);
    isPvpHost = true;
    currentPvpChar = charType;
    if(lobbyChannel) await lobbyChannel.track({ room: { roomId: myRoomId, roomName: "Вызов от " + currentUser, hostName: currentUser, hostPts: currentPvpPts, charName, hp, atk } });
    if(onlineChannel) {
        onlineChannel.send({ type: 'broadcast', event: 'challenge', payload: { target: targetUser, host: currentUser, roomId: myRoomId } });
    }
    closePvpLobby();
    
    if(roomChannel) supabaseClient.removeChannel(roomChannel);
    roomChannel = supabaseClient.channel(myRoomId, { config: { broadcast: { self: false } } });
    roomChannel.on('broadcast', { event: 'join_request' }, (payload) => {
        const guest = payload.payload;
        startPvpBattle(guest.charName, guest.hp, guest.atk, guest.username, guest.charType);
        roomChannel.send({ type: 'broadcast', event: 'start_game', payload: { charName: charName, hp, atk, username: currentUser, charType: charType } });
    });
    roomChannel.on('broadcast', { event: 'enemy_action' }, (payload) => { handlePvpEnemyAction(payload.payload); });
    roomChannel.on('broadcast', { event: 'chat_message' }, (payload) => {
        addPvpChatMessage(payload.payload.nick || '???', payload.payload.text || '');
    });
    roomChannel.subscribe();
    initPvpChat(myRoomId);
    
    switchTab('rpg');
    document.getElementById('rpg-char-select').classList.add('hidden');
    document.getElementById('pvp-battle-screen').classList.remove('hidden');
    document.getElementById('pvp-player-img').src = img;
    document.getElementById('pvp-player-name').innerText = "Ты (" + charName + ")";
    document.getElementById('pvp-log').innerHTML = "Ожидаем соперника...";
    document.getElementById('pvp-turn-indicator').innerText = "ОЖИДАНИЕ";
    document.getElementById('pvp-turn-indicator').className = "turn-indicator";
    disablePvpButtons();
}

function listenForChallenges() {
    if(!onlineChannel) return;
    onlineChannel.on('broadcast', { event: 'challenge' }, (payload) => {
        const data = payload.payload;
        if (data.target === currentUser) {
            pendingChallengeRoomId = data.roomId;
            pendingChallengeHost = data.host;
            document.getElementById('pvp-receive-host-name').innerText = "Игрок: " + data.host;
            document.getElementById('pvp-receive-modal').classList.remove('hidden');
        }
    });
}

function closeReceiveModal() {
    document.getElementById('pvp-receive-modal').classList.add('hidden');
    pendingChallengeRoomId = null;
    pendingChallengeHost = null;
}

function executeAcceptChallenge() {
    if (!pendingChallengeRoomId) return;
    const roomId = pendingChallengeRoomId;
    closeReceiveModal();
    const charType = document.getElementById('pvp-receive-char-select').value;
    joinPvpRoom(roomId, charType);
}

async function createPvpRoom() {
    const roomName = document.getElementById('pvp-room-name').value.trim() || "Комната " + currentUser;
    const charType = document.getElementById('pvp-char-select').value;
    let baseHp = charType === 'ashab' ? 150 : (charType === 'apostol' ? 80 : 110);
    let baseAtk = charType === 'ashab' ? 20 : (charType === 'apostol' ? 30 : 18);
    let hp = baseHp + (currentUpgrades[charType].hp * 20);
    let atk = baseAtk + (currentUpgrades[charType].atk * 5);
    let charName = charType === 'ashab' ? "Ашаб" : (charType === 'apostol' ? "Апостол" : "Мээ");
    let img = charType === 'ashab' ? "IMG_3545.jpeg" : (charType === 'apostol' ? "IMG_3544.jpeg" : "IMG_3546.jpeg");

    myRoomId = 'room_' + Math.random().toString(36).substr(2, 9);
    isPvpHost = true;
    currentPvpChar = charType;
    if(lobbyChannel) await lobbyChannel.track({ room: { roomId: myRoomId, roomName, hostName: currentUser, hostPts: currentPvpPts, charName, hp, atk } });
    closePvpLobby();
    
    if(roomChannel) supabaseClient.removeChannel(roomChannel);
    roomChannel = supabaseClient.channel(myRoomId, { config: { broadcast: { self: false } } });
    roomChannel.on('broadcast', { event: 'join_request' }, (payload) => {
        const guest = payload.payload;
        startPvpBattle(guest.charName, guest.hp, guest.atk, guest.username, guest.charType);
        roomChannel.send({ type: 'broadcast', event: 'start_game', payload: { charName: charName, hp, atk, username: currentUser, charType: charType } });
    });
    roomChannel.on('broadcast', { event: 'enemy_action' }, (payload) => { handlePvpEnemyAction(payload.payload); });
    roomChannel.on('broadcast', { event: 'leave' }, () => { if (pvpGameState.myHp > 0) alert("Соперник покинул комнату."); leavePvpRoom(false); });
    roomChannel.on('broadcast', { event: 'chat_message' }, (payload) => {
        addPvpChatMessage(payload.payload.nick || '???', payload.payload.text || '');
    });
    roomChannel.subscribe();
    initPvpChat(myRoomId);
    
    switchTab('rpg');
    document.getElementById('rpg-char-select').classList.add('hidden');
    document.getElementById('pvp-battle-screen').classList.remove('hidden');
    document.getElementById('pvp-player-img').src = img;
    document.getElementById('pvp-player-name').innerText = "Ты (" + charName + ")";
    document.getElementById('pvp-log').innerHTML = "Ожидаем соперника...";
    document.getElementById('pvp-turn-indicator').innerText = "ОЖИДАНИЕ";
    document.getElementById('pvp-turn-indicator').className = "turn-indicator";
    disablePvpButtons();
    const bgMusic = document.getElementById('battle-music');
    bgMusic.currentTime = 0; bgMusic.volume = 0.3; bgMusic.play().catch(e => console.log("Audio blocked"));
}

async function joinPvpRoom(roomId, charType) {
    isPvpHost = false;
    currentPvpChar = charType;
    myRoomId = roomId;
    let baseHp = charType === 'ashab' ? 150 : (charType === 'apostol' ? 80 : 110);
    let baseAtk = charType === 'ashab' ? 20 : (charType === 'apostol' ? 30 : 18);
    let hp = baseHp + (currentUpgrades[charType].hp * 20);
    let atk = baseAtk + (currentUpgrades[charType].atk * 5);
    let charName = charType === 'ashab' ? "Ашаб" : (charType === 'apostol' ? "Апостол" : "Мээ");
    let img = charType === 'ashab' ? "IMG_3545.jpeg" : (charType === 'apostol' ? "IMG_3544.jpeg" : "IMG_3546.jpeg");
    
    closePvpLobby();
    switchTab('rpg');
    document.getElementById('rpg-char-select').classList.add('hidden');
    document.getElementById('pvp-battle-screen').classList.remove('hidden');
    document.getElementById('pvp-player-img').src = img;
    document.getElementById('pvp-player-name').innerText = "Ты (" + charName + ")";
    document.getElementById('pvp-log').innerHTML = "Подключаемся к бою...";
    document.getElementById('pvp-turn-indicator').innerText = "ОЖИДАНИЕ";
    document.getElementById('pvp-turn-indicator').className = "turn-indicator";
    disablePvpButtons();
    
    if(roomChannel) supabaseClient.removeChannel(roomChannel);
    roomChannel = supabaseClient.channel(roomId, { config: { broadcast: { self: false } } });
    roomChannel.on('broadcast', { event: 'start_game' }, (payload) => {
        const host = payload.payload;
        startPvpBattle(host.charName, host.hp, host.atk, host.username, host.charType);
        setPvpTurn(false);
    });
    roomChannel.on('broadcast', { event: 'enemy_action' }, (payload) => { handlePvpEnemyAction(payload.payload); });
    roomChannel.on('broadcast', { event: 'chat_message' }, (payload) => {
        addPvpChatMessage(payload.payload.nick || '???', payload.payload.text || '');
    });
    roomChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') { roomChannel.send({ type: 'broadcast', event: 'join_request', payload: { username: currentUser, charName, hp, atk, charType } }); }
    });
    initPvpChat(roomId);
}

function startPvpBattle(enemyName, enemyHp, enemyAtk, enemyUsername, enemyCharType) {
    const charType = currentPvpChar;
    let baseHp = charType === 'ashab' ? 150 : (charType === 'apostol' ? 80 : 110);
    let baseAtk = charType === 'ashab' ? 20 : (charType === 'apostol' ? 30 : 18);
    let hp = baseHp + (currentUpgrades[charType].hp * 20);
    let atk = baseAtk + (currentUpgrades[charType].atk * 5);
    
    pvpGameState = { myHp: hp, myMaxHp: hp, myAtk: atk, myMp: 0, enemyHp: enemyHp, enemyMaxHp: enemyHp, enemyName: enemyName, enemyMp: 0, isMyTurn: isPvpHost, myBorisHp: 0, enemyBorisHp: 0, myParashnikHp: 0, enemyParashnikHp: 0, myDefending: false, enemyDefending: false, myItemUsed: false };
    
    let enemyImg = enemyCharType === 'ashab' ? "IMG_3545.jpeg" : (enemyCharType === 'apostol' ? "IMG_3544.jpeg" : "IMG_3546.jpeg");
    if (!enemyCharType) enemyImg = "https://via.placeholder.com/100?text=ENEMY";

    document.getElementById('pvp-enemy-name').innerText = enemyName;
    document.getElementById('pvp-enemy-img').src = enemyImg; 
    updatePvpUI(); logPvp(`Бой начался против ${enemyName}!`);
    if (isPvpHost) { setPvpTurn(true); enablePvpButtons(); } 
    else { setPvpTurn(false); disablePvpButtons(); }
    const bgMusic = document.getElementById('battle-music');
    if (bgMusic.paused) { bgMusic.currentTime = 0; bgMusic.volume = 0.3; bgMusic.play().catch(e => console.log("Audio blocked")); }
}

function handlePvpEnemyAction(payload) {
    if (pvpGameState.myHp <= 0) return; 
    
    triggerScreenShake();
    flashRedScreen();

    if (payload.type === 'attack') {
        playSoundEffect('attack');
        let dmg = payload.dmg;
        if (pvpGameState.myDefending) { dmg = Math.floor(dmg * 0.2); pvpGameState.myDefending = false; logPvp(`Ты блокировал атаку, получив ${dmg} урона (80% срезано).`); }
        else if (pvpGameState.myBorisHp > 0) {
            pvpGameState.myBorisHp -= dmg;
            logPvp(`Враг бьет Бориса на ${dmg}. Осталось ${Math.max(0, pvpGameState.myBorisHp)} HP.`);
            if(pvpGameState.myBorisHp <= 0) { logPvp("Борис разрушен!"); pvpGameState.myBorisHp = 0; }
        } else if (pvpGameState.myParashnikHp > 0) {
            pvpGameState.myParashnikHp -= dmg;
            logPvp(`Враг бьет Парашника на ${dmg}. Осталось ${Math.max(0, pvpGameState.myParashnikHp)} HP.`);
            if(pvpGameState.myParashnikHp <= 0) { logPvp("Парашник уничтожен!"); pvpGameState.myParashnikHp = 0; }
        } else {
            pvpGameState.myHp -= dmg;
            logPvp(`Враг бьет на ${dmg} урона!`);
        }
    } else if (payload.type === 'defend') {
        playSoundEffect('protection');
        logPvp(`Враг встает в защиту.`);
        pvpGameState.enemyDefending = true;
    } else if (payload.type === 'skill') {
        playSoundEffect('crit');
        let dmg = payload.dmg;
        if (pvpGameState.myDefending) { dmg = Math.floor(dmg * 0.5); pvpGameState.myDefending = false; logPvp(`Ты блокировал способность, получив ${dmg} урона (50% срезано).`); }
        else if (pvpGameState.myBorisHp > 0) {
            pvpGameState.myBorisHp -= dmg; logPvp(`Враг бьет Бориса способностью на ${dmg}.`);
            if(pvpGameState.myBorisHp <= 0) { logPvp("Борис разрушен!"); pvpGameState.myBorisHp = 0; }
        } else if (pvpGameState.myParashnikHp > 0) {
            pvpGameState.myParashnikHp -= dmg; logPvp(`Враг бьет Парашника способностью.`);
            if(pvpGameState.myParashnikHp <= 0) { logPvp("Парашник уничтожен!"); pvpGameState.myParashnikHp = 0; }
        } else {
            pvpGameState.myHp -= dmg; logPvp(`Враг использует способность! Урон: ${dmg}`);
        }
    } else if (payload.type === 'item') {
        if (payload.effect === 'heal') { 
            playSoundEffect('heal');
            if(payload.val === 999) { pvpGameState.enemyHp = pvpGameState.enemyMaxHp; logPvp(`Враг полностью исцелился!`); }
            else { pvpGameState.enemyHp = Math.min(pvpGameState.enemyMaxHp, pvpGameState.enemyHp + payload.val); logPvp(`Враг хилится на ${payload.val}!`); }
        }
        else if (payload.effect === 'damage') { 
            playSoundEffect('harmful');
            let dmg = payload.val;
            if (pvpGameState.myDefending) { dmg = Math.floor(dmg * 0.35); pvpGameState.myDefending = false; logPvp(`Ты блокировал предмет, получив ${dmg} урона (65% срезано).`); }
            if (pvpGameState.myBorisHp > 0) { pvpGameState.myBorisHp -= dmg; logPvp(`Враг швыряет предмет в Бориса! Урон: ${dmg}`); if(pvpGameState.myBorisHp <= 0) { logPvp("Борис разрушен!"); pvpGameState.myBorisHp = 0; } }
            else if(pvpGameState.myParashnikHp > 0) { pvpGameState.myParashnikHp -= dmg; logPvp(`Враг швыряет предмет в Парашника! Урон: ${dmg}`); if(pvpGameState.myParashnikHp <= 0) { logPvp("Парашник уничтожен!"); pvpGameState.myParashnikHp = 0; } }
            else { pvpGameState.myHp -= dmg; logPvp(`Враг швыряет предмет! Урон: ${dmg}`); }
        }
        else if (payload.effect === 'atk') { logPvp(`Враг юзает бафф на атаку!`); }
        else if (payload.effect === 'boris') { playSoundEffect('thing'); pvpGameState.enemyBorisHp += 60; logPvp(`Враг поставил Бориса!`); }
        else if (payload.effect === 'parashnik') { playSoundEffect('thing'); pvpGameState.myParashnikHp += 30; logPvp(`Враг поставил Парашника!`); }
        else if (payload.effect === 'shaver') { playSoundEffect('shaver'); pvpGameState.enemyBorisHp = 0; pvpGameState.myParashnikHp = 0; logPvp(`Враг сбрил твоего Бориса и Парашника!`); }
        updatePvpUI();
        return; 
    }
    updatePvpUI();
    if (pvpGameState.myHp <= 0) { endPvpBattle(false); } 
    else { 
        if (pvpGameState.myParashnikHp > 0) {
            pvpGameState.myHp -= 10;
            pvpGameState.myMp = Math.max(0, pvpGameState.myMp - 15);
            logPvp(`Тебя отравил парашник! -10 HP, -15 маны.`);
            updatePvpUI();
            if(pvpGameState.myHp <= 0) { endPvpBattle(false); return; }
        }
        pvpGameState.isMyTurn = true; 
        pvpGameState.myItemUsed = false; 
        setPvpTurn(true); 
        enablePvpButtons(); 
    }
}

function pvpAttack() {
    if (!pvpGameState.isMyTurn) return;
    playSoundEffect('attack');
    pvpGameState.isMyTurn = false; pvpGameState.myItemUsed = false; disablePvpButtons(); setPvpTurn(false);
    triggerScreenShake(); 
    let dmg = Math.floor(Math.random() * 10) + pvpGameState.myAtk;
    if (pvpGameState.enemyDefending) { dmg = Math.floor(dmg * 0.2); pvpGameState.enemyDefending = false; logPvp(`Враг заблокировал атаку, он получил ${dmg} урона (80% срезано).`); }
    else if (pvpGameState.enemyBorisHp > 0) {
        pvpGameState.enemyBorisHp -= dmg;
        logPvp(`Ты бьешь Бориса на ${dmg}. Осталось ${Math.max(0, pvpGameState.enemyBorisHp)} HP.`);
        if(pvpGameState.enemyBorisHp <= 0) { logPvp("Борис врага разрушен!"); pvpGameState.enemyBorisHp = 0; }
    } else if (pvpGameState.enemyParashnikHp > 0) {
        pvpGameState.enemyParashnikHp -= dmg;
        logPvp(`Ты бьешь Парашника на ${dmg}. Осталось ${Math.max(0, pvpGameState.enemyParashnikHp)} HP.`);
        if(pvpGameState.enemyParashnikHp <= 0) { logPvp("Парашник врага уничтожен!"); pvpGameState.enemyParashnikHp = 0; }
    } else {
        pvpGameState.enemyHp -= dmg; 
        logPvp(`Ты бьешь на ${dmg} урона!`);
    }
    pvpGameState.myMp = Math.min(100, pvpGameState.myMp + 20);
    updatePvpUI(); 
    if(roomChannel) roomChannel.send({ type: 'broadcast', event: 'enemy_action', payload: { type: 'attack', dmg } });
    if (pvpGameState.enemyHp <= 0) { endPvpBattle(true); }
    else {
        if (pvpGameState.enemyParashnikHp > 0) {
            pvpGameState.enemyHp -= 10;
            pvpGameState.enemyMp = Math.max(0, pvpGameState.enemyMp - 15);
            logPvp(`Враг отравлен парашником! -10 HP.`);
            updatePvpUI();
            if(pvpGameState.enemyHp <= 0) { endPvpBattle(true); return; }
        }
    }
}

function pvpDefend() {
    if (!pvpGameState.isMyTurn) return;
    if (pvpGameState.myMp < 40) { alert("Мало маны для защиты! Нужно 40."); return; }
    playSoundEffect('protection');
    pvpGameState.myMp -= 40;
    pvpGameState.myItemUsed = false;
    pvpGameState.isMyTurn = false; disablePvpButtons(); setPvpTurn(false);
    pvpGameState.myDefending = true;
    updatePvpUI(); logPvp(`Ты встаешь в защиту. (-40 маны)`);
    if(roomChannel) roomChannel.send({ type: 'broadcast', event: 'enemy_action', payload: { type: 'defend' } });
}

function pvpSkill() {
    if (!pvpGameState.isMyTurn || pvpGameState.myMp < 100) return;
    playSoundEffect('crit');
    pvpGameState.isMyTurn = false; pvpGameState.myMp = 0; pvpGameState.myItemUsed = false; disablePvpButtons(); setPvpTurn(false);
    triggerScreenShake(); 
    let dmg = 0;
    let charType = currentPvpChar;
    if (charType === 'ashab') dmg = 60 + (currentUpgrades[charType].atk * 10);
    else if (charType === 'apostol') dmg = Math.floor(Math.random() * 30) + 70 + (currentUpgrades[charType].atk * 10);
    else if (charType === 'mee') { dmg = 0; pvpGameState.myHp = Math.min(pvpGameState.myMaxHp, pvpGameState.myHp + 50); logPvp(`Ты хилишься на 50 HP!`); playSoundEffect('heal'); }
    if (dmg > 0) {
        if (pvpGameState.enemyDefending) { dmg = Math.floor(dmg * 0.5); pvpGameState.enemyDefending = false; logPvp(`Враг заблокировал способность, получив ${dmg} урона.`); }
        else if (pvpGameState.enemyBorisHp > 0) {
            pvpGameState.enemyBorisHp -= dmg; logPvp(`Ты бьешь Бориса способностью на ${dmg}.`);
            if(pvpGameState.enemyBorisHp <= 0) { logPvp("Борис врага разрушен!"); pvpGameState.enemyBorisHp = 0; }
        } else if (pvpGameState.enemyParashnikHp > 0) {
            pvpGameState.enemyParashnikHp -= dmg; logPvp(`Ты бьешь Парашника способностью на ${dmg}.`);
            if(pvpGameState.enemyParashnikHp <= 0) { logPvp("Парашник врага уничтожен!"); pvpGameState.enemyParashnikHp = 0; }
        } else {
            pvpGameState.enemyHp -= dmg; logPvp(`Ты ебашишь способностью на ${dmg} урона!`);
        }
    }
    updatePvpUI(); 
    if(roomChannel) roomChannel.send({ type: 'broadcast', event: 'enemy_action', payload: { type: 'skill', dmg } });
    if (pvpGameState.enemyHp <= 0) { endPvpBattle(true); }
}

function openPvpItemMenu() {
    if (!pvpGameState.isMyTurn || pvpGameState.myItemUsed) return;
    const list = document.getElementById('rpg-item-list');
    list.innerHTML = '';
    let processedInv = getProcessedInventory();
    if (processedInv.length === 0) { list.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">У тебя пусто.</p>'; } 
    else {
        processedInv.forEach((item) => {
            let effectText = ""; let btnText = "Юз"; 
            if (item.rarity === 'Обычное') effectText = "Лечит 20 HP";
            if (item.rarity === 'Редкое' && item.name !== 'парашник') effectText = "+10 к Атаке";
            if (item.name === 'картофель') effectText = "+10 к Атаке";
            if (item.name === 'голова барана') effectText = "40 урона врагу";
            if (item.name === 'коала') effectText = "100 маны";
            if (item.name === 'apostol') effectText = "100 урона врагу";
            if (item.name === 'парашник') effectText = "Отравление (30 урона)";
            if (item.name === 'boris') effectText = "Щит на 60 HP";
            if (item.name === 'шприц и лекарство') effectText = "100% лечение";
            if (item.name === 'Сбриватель хуйни') effectText = "Убирает щиты врага";
            const div = document.createElement('div'); div.className = 'inv-card';
            if (item.qty > 1) div.innerHTML += `<div class="qty-badge">x${item.qty}</div>`;
            div.innerHTML += `
                ${getImgTag(item.img)}
                <div class="inv-card-name"><span class="rarity-${item.rarity}">${item.name}</span></div>
                <div style="font-size:10px; margin-bottom:5px;">${effectText}</div>
                <div class="inv-card-buttons">
                    <button onclick="pvpUseItem('${item.name}')" style="background-color: #90ee90;">${btnText}</button>
                    <button class="info-btn" onclick="openItemInfo('${item.name}')">Подробнее</button>
                </div>
            `;
            list.appendChild(div);
        });
    }
    document.getElementById('rpg-item-modal').classList.remove('hidden');
}

async function pvpUseItem(itemName) {
    if (!pvpGameState.isMyTurn || pvpGameState.myItemUsed) return;
    const itemIndex = currentInventory.findIndex(i => i.name === itemName);
    if (itemIndex === -1) return;
    const item = currentInventory[itemIndex];
    pvpGameState.myItemUsed = true; 
    disablePvpButtons(); 
    closeItemMenu();
    
    if (item.name === 'Сбриватель хуйни') {
        playSoundEffect('shaver');
    } else if (item.name === 'голова барана' || item.name === 'apostol') {
        playSoundEffect('harmful');
    } else {
        playSoundEffect('thing');
    }
    
    let isDamaging = (item.name === 'голова барана' || item.name === 'apostol' || item.name === 'Сбриватель хуйни');
    animatePvpItemUse(item, isDamaging);
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'consume_item', username: currentUser, data: { item_id: item.id } } });
        if (!error && data.success) { currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); } 
        else { logPvp("Ошибка использования."); pvpGameState.myItemUsed = false; enablePvpButtons(); return; }
    } catch(e) { logPvp("Ошибка сервера."); pvpGameState.myItemUsed = false; enablePvpButtons(); return; }
    const applyEffect = () => {
        let payload = { type: 'item', effect: '', val: 0 };
        if (item.name === 'хуйня') { pvpGameState.myHp = Math.min(pvpGameState.myMaxHp, pvpGameState.myHp + 20); logPvp(`+20 HP`); payload.effect='heal'; payload.val=20; playSoundEffect('heal'); }
        else if (item.name === 'картофель') { pvpGameState.myAtk += 10; logPvp(`Атака +10!`); payload.effect='atk'; payload.val=10; }
        else if (item.name === 'голова барана') { 
            let dmg = 40;
            if (pvpGameState.enemyDefending) { dmg = Math.floor(dmg * 0.35); pvpGameState.enemyDefending = false; logPvp(`Враг заблокировал голову, получив ${dmg} (65% срезано).`); }
            if(pvpGameState.enemyBorisHp > 0) { pvpGameState.enemyBorisHp -= dmg; logPvp(`Швырнул голову в Бориса!`); if(pvpGameState.enemyBorisHp <= 0) pvpGameState.enemyBorisHp=0; }
            else if (pvpGameState.enemyParashnikHp > 0) { pvpGameState.enemyParashnikHp -= dmg; logPvp(`Швырнул голову в Парашника!`); if(pvpGameState.enemyParashnikHp <= 0) pvpGameState.enemyParashnikHp=0; }
            else { pvpGameState.enemyHp -= dmg; logPvp(`${dmg} урона!`); }
            payload.effect='damage'; payload.val=dmg; 
        }
        else if (item.name === 'коала') { pvpGameState.myMp = 100; logPvp(`Мана 100!`); payload.effect='mp'; payload.val=100; }
        else if (item.name === 'apostol') { 
            let dmg = 100;
            if (pvpGameState.enemyDefending) { dmg = Math.floor(dmg * 0.35); pvpGameState.enemyDefending = false; logPvp(`Враг заблокировал Apostol, получив ${dmg} (65% срезано).`); }
            if(pvpGameState.enemyBorisHp > 0) { pvpGameState.enemyBorisHp -= dmg; logPvp(`Швырнул Apostol в Бориса!`); if(pvpGameState.enemyBorisHp <= 0) pvpGameState.enemyBorisHp=0; }
            else if (pvpGameState.enemyParashnikHp > 0) { pvpGameState.enemyParashnikHp -= dmg; logPvp(`Швырнул Apostol в Парашника!`); if(pvpGameState.enemyParashnikHp <= 0) pvpGameState.enemyParashnikHp=0; }
            else { pvpGameState.enemyHp -= dmg; logPvp(`${dmg} УРОНА!`); }
            payload.effect='damage'; payload.val=dmg; 
        }
        else if (item.name === 'шприц и лекарство') { pvpGameState.myHp = pvpGameState.myMaxHp; logPvp(`100% лечение!`); payload.effect='heal'; payload.val=999; playSoundEffect('heal'); }
        else if (item.name === 'boris') { pvpGameState.myBorisHp += 60; logPvp(`Ты поставил Бориса!`); payload.effect='boris'; }
        else if (item.name === 'парашник') { pvpGameState.enemyParashnikHp += 30; logPvp(`Ты поставил Парашника врагу!`); payload.effect='parashnik'; }
        else if (item.name === 'Сбриватель хуйни') { 
            pvpGameState.enemyBorisHp = 0; pvpGameState.enemyParashnikHp = 0; logPvp(`Ты сбрил всю хуйню врага!`); payload.effect='shaver'; 
        }
        else if (item.name === 'Вам не повезло') { logPvp(`Вы нихуя не сделали.`); payload.effect='nothing'; }
        updatePvpUI();
        if(roomChannel) roomChannel.send({ type: 'broadcast', event: 'enemy_action', payload });
        if (pvpGameState.enemyHp <= 0) { endPvpBattle(true); }
        else {
            if (pvpGameState.enemyParashnikHp > 0 && item.name !== 'Сбриватель хуйни') {
                pvpGameState.enemyHp -= 10; pvpGameState.enemyMp = Math.max(0, pvpGameState.enemyMp - 15);
                logPvp(`Враг отравлен парашником! -10 HP.`); updatePvpUI();
                if(pvpGameState.enemyHp <= 0) { endPvpBattle(true); return; }
            }
            enablePvpButtons(); 
        }
    };
    setTimeout(applyEffect, 2600); 
}

async function endPvpBattle(isWin) {
    disablePvpButtons();
    const bgMusic = document.getElementById('battle-music');
    bgMusic.pause();
    let newPts = isWin ? currentPvpPts + 15 : Math.max(0, currentPvpPts - 15);
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'pvp_result', username: currentUser, data: { win: isWin } } });
        if (!error && data && data.success) { currentPvpPts = data.newPts; updateUI(); }
        else { currentPvpPts = newPts; updateUI(); }
    } catch(e) { currentPvpPts = newPts; updateUI(); }
    logPvp(isWin ? "ТЫ ПОБЕДИЛ! +15 PTS" : "ТЫ ПРОИГРАЛ! -15 PTS");
    setTimeout(() => { leavePvpRoom(false); alert(isWin ? "Победа! +15 PTS" : "Поражение! -15 PTS"); }, 3000);
}

async function leavePvpRoom(sendSignal = true) {
    if (roomChannel) { if (sendSignal) roomChannel.send({ type: 'broadcast', event: 'leave' }); supabaseClient.removeChannel(roomChannel); roomChannel = null; }
    if (isPvpHost && lobbyChannel) { await lobbyChannel.track({ online: true }); }
    document.getElementById('pvp-battle-screen').classList.add('hidden');
    document.getElementById('rpg-char-select').classList.remove('hidden');
    disablePvpButtons();
    document.getElementById('battle-music').pause();
    myRoomId = null;
}

function updatePvpUI() {
    document.getElementById('pvp-player-hp-text').innerText = `${Math.max(0, pvpGameState.myHp)}/${pvpGameState.myMaxHp}`;
    document.getElementById('pvp-player-hp-bar').style.width = (Math.max(0, pvpGameState.myHp) / pvpGameState.myMaxHp) * 100 + '%';
    document.getElementById('pvp-player-mp-text').innerText = `${pvpGameState.myMp}/100`;
    document.getElementById('pvp-player-mp-bar').style.width = pvpGameState.myMp + '%';
    document.getElementById('pvp-enemy-hp-text').innerText = `${Math.max(0, pvpGameState.enemyHp)}/${pvpGameState.enemyMaxHp}`;
    document.getElementById('pvp-enemy-hp-bar').style.width = (Math.max(0, pvpGameState.enemyHp) / pvpGameState.enemyMaxHp) * 100 + '%';
    renderPvpDeployedItems();
}

function renderPvpDeployedItems() {
    let pDep = document.getElementById('pvp-player-deployed');
    let eDep = document.getElementById('pvp-enemy-deployed');
    pDep.innerHTML = ''; eDep.innerHTML = '';
    if (pvpGameState.myBorisHp > 0) {
        pDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(pvpGameState.myBorisHp/60)*100}%; background: #00ff00;"></div></div></div>`;
    }
    if (pvpGameState.myParashnikHp > 0) {
        pDep.innerHTML += `<div class="deployed-item"><img src="img_parashnik.png" onerror="this.src='https://via.placeholder.com/50?text=P'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(pvpGameState.myParashnikHp/30)*100}%; background: #a020f0;"></div></div></div>`;
    }
    if (pvpGameState.enemyBorisHp > 0) {
        eDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(pvpGameState.enemyBorisHp/60)*100}%; background: #00ff00;"></div></div></div>`;
    }
    if (pvpGameState.enemyParashnikHp > 0) {
        eDep.innerHTML += `<div class="deployed-item"><img src="img_parashnik.png" onerror="this.src='https://via.placeholder.com/50?text=P'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(pvpGameState.enemyParashnikHp/30)*100}%; background: #a020f0;"></div></div></div>`;
    }
}

function setPvpTurn(isPlayer) {
    const ind = document.getElementById('pvp-turn-indicator');
    if (isPlayer) { ind.innerText = "ВАШ ХОД"; ind.className = "turn-indicator turn-player"; } 
    else { ind.innerText = "ХОД ВРАГА"; ind.className = "turn-indicator turn-enemy"; }
}

function disablePvpButtons() {
    ['pvp-atk-btn', 'pvp-def-btn', 'pvp-skill-btn', 'pvp-item-btn'].forEach(id => {
        let btn = document.getElementById(id);
        if (btn) btn.disabled = true;
    });
}

function enablePvpButtons() {
    let atk = document.getElementById('pvp-atk-btn');
    let def = document.getElementById('pvp-def-btn');
    let skill = document.getElementById('pvp-skill-btn');
    let item = document.getElementById('pvp-item-btn');
    if (atk) atk.disabled = false;
    if (def) def.disabled = pvpGameState.myMp < 40; 
    if (item) item.disabled = pvpGameState.myItemUsed;
    if (skill) skill.disabled = pvpGameState.myMp < 100;
}

function logPvp(msg) { const log = document.getElementById('pvp-log'); if (!log) return; log.innerHTML += `<br>> ${msg}`; log.scrollTop = log.scrollHeight; }

function animatePvpItemUse(item, isDamage) {
    const battlefield = document.getElementById('pvp-battlefield-bg');
    const el = document.createElement('img');
    el.src = item.img || 'https://via.placeholder.com/50?text=ITEM'; 
    el.style.position = 'absolute'; el.style.width = '80px'; el.style.height = '80px'; el.style.zIndex = '9999';
    
    if (item.name === 'Сбриватель хуйни') {
        el.style.left = '-100px'; 
        el.style.bottom = '20%'; 
        el.style.transform = 'rotate(0deg) scale(1)'; 
        battlefield.appendChild(el);
        void el.offsetWidth; 
        el.style.transition = 'all 3s linear'; 
        el.style.left = '110%'; 
    } else {
        el.style.transition = 'all 2.6s cubic-bezier(0.25, 0.1, 0.25, 1)'; 
        if (isDamage) {
            el.style.left = '20%'; el.style.top = '40%'; el.style.transform = 'rotate(-20deg) scale(1)'; battlefield.appendChild(el);
            void el.offsetWidth; 
            el.style.left = '75%'; el.style.top = '30%'; el.style.transform = 'scale(1.5) rotate(720deg)'; 
            setTimeout(() => { el.remove(); }, 2600);
        } else {
            el.style.left = '25%'; el.style.top = '30%'; el.style.transform = 'rotate(0deg) scale(1)'; battlefield.appendChild(el);
            void el.offsetWidth;
            el.style.top = '60%'; el.style.opacity = '0'; el.style.transform = 'scale(0.8) rotate(15deg)';
            setTimeout(() => { el.remove(); }, 2600);
        }
    }
}

let rpgChar = null; let rpgEnemy = null; let rpgFloorMain = 1; let rpgFloorSub = 1; 
let rpgMana = 0; let rpgMaxMana = 100; let isPlayerTurn = true; let enemyIsCharging = false; let currentCharType = null; let currentBgIndex = -1;
let rpgPlayerBorisHp = 0; let rpgEnemyBorisHp = 0; let rpgPlayerParashnikHp = 0; let rpgEnemyParashnikHp = 0;
let rpgItemUsed = false; let rpgPlayerDefending = false; let rpgEnemyStunned = false;
let enemyTurnTimeout = null;

function changeBackground() {
    let newIndex; do { newIndex = Math.floor(Math.random() * battleBackgrounds.length); } while (newIndex === currentBgIndex && battleBackgrounds.length > 1);
    currentBgIndex = newIndex; document.getElementById('battlefield-bg').style.backgroundImage = `url('${battleBackgrounds[currentBgIndex]}')`;
}

function selectChar(type) {
    if (enemyTurnTimeout) clearTimeout(enemyTurnTimeout);
    currentCharType = type;
    let baseHp = 0, baseAtk = 0, mpGain = 0, name = "", charClass = "", imgUrl = "";
    if (type === 'ashab') { baseHp = 150; baseAtk = 20; mpGain = 20; name = "Ashab"; charClass = "Берсерк"; imgUrl = "IMG_3545.jpeg"; }
    else if (type === 'apostol') { baseHp = 80; baseAtk = 30; mpGain = 35; name = "Apostol"; charClass = "Чернокнижник"; imgUrl = "IMG_3544.jpeg"; }
    else if (type === 'mee') { baseHp = 110; baseAtk = 18; mpGain = 25; name = "Мээ"; charClass = "Друид"; imgUrl = "IMG_3546.jpeg"; }
    let u = currentUpgrades[type];
    rpgChar = { name, class: charClass, maxHp: baseHp + (u.hp * 20), hp: baseHp + (u.hp * 20), atk: baseAtk + (u.atk * 5), mpGain, img: imgUrl };
    rpgFloorMain = 1; rpgFloorSub = 1; rpgMana = 0; rpgPlayerBorisHp = 0; rpgPlayerParashnikHp = 0; rpgEnemyBorisHp = 0; rpgEnemyParashnikHp = 0; rpgItemUsed = false; rpgPlayerDefending = false; rpgEnemyStunned = false;
    document.getElementById('rpg-char-select').classList.add('hidden');
    document.getElementById('rpg-battle-screen').classList.remove('hidden');
    document.getElementById('rpg-log').innerHTML = `Ты выбрал ${rpgChar.name}.<br>В БОЙ!<br>`;
    document.getElementById('rpg-player-img').src = rpgChar.img;
    const bgMusic = document.getElementById('battle-music');
    bgMusic.currentTime = 0; bgMusic.volume = 0.3; bgMusic.play().catch(e => console.log("Audio blocked"));
    changeBackground(); spawnEnemy();
}

function fleeOfflineBattle() {
    if (!confirm("Съебаться с поля боя? Весь прогресс текущего этажа будет потерян.")) return;
    if (enemyTurnTimeout) clearTimeout(enemyTurnTimeout);
    document.getElementById('battle-music').pause();
    document.getElementById('rpg-battle-screen').classList.add('hidden');
    document.getElementById('rpg-char-select').classList.remove('hidden');
    rpgChar = null; rpgEnemy = null; rpgFloorMain = 1; rpgFloorSub = 1; rpgMana = 0;
    rpgPlayerBorisHp = 0; rpgPlayerParashnikHp = 0; rpgEnemyBorisHp = 0; rpgEnemyParashnikHp = 0;
    rpgItemUsed = false; rpgPlayerDefending = false; rpgEnemyStunned = false; isPlayerTurn = false;
    renderCharStats(); updateUI();
}

function spawnEnemy() {
    let baseHp = 60 + (rpgFloorMain * 25); let baseAtk = 10 + (rpgFloorMain * 4);
    const enemyTypes = [
        { name: "Пидор", hpMult: 1.2, atkMult: 1, img: "enemy_pidor.png" },
        { name: "Голый чювак", hpMult: 1, atkMult: 1.3, img: "enemy_chuvak.png" },
        { name: "Бедуин", hpMult: 1.5, atkMult: 0.8, img: "enemy_beduin.png" }
    ];
    let eType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]; let eHp = Math.floor(baseHp * eType.hpMult);
    rpgEnemy = { name: `${eType.name} (Ур. ${rpgFloorMain}.${rpgFloorSub})`, hp: eHp, maxHp: eHp, atk: Math.floor(baseAtk * eType.atkMult), img: eType.img };
    rpgEnemyBorisHp = 0; rpgEnemyParashnikHp = 0; rpgItemUsed = false; rpgPlayerDefending = false; rpgEnemyStunned = false;
    document.getElementById('rpg-floor').innerText = `ЭТАЖ ${rpgFloorMain}.${rpgFloorSub}`;
    document.getElementById('rpg-enemy-img').src = rpgEnemy.img;
    updateRpgUI(); addLog(`На арене появился ${rpgEnemy.name}!`);
    isPlayerTurn = true; enemyIsCharging = false; setTurnIndicator(true); checkButtons();
}

function addLog(msg) { const logBox = document.getElementById('rpg-log'); logBox.innerHTML += `<br>> ${msg}`; logBox.scrollTop = logBox.scrollHeight; }
function setTurnIndicator(isPlayer) { const ind = document.getElementById('rpg-turn-indicator'); if (isPlayer) { ind.innerText = "ВАШ ХОД"; ind.className = "turn-indicator turn-player"; } else { ind.innerText = "ХОД ВРАГА"; ind.className = "turn-indicator turn-enemy"; } }

function updateRpgUI() {
    document.getElementById('rpg-player-name').innerText = rpgChar.name;
    document.getElementById('rpg-player-hp-text').innerText = `${Math.max(0, rpgChar.hp)}/${rpgChar.maxHp}`;
    document.getElementById('rpg-player-hp-bar').style.width = (Math.max(0, rpgChar.hp) / rpgChar.maxHp) * 100 + '%';
    document.getElementById('rpg-player-mp-text').innerText = `${rpgMana}/${rpgMaxMana}`;
    document.getElementById('rpg-player-mp-bar').style.width = (rpgMana / rpgMaxMana) * 100 + '%';
    document.getElementById('rpg-enemy-name').innerText = rpgEnemy.name;
    document.getElementById('rpg-enemy-hp-text').innerText = `${Math.max(0, rpgEnemy.hp)}/${rpgEnemy.maxHp}`;
    document.getElementById('rpg-enemy-hp-bar').style.width = (Math.max(0, rpgEnemy.hp) / rpgEnemy.maxHp) * 100 + '%';
    renderRpgDeployedItems();
}

function renderRpgDeployedItems() {
    let pDep = document.getElementById('rpg-player-deployed');
    let eDep = document.getElementById('rpg-enemy-deployed');
    pDep.innerHTML = ''; eDep.innerHTML = '';
    if (rpgPlayerBorisHp > 0) {
        pDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgPlayerBorisHp/60)*100}%; background: #00ff00;"></div></div></div>`;
    }
    if (rpgPlayerParashnikHp > 0) {
        pDep.innerHTML += `<div class="deployed-item"><img src="img_parashnik.png" onerror="this.src='https://via.placeholder.com/50?text=P'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgPlayerParashnikHp/30)*100}%; background: #a020f0;"></div></div></div>`;
    }
    if (rpgEnemyBorisHp > 0) {
        eDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgEnemyBorisHp/60)*100}%; background: #00ff00;"></div></div></div>`;
    }
    if (rpgEnemyParashnikHp > 0) {
        eDep.innerHTML += `<div class="deployed-item"><img src="img_parashnik.png" onerror="this.src='https://via.placeholder.com/50?text=P'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgEnemyParashnikHp/30)*100}%; background: #a020f0;"></div></div></div>`;
    }
}

function checkButtons() {
    const btns = [document.querySelector('.btn-atk'), document.querySelector('.btn-def'), document.getElementById('rpg-skill-btn'), document.querySelector('.btn-item')];
    if (isPlayerTurn) { 
        btns[0].disabled = false; 
        btns[1].disabled = rpgMana < 40; 
        btns[2].disabled = rpgMana < 100; 
        btns[3].disabled = rpgItemUsed; 
    } else { 
        btns.forEach(b => b.disabled = true); 
    }
}
function animateAttack(isPlayer) {
    let pImg = document.getElementById('rpg-player-img'); let eImg = document.getElementById('rpg-enemy-img');
    if (isPlayer) { pImg.classList.add('attack-anim-player'); setTimeout(() => pImg.classList.remove('attack-anim-player'), 200); } else { eImg.classList.add('attack-anim-enemy'); setTimeout(() => eImg.classList.remove('attack-anim-enemy'), 200); }
}

function rpgAttack() {
    if (!isPlayerTurn || rpgChar.hp <= 0 || rpgEnemy.hp <= 0) return;
    playSoundEffect('attack');
    isPlayerTurn = false; rpgItemUsed = false; setTurnIndicator(false); checkButtons(); animateAttack(true);
    triggerScreenShake();
    let dmg = Math.floor(Math.random() * 10) + rpgChar.atk;
    if(rpgEnemyBorisHp > 0) {
        rpgEnemyBorisHp -= dmg; addLog(`Ты бьешь Бориса на ${dmg}.`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp = 0; addLog("Борис разрушен!"); }
    } else if (rpgEnemyParashnikHp > 0) {
        rpgEnemyParashnikHp -= dmg; addLog(`Ты бьешь Парашника на ${dmg}.`); if(rpgEnemyParashnikHp <= 0) { rpgEnemyParashnikHp = 0; addLog("Парашник уничтожен!"); }
    } else {
        rpgEnemy.hp -= dmg; addLog(`${rpgChar.name} бьет на ${dmg} урона.`);
    }
    rpgMana = Math.min(rpgMaxMana, rpgMana + rpgChar.mpGain);
    updateRpgUI();
    if (rpgEnemy.hp <= 0) winRpg(); else enemyTurnTimeout = setTimeout(enemyTurn, 800);
}
function rpgDefend() {
    if (!isPlayerTurn || rpgChar.hp <= 0 || rpgEnemy.hp <= 0) return;
    if (rpgMana < 40) { alert("Мало маны для защиты! Нужно 40."); return; }
    playSoundEffect('protection');
    rpgMana -= 40;
    isPlayerTurn = false; rpgItemUsed = false; rpgPlayerDefending = true; rpgEnemyStunned = true; setTurnIndicator(false); checkButtons();
    addLog(`${rpgChar.name} в защите (-40 маны). Враг споткнется на след. ход!`); updateRpgUI(); enemyTurnTimeout = setTimeout(() => enemyTurn(true), 800);
}
function rpgSkill() {
    if (!isPlayerTurn || rpgMana < 100 || rpgChar.hp <= 0 || rpgEnemy.hp <= 0) return;
    playSoundEffect('crit');
    isPlayerTurn = false; rpgMana = 0; rpgItemUsed = false; setTurnIndicator(false); checkButtons(); animateAttack(true);
    triggerScreenShake();
    let dmg = 0;
    if (rpgChar.class === "Берсерк") { dmg = 60 + (currentUpgrades[currentCharType].atk * 10); addLog(`Сокрушающий удар на ${dmg}!`); }
    else if (rpgChar.class === "Чернокнижник") { dmg = Math.floor(Math.random() * 30) + 70 + (currentUpgrades[currentCharType].atk * 10); addLog(`Тёмный ритуал. Урон: ${dmg}!`); }
    else if (rpgChar.class === "Друид") { let heal = 70 + (currentUpgrades[currentCharType].hp * 10); rpgChar.hp = Math.min(rpgChar.maxHp, rpgChar.hp + heal); addLog(`Исцеление на ${heal} HP!`); playSoundEffect('heal'); }
    if (dmg > 0) {
        if(rpgEnemyBorisHp > 0) {
            rpgEnemyBorisHp -= dmg; addLog(`Ты бьешь Бориса способностью.`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp = 0; addLog("Борис разрушен!"); }
        } else if (rpgEnemyParashnikHp > 0) {
            rpgEnemyParashnikHp -= dmg; addLog(`Ты бьешь Парашника способностью.`); if(rpgEnemyParashnikHp <= 0) { rpgEnemyParashnikHp = 0; addLog("Парашник уничтожен!"); }
        } else {
            rpgEnemy.hp -= dmg; 
        }
    }
    updateRpgUI(); if (rpgEnemy.hp <= 0) winRpg(); else enemyTurnTimeout = setTimeout(enemyTurn, 800);
}

function enemyTurn(isPlayerDefending = false) {
    if (rpgEnemyStunned && !isPlayerDefending) {
        rpgEnemyStunned = false;
        addLog(`${rpgEnemy.name} спотыкается и пропускает ход!`);
        isPlayerTurn = true; setTurnIndicator(true); checkButtons();
        return;
    }
    
    setTurnIndicator(false); animateAttack(false);
    triggerScreenShake();
    flashRedScreen();

    let itemChance = Math.min(0.35, 0.05 + (rpgFloorMain * 0.03)); 
    
    if (Math.random() < itemChance && !isPlayerDefending) {
        let itemRoll = Math.random();
        if (itemRoll < 0.4 && rpgEnemy.hp < rpgEnemy.maxHp - 20) {
            rpgEnemy.hp = Math.min(rpgEnemy.maxHp, rpgEnemy.hp + 20);
            addLog(`Враг юзает хуйнью и лечится на 20 HP!`);
            playSoundEffect('heal');
        } else if (itemRoll < 0.6 && rpgEnemyBorisHp <= 0) {
            rpgEnemyBorisHp = 60;
            addLog(`Враг ставит Бориса!`);
            playSoundEffect('thing');
        } else if (itemRoll < 0.8 && rpgPlayerParashnikHp <= 0) {
            rpgPlayerParashnikHp = 30;
            addLog(`Враг ставит Парашника!`);
            playSoundEffect('thing');
        } else {
            playSoundEffect('harmful');
            let dmg = 40;
            if (isPlayerDefending) { dmg = Math.floor(dmg * 0.35); addLog(`Ты заблокировал предмет, получив ${dmg} (65% срезано).`); }
            if (rpgPlayerBorisHp > 0) { rpgPlayerBorisHp -= dmg; addLog(`Враг швырнул голову барана в Бориса!`); if(rpgPlayerBorisHp<=0){rpgPlayerBorisHp=0; addLog("Твой Борис разрушен!");} }
            else if (rpgPlayerParashnikHp > 0) { rpgPlayerParashnikHp -= dmg; addLog(`Враг швырнул голову барана в Парашника!`); if(rpgPlayerParashnikHp<=0){rpgPlayerParashnikHp=0; addLog("Твой Парашник уничтожен!");} }
            else { rpgChar.hp -= dmg; addLog(`Враг швырнул голову барана на ${dmg} урона!`); }
        }
        updateRpgUI();
        if (rpgChar.hp <= 0) { 
            addLog(`Ты сдох...`); isPlayerTurn = false; checkButtons(); document.getElementById('battle-music').pause(); setTimeout(() => { document.getElementById('rpg-char-select').classList.remove('hidden'); document.getElementById('rpg-battle-screen').classList.add('hidden'); renderCharStats(); updateUI(); }, 3000); 
        } else {
            enemyTurnTimeout = setTimeout(() => { isPlayerTurn = true; setTurnIndicator(true); checkButtons(); }, 800);
        }
        return;
    }
    
    let dmg = Math.floor(Math.random() * 10) + rpgEnemy.atk;
    let isUlt = false;
    
    if (!isPlayerDefending && Math.random() < 0.3 && !enemyIsCharging) {
        enemyIsCharging = true; addLog(`${rpgEnemy.name} копит силы...`); isPlayerTurn = true; setTurnIndicator(true); checkButtons(); return;
    }
    if (enemyIsCharging) { dmg *= 2; enemyIsCharging = false; isUlt = true; addLog(`ЕБАТЬ! Усиленный удар!`); playSoundEffect('crit'); }
    
    if (isPlayerDefending) {
        if (isUlt) { dmg = Math.floor(dmg * 0.5); addLog(`Защита срезала ульту на 50%. Урон: ${dmg}.`); }
        else { dmg = Math.floor(dmg * 0.2); addLog(`Защита срезала атаку на 80%. Урон: ${dmg}.`); }
    } else {
        playSoundEffect('attack');
        addLog(`Враг бьет на ${dmg}!`);
    }
    
    if(rpgPlayerBorisHp > 0) {
        rpgPlayerBorisHp -= dmg; addLog(`Атака ушла в Бориса.`); if(rpgPlayerBorisHp <= 0) { rpgPlayerBorisHp = 0; addLog("Твой Борис разрушен!"); }
    } else if (rpgPlayerParashnikHp > 0) {
        rpgPlayerParashnikHp -= dmg; addLog(`Атака ушла в Парашника.`); if(rpgPlayerParashnikHp <= 0) { rpgPlayerParashnikHp = 0; addLog("Твой Парашник уничтожен!"); }
    } else {
        rpgChar.hp -= dmg; 
    }
    
    rpgPlayerDefending = false;
    updateRpgUI();
    
    if (rpgChar.hp <= 0) { 
        addLog(`Ты сдох...`); isPlayerTurn = false; checkButtons(); document.getElementById('battle-music').pause(); setTimeout(() => { document.getElementById('rpg-char-select').classList.remove('hidden'); document.getElementById('rpg-battle-screen').classList.add('hidden'); renderCharStats(); updateUI(); }, 3000); 
    } else { 
        if(rpgPlayerParashnikHp > 0) {
            rpgChar.hp -= 10; rpgMana = Math.max(0, rpgMana - 15);
            addLog(`Тебя отравил парашник! -10 HP, -15 маны.`);
            updateRpgUI();
            if(rpgChar.hp <= 0) { addLog(`Ты сдох от яда...`); isPlayerTurn = false; checkButtons(); document.getElementById('battle-music').pause(); setTimeout(() => { document.getElementById('rpg-char-select').classList.remove('hidden'); document.getElementById('rpg-battle-screen').classList.add('hidden'); renderCharStats(); updateUI(); }, 3000); return; }
        }
        isPlayerTurn = true; setTurnIndicator(true); checkButtons(); 
    }
}

async function winRpg() {
    let reward = 15 + (rpgFloorMain * 10);
    const wonFloorMain = rpgFloorMain;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'rpg_win', username: currentUser, data: { floorMain: wonFloorMain } } });
        if (!error && data && data.success) { currentCoins = data.newCoins; updateUI(); addLog(`Победа! +${data.earned} монет.`); }
        else if (data && data.error) { addLog(`Сервер: ${data.error}`); }
    } catch(e) { addLog(`Ошибка сети: ${e.message}`); }
    finally {
        try {
            await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'update_floor', username: currentUser, data: { charType: currentCharType, floor: wonFloorMain } } });
        } catch(e) { console.error(e); }
        rpgFloorSub++;
        if (rpgFloorSub > 5) { rpgFloorSub = 1; rpgFloorMain++; changeBackground(); }
        rpgMana = Math.min(rpgMaxMana, rpgMana + 30);
        enemyTurnTimeout = setTimeout(() => { addLog(`=== ЭТАЖ ${rpgFloorMain}.${rpgFloorSub} ===`); spawnEnemy(); }, 2000);
    }
}

async function openCase(price) {
    const resBox = document.getElementById('case-result'); resBox.innerHTML = "Крутим...";
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'open_case', username: currentUser, data: { price } } });
        if (error) resBox.textContent = "Ошибка сети: " + error.message; 
        else if (data.error) resBox.textContent = "Ошибка: " + data.error;
        else {
            currentCoins = data.newCoins; currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI();
            if (data.droppedItem && data.droppedItem.name !== "Вам не повезло") {
                resBox.innerHTML = `
                    <div style="background:#fff; border:2px solid #000; padding:15px; display:flex; flex-direction:column; align-items:center; gap:10px;">
                        ${getImgTag(data.droppedItem.img)}
                        <div style="text-align:center;">
                            <div style="font-size:20px;" class="rarity-${data.droppedItem.rarity}">${data.droppedItem.name}</div>
                            <small>+${data.droppedItem.points} очков</small>
                        </div>
                        <button class="info-btn" style="width: 150px;" onclick="openItemInfo('${data.droppedItem.name}')">Подробнее</button>
                    </div>`;
            } else {
                resBox.innerHTML = `
                    <div style="text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <div>${data.message}</div>
                        <button class="info-btn" style="width: 150px;" onclick="openItemInfo('Вам не повезло')">Подробнее</button>
                    </div>`;
            }
        }
    } catch(e) { resBox.textContent = "Фатальная ошибка: " + e.message; }
}

async function renderInventory() {
    const list = document.getElementById('inventory-list'); list.innerHTML = 'Загрузка...';
    const { data: myListings } = await supabaseClient.from('marketplace').select('*').eq('seller', currentUser);
    list.innerHTML = ''; let processedInv = getProcessedInventory();
    if (processedInv.length === 0 && (!myListings || myListings.length === 0)) { list.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Пусто.</p>'; return; }
    processedInv.forEach((item) => {
        const div = document.createElement('div'); div.className = 'inv-card';
        if (item.qty > 1) div.innerHTML += `<div class="qty-badge">x${item.qty}</div>`;
        div.innerHTML += `
            ${getImgTag(item.img)}
            <div class="inv-card-name"><span class="rarity-${item.rarity}">${item.name}</span></div>
            <div class="inv-card-buttons">
                <button onclick="sellItem('${item.name}')" style="background-color: #90ee90;">Продать</button>
                <button class="info-btn" onclick="openItemInfo('${item.name}')">Подробнее</button>
            </div>
        `;
        list.appendChild(div);
    });
    if (myListings) {
        myListings.forEach(item => {
            const div = document.createElement('div'); div.className = 'inv-card'; div.style.backgroundColor = '#ffdddd';
            div.innerHTML = `
                ${getImgTag(item.img)}
                <div class="inv-card-name"><span class="rarity-${item.rarity}">${item.item_name}</span></div>
                <div style="font-size:10px; color:red; margin-bottom:5px;">На продаже: ${item.price}</div>
                <div class="inv-card-buttons">
                    <button onclick="removeListing(${item.id})" style="background-color: #ffcccb;">Снять</button>
                    <button class="info-btn" onclick="openItemInfo('${item.item_name}')">Подробнее</button>
                </div>
            `;
            list.appendChild(div);
        });
    }
}

async function sellItem(itemName) {
    const realItem = currentInventory.find(i => i.name === itemName);
    if (!realItem) { alert("Предмет не найден!"); return; }
    const price = prompt(`За сколько монет продать "${realItem.name}"?`, 50);
    if (!price || isNaN(price) || price <= 0) return;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'sell_item', username: currentUser, data: { item: realItem, price: parseInt(price) } } });
        if (error) alert("Ошибка сети: " + error.message); else if (data.error) alert(data.error);
        else { currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); renderInventory(); alert("Выставлено на рынок!"); }
    } catch(e) { alert("Фатальная ошибка: " + e.message); }
}

async function removeListing(listing_id) {
    if (!confirm("Снять лот с продажи?")) return;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'remove_listing', username: currentUser, data: { listing_id: listing_id } } });
        if (error) alert("Ошибка сети: " + error.message); else if (data.error) alert(data.error);
        else { currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); renderInventory(); alert("Лот снят с продажи."); }
    } catch(e) { alert("Фатальная ошибка: " + e.message); }
}

async function renderMarket() {
    const list = document.getElementById('market-list'); list.innerHTML = 'Загрузка...';
    const { data, error } = await supabaseClient.from('marketplace').select('*').order('id', { ascending: false });
    if (error) { list.innerHTML = 'Ошибка'; return; }
    list.innerHTML = '';
    if (data.length === 0) { list.innerHTML = '<p>Рынок пуст.</p>'; return; }
    data.forEach(item => {
        const div = document.createElement('div'); div.className = 'shop-item';
        let actionBtn = item.seller === currentUser ? `<button onclick="removeListing(${item.id})" style="background-color: #ffcccb; font-size: 14px;">Снять</button>` : `<button onclick="buyItem(${item.id})" style="background-color: #90ee90; font-size: 14px;">Купить (${item.price})</button>`;
        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${getImgTag(item.img)}
                <div>
                    <b class="rarity-${item.rarity}">${item.item_name}</b> <small>(+${item.points} очков)</small><br>
                    <small>Продавец: ${item.seller}</small>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; width:100px;">
                ${actionBtn}
                <button class="info-btn" onclick="openItemInfo('${item.item_name}')">Подробнее</button>
            </div>
        `;
        list.appendChild(div);
    });
}

async function buyItem(listing_id) {
    if (!confirm("Купить предмет?")) return;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'buy_item', username: currentUser, data: { listing_id: listing_id } } });
        if (error) alert("Ошибка сети: " + error.message); else if (data.error) alert(data.error);
        else { currentCoins = data.newCoins; currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); renderMarket(); alert("Успешно куплено!"); }
    } catch(e) { alert("Фатальная ошибка: " + e.message); }
}

async function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body'); tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('players').select('username, max_score, item_points, pvp_pts');
    if (!error) {
        let sorted = data.map(u => ({ ...u, total: (u.max_score||0)+(u.item_points||0) })).sort((a, b) => b.total - a.total).slice(0, 10);
        tbody.innerHTML = ''; 
        sorted.forEach((u, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i+1}</td><td>${u.username}</td><td style="color:orange; font-weight:bold;">${u.pvp_pts||0}</td><td>${u.max_score||0}</td><td>${u.item_points||0}</td><td><button onclick="viewProfile('${u.username}')" style="font-size:12px;">Профиль</button></td>`;
            if (u.username === currentUser) tr.style.backgroundColor = '#FFFF00';
            tbody.appendChild(tr);
        });
    }
}

async function viewProfile(username) {
    const modal = document.getElementById('profile-modal');
    const nameEl = document.getElementById('prof-name'); const statsEl = document.getElementById('prof-stats'); const invEl = document.getElementById('prof-inventory');
    nameEl.textContent = "Профиль: " + username; statsEl.innerHTML = "Загрузка..."; invEl.innerHTML = ''; modal.classList.remove('hidden');
    const { data, error } = await supabaseClient.from('players').select('*').eq('username', username).single();
    if (error || !data) { statsEl.textContent = "Ошибка."; return; }
    const state = onlineChannel ? onlineChannel.presenceState() : {};
    const isOnline = state[username] !== undefined;
    let onlineStatusHtml = isOnline ? '<span style="color: #00ff00; font-weight: bold;">● ОНЛАЙН</span>' : '<span style="color: #ff0000; font-weight: bold;">● ОФФЛАЙН</span>';
    let createdStr = data.created_at ? new Date(data.created_at).toLocaleString('ru-RU') : 'Неизвестно';
    let lastOnlineStr = data.last_online ? new Date(data.last_online).toLocaleString('ru-RU') : 'Неизвестно';
    let maxF = data.rpg_max_floors || {}; let ups = data.rpg_upgrades || {};
    statsEl.innerHTML = `
        Статус: ${onlineStatusHtml}<br>Зареган: ${createdStr}<br>Был в сети: ${lastOnlineStr}<hr style="margin: 5px 0;">
        <b>PTS: <span style="color:orange;">${data.pvp_pts || 0}</span></b> | Общий счет: ${(data.max_score || 0) + (data.item_points || 0)}<hr style="margin: 5px 0;">
        <b>Статы РПГ:</b><br>
        <span style="color: #d32f2f;">Ashab:</span> Этаж ${(maxF.ashab || 0).toFixed(1)} | HP ур.${ups.ashab?.hp || 0} | ATK ур.${ups.ashab?.atk || 0}<br>
        <span style="color: #d32f2f;">Apostol:</span> Этаж ${(maxF.apostol || 0).toFixed(1)} | HP ур.${ups.apostol?.hp || 0} | ATK ур.${ups.apostol?.atk || 0}<br>
        <span style="color: #d32f2f;">Мээ:</span> Этаж ${(maxF.mee || 0).toFixed(1)} | HP ур.${ups.mee?.hp || 0} | ATK ур.${ups.mee?.atk || 0}
    `;
    const { data: marketItems } = await supabaseClient.from('marketplace').select('*').eq('seller', username);
    let inv = data.inventory || [];
    let grouped = {}; inv.forEach(item => { if (!grouped[item.name]) grouped[item.name] = { ...item, qty: 0 }; grouped[item.name].qty++; });
    let processedInv = Object.values(grouped).sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));
    if (processedInv.length === 0 && (!marketItems || marketItems.length === 0)) { invEl.innerHTML = "<p style='grid-column: 1/-1;'>Инвентарь пуст.</p>"; }
    else {
        processedInv.forEach(item => {
            const div = document.createElement('div'); div.className = 'inv-card';
            if (item.qty > 1) div.innerHTML += `<div class="qty-badge">x${item.qty}</div>`;
            div.innerHTML += `
                ${getImgTag(item.img)}
                <div class="inv-card-name"><span class="rarity-${item.rarity}">${item.name}</span></div>
                <div class="inv-card-buttons">
                    <button class="info-btn" onclick="openItemInfo('${item.name}')">Подробнее</button>
                </div>
            `;
            invEl.appendChild(div);
        });
        if (marketItems) {
            marketItems.forEach(item => {
                const div = document.createElement('div'); div.className = 'inv-card'; div.style.backgroundColor = '#ffdddd';
                div.innerHTML = `
                    ${getImgTag(item.img)}
                    <div class="inv-card-name"><span class="rarity-${item.rarity}">${item.item_name}</span></div>
                    <div style="font-size:10px; color:red; margin-bottom:5px;">На продаже</div>
                    <div class="inv-card-buttons">
                        <button class="info-btn" onclick="openItemInfo('${item.item_name}')">Подробнее</button>
                    </div>
                `;
                invEl.appendChild(div);
            });
        }
    }
}

function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }

function openItemMenu() {
    if(!isPlayerTurn) return;
    const list = document.getElementById('rpg-item-list'); list.innerHTML = '';
    let processedInv = getProcessedInventory();
    if (processedInv.length === 0) { list.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">У тебя пусто.</p>'; } 
    else {
        processedInv.forEach((item) => {
            let effectText = ""; let btnText = "Использовать"; 
            if (item.rarity === 'Обычное') effectText = "Лечит 20 HP";
            if (item.rarity === 'Редкое' && item.name !== 'парашник') effectText = "+10 к Атаке";
            if(item.name === 'картофель') effectText = "+10 к Атаке";
            if(item.name === 'голова барана') effectText = "40 урона врагу";
            if(item.name === 'коала') effectText = "100 маны";
            if(item.name === 'apostol') effectText = "100 урона врагу";
            if(item.name === 'парашник') effectText = "Отравление (30 урона)";
            if(item.name === 'boris') effectText = "Щит на 60 HP";
            if(item.name === 'шприц и лекарство') effectText = "100% лечение";
            if(item.name === 'Сбриватель хуйни') effectText = "Убирает щиты врага";
            const div = document.createElement('div'); div.className = 'inv-card';
            if (item.qty > 1) div.innerHTML += `<div class="qty-badge">x${item.qty}</div>`;
            div.innerHTML += `
                ${getImgTag(item.img)}
                <div class="inv-card-name"><span class="rarity-${item.rarity}">${item.name}</span></div>
                <div style="font-size:10px; margin-bottom:5px;">${effectText}</div>
                <div class="inv-card-buttons">
                    <button onclick="useItemInBattle('${item.name}')" style="background-color: #90ee90;">${btnText}</button>
                    <button class="info-btn" onclick="openItemInfo('${item.name}')">Подробнее</button>
                </div>
            `;
            list.appendChild(div);
        });
    }
    document.getElementById('rpg-item-modal').classList.remove('hidden');
}
function closeItemMenu() { document.getElementById('rpg-item-modal').classList.add('hidden'); }

async function useItemInBattle(itemName) {
    if (!isPlayerTurn) return;
    const itemIndex = currentInventory.findIndex(i => i.name === itemName);
    if (itemIndex === -1) return;
    const item = currentInventory[itemIndex];
    isPlayerTurn = false; rpgItemUsed = true; setTurnIndicator(false); checkButtons();
    
    if (item.name === 'Сбриватель хуйни') {
        playSoundEffect('shaver');
    } else if (item.name === 'голова барана' || item.name === 'apostol') {
        playSoundEffect('harmful');
    } else {
        playSoundEffect('thing');
    }
    
    let isDamaging = (item.name === 'голова барана' || item.name === 'apostol' || item.name === 'Сбриватель хуйни');
    animateItemUse(item, isDamaging);
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'consume_item', username: currentUser, data: { item_id: item.id } } });
        if (!error && data.success) { currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); } 
        else { addLog("Ошибка при использовании."); isPlayerTurn = true; rpgItemUsed = false; checkButtons(); return; }
    } catch(e) { addLog("Фатальная ошибка сервера."); isPlayerTurn = true; rpgItemUsed = false; checkButtons(); return; }
    const applyEffect = () => {
        if (item.name === 'хуйня') { rpgChar.hp = Math.min(rpgChar.maxHp, rpgChar.hp + 20); addLog(`Выпил ${item.name}. +20 HP.`); playSoundEffect('heal'); }
        else if (item.name === 'картофель') { rpgChar.atk += 10; addLog(`Съел ${item.name}. Атака +10!`); }
        else if (item.name === 'голова барана') { 
            let dmg = 40;
            if (rpgEnemyBorisHp > 0) { rpgEnemyBorisHp -= dmg; addLog(`Швырнул голову в Бориса!`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp=0; addLog("Борис разрушен!"); } }
            else if(rpgEnemyParashnikHp > 0) { rpgEnemyParashnikHp -= dmg; addLog(`Швырнул голову в Парашника!`); if(rpgEnemyParashnikHp <= 0) { rpgEnemyParashnikHp=0; addLog("Парашник уничтожен!"); } }
            else { rpgEnemy.hp -= dmg; addLog(`Швырнул ${item.name}. ${dmg} урона!`); }
        }
        else if (item.name === 'коала') { rpgMana = 100; addLog(`Использовал ${item.name}. Мана 100!`); }
        else if (item.name === 'apostol') { 
            let dmg = 100;
            if(rpgEnemyBorisHp > 0) { rpgEnemyBorisHp -= dmg; addLog(`Швырнул Apostol в Бориса!`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp=0; addLog("Борис разрушен!"); } }
            else if(rpgEnemyParashnikHp > 0) { rpgEnemyParashnikHp -= dmg; addLog(`Швырнул Apostol в Парашника!`); if(rpgEnemyParashnikHp <= 0) { rpgEnemyParashnikHp=0; addLog("Парашник уничтожен!"); } }
            else { rpgEnemy.hp -= dmg; addLog(`ПРИЗВАН APOSTOL! ${dmg} УРОНА!`); }
        }
        else if (item.name === 'шприц и лекарство') { rpgChar.hp = rpgChar.maxHp; addLog(`100% лечение!`); playSoundEffect('heal'); }
        else if (item.name === 'boris') { rpgPlayerBorisHp += 60; addLog(`Ты поставил Бориса!`); }
        else if (item.name === 'парашник') { rpgEnemyParashnikHp += 30; addLog(`Ты поставил Парашника врагу!`); }
        else if (item.name === 'Сбриватель хуйни') { rpgEnemyBorisHp = 0; rpgEnemyParashnikHp = 0; addLog(`Ты сбрил всю хуйню врага!`); }
        else if (item.name === 'Вам не повезло') { addLog(`Вы нихуя не сделали.`); }
        updateRpgUI(); 
        if (rpgEnemy.hp <= 0) winRpg(); else {
            if (rpgEnemyParashnikHp > 0 && item.name !== 'Сбриватель хуйни') {
                rpgEnemy.hp -= 10; rpgEnemy.mp = Math.max(0, (rpgEnemy.mp||0) - 15);
                addLog(`Враг отравлен парашником! -10 HP.`); updateRpgUI();
                if(rpgEnemy.hp <= 0) { winRpg(); return; }
            }
            isPlayerTurn = true;
            setTurnIndicator(true);
            checkButtons(); 
        }
    };
    setTimeout(applyEffect, 2600); 
    closeItemMenu();
}

function animateItemUse(item, isDamage) {
    const battlefield = document.getElementById('battlefield-bg');
    const el = document.createElement('img');
    el.src = item.img || 'https://via.placeholder.com/50?text=ITEM'; 
    el.style.position = 'absolute'; el.style.width = '80px'; el.style.height = '80px'; el.style.zIndex = '9999';
    
    if (item.name === 'Сбриватель хуйни') {
        el.style.left = '-100px'; 
        el.style.bottom = '20%'; 
        el.style.transform = 'rotate(0deg) scale(1)'; 
        battlefield.appendChild(el);
        void el.offsetWidth; 
        el.style.transition = 'all 3s linear'; 
        el.style.left = '110%'; 
    } else {
        el.style.transition = 'all 2.6s cubic-bezier(0.25, 0.1, 0.25, 1)'; 
        if (isDamage) {
            el.style.left = '20%'; el.style.top = '40%'; el.style.transform = 'rotate(-20deg) scale(1)'; battlefield.appendChild(el);
            void el.offsetWidth; 
            el.style.left = '75%'; el.style.top = '30%'; el.style.transform = 'scale(1.5) rotate(720deg)'; 
            setTimeout(() => { el.remove(); }, 2600);
        } else {
            el.style.left = '25%'; el.style.top = '30%'; el.style.transform = 'rotate(0deg) scale(1)'; battlefield.appendChild(el);
            void el.offsetWidth;
            el.style.top = '60%'; el.style.opacity = '0'; el.style.transform = 'scale(0.8) rotate(15deg)';
            setTimeout(() => { el.remove(); }, 2600);
        }
    }
}

const pads = document.querySelectorAll('.pad'); const statusText = document.getElementById('status'); const restartBtn = document.getElementById('restart-btn');
const AudioContext = window.AudioContext || window.webkitAudioContext; const audioCtx = new AudioContext();
const frequencies = { '1': 200, '2': 300, '3': 400, '4': 500 }; 
let gameSequence = [], playerSequence = [], level = 1, maxPads = 1, isPlayingSequence = false, canClick = false, gameStarted = false;

function playSound(id) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(frequencies[id], audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    const pad = document.querySelector(`.pad[data-id="${id}"]`);
    if(pad) { pad.classList.add('active'); setTimeout(() => pad.classList.remove('active'), 300); }
}
function resetGame() {
    gameSequence = []; level = 1; maxPads = 1; gameStarted = false; restartBtn.classList.add('hidden');
    statusText.textContent = "привет ножми"; statusText.style.color = "#00FF00"; pads.forEach(p => p.classList.add('disabled')); updateActivePads();
}
function startGame() {
    gameStarted = true; gameSequence = []; level = 1; maxPads = 1;
    restartBtn.classList.add('hidden'); updateActivePads(); nextRound();
}
function updateActivePads() { pads.forEach(p => { const id = parseInt(p.dataset.id); if (id <= maxPads) p.classList.remove('disabled'); else p.classList.add('disabled'); }); }
function nextRound() {
    playerSequence = []; statusText.textContent = "ЗАПОМИНАЙТЕ...";
    if (level > 1 && level % 2 === 0 && maxPads < 4) { maxPads++; updateActivePads(); }
    const randomId = Math.floor(Math.random() * maxPads) + 1; gameSequence.push(randomId.toString()); setTimeout(playSequence, 500);
}
function playSequence() {
    isPlayingSequence = true; canClick = false;
    gameSequence.forEach((id, index) => {
        setTimeout(() => {
            playSound(id);
            if (index === gameSequence.length - 1) { setTimeout(() => { isPlayingSequence = false; canClick = true; statusText.textContent = "ВАШ ХОД!"; }, 400); }
        }, index * 600);
    });
}
async function handlePadClick(e) {
    if (!canClick || isPlayingSequence || !gameStarted) return;
    const id = e.currentTarget.dataset.id; playSound(id); playerSequence.push(id);
    const currentStep = playerSequence.length - 1;
    if (playerSequence[currentStep] !== gameSequence[currentStep]) {
        canClick = false; gameStarted = false; statusText.textContent = "ОШИБКА!"; statusText.style.color = "#FF0000";
        let currentScore = level - 1;
        try {
            const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'score', username: currentUser, data: { score: currentScore } } });
            if (error) { statusText.textContent += ` (Ошибка сети)`; }
            else if (data.error) { statusText.textContent += ` (${data.error})`; }
            else {
                currentCoins = data.newCoins; if (currentScore > currentHighScore) currentHighScore = currentScore; updateUI();
                if (data.earned > 0) { statusText.textContent += ` (+${data.earned} монет)`; }
                else { statusText.textContent += ` (Ничего)`; }
            }
        } catch(e) { statusText.textContent += ` (Сбой)`; }
        const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1);
        osc.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 1); restartBtn.classList.remove('hidden'); return;
    }
    if (playerSequence.length === gameSequence.length) { canClick = false; level++; statusText.textContent = `УРОВЕНЬ ${level} ПРОЙДЕН!`; setTimeout(nextRound, 1500); }
}

pads.forEach(pad => pad.addEventListener('click', handlePadClick));
restartBtn.addEventListener('click', startGame);
statusText.addEventListener('click', () => { if (!gameStarted) startGame(); });