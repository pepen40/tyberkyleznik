const SUPABASE_URL = 'https://zfvinbamwavibnhmfwnz.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ytzpwBslnHFtTsheZGDTJw_ouursAih';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
        queueMicrotask(() => {
            (async () => {
                let newPassword = prompt("Введи новый пароль (минимум 10 символов):");
                if (!newPassword || newPassword.length < 10) {
                    alert("Пароль должен содержать минимум 10 символов.");
                    await supabaseClient.auth.signOut();
                    return;
                }
                const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
                if (error) alert("Не удалось изменить пароль: " + error.message);
                else alert("Пароль успешно изменён. Теперь войди с новым паролем.");
                await supabaseClient.auth.signOut();
            })();
        });
    }
});
const EDGE_FUNCTION_NAME = 'award-coins';
// Set only by the isolated test server; server/SQL enforce all restrictions too.
let closedTestMode = window.PEPEN_CLOSED_TEST === true;
function showClosedTestNotice() {
    if (!closedTestMode || document.getElementById('closed-test-notice')) return;
    const notice = document.createElement('div');
    notice.id = 'closed-test-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = 'ЗАКРЫТЫЙ ТЕСТ · отдельные аккаунты и данные · награды, рейтинг, покупки и продажа отключены · прогресс PvE только на время сессии';
    notice.style.cssText = 'background:#ffffcc;color:#000;border:2px outset #fff;padding:10px;font:14px Tahoma,sans-serif;';
    document.body.prepend(notice);
}
window.addEventListener('DOMContentLoaded', showClosedTestNotice);

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}
function inlineJsString(value) {
    return JSON.stringify(String(value ?? ''))
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
function safeInlineArg(value) {
    return escapeHtml(inlineJsString(value));
}
const battleBackgrounds = ['bg1.png', 'bg2.png', 'bg3.png', 'bg4.png', 'bg5.png', 'bg6.png'];

// === БЕЗ АВТОЛОГИНА, ПОГОДА И ЧАСЫ ВКЛЮЧЕНЫ ПО УМОЛЧАНИЮ ===
window.addEventListener('load', () => {
    // Всегда показываем экран входа — никакого автологина
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    restoreAuthSession();
    initSiteBackground();
    initSheepSetting();
    initRoachSetting();
    initRoachControls();

    // Погода включена по умолчанию
    document.getElementById('weather-toggle').checked = true;
    document.getElementById('weather-widget').classList.remove('hidden');

    // Часы включены по умолчанию
    const clockToggle = document.getElementById('clock-toggle');
    if (clockToggle) clockToggle.checked = true;
    const clockEl = document.getElementById('antique-clock');
    if (clockEl) clockEl.style.setProperty('display', 'block', 'important');
});

const SITE_BACKGROUND_COLORS = {
    teal: '#008080', black: '#000000', white: '#ffffff', gray: '#808080',
    dark: '#202020', navy: '#000080', purple: '#4b0082', blue: '#4682b4',
    green: '#285943', burgundy: '#702632', cream: '#f2e8cf'
};
function initSiteBackground() {
    let saved = 'teal';
    try { saved = localStorage.getItem('pepen-site-background') || 'teal'; } catch (_) {}
    applySiteBackground(saved, false);
    const select = document.getElementById('site-background-select');
    if (select) select.value = Object.prototype.hasOwnProperty.call(SITE_BACKGROUND_COLORS, saved) ? saved : 'teal';
}
function applySiteBackground(key, save = true) {
    const color = SITE_BACKGROUND_COLORS[key] || SITE_BACKGROUND_COLORS.teal;
    document.body.style.backgroundColor = color;
    if (save) { try { localStorage.setItem('pepen-site-background', key); } catch (_) {} }
    const select = document.getElementById('site-background-select');
    if (select && select.value !== key) select.value = key;
}

function toggleWeather() {
    const isChecked = document.getElementById('weather-toggle').checked;
    if (isChecked) {
        document.getElementById('weather-widget').classList.remove('hidden');
    } else {
        document.getElementById('weather-widget').classList.add('hidden');
    }
    // Никакого localStorage
}

// === НАСТРОЙКА ПИКСЕЛЬНОГО БАРАНА ===
const SHEEP_SETTING_KEY = 'pepen-sheep-enabled';
const SHEEP_SOUND_SETTING_KEY = 'pepen-sheep-sound-enabled';
function isSheepSoundEnabled() {
    try { return localStorage.getItem(SHEEP_SOUND_SETTING_KEY) !== 'false'; }
    catch (_) { return true; }
}
function isSheepEnabled() {
    try { return localStorage.getItem(SHEEP_SETTING_KEY) !== 'false'; }
    catch (_) { return true; }
}
function initSheepSetting() {
    const toggle = document.getElementById('sheep-enabled');
    if (!toggle) return;
    toggle.checked = isSheepEnabled();
    toggle.addEventListener('change', () => {
        try { localStorage.setItem(SHEEP_SETTING_KEY, toggle.checked ? 'true' : 'false'); } catch (_) {}
        if (!toggle.checked) {
            stopSheep();
        } else if (currentUser) {
            startSheep();
        }
    });

    const soundToggle = document.getElementById('sheep-sound-enabled');
    if (soundToggle) {
        soundToggle.checked = isSheepSoundEnabled();
        soundToggle.addEventListener('change', () => {
            try { localStorage.setItem(SHEEP_SOUND_SETTING_KEY, soundToggle.checked ? 'true' : 'false'); } catch (_) {}
            if (!soundToggle.checked) {
                const audio = document.getElementById('sheep-beee-audio');
                if (audio) { audio.pause(); audio.currentTime = 0; }
            }
        });
    }
}

// === БАРАН С ПАРАШЮТОМ ===
let sheepTimer = null;
let sheepDescentTimer = null;
let sheepWalkTimer = null;
let sheepSecondsUntilBeee = 43;
let sheepWalkingRight = false;

function startSheep() {
    stopSheep();

    const layer = document.getElementById('sheep-layer');
    const character = document.getElementById('sheep-character');
    const audio = document.getElementById('sheep-beee-audio');
    if (!layer || !character || !audio || !currentUser || !isSheepEnabled()) return;

    layer.classList.remove('hidden');
    character.classList.remove('walking');
    character.style.animation = 'none';
    character.style.transition = 'none';
    character.style.left = 'calc(50% - 29px)';
    character.style.top = '-110px';
    character.style.bottom = 'auto';
    character.style.transform = 'none';
    void character.offsetWidth;
    character.style.animation = 'sheep-parachute-descent 18s linear forwards';

    sheepSecondsUntilBeee = 43;
    sheepWalkingRight = false;

    // После приземления убираем только парашют — сам баран остаётся на экране.
    sheepDescentTimer = setTimeout(() => {
        character.style.animation = 'none';
        character.classList.add('walking');
        character.style.top = 'auto';
        character.style.bottom = '0';
        character.style.left = '0px';
        character.style.transition = 'none';
        const parachute = document.getElementById('sheep-parachute');
        if (parachute) parachute.style.display = 'none';
        // Баран бесконечно ходит от одного края экрана до другого и обратно.
        // CSS alternate сам разворачивает движение на каждом краю — таймеры не нужны.
        void character.offsetWidth;
        character.style.animation = 'sheep-walk-across 140s linear infinite alternate';
        sheepDescentTimer = null;
    }, 18000);

    sheepTimer = setInterval(() => {
        if (document.visibilityState !== 'visible' || !currentUser) return;
        sheepSecondsUntilBeee -= 1;
        if (sheepSecondsUntilBeee <= 0) {
            if (isSheepSoundEnabled()) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            }
            sheepSecondsUntilBeee = 43;
        }
    }, 1000);
}

function stopSheep() {
    if (sheepTimer) clearInterval(sheepTimer);
    if (sheepDescentTimer) clearTimeout(sheepDescentTimer);
    if (sheepWalkTimer) {
        clearTimeout(sheepWalkTimer);
        clearInterval(sheepWalkTimer);
    }
    sheepTimer = null;
    sheepDescentTimer = null;
    sheepWalkTimer = null;

    const layer = document.getElementById('sheep-layer');
    const character = document.getElementById('sheep-character');
    const parachute = document.getElementById('sheep-parachute');
    const audio = document.getElementById('sheep-beee-audio');
    if (layer) layer.classList.add('hidden');
    if (character) {
        character.classList.remove('walking');
        character.style.animation = '';
        character.style.transition = '';
        character.style.left = '';
        character.style.top = '';
        character.style.bottom = '';
    }
    if (parachute) parachute.style.display = '';
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}


// === ТАРАКАНЬЯ МЯСОРУБКА ===
// Ожидаемые файлы в корне сайта:
// tarakan.png, kuvalda.png, tryapka.png,
// tarakan-smert.mp3, tryapka-zvuk.mp3
const ROACH_SETTING_KEY = 'pepen-roach-enabled';
const ROACH_FIRST_DELAY = 60;       // первая волна через 1 минуту
const ROACH_REPEAT_DELAY = 30 * 60; // затем каждые 30 минут активного сеанса
const ROACH_COUNT = 9;
let roachEnabled = true;
let roachScheduleTimer = null;
let roachCountdown = ROACH_FIRST_DELAY;
let roachAnimationFrame = null;
let roachRewardSent = false;
let roachActive = false;
let roachGeneration = 0;
let roachItems = [];
let roachSplats = [];
let roachTool = 'none';
let roachPointerX = 0;
let roachPointerY = 0;
let roachAlertTimer = null;
let roachCleanTimer = null;

function isRoachEnabled() {
    try { return localStorage.getItem(ROACH_SETTING_KEY) !== 'false'; }
    catch (_) { return true; }
}
function initRoachSetting() {
    const toggle = document.getElementById('roach-enabled');
    roachEnabled = isRoachEnabled();
    if (!toggle) return;
    toggle.checked = roachEnabled;
    toggle.addEventListener('change', () => {
        roachEnabled = toggle.checked;
        try { localStorage.setItem(ROACH_SETTING_KEY, roachEnabled ? 'true' : 'false'); } catch (_) {}
        if (!roachEnabled) stopRoachEvent(true);
        else if (currentUser) startRoachSchedule(ROACH_FIRST_DELAY);
    });
}
function startRoachSchedule(seconds = ROACH_FIRST_DELAY) {
    stopRoachSchedule();
    if (!currentUser || !isRoachEnabled()) return;
    roachCountdown = seconds;
    roachScheduleTimer = setInterval(() => {
        if (!currentUser || !isRoachEnabled() || document.visibilityState !== 'visible') return;
        roachCountdown--;
        if (roachCountdown <= 0) {
            if (!roachActive) spawnRoachWave();
            roachCountdown = ROACH_REPEAT_DELAY;
        }
    }, 1000);
}
function stopRoachSchedule() {
    if (roachScheduleTimer) clearInterval(roachScheduleTimer);
    roachScheduleTimer = null;
}
const ROACH_SOUND_SETTING_KEY = 'pepen-roach-sounds-enabled';
function isRoachSoundEnabled() {
    const toggle = document.getElementById('roach-sound-enabled');
    if (toggle) return toggle.checked;
    return localStorage.getItem(ROACH_SOUND_SETTING_KEY) !== 'false';
}
function initRoachSoundSetting() {
    const toggle = document.getElementById('roach-sound-enabled');
    if (!toggle) return;
    toggle.checked = localStorage.getItem(ROACH_SOUND_SETTING_KEY) !== 'false';
    toggle.addEventListener('change', () => {
        localStorage.setItem(ROACH_SOUND_SETTING_KEY, String(toggle.checked));
        if (!toggle.checked) {
            ['cockroach-alarm-audio','hammer-sound-audio','roach-wipe-audio','roach-applause-audio'].forEach(id => {
                const audio = document.getElementById(id);
                if (audio) { audio.pause(); audio.currentTime = 0; }
            });
        }
    });
}
document.addEventListener('DOMContentLoaded', initRoachSoundSetting);
function playRoachAudio(id) {
    if (!isRoachSoundEnabled()) return;
    const audio = document.getElementById(id);
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch (_) {}
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
}
// Отдельный проигрыватель для звуков кейсов: настройка тараканов на них не влияет.
function playIndependentAudio(id) {
    const audio = document.getElementById(id);
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch (_) {}
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
}
function spawnRoachWave() {
    if (!currentUser || !isRoachEnabled() || roachActive) return;
    const layer = document.getElementById('roach-event-layer');
    const field = document.getElementById('roach-field');
    const tools = document.getElementById('roach-tools');
    if (!layer || !field || !tools) return;
    roachGeneration++;
    roachActive = true;
    roachRewardSent = false;
    roachTool = 'hammer';
    roachItems = [];
    roachSplats = [];
    field.innerHTML = '';
    document.getElementById('roach-clean-message')?.classList.add('hidden');
    document.getElementById('roach-cursor')?.classList.add('hidden');
    layer.classList.remove('hidden');
    tools.classList.remove('hidden');
    showRoachAlert();
    // Однократная тревога при появлении тараканов (без повтора/цикла).
    playRoachAudio('cockroach-alarm-audio');

    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < ROACH_COUNT; i++) {
        const img = document.createElement('img');
        img.className = 'roach-bug';
        img.src = 'tarakan.png';
        img.alt = 'Таракан';
        img.draggable = false;
        const item = {
            el: img,
            x: Math.random() * Math.max(10, w - 55),
            y: 90 + Math.random() * Math.max(20, h - 180),
            // Направление движения в радианах; спрайт изначально смотрит вправо.
            heading: Math.random() * Math.PI * 2,
            speed: 1.15 + Math.random() * 0.85,
            turnIn: 35 + Math.floor(Math.random() * 75),
            vx: 0,
            vy: 0,
            alive: true,
            hits: 0
        };
        item.vx = Math.cos(item.heading) * item.speed;
        item.vy = Math.sin(item.heading) * item.speed;
        img.style.setProperty('--roach-heading', (item.heading * 180 / Math.PI) + 'deg');
        img.style.left = item.x + 'px';
        img.style.top = item.y + 'px';
        img.addEventListener('click', () => hitRoach(item));
        field.appendChild(img);
        roachItems.push(item);
    }
    const hammerBtn = document.getElementById('roach-hammer-tool');
    const ragBtn = document.getElementById('roach-rag-tool');
    hammerBtn?.classList.remove('selected');
    ragBtn?.classList.remove('selected');
    setRoachTool('none');
    if (!roachAnimationFrame) animateRoaches();
}
function showRoachAlert() {
    const alert = document.getElementById('roach-alert');
    if (!alert) return;
    alert.classList.remove('hidden');
    if (roachAlertTimer) clearTimeout(roachAlertTimer);
    roachAlertTimer = setTimeout(() => alert.classList.add('hidden'), 10000);
}
function animateRoaches() {
    if (!roachActive) { roachAnimationFrame = null; return; }
    const w = window.innerWidth;
    const h = window.innerHeight;
    roachItems.forEach(item => {
        if (!item.alive) return;
        const rw = item.el.offsetWidth || 252;
        const rh = item.el.offsetHeight || 186;

        // Таракан бежит вперёд, периодически немного меняя курс.
        item.turnIn--;
        if (item.turnIn <= 0) {
            item.heading += (Math.random() - 0.5) * 1.15;
            item.speed = 1.15 + Math.random() * 0.85;
            item.turnIn = 35 + Math.floor(Math.random() * 75);
        }
        item.vx = Math.cos(item.heading) * item.speed;
        item.vy = Math.sin(item.heading) * item.speed;

        item.x += item.vx;
        item.y += item.vy;

        // Отскакивает от краёв, разворачивая голову вместе с направлением.
        if (item.x <= 0 || item.x >= w - rw) {
            item.heading = Math.PI - item.heading;
            item.x = Math.max(0, Math.min(w - rw, item.x));
        }
        if (item.y <= 48 || item.y >= h - rh - 12) {
            item.heading = -item.heading;
            item.y = Math.max(48, Math.min(h - rh - 12, item.y));
        }
        item.vx = Math.cos(item.heading) * item.speed;
        item.vy = Math.sin(item.heading) * item.speed;
        item.el.style.setProperty('--roach-heading', (item.heading * 180 / Math.PI) + 'deg');
        item.el.style.left = item.x + 'px';
        item.el.style.top = item.y + 'px';
    });
    roachAnimationFrame = requestAnimationFrame(animateRoaches);
}
function hitRoach(item) {
    if (!roachActive || roachTool !== 'hammer' || !item.alive) return;
    item.hits = (item.hits || 0) + 1;
    playRoachAudio('hammer-sound-audio');
    item.el.classList.remove('roach-hit-1', 'roach-hit-2');
    if (item.hits < 3) {
        item.el.classList.add('roach-hit-' + item.hits);
        return;
    }
    item.alive = false;
    item.el.classList.add('roach-dead');
    const splat = document.createElement('div');
    splat.className = 'roach-splat';
    splat.setAttribute('role', 'button');
    splat.setAttribute('aria-label', 'Оттереть пятно тряпочкой');
    splat.style.left = (item.x + 8) + 'px';
    splat.style.top = (item.y + 4) + 'px';
    const splatImage = document.createElement('img');
    splatImage.src = 'roach-splat.png';
    splatImage.alt = '';
    splatImage.draggable = false;
    splat.appendChild(splatImage);
    splat.wipeHits = 0;
    splat.addEventListener('click', () => cleanRoachSplat(splat));
    document.getElementById('roach-field')?.appendChild(splat);
    roachSplats.push(splat);
    checkRoachClear();
}
function cleanRoachSplat(splat) {
    if (!roachActive || roachTool !== 'rag' || !splat.isConnected || splat.dataset.cleaning === 'true') return;
    splat.wipeHits = (splat.wipeHits || 0) + 1;
    playRoachAudio('roach-wipe-audio');
    splat.classList.add('wiping');
    splat.dataset.wipeHits = String(splat.wipeHits);
    if (splat.wipeHits < 3) {
        setTimeout(() => splat.classList.remove('wiping'), 180);
        return;
    }
    splat.dataset.cleaning = 'true';
    splat.classList.add('cleaning');
    setTimeout(() => {
        splat.remove();
        roachSplats = roachSplats.filter(x => x !== splat);
        checkRoachClear();
    }, 280);
}
function setRoachTool(tool) {
    if (!roachActive) return;
    roachTool = tool;
    document.getElementById('roach-hammer-tool')?.classList.toggle('selected', tool === 'hammer');
    document.getElementById('roach-rag-tool')?.classList.toggle('selected', tool === 'rag');
    const cursor = document.getElementById('roach-cursor');
    if (cursor) {
        cursor.classList.toggle('hidden', tool === 'none');
        const img = cursor.querySelector('img');
        if (img) img.src = tool === 'rag' ? 'tryapka.png' : 'kuvalda.png';
    }
    document.getElementById('roach-event-layer')?.classList.toggle('tool-cursor-active', tool !== 'none');
    document.getElementById('roach-event-layer')?.classList.toggle('rag-mode', tool === 'rag');
}
// Картинка инструмента следует за указателем только после выбора инструмента.
document.addEventListener('mousemove', (event) => {
    const cursor = document.getElementById('roach-cursor');
    if (!cursor || !roachActive || roachTool === 'none') return;
    cursor.style.left = (event.clientX + 4) + 'px';
    cursor.style.top = (event.clientY + 4) + 'px';
});
function checkRoachClear() {
    const allDead = roachItems.length && roachItems.every(x => !x.alive);
    if (allDead && roachSplats.length === 0) finishRoachWave();
}
async function finishRoachWave() {
    if (!roachActive || roachRewardSent) return;
    const generation = roachGeneration, account = currentAuthUserId;
    const isCurrentWave = () => generation === roachGeneration && account === currentAuthUserId;
    roachRewardSent = true;
    try {
        if (currentUser) {
            const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
                body: { action: 'roach_clear', username: currentUser, data: {} }
            });
            if (!isCurrentWave()) return;
            if (error) throw error;
            if (data?.success) {
                playRoachAudio('roach-applause-audio');
                currentCoins = Number(data.newCoins ?? currentCoins);
                if (data.newUpgrades) currentUpgrades = data.newUpgrades;
                updateUI();
                const messageEl = document.getElementById('roach-clean-message');
                if (messageEl) messageEl.textContent = 'зачищено · +150 монет';
            } else {
                if (data?.rewardPaused) {
                    const messageEl = document.getElementById('roach-clean-message');
                    if (messageEl) messageEl.textContent = 'Бойня завершена. Монеты и зачёт зачистки временно отключены до серверной проверки.';
                } else {
                    roachRewardSent = false;
                    console.error('Не удалось начислить награду за бойню:', data?.error);
                }
            }
        }
    } catch (e) {
        if (!isCurrentWave()) return;
        roachRewardSent = false;
        console.error('Ошибка награды за бойню:', e);
    }
    if (!isCurrentWave()) return;
    roachActive = false;
    if (roachAnimationFrame) cancelAnimationFrame(roachAnimationFrame);
    roachAnimationFrame = null;
    document.getElementById('roach-tools')?.classList.add('hidden');
    document.getElementById('roach-cursor')?.classList.add('hidden');
    document.getElementById('roach-alert')?.classList.add('hidden');
    const message = document.getElementById('roach-clean-message');
    message?.classList.remove('hidden');
    if (roachCleanTimer) clearTimeout(roachCleanTimer);
    roachCleanTimer = setTimeout(() => {
        document.getElementById('roach-event-layer')?.classList.add('hidden');
        if (message) message.classList.add('hidden');
        const field = document.getElementById('roach-field');
        if (field) field.innerHTML = '';
        roachItems = [];
        roachSplats = [];
    }, 10000);
}
function stopRoachEvent(resetSchedule = false) {
    roachGeneration++;
    stopRoachSchedule();
    roachActive = false;
    if (roachAnimationFrame) cancelAnimationFrame(roachAnimationFrame);
    roachAnimationFrame = null;
    if (roachAlertTimer) clearTimeout(roachAlertTimer);
    if (roachCleanTimer) clearTimeout(roachCleanTimer);
    roachAlertTimer = null;
    roachCleanTimer = null;
    document.getElementById('roach-event-layer')?.classList.add('hidden');
    document.getElementById('roach-tools')?.classList.add('hidden');
    document.getElementById('roach-field')?.replaceChildren();
    document.getElementById('roach-clean-message')?.classList.add('hidden');
    document.getElementById('roach-alert')?.classList.add('hidden');
    document.getElementById('roach-cursor')?.classList.add('hidden');
    roachItems = [];
    roachSplats = [];
    ['roach-death-audio', 'roach-wipe-audio'].forEach(id => {
        const a = document.getElementById(id);
        if (a) { a.pause(); a.currentTime = 0; }
    });
    if (resetSchedule && currentUser && isRoachEnabled()) startRoachSchedule(ROACH_FIRST_DELAY);
}
function initRoachControls() {
    document.getElementById('roach-hammer-tool')?.addEventListener('click', () => setRoachTool('hammer'));
    document.getElementById('roach-rag-tool')?.addEventListener('click', () => setRoachTool('rag'));
    document.addEventListener('pointermove', e => {
        roachPointerX = e.clientX;
        roachPointerY = e.clientY;
        const cursor = document.getElementById('roach-cursor');
        if (cursor && !cursor.classList.contains('hidden')) {
            cursor.style.left = (roachPointerX - 12) + 'px';
            cursor.style.top = (roachPointerY - 12) + 'px';
        }
    });
    document.getElementById('roach-field')?.addEventListener('click', e => {
        if (roachTool === 'rag' && e.target === e.currentTarget) {
            // В режиме тряпочки клик по пустому месту ничего не делает.
        }
    });
}


async function logout() {
    if (!confirm("Выйти с аккаунта?")) return;
    stopSheep();
    stopRoachEvent(false);
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert("Не удалось выйти: " + error.message);
        return;
    }
    currentUser = null;
    window.resetChessSession?.();
    currentAuthUserId = null;
    location.reload();
}

async function finishAuthLogin(user) {
    if (!user?.id) throw new Error("Не удалось определить пользователя.");
    const { data: profileResponse, error: profileError } = await supabaseClient.functions.invoke('award-coins', {
        body: { action: 'get_player_profile', data: {} }
    });
    const data = profileResponse?.profile;
    if (profileError || !profileResponse?.success || !data) {
        throw new Error("Профиль игрока не найден: " + (profileError?.message || profileResponse?.error || "нет записи"));
    }
    if (profileResponse.closedTest === true) { closedTestMode = true; showClosedTestNotice(); }

    if (currentAuthUserId !== user.id) window.resetChessSession?.();
    currentUser = data.username;
    currentAuthUserId = user.id;
    await window.syncServerInviteSettings?.();
    currentHighScore = data.max_score || 0;
    currentCoins = data.coins || 0;
    currentInventory = data.inventory || [];
    currentItemPoints = data.item_points || 0;
    currentPvpPts = data.pvp_pts || 0;
    currentUpgrades = data.rpg_upgrades || {"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}};
    ensureRpgGear();
    currentMaxFloors = data.rpg_max_floors || {"ashab":0,"apostol":0,"mee":0};
    const rpgInvitationInboxReady = await initRpgInvitationInbox(user.id);

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    startSheep();
    startRoachSchedule(ROACH_FIRST_DELAY);
    preloadSounds();
    initOnlineCounter();
    if (rpgInvitationInboxReady) initLobby();
    initSiteGlobalChat();
    updateUI();
    resetGame();
    renderCharStats();
    switchTab('minigames');
}

async function restoreAuthSession() {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData?.session) return;
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
        await supabaseClient.auth.signOut();
        return;
    }
    try {
        await finishAuthLogin(userData.user);
    } catch (error) {
        console.error("Ошибка восстановления сессии:", error);
        document.getElementById('auth-msg').textContent = "Не удалось загрузить профиль: " + error.message;
        await supabaseClient.auth.signOut();
    }
}

function usernameAuthEmail(username) {
    const normalized = username.trim().toLowerCase();
    const bytes = new TextEncoder().encode(normalized);
    const encoded = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return encoded + "@username.pepen.invalid";
}

async function register() {
    if (closedTestMode) { document.getElementById('auth-msg').textContent = 'Закрытый тест: аккаунт выдаёт организатор. Используй кнопку входа.'; return; }
    const u = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password');
    let p = passwordInput.value;
    const msg = document.getElementById('auth-msg');
    msg.style.color = '';
    if (!u || !p) { msg.textContent = "Заполни ник и пароль."; return; }
    if (!/^[a-zA-Zа-яА-Я0-9_]{3,20}$/.test(u)) { msg.textContent = "Ник: 3-20 символов, буквы/цифры/_"; return; }
    if (p.length < 10) { msg.textContent = "Пароль должен содержать минимум 10 символов."; return; }

    // Убираем пароль из поля формы до сетевых запросов; сам пароль отправляется только в Supabase Auth.
    passwordInput.value = '';
    const { data: existing } = await supabaseClient
        .from('player_public_profiles').select('username').ilike('username', u).limit(1);
    if (existing?.length) { p = ''; msg.textContent = "Этот ник уже занят."; return; }

    let authResult;
    try {
        authResult = await supabaseClient.auth.signUp({
            email: usernameAuthEmail(u),
            password: p,
            options: { data: { username: u } }
        });
    } catch (e) {
        p = '';
        msg.textContent = "Ошибка регистрации: " + (e?.message || e);
        return;
    }
    p = '';
    const { data, error } = authResult;
    if (error) { msg.textContent = "Ошибка регистрации: " + error.message; return; }
    if (!data.session || !data.user) {
        msg.textContent = "Регистрация не завершилась автоматически. Проверь настройки Supabase Auth.";
        return;
    }
    try {
        await finishAuthLogin(data.user);
        msg.textContent = "";
    } catch (e) { msg.textContent = "Аккаунт создан, но профиль не загрузился: " + e.message; }
}
async function login() {
    const u = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password');
    let p = passwordInput.value;
    const msg = document.getElementById('auth-msg');
    msg.style.color = '';
    if (!u || !p) { msg.textContent = "Введи ник и пароль."; return; }

    // Не оставляем пароль в DOM во время запроса авторизации.
    passwordInput.value = '';
    let authResult;
    try {
        authResult = await supabaseClient.auth.signInWithPassword({
            email: usernameAuthEmail(u),
            password: p
        });
    } catch (e) {
        p = '';
        msg.textContent = "Не удалось войти: проверь ник и пароль.";
        return;
    }
    p = '';
    const { data, error } = authResult;
    if (error || !data?.user) {
        msg.textContent = "Не удалось войти: проверь ник и пароль.";
        return;
    }
    try {
        await finishAuthLogin(data.user);
        msg.textContent = "";
    } catch (e) {
        msg.textContent = "Ошибка загрузки профиля: " + e.message;
        await supabaseClient.auth.signOut();
    }
}

const itemDatabase = {
    "хуйня": { desc: "На самом деле это не хуйня это аппарат жизнеобеспечения. Восстанавливает 15% от максимального здоровья.", chance: "30-40%" },
    "картофель": { desc: "когда то давно влад пошел мыть картошку но так как леха занял все ведра головами рыб ,окурками, говном, щинячьими цоботами, цокольной хуйней, пастой, дрыном, рырями и прочим хламом ему пришлось мыть ее в ванне , но случилось так что он о ней забыл она проросла и синтезировала в себе ебанутый допинг который придает сил. Сожрал — и следующий обычный удар нанесёт на 15% больше урона. Бафф действует ровно на один удар!", chance: "25%" },
    "голова барана": { desc: "эту голову удалось спиздить у дяди альшада если ее ебануть в кого нибудь то будет больно. Наносит 20% от максимального здоровья цели.", chance: "15%" },
    "коала": { desc: "домашнее животное которое привез дядя кумиби из африки. восстановит ману на 100%.", chance: "10%" },
    "apostol": { desc: "apostol!!! Apoostool!! Apoooostooooooolll!!!", chance: "3%" },
    "парашник": { desc: "ставишь его он пускает пары и отравляет противника, также забирает его ману. каждый ход снимает 5% максимального HP и 15% максимальной маны. имеет 30 хп и действует, пока его не уничтожат.", chance: "20%" },
    "boris": { desc: "слышьте кто у меня эту хуйню на подоконнике оставил? ставишь его и он поглощает в себя весь урон от врага. но он не вечный. прочность — 40% максимального HP владельца.", chance: "3%" },
    "шприц и лекарство": { desc: "влад нашел эту хуйню за больницей в заводоуковске. думаю оно должно лечить. Восстанавливает 45% от максимального здоровья.", chance: "12%" },
    "Сбриватель хуйни": { desc: "гозонокосилка уберет хуйню которая положительно влияет на ход игры противника. сбреет отравляющие вас парашники уберет boris с оппонента.", chance: "7%" },
    "Вам не повезло": { desc: "вам крупно повезло вам нихуя не выпало! НИХУЯШЕНЬКИ.", chance: "6-28%" }
};

let currentUser = null;
let currentAuthUserId = null;
let currentHighScore = 0;
let currentCoins = 0;
let currentItemPoints = 0;
let currentPvpPts = 0;
let currentInventory = []; 
let currentUpgrades = {"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}};
let currentMaxFloors = {"ashab":0,"apostol":0,"mee":0};
const rarityWeight = { 'Легендарное': 5, 'Сверхредкое': 4, 'Эпическое': 3, 'Редкое': 2, 'Обычное': 1, 'Мусор': 0 };


// === RPG: постоянная экипировка ===
const RPG_GEAR = [
 {id:'wood_blade',name:'дрын',slot:'weapon',slotLabel:'Оружие',price:100,atkPercent:6,hp:0,crit:0,defense:0,desc:'+6% к атаке. Дешёвая, но доска — тоже аргумент.',emoji:'🪵'},
 {id:'iron_edge',name:'ну нихуевенький такой ножик',slot:'weapon',slotLabel:'Оружие',price:450,atkPercent:10,hp:0,crit:0,defense:0,desc:'+10% к атаке.',emoji:'🗡️'},
 {id:'berserker_axe',name:'кувалда пидора',slot:'weapon',slotLabel:'Оружие',price:1200,atkPercent:13,hp:0,crit:3,defense:0,desc:'+13% к атаке и +3% критического удара.',emoji:'🪓'},
 {id:'void_blade',name:'хуйня ( мощная)',slot:'weapon',slotLabel:'Оружие',price:3500,atkPercent:15,hp:0,crit:9,defense:0,desc:'+15% к атаке и +9% критического удара.',emoji:'🌌'},
 {id:'patched_vest',name:'накидка пидора',slot:'armor',slotLabel:'Броня',price:120,atkPercent:0,hp:25,crit:0,defense:3,desc:'+25 к максимальному HP, снижает входящий урон на 3%.',emoji:'🦺'},
 {id:'iron_plate',name:'костюм для игры в бодминтон',slot:'armor',slotLabel:'Броня',price:500,atkPercent:0,hp:65,crit:0,defense:8,desc:'+65 HP и -8% входящего урона.',emoji:'🛡️'},
 {id:'guardian_shell',name:'наряд хуйни',slot:'armor',slotLabel:'Броня',price:1500,atkPercent:0,hp:130,crit:0,defense:12,desc:'+130 HP и -12% входящего урона.',emoji:'🏰'},
 {id:'abyss_armor',name:'фембойский костюмчик',slot:'armor',slotLabel:'Броня',price:3500,atkPercent:0,hp:220,crit:0,defense:18,desc:'+220 HP и -18% входящего урона.',emoji:'🕳️'},
 {id:'lucky_charm',name:'мочевой пузырь дельфина',slot:'charm',slotLabel:'Амулет',price:300,atkPercent:0,atk:0,hp:0,crit:3,defense:0,desc:'+3% шанс критического удара.',emoji:'🧿'},
 {id:'wolf_fang',name:'окоченелости амжана жолтого',slot:'charm',slotLabel:'Амулет',price:950,atkPercent:0,atk:5,hp:15,crit:5,defense:0,desc:'+5 атаки, +15 HP и +5% критического удара.',emoji:'🐺'},
 {id:'phoenix_heart',name:'щенячий цобот',slot:'charm',slotLabel:'Амулет',price:2200,atkPercent:0,atk:0,hp:50,crit:0,defense:0,desc:'+50 HP. После победы восстанавливает 20% HP перед следующим этажом.',emoji:'🐾'},
 {id:'king_relic',name:'мясо пидора с изюмом',slot:'charm',slotLabel:'Амулет',price:5000,atkPercent:0,atk:12,hp:80,crit:8,defense:5,desc:'+12 атаки, +80 HP, +8% крит и -5% урона.',emoji:'👑'}
];
let rpgGearFilter = 'all';

const RPG_DAILY_QUESTS = [
    { id: 'wins3', title: 'istrebitel', desc: 'Победи 3 врагов в офлайн-RPG.', target: 3, reward: 75, metric: 'wins' },
    { id: 'boss1', title: 'опасный чювак', desc: 'Одолей босса на пятом подэтаже.', target: 1, reward: 150, metric: 'bosses' },
    { id: 'spend500', title: 'лионель месси', desc: 'Потрать 500 монет на прокачку или экипировку.', target: 500, reward: 50, metric: 'spent' }
];
const RPG_ACHIEVEMENTS = [
    { id: 'first_win', title: 'Начало start', desc: 'Победи первого врага.', target: 1, reward: 50, metric: 'totalWins' },
    { id: 'ten_wins', title: 'gustav', desc: 'Победи 10 врагов суммарно.', target: 10, reward: 200, metric: 'totalWins' },
    { id: 'fifty_wins', title: 'VLADIMIR', desc: 'Победи 50 врагов суммарно.', target: 50, reward: 600, metric: 'totalWins' },
    { id: 'first_boss', title: 'серьезный поцан', desc: 'Победи первого босса.', target: 1, reward: 150, metric: 'totalBosses' },
    { id: 'ten_bosses', title: 'да мне похуй', desc: 'Победи 10 боссов суммарно.', target: 10, reward: 750, metric: 'totalBosses' }
];
let rpgContractBusy = false;
function getLocalRpgProgress() {
    const state = currentUpgrades && currentUpgrades.rpgDaily;
    return state && typeof state === 'object' ? state : { date: '', wins: 0, bosses: 0, spent: 0, claimed: [], totalWins: 0, totalBosses: 0, achievementsClaimed: [] };
}
async function loadRpgContracts() {
    const account = currentAuthUserId;
    const dailyEl = document.getElementById('rpg-daily-contracts');
    const achEl = document.getElementById('rpg-achievements');
    if (!dailyEl || !achEl || !currentUser) return;
    if (typeof closedTestMode !== 'undefined' && closedTestMode) { dailyEl.textContent = 'Закрытый тест: задания и начисления отключены. Бои доступны без наград.'; achEl.textContent = ''; return; }
    dailyEl.innerHTML = '<p>Обновляем контракты...</p>';
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'daily_status', username: currentUser, data: {} } });
        if (account !== currentAuthUserId) return;
        if (error) throw error;
        if (!data || !data.success) throw new Error(data?.error || 'Не удалось загрузить доску. Проверь соединение и открой вкладку снова.');
        currentUpgrades = data.newUpgrades || currentUpgrades;
        currentCoins = Number(data.newCoins ?? currentCoins);
        updateUI();
        renderRpgContracts(data.progress || getLocalRpgProgress());
    } catch (e) {
        if (account !== currentAuthUserId) return;
        dailyEl.innerHTML = '<p>Не удалось загрузить доску. Проверь соединение и открой вкладку снова.</p>';
        achEl.innerHTML = '';
    }
}
function renderRpgContracts(progress) {
    const dailyEl = document.getElementById('rpg-daily-contracts');
    const achEl = document.getElementById('rpg-achievements');
    if (!dailyEl || !achEl) return;
    const claimed = Array.isArray(progress.claimed) ? progress.claimed : [];
    dailyEl.innerHTML = RPG_DAILY_QUESTS.map(q => {
        const value = Math.min(q.target, Math.max(0, Number(progress[q.metric]) || 0));
        const done = value >= q.target; const got = claimed.includes(q.id);
        const action = got ? '<button disabled>✓ Получено</button>' : done ? `<button class="claim-ready" onclick="claimRpgReward('daily','${q.id}')">Забрать</button>` : '<button disabled>В процессе</button>';
        return `<article class="rpg-contract-card ${done ? 'is-complete' : ''} ${got ? 'is-claimed' : ''}"><div class="rpg-contract-title">${q.title}</div><div class="rpg-contract-desc">${q.desc}</div><div class="rpg-contract-progress"><span style="width:${Math.round(value/q.target*100)}%"></span></div><div class="rpg-contract-foot"><span>${value}/${q.target} · +${q.reward} 🪙</span>${action}</div></article>`;
    }).join('');
    const achClaimed = Array.isArray(progress.achievementsClaimed) ? progress.achievementsClaimed : [];
    achEl.innerHTML = RPG_ACHIEVEMENTS.map(a => {
        const value = Math.min(a.target, Math.max(0, Number(progress[a.metric]) || 0));
        const done = value >= a.target; const got = achClaimed.includes(a.id);
        const action = got ? '<button disabled>✓ Получено</button>' : done ? `<button class="claim-ready" onclick="claimRpgReward('achievement','${a.id}')">Забрать</button>` : '<button disabled>Закрыто</button>';
        return `<article class="rpg-contract-card ${done ? 'is-complete' : ''} ${got ? 'is-claimed' : ''}"><div class="rpg-contract-title">🏆 ${a.title}</div><div class="rpg-contract-desc">${a.desc}</div><div class="rpg-contract-progress"><span style="width:${Math.round(value/a.target*100)}%"></span></div><div class="rpg-contract-foot"><span>${value}/${a.target} · +${a.reward} 🪙</span>${action}</div></article>`;
    }).join('');
}
async function claimRpgReward(kind, id) {
    const account = currentAuthUserId;
    if (rpgContractBusy) return; rpgContractBusy = true;
    const status = document.getElementById('rpg-contract-status'); if (status) status.textContent = 'Проверяем награду...';
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'claim_rpg_reward', username: currentUser, data: { kind, id } } });
        if (account !== currentAuthUserId) return;
        if (error) throw error;
        if (!data || !data.success) throw new Error(data?.error || 'Награда недоступна');
        currentCoins = Number(data.newCoins ?? currentCoins); currentUpgrades = data.newUpgrades || currentUpgrades; updateUI(); renderRpgContracts(data.progress || getLocalRpgProgress());
        if (status) status.textContent = `Забрано +${data.earned} монет.`;
    } catch (e) { if (account !== currentAuthUserId) return; if (status) status.textContent = e.message || 'Не удалось забрать награду.'; }
    finally { rpgContractBusy = false; }
}

function ensureRpgGear() {
    if (!currentUpgrades || typeof currentUpgrades !== 'object') currentUpgrades = {};
    if (!currentUpgrades.rpgGear || typeof currentUpgrades.rpgGear !== 'object') {
        currentUpgrades.rpgGear = { owned: [], equipped: { ashab: { weapon: null, armor: null, charm: null }, apostol: { weapon: null, armor: null, charm: null }, mee: { weapon: null, armor: null, charm: null } } };
    }
    if (!Array.isArray(currentUpgrades.rpgGear.owned)) currentUpgrades.rpgGear.owned = [];
    if (!currentUpgrades.rpgGear.equipped || typeof currentUpgrades.rpgGear.equipped !== 'object') currentUpgrades.rpgGear.equipped = {};
    ['ashab', 'apostol', 'mee'].forEach(char => {
        if (!currentUpgrades.rpgGear.equipped[char]) currentUpgrades.rpgGear.equipped[char] = { weapon: null, armor: null, charm: null };
        ['weapon', 'armor', 'charm'].forEach(slot => {
            if (!(slot in currentUpgrades.rpgGear.equipped[char])) currentUpgrades.rpgGear.equipped[char][slot] = null;
        });
    });
    return currentUpgrades.rpgGear;
}

function getGearBonuses(charType) {
    const gear = ensureRpgGear();
    const equipped = gear.equipped[charType] || {};
    const total = { hp: 0, atk: 0, atkPercent: 0, crit: 0, defense: 0 };
    Object.values(equipped).forEach(id => {
        const item = RPG_GEAR.find(g => g.id === id);
        if (!item) return;
        total.hp += item.hp || 0;
        total.atk += item.atk || 0;
        total.atkPercent += item.atkPercent || 0;
        total.crit += item.crit || 0;
        total.defense += item.defense || 0;
    });
    total.crit = Math.min(50, total.crit);
    total.defense = Math.min(35, total.defense);
    total.atkPercent = Math.min(50, total.atkPercent);
    return total;
}

function openGearCabinet() {
    ensureRpgGear();
    const modal = document.getElementById('rpg-gear-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderGearCabinet();
}
function closeGearCabinet() {
    const modal = document.getElementById('rpg-gear-modal');
    if (modal) modal.classList.add('hidden');
}
function setGearFilter(filter) {
    rpgGearFilter = ['all', 'weapon', 'armor', 'charm'].includes(filter) ? filter : 'all';
    document.querySelectorAll('[data-gear-filter]').forEach(btn => btn.classList.toggle('active', btn.dataset.gearFilter === rpgGearFilter));
    renderGearCabinet();
}

function renderGearCabinet() {
    const list = document.getElementById('rpg-gear-list');
    const equippedEl = document.getElementById('rpg-gear-equipped');
    const charSelect = document.getElementById('rpg-gear-char');
    if (!list || !equippedEl || !charSelect) return;
    const gear = ensureRpgGear();
    const charType = charSelect.value || 'ashab';
    const equipped = gear.equipped[charType];
    const slotNames = { weapon: '⚔️ Оружие', armor: '🛡️ Броня', charm: '🧿 Амулет' };
    document.getElementById('rpg-gear-coins').textContent = Number(currentCoins || 0).toLocaleString('ru-RU');
    equippedEl.innerHTML = ['weapon', 'armor', 'charm'].map(slot => {
        const item = RPG_GEAR.find(g => g.id === equipped[slot]);
        return `<div class="rpg-equipped-slot"><strong>${slotNames[slot]}</strong>${item ? `${item.emoji} ${item.name}<br><button type="button" onclick="equipGear('${item.id}', true)">Снять</button>` : 'Пусто'}</div>`;
    }).join('');
    const shown = RPG_GEAR.filter(item => rpgGearFilter === 'all' || item.slot === rpgGearFilter);
    list.innerHTML = shown.map(item => {
        const owned = gear.owned.includes(item.id);
        const isEquipped = equipped[item.slot] === item.id;
        const stats = [
            item.atkPercent ? `АТК +${item.atkPercent}%` : '',
            item.atk ? `АТК +${item.atk}` : '',
            item.hp ? `HP +${item.hp}` : '',
            item.crit ? `Крит +${item.crit}%` : '',
            item.defense ? `Снижение урона −${item.defense}%` : ''
        ].filter(Boolean).join(' · ');
        let action = '';
        if (isEquipped) action = `<button type="button" class="gear-equipped-btn" disabled>✓ Надето</button>`;
        else if (owned) action = `<button type="button" class="gear-equip" onclick="equipGear('${item.id}')">Надеть на ${charSelect.options[charSelect.selectedIndex].text.split(' — ')[0]}</button>`;
        else action = `<button type="button" class="gear-buy" onclick="buyGear('${item.id}')">Купить · ${item.price.toLocaleString('ru-RU')} монет</button>`;
        return `<article class="rpg-gear-card ${owned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}">
            <div class="rpg-gear-card-head"><span class="rpg-gear-emoji">${item.emoji}</span><div><div class="rpg-gear-name">${item.name}</div><div class="rpg-gear-type">${item.slotLabel}</div></div></div>
            <div class="rpg-gear-desc">${item.desc}</div><div class="rpg-gear-stats">${stats}</div>${action}
        </article>`;
    }).join('');
    document.querySelectorAll('[data-gear-filter]').forEach(btn => btn.classList.toggle('active', btn.dataset.gearFilter === rpgGearFilter));
}

async function buyGear(itemId) {
    const account = currentAuthUserId;
    const item = RPG_GEAR.find(g => g.id === itemId);
    if (!item) return;
    const gear = ensureRpgGear();
    if (gear.owned.includes(itemId)) { showGearMessage('Этот предмет уже есть в коллекции.'); return; }
    if (currentCoins < item.price) { showGearMessage(`Не хватает ${item.price - currentCoins} монет.`); return; }
    const button = document.querySelector(`button[onclick="buyGear('${itemId}')"]`);
    if (button) button.disabled = true;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'buy_gear', username: currentUser, data: { itemId } }
        });
        if (account !== currentAuthUserId) return;
        if (error) throw error;
        if (!data || !data.success) { showGearMessage(data?.error || 'Покупка не удалась.'); return; }
        currentCoins = data.newCoins;
        currentUpgrades = data.newUpgrades;
        ensureRpgGear();
        updateUI();
        renderGearCabinet();
        showGearMessage(`Приобретено: ${item.name}! Теперь надень его на бойца.`);
    } catch (e) { if (account !== currentAuthUserId) return;
        showGearMessage('Ошибка покупки: ' + (e.message || e));
    } finally {
        if (button) button.disabled = false;
    }
}

async function equipGear(itemId, unequip = false) {
    const account = currentAuthUserId;
    const item = RPG_GEAR.find(g => g.id === itemId);
    const charSelect = document.getElementById('rpg-gear-char');
    const charType = charSelect ? charSelect.value : 'ashab';
    const gear = ensureRpgGear();
    if (!unequip && (!item || !gear.owned.includes(itemId))) { showGearMessage('Сначала получи предмет.'); return; }
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'equip_gear', username: currentUser, data: { itemId, charType, unequip: !!unequip } }
        });
        if (account !== currentAuthUserId) return;
        if (error) throw error;
        if (!data || !data.success) { showGearMessage(data?.error || 'Не удалось изменить экипировку.'); return; }
        currentUpgrades = data.newUpgrades;
        ensureRpgGear();
        renderGearCabinet();
        renderCharStats();
        showGearMessage(unequip ? 'Предмет снят.' : `${item.name} надет на выбранного бойца.`);
    } catch (e) { if (account !== currentAuthUserId) return;
        showGearMessage('Ошибка экипировки: ' + (e.message || e));
    }
}

function showGearMessage(message) {
    const el = document.getElementById('rpg-gear-message');
    if (el) el.textContent = message;
}


function percentOf(maxValue, percent) { return Math.max(1, Math.round((Number(maxValue) || 0) * percent / 100)); }

let onlineChannel = null;
let rpgInvitationChannel = null;
let rpgInvitationChannelStatus = 'CLOSED';
let rpgInvitationInitPromise = null;
let rpgInvitationRemovalPromise = Promise.resolve();
let lobbyChannel = null;
let roomChannel = null;
let myRoomId = null;
let pvpRooms = {};
let onlinePlayers = [];
let pvpBattleStarted = false;
let pvpBattleFinished = false;

let pendingChallengeTarget = null;
let pendingChallengeRoomId = null;
let pendingChallengeExpiryTimer = null;
let pendingChallengeHost = null;
let processingIncomingChallengeRoomId = null;
let pendingOutgoingChallenge = null;
let outgoingChallengeRegistrationInProgress = false;
const RPG_INVITATION_TIMEOUT_MS = 30000;

function normalizeRpgUsername(value) { return String(value || '').trim().toLocaleLowerCase(); }

function waitForRpgRealtimeSubscription(channel, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => finish(new Error('Realtime subscription timed out')), timeoutMs);
        function finish(error) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            error ? reject(error) : resolve();
        }
        channel.subscribe(status => {
            if (status === 'SUBSCRIBED') finish();
            else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) finish(new Error(`Realtime channel ${status.toLowerCase()}`));
        });
    });
}

async function sendRpgInvitationResponse(roomId, status) {
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'respond_rpg_invitation', data: { roomId, status } }
        });
        return !error && data?.success === true;
    } catch (_) { return false; }
}

function initRpgInvitationInbox(userId) {
    if (rpgInvitationInitPromise) return rpgInvitationInitPromise;
    let attempt;
    attempt = initializeRpgInvitationInbox(userId).catch(error => {
        rpgInvitationChannelStatus = 'CHANNEL_ERROR';
        console.error('[RPG inbox] Initialization failed.', {
            status: rpgInvitationChannelStatus,
            message: getSafeRealtimeErrorMessage(error)
        });
        return false;
    }).finally(() => {
        if (rpgInvitationInitPromise === attempt) rpgInvitationInitPromise = null;
    });
    rpgInvitationInitPromise = attempt;
    return attempt;
}

function getSafeRealtimeErrorMessage(error) {
    return String(error?.message || error || 'Unknown Realtime error')
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted JWT]')
        .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b/gi, '[redacted Supabase key]')
        .slice(0, 300);
}

async function initializeRpgInvitationInbox(userId) {
    if (!userId) return false;
    if (rpgInvitationChannel) {
        const previousChannel = rpgInvitationChannel;
        rpgInvitationChannel = null;
        rpgInvitationRemovalPromise = supabaseClient.removeChannel(previousChannel).catch(() => {});
    }
    await rpgInvitationRemovalPromise;
    rpgInvitationChannelStatus = 'CONNECTING';
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        const session = data?.session;
        if (error || !session?.access_token || session.user?.id !== userId) {
            rpgInvitationChannelStatus = 'AUTH_ERROR';
            console.error('[RPG inbox] Auth session unavailable for Realtime subscription.', {
                message: getSafeRealtimeErrorMessage(error || 'No matching authenticated session.')
            });
            return false;
        }
        await supabaseClient.realtime.setAuth(session.access_token);
        console.info('[RPG inbox] Realtime JWT synchronized for authenticated user.');
    } catch (error) {
        rpgInvitationChannelStatus = 'AUTH_ERROR';
        console.error('[RPG inbox] Could not set the Realtime user JWT.', {
            message: getSafeRealtimeErrorMessage(error)
        });
        return false;
    }
    await rpgInvitationRemovalPromise;
    const channel = supabaseClient.channel(`rpg-invitations:${userId}`, {
        config: { private: true, broadcast: { self: false } }
    });
    rpgInvitationChannel = channel;
    listenForChallenges(channel);
    return new Promise(resolve => {
        let readinessSettled = false;
        let channelEnded = false;
        let subscriptionTimer;
        const finish = result => {
            if (readinessSettled) return;
            readinessSettled = true;
            clearTimeout(subscriptionTimer);
            resolve(result);
        };
        const failChannel = status => {
            if (channelEnded || rpgInvitationChannel !== channel) return;
            channelEnded = true;
            rpgInvitationChannelStatus = status;
            console.error('[RPG inbox] Realtime subscription failed.', { status });
            rpgInvitationChannel = null;
            finish(false);
            rpgInvitationRemovalPromise = supabaseClient.removeChannel(channel).catch(() => {});
            if (pendingOutgoingChallenge) {
                void clearOutgoingRpgChallenge('Канал приглашений недоступен. Повторите вызов позже.');
            }
        };
        subscriptionTimer = setTimeout(() => {
            if (rpgInvitationChannel !== channel) return finish(false);
            failChannel('TIMED_OUT');
        }, 10000);
        channel.subscribe((status, error) => {
            if (rpgInvitationChannel !== channel || channelEnded) return;
            rpgInvitationChannelStatus = status;
            if (status === 'SUBSCRIBED') {
                console.info('[RPG inbox] Realtime subscription established.', { status });
                finish(true);
                return;
            }
            const details = error ? {
                message: getSafeRealtimeErrorMessage(error),
                code: getSafeRealtimeErrorMessage(error.code),
                details: getSafeRealtimeErrorMessage(error.details)
            } : null;
            console.warn('[RPG inbox] Realtime subscription status.', { status, error: details });
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                failChannel(status);
            }
        });
    });
}

async function clearOutgoingRpgChallenge(message) {
    const pending = pendingOutgoingChallenge;
    if (!pending) return;
    const ownsServerMatch = myRoomId === pending.roomId && pvpMatchId;
    if (ownsServerMatch) {
        try {
            await invokeRpgPvp('cancel_match', { room_topic: pending.roomId });
        } catch (_) {
            let match;
            try {
                match = await invokeRpgPvp('get_match', { room_topic: pending.roomId });
            } catch (_) {
                match = null;
            }
            if (match?.status === 'active' || match?.status === 'completed') {
                applyAuthoritativePvpMatch(match);
                return;
            }
            if (!match || !['cancelled', 'expired'].includes(match.status)) {
                if (pending.timer) clearTimeout(pending.timer);
                pending.timer = setTimeout(() => clearOutgoingRpgChallenge(message), 5000);
                const log = document.getElementById('pvp-log');
                if (log) log.textContent = 'Не удалось подтвердить отмену матча. Проверяем состояние и сохраняем комнату.';
                return;
            }
        }
    }
    clearTimeout(pending.timer);
    pendingOutgoingChallenge = null;
    outgoingChallengeRegistrationInProgress = false;
    void supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
        body: { action: 'close_rpg_invitation', data: { roomId: pending.roomId } }
    }).catch(() => {});
    if (roomChannel) {
        const oldChannel = roomChannel;
        roomChannel = null;
        try { await supabaseClient.removeChannel(oldChannel); } catch (_) {}
    }
    if (pvpSyncTimer) clearInterval(pvpSyncTimer);
    pvpSyncTimer = null;
    if (lobbyChannel) { try { await lobbyChannel.track({ online: true }); } catch (_) {} }
    myRoomId = null;
    pvpMatchId = null;
    pvpMatchVersion = null;
    isPvpHost = false;
    currentPvpChar = null;
    pvpBattleStarted = false;
    pvpBattleFinished = false;
    pvpPendingAction = null;
    pvpOpponentName = null;
    document.getElementById('pvp-battle-screen')?.classList.add('hidden');
    document.getElementById('rpg-char-select')?.classList.remove('hidden');
    const log = document.getElementById('pvp-log');
    if (log) log.textContent = message;
}

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
    onlineChannel = supabaseClient.channel('online-users', { config: { presence: { key: currentUser }, private: true } });
    onlineChannel.on('presence', { event: 'sync' }, () => {
        const state = onlineChannel.presenceState();
        onlinePlayers = Object.keys(state);
        document.getElementById('ui-online').innerText = onlinePlayers.length;
        if(!document.getElementById('pvp-lobby-modal').classList.contains('hidden')){ renderPvpRooms(); }
    }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await onlineChannel.track({ online_at: new Date().toISOString() });
        }
    });
}

function initLobby() {
    if(lobbyChannel) supabaseClient.removeChannel(lobbyChannel);
    lobbyChannel = supabaseClient.channel('pvp_lobby', { config: { presence: { key: currentUser }, private: true } });
    lobbyChannel.on('presence', { event: 'sync' }, () => {
        const state = lobbyChannel.presenceState();
        pvpRooms = Object.create(null);
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
    nickSpan.textContent = '[ЧАТ] ' + String(nick || 'Игрок').slice(0, 24) + ':';
    msg.appendChild(nickSpan);
    msg.appendChild(document.createTextNode(' ' + String(text || '').slice(0, 240)));
    logBox.appendChild(msg);
    while (logBox.children.length > 250) logBox.firstElementChild.remove();
    logBox.scrollTop = logBox.scrollHeight;
}

let pvpChatSending = false;
async function sendPvpMessage() {
    const input = document.getElementById('pvp-chat-input');
    if (!input || !roomChannel || !myRoomId || pvpChatSending) return;
    const messageText = input.value.trim();
    if (!messageText) return;
    if (messageText.length > 240) {
        alert('Сообщение не должно превышать 240 символов.');
        return;
    }

    pvpChatSending = true;
    const sendButton = document.getElementById('pvp-chat-send');
    if (sendButton) sendButton.disabled = true;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'send_chat_message', data: { topic: myRoomId, text: messageText } }
        });
        if (error || !data?.success) {
            alert(data?.error || error?.message || 'Не удалось отправить сообщение.');
            return;
        }
        addPvpChatMessage(currentUser, messageText);
        input.value = '';
    } catch (e) {
        console.error('Ошибка отправки сообщения:', e);
        alert('Не удалось отправить сообщение. Попробуй ещё раз.');
    } finally {
        pvpChatSending = false;
        if (sendButton) sendButton.disabled = false;
    }
}

function getImgTag(imgName) {
    const safeName = String(imgName || '');
    if (!/^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif)$/i.test(safeName)) {
        return '<span style="font-size: 20px;">📎</span>';
    }
    return `<img src="${safeName}" class="inv-card-img" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('📎'))">`;
}

function getProcessedInventory() {
    const grouped = Object.create(null);
    (Array.isArray(currentInventory) ? currentInventory : []).forEach(item => {
        if (!grouped[item.name]) grouped[item.name] = { ...item, qty: 0 };
        grouped[item.name].qty++;
    });
    return Object.values(grouped).sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));
}

let siteGlobalChatChannel = null;
let siteGlobalChatSending = false;
function initSiteGlobalChat() {
    if (siteGlobalChatChannel || !supabaseClient || !currentUser) return;
    const messages = document.getElementById('site-global-chat-messages');
    const input = document.getElementById('site-global-chat-input');
    const send = document.getElementById('site-global-chat-send');
    if (!messages || !input || !send) return;

    messages.replaceChildren();
    const add = (nick, text) => {
        const row = document.createElement('div');
        row.className = 'site-global-chat-message';
        const strong = document.createElement('b');
        strong.textContent = String(nick || 'Игрок').slice(0, 24) + ': ';
        const body = document.createElement('span');
        body.textContent = String(text || '').slice(0, 240);
        row.append(strong, body);
        messages.appendChild(row);
        while (messages.children.length > 80) messages.firstElementChild.remove();
        messages.scrollTop = messages.scrollHeight;
    };

    siteGlobalChatChannel = supabaseClient.channel('pepen40-global-chat', {
        config: { broadcast: { self: false }, private: true }
    });
    siteGlobalChatChannel.on('broadcast', { event: 'site_message' }, ({ payload }) => {
        if (!payload || typeof payload.text !== 'string') return;
        add(payload.nick, payload.text);
    });
    siteGlobalChatChannel.subscribe();

    const submit = async () => {
        const value = input.value.trim();
        if (!value || siteGlobalChatSending) return;
        if (value.length > 240) {
            alert('Сообщение не должно превышать 240 символов.');
            return;
        }

        siteGlobalChatSending = true;
        send.disabled = true;
        try {
            const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
                body: { action: 'send_chat_message', data: { topic: 'pepen40-global-chat', text: value } }
            });
            if (error || !data?.success) {
                alert(data?.error || error?.message || 'Не удалось отправить сообщение.');
                return;
            }
            add(currentUser, value);
            input.value = '';
            input.focus();
        } catch (e) {
            console.error('Ошибка отправки сообщения в общий чат:', e);
            alert('Не удалось отправить сообщение. Попробуй ещё раз.');
        } finally {
            siteGlobalChatSending = false;
            send.disabled = false;
        }
    };

    send.addEventListener('click', submit);
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    });
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
        const card = document.querySelector(`#max-floor-${c}`)?.closest('.rpg-char-card');
        if (card) {
            let gearLine = card.querySelector('.rpg-gear-summary');
            if (!gearLine) {
                gearLine = document.createElement('div');
                gearLine.className = 'rpg-gear-summary';
                card.querySelector('.char-info')?.appendChild(gearLine);
            }
            const b = getGearBonuses(c);
            const count = Object.values(ensureRpgGear().equipped[c] || {}).filter(Boolean).length;
            gearLine.textContent = count ? `Экипировка: ${count}/3 · +${b.atk} АТК · +${b.hp} HP · ${b.defense}% защиты · ${b.crit}% крит` : 'Экипировка: пусто';
        }
    });
}

function switchTab(tab) {
    if (typeof closedTestMode !== 'undefined' && closedTestMode && ['market', 'cases'].includes(tab)) {
        alert('Закрытый тест: экономика, кейсы и торговля отключены. Доступны игры, чат и тестовый инвентарь.');
        return;
    }
    if (tab !== 'game' && typeof cancelSimonGame === 'function') cancelSimonGame();
['minigames', 'game', 'chess', 'rpg', 'cases', 'inventory', 'market', 'leaderboard', 'howto', 'settings'].forEach(t => {
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
    if (tab === 'rpg') { renderCharStats(); loadRpgContracts(); }
}
function openMiniGame(game) {
    if (game === 'game') {
        switchTab('game');
    } else if (game === 'chess') {
        switchTab('chess');
    }
}
async function buyUpgrade(charType, statType) {
    const account = currentAuthUserId;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'buy_upgrade', username: currentUser, data: { charType, statType } }
        });
        if (account !== currentAuthUserId) return;
        if (error) { alert("Ошибка сети: " + error.message); return; }
        if (data.error) { alert(data.error); return; }
        currentCoins = data.newCoins; currentUpgrades = data.newUpgrades; updateUI();
    } catch(e) { if (account !== currentAuthUserId) return; alert("Фатальная ошибка: " + e.message); }
}

function openItemInfo(itemName) {
    const db = Object.prototype.hasOwnProperty.call(itemDatabase, itemName)
        ? itemDatabase[itemName]
        : { desc: "Описание отсутствует.", chance: "???" };
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
    const safeImage = /^[a-zA-Z0-9_-]+\\.(?:png|jpe?g|webp|gif)$/i.test(String(img || '')) ? img : '';
    const imageEl = document.getElementById('info-img');
    imageEl.src = safeImage || 'https://via.placeholder.com/100?text=ITEM';
    imageEl.onerror = function() { this.src = 'https://via.placeholder.com/100?text=NO+IMG'; };
    document.getElementById('info-name').textContent = String(itemName ?? '');
    const safeRarity = ['Обычное', 'Редкое', 'Сверхредкое', 'Эпическое', 'Легендарное', 'Мусор'].includes(rarity) ? rarity : 'Мусор';
    document.getElementById('info-rarity').textContent = safeRarity;
    document.getElementById('info-rarity').className = `rarity-${safeRarity}`;
    document.getElementById('info-desc').innerHTML = `<b>Шанс выпадения:</b> ${escapeHtml(db.chance)}<br><br>${escapeHtml(db.desc)}`;
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
            <button class="info-btn" style="width: 100px;" onclick="openItemInfo(${safeInlineArg(item.name)})">Подробнее</button>
        `;
        list.appendChild(div);
    });
    document.getElementById('case-contents-modal').classList.remove('hidden');
}

function closeCaseContents() { document.getElementById('case-contents-modal').classList.add('hidden'); }

let currentPvpChar = null;
let isPvpHost = false;
let pvpGameState = { myHp: 0, enemyHp: 0, myMaxHp: 0, enemyMaxHp: 0, myMp: 0, enemyMp: 0, isMyTurn: false, myBorisHp: 0, enemyBorisHp: 0, myParashnikHp: 0, enemyParashnikHp: 0, myDefending: false, enemyDefending: false, myItemUsed: false, myBonusAttacks: 0, myPotatoBuff: false };
let pvpMatchId = null;
let pvpMatchVersion = null;
let pvpSyncTimer = null;
let pvpSyncBusy = false;
let pvpActionBusy = false;
let pvpPendingAction = null;
let pvpOpponentName = null;

async function openPvpLobby() {
    if (rpgInvitationChannelStatus !== 'SUBSCRIBED') {
        let ready = false;
        try { ready = await initRpgInvitationInbox(currentAuthUserId); } catch (_) {}
        if (!ready || rpgInvitationChannelStatus !== 'SUBSCRIBED') {
            alert('Канал приглашений пока не подключён. Проверьте соединение и повторите попытку.');
            return;
        }
    }
    if (!lobbyChannel) initLobby();
    document.getElementById('pvp-lobby-modal').classList.remove('hidden');
    renderPvpRooms();
}

function closePvpLobby() { document.getElementById('pvp-lobby-modal').classList.add('hidden'); }

function renderPvpRooms() {
    const list = document.getElementById('pvp-online-list');
    if (!list) return;
    list.replaceChildren();
    const validUsername = /^[a-zA-Zа-яА-Я0-9_]{3,20}$/;
    const players = [...new Set((onlinePlayers || []).filter(name =>
        typeof name === 'string' && validUsername.test(name) && name !== currentUser
    ))];
    if (players.length === 0) {
        const empty = document.createElement('p');
        empty.style.textAlign = 'center';
        empty.textContent = 'Нет онлайн игроков.';
        list.appendChild(empty);
        return;
    }

    players.forEach(player => {
        const row = document.createElement('div');
        row.className = 'pvp-room-item';

        const info = document.createElement('div');
        const name = document.createElement('b');
        name.textContent = player;
        info.appendChild(name);

        if (pvpRooms[player]) {
            const waiting = document.createElement('span');
            waiting.style.color = 'green';
            waiting.style.fontSize = '12px';
            waiting.textContent = ' (Ждет боя)';
            info.appendChild(waiting);
        }

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '5px';

        const profileButton = document.createElement('button');
        profileButton.type = 'button';
        profileButton.textContent = 'Профиль';
        profileButton.style.margin = '0';
        profileButton.style.fontSize = '14px';
        profileButton.style.background = '#87CEEB';
        profileButton.addEventListener('click', () => viewProfile(player));

        const challengeButton = document.createElement('button');
        challengeButton.type = 'button';
        challengeButton.textContent = 'Вызвать на бой';
        challengeButton.style.margin = '0';
        challengeButton.style.fontSize = '14px';
        challengeButton.style.background = '#ffcccb';
        challengeButton.addEventListener('click', () => challengePlayer(player));

        actions.append(profileButton, challengeButton);
        row.append(info, actions);
        list.appendChild(row);
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
    if (pendingOutgoingChallenge || outgoingChallengeRegistrationInProgress) {
        console.error('[RPG invite] Challenge blocked because another invitation is active.', {
            status: rpgInvitationChannelStatus
        });
        closeChallengeModal();
        alert('У вас уже есть активное PvP-приглашение.');
        return;
    }
    if (rpgInvitationChannelStatus !== 'SUBSCRIBED') {
        const retryButton = document.querySelector('#pvp-challenge-modal button[onclick="executeChallenge()"]');
        if (retryButton) retryButton.disabled = true;
        let ready = false;
        try { ready = await initRpgInvitationInbox(currentAuthUserId); } catch (_) {}
        if (retryButton) retryButton.disabled = false;
        if (!ready || rpgInvitationChannelStatus !== 'SUBSCRIBED') {
            console.error('[RPG invite] Private inbox reconnect failed.', { status: rpgInvitationChannelStatus });
            alert('Канал приглашений пока не подключён. Проверьте соединение и повторите вызов.');
            return;
        }
        if (!lobbyChannel) initLobby();
    }
    if (!onlinePlayers.some(name => normalizeRpgUsername(name) === normalizeRpgUsername(targetUser))) {
        closeChallengeModal();
        alert('Игрок отключён или больше не найден.');
        return;
    }
    closeChallengeModal();
    outgoingChallengeRegistrationInProgress = true;

    const charType = document.getElementById('pvp-challenge-char-select').value;
    const baseHp = charType === 'ashab' ? 150 : (charType === 'apostol' ? 80 : 110);
    const baseAtk = charType === 'ashab' ? 20 : (charType === 'apostol' ? 30 : 18);
    const gearBonus = getGearBonuses(charType);
    const hp = baseHp + (currentUpgrades[charType].hp * 20) + gearBonus.hp;
    const atk = Math.round((baseAtk + (currentUpgrades[charType].atk * 5) + gearBonus.atk) * (1 + (gearBonus.atkPercent || 0) / 100));
    const charName = charType === 'ashab' ? 'Ашаб' : (charType === 'apostol' ? 'Апостол' : 'Мээ');
    const img = charType === 'ashab' ? 'IMG_3545.jpeg' : (charType === 'apostol' ? 'IMG_3544.jpeg' : 'IMG_3546.jpeg');

    myRoomId = 'room_' + crypto.randomUUID().replace(/-/g, '').slice(0, 9);
    const roomId = myRoomId;
    let registration;
    let registrationError;
    try {
        ({ data: registration, error: registrationError } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'register_rpg_invitation', data: { topic: roomId, inviteeUsername: targetUser } }
        }));
    } catch (_) {
        outgoingChallengeRegistrationInProgress = false;
        void supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'close_rpg_invitation', data: { roomId } }
        }).catch(() => {});
        myRoomId = null;
        alert('Ошибка сети при регистрации приглашения. Повторите вызов.');
        return;
    }
    if (registrationError || !registration?.success) {
        outgoingChallengeRegistrationInProgress = false;
        myRoomId = null;
        alert(registration?.error || registrationError?.message || 'Не удалось зарегистрировать приглашение.');
        return;
    }

    let match;
    try {
        match = await invokeRpgPvp('create_match', {
            match_id: newPvpActionId(), room_topic: roomId, char_type: charType
        });
    } catch (error) {
        outgoingChallengeRegistrationInProgress = false;
        myRoomId = null;
        void supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'close_rpg_invitation', data: { roomId } }
        }).catch(() => {});
        alert(error.message || 'Не удалось создать серверный PvP-матч.');
        return;
    }

    isPvpHost = true;
    currentPvpChar = charType;
    pvpMatchId = match.match_id;
    pvpMatchVersion = Number(match.version);
    pvpBattleStarted = false;
    pvpBattleFinished = false;
    pvpPendingAction = null;
    pvpOpponentName = targetUser;
    pendingOutgoingChallenge = { roomId, target: normalizeRpgUsername(targetUser), timer: null };
    outgoingChallengeRegistrationInProgress = false;
    if (lobbyChannel) {
        try { await lobbyChannel.track({ room: { roomId, roomName: 'Вызов от ' + currentUser, hostName: currentUser, hostPts: currentPvpPts, charName, hp, atk } }); }
        catch (_) { await clearOutgoingRpgChallenge('Не удалось обновить PvP-лобби. Вызов отменён.'); return; }
    }
    closePvpLobby();
    if (roomChannel) await supabaseClient.removeChannel(roomChannel);
    roomChannel = supabaseClient.channel(roomId, { config: { broadcast: { self: false }, private: true } });
    roomChannel.on('broadcast', { event: 'chat_message' }, payload => addPvpChatMessage(payload?.payload?.nick || '???', payload?.payload?.text || ''));

    try {
        await waitForRpgRealtimeSubscription(roomChannel);
    } catch (_) {
        await clearOutgoingRpgChallenge('Не удалось подключиться к комнате боя. Вызов отменён.');
        return;
    }

    initPvpChat(roomId);
    switchTab('rpg');
    stopOfflineBattleForPvp();
    document.getElementById('rpg-char-select').classList.add('hidden');
    document.getElementById('pvp-battle-screen').classList.remove('hidden');
    document.getElementById('pvp-player-img').src = img;
    document.getElementById('pvp-player-name').innerText = 'Ты (' + charName + ')';
    document.getElementById('pvp-log').textContent = 'Отправка приглашения…';
    document.getElementById('pvp-turn-indicator').innerText = 'ОЖИДАНИЕ';
    document.getElementById('pvp-turn-indicator').className = 'turn-indicator';
    disablePvpButtons();
    startPvpMatchSync();

    pendingOutgoingChallenge.timer = setTimeout(() => expireOutgoingRpgChallenge(roomId), RPG_INVITATION_TIMEOUT_MS);
    try {
        const { data: delivery, error: deliveryError } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'deliver_rpg_invitation', data: { roomId } }
        });
        if (deliveryError || !delivery?.success) await clearOutgoingRpgChallenge(delivery?.error || 'Не удалось отправить приглашение из-за ошибки сети.');
    } catch (_) {
        await clearOutgoingRpgChallenge('Не удалось отправить приглашение из-за ошибки сети.');
    }
}

async function expireOutgoingRpgChallenge(roomId) {
    const pending = pendingOutgoingChallenge;
    if (!pending || pending.roomId !== roomId) return;
    try {
        const match = await invokeRpgPvp('get_match', { room_topic: roomId });
        if (match.status === 'active' || match.status === 'completed') {
            applyAuthoritativePvpMatch(match);
            return;
        }
    } catch (_) {}
    await clearOutgoingRpgChallenge('Игрок не ответил или приглашение истекло. Можно повторить вызов.');
}

function listenForChallenges(channel = rpgInvitationChannel) {
    if (!channel) return;
    channel.on('broadcast', { event: 'challenge_cancelled' }, message => {
        const data = message?.payload;
        if (channel !== rpgInvitationChannel || data?.targetUserId !== currentAuthUserId || data?.roomId !== pendingChallengeRoomId) return;
        pendingChallengeRoomId = null; pendingChallengeHost = null;
        document.getElementById('pvp-receive-modal').classList.add('hidden');
    });
    channel.on('broadcast', { event: 'challenge' }, async message => {
        if (channel !== rpgInvitationChannel) return;
        const data = message?.payload;
        if (!data || data.targetUserId !== currentAuthUserId || typeof data.roomId !== 'string' || !/^room_[a-z0-9]{9}$/.test(data.roomId)) return;
        if (pendingChallengeRoomId === data.roomId || processingIncomingChallengeRoomId === data.roomId) return;
        if (pendingChallengeRoomId || processingIncomingChallengeRoomId || myRoomId || pendingOutgoingChallenge) {
            await sendRpgInvitationResponse(data.roomId, 'busy');
            return;
        }
        processingIncomingChallengeRoomId = data.roomId;
        let invitation;
        let error;
        try {
            ({ data: invitation, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
                body: { action: 'validate_room_invitation', data: { topic: data.roomId, kind: 'rpg' } }
            }));
        } catch (_) {
            processingIncomingChallengeRoomId = null;
            return;
        }
        if (channel !== rpgInvitationChannel || data.targetUserId !== currentAuthUserId) return;
        if (error || !invitation?.success || invitation.kind !== 'rpg') {
            processingIncomingChallengeRoomId = null;
            return;
        }
        if (localStorage.getItem('rpgInvitesEnabled') === 'false') {
            await sendRpgInvitationResponse(data.roomId, 'disabled');
            processingIncomingChallengeRoomId = null;
            return;
        }
        pendingChallengeRoomId = data.roomId;
        if (pendingChallengeExpiryTimer) clearTimeout(pendingChallengeExpiryTimer);
        pendingChallengeExpiryTimer = setTimeout(() => {
            if (channel !== rpgInvitationChannel || pendingChallengeRoomId !== data.roomId) return;
            pendingChallengeRoomId = null; pendingChallengeHost = null;
            document.getElementById('pvp-receive-modal').classList.add('hidden');
        }, Math.min(30000, Math.max(0, Number(data.remainingMs) || 30000)));
        processingIncomingChallengeRoomId = null;
        pendingChallengeHost = String(invitation.hostUsername || data.host || 'Игрок');
        document.getElementById('pvp-receive-host-name').textContent = 'Игрок: ' + pendingChallengeHost;
        const receiveStatus = document.getElementById('pvp-receive-status');
        if (receiveStatus) receiveStatus.textContent = 'Приглашение проверено. Отправляем подтверждение…';
        document.getElementById('pvp-receive-modal').classList.remove('hidden');
        const acknowledged = await sendRpgInvitationResponse(data.roomId, 'received');
        if (channel !== rpgInvitationChannel || data.targetUserId !== currentAuthUserId || pendingChallengeRoomId !== data.roomId) return;
        if (receiveStatus) receiveStatus.textContent = acknowledged
            ? 'Получение подтверждено. Выберите действие.'
            : 'Не удалось подтвердить получение. Проверьте соединение и повторите действие.';
    });

    channel.on('broadcast', { event: 'challenge_response' }, async message => {
        if (channel !== rpgInvitationChannel) return;
        const data = message?.payload;
        const pending = pendingOutgoingChallenge;
        if (!data || !pending || data.roomId !== pending.roomId || normalizeRpgUsername(data.from) !== pending.target || myRoomId !== pending.roomId || !isPvpHost) return;
        if (data.status === 'received') {
            const log = document.getElementById('pvp-log');
            if (log) log.textContent = 'Приглашение доставлено. Ожидаем ответа игрока…';
            return;
        }
        if (data.status === 'accepted') {
            clearTimeout(pending.timer);
            pendingOutgoingChallenge = null;
            return;
        }
        const statuses = {
            declined: 'Игрок отклонил приглашение.',
            disabled: 'Игрок запретил RPG-приглашения.',
            busy: 'Игрок сейчас занят другим матчем или приглашением.'
        };
        await clearOutgoingRpgChallenge(statuses[data.status] || 'Игрок не подтвердил приглашение.');
    });
}

async function closeReceiveModal() {
    if (pendingChallengeExpiryTimer) clearTimeout(pendingChallengeExpiryTimer);
    const roomId = pendingChallengeRoomId;
    document.getElementById('pvp-receive-modal').classList.add('hidden');
    const receiveStatus = document.getElementById('pvp-receive-status');
    if (receiveStatus) receiveStatus.textContent = '';
    pendingChallengeRoomId = null;
    pendingChallengeHost = null;
    if (roomId) await sendRpgInvitationResponse(roomId, 'declined');
}

async function executeAcceptChallenge() {
    if (!pendingChallengeRoomId) return;
    const roomId = pendingChallengeRoomId;
    const account = currentAuthUserId;
    const isCurrent = () => account === currentAuthUserId && pendingChallengeRoomId === roomId;
    pvpOpponentName = pendingChallengeHost;
    document.getElementById('pvp-receive-modal').classList.add('hidden');
    const receiveStatus = document.getElementById('pvp-receive-status');
    if (receiveStatus) receiveStatus.textContent = 'Подключаемся к комнате…';
    const charType = document.getElementById('pvp-receive-char-select').value;
    let joined = false;
    const accepted = await sendRpgInvitationResponse(roomId, 'accepted');
    if (!isCurrent()) return;
    if (!accepted) {
        document.getElementById('pvp-receive-modal').classList.remove('hidden');
        if (receiveStatus) receiveStatus.textContent = 'Сервер не подтвердил принятие приглашения.';
        return;
    }
    try { joined = await joinPvpRoom(roomId, charType); } catch (_) {}
    if (!isCurrent()) return;
    if (joined && myRoomId === roomId) {
        pendingChallengeRoomId = null;
        pendingChallengeHost = null;
        await sendRpgInvitationResponse(roomId, 'accepted');
    } else {
        const receiveStatus = document.getElementById('pvp-receive-status');
        if (receiveStatus) receiveStatus.textContent = 'Не удалось подключиться к бою. Проверьте соединение и попробуйте принять приглашение ещё раз.';
        document.getElementById('pvp-receive-modal').classList.remove('hidden');
    }
}
async function getPvpBuildSnapshot(charType) {
    const upgrades = currentUpgrades?.[charType] || { hp: 0, atk: 0 };
    const gear = ensureRpgGear();
    const equipped = gear?.equipped?.[charType] || {};
    const gearNames = Object.values(equipped).filter(Boolean).map(id => RPG_GEAR.find(item => item.id === id)?.name || id);
    return { charType, hpLevel: Number(upgrades.hp) || 0, atkLevel: Number(upgrades.atk) || 0, gearNames };
}
function renderPvpEnemyBuild(build) {
    const box = document.getElementById('pvp-enemy-build-content');
    if (!box) return;
    if (!build) { box.textContent = 'Соперник ещё не передал данные.'; return; }
    const names = Array.isArray(build.gearNames) && build.gearNames.length ? build.gearNames : ['Нет надетых предметов'];
    box.innerHTML = `<b>Боец:</b> ${escapeHtml(build.charType || '—')}<br><b>Прокачка HP:</b> ${Number(build.hpLevel)||0}<br><b>Прокачка ATK:</b> ${Number(build.atkLevel)||0}<br><b>Надетое снаряжение:</b><ul>${names.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`;
}
function togglePvpEnemyBuild(show) {
    document.getElementById('pvp-enemy-build-modal')?.classList.toggle('hidden', !show);
}

function newPvpActionId() { return crypto.randomUUID(); }

async function invokeRpgPvp(action, data) {
    const { data: result, error } = await supabaseClient.functions.invoke('rpg-pvp', { body: { action, data } });
    if (error) {
        let message = error.message || 'PvP request failed';
        try { message = (await error.context.clone().json())?.error || message; } catch (_) {}
        throw new Error(message);
    }
    if (!result?.success) throw new Error(result?.error || 'PvP request failed');
    return result;
}

function applyAuthoritativePvpMatch(match) {
    if (!match?.state || !match.status) return;
    if (match.match_id) pvpMatchId = match.match_id;
    if (match.status === 'active' && pendingOutgoingChallenge?.roomId === myRoomId) {
        clearTimeout(pendingOutgoingChallenge.timer);
        pendingOutgoingChallenge = null;
    } else if (['completed', 'cancelled', 'expired'].includes(match.status) && pendingOutgoingChallenge?.roomId === myRoomId) {
        clearTimeout(pendingOutgoingChallenge.timer);
        pendingOutgoingChallenge = null;
    }
    const version = Number(match.version);
    if (Number.isSafeInteger(version)) {
        if (pvpMatchVersion !== null && version < pvpMatchVersion) return;
        pvpMatchVersion = version;
    }
    const ownSide = isPvpHost ? 'host' : 'guest';
    const otherSide = isPvpHost ? 'guest' : 'host';
    const own = match.state[ownSide];
    const other = match.state[otherSide];
    if (!own || !other) {
        pvpGameState.isMyTurn = false;
        disablePvpButtons();
        if (['completed', 'cancelled', 'expired'].includes(match.status)) {
            finishPvpFromServer(match.winner_side === ownSide, match.status);
            return;
        }
        if (match.status === 'waiting') {
            document.getElementById('pvp-turn-indicator').textContent = 'ОЖИДАНИЕ СОПЕРНИКА';
            document.getElementById('pvp-log').textContent = 'Матч создан. Ожидаем подключения соперника…';
        }
        return;
    }
    const ownBuild = own.fighter || match.server_builds?.[ownSide] || {};
    const otherBuild = other.fighter || match.server_builds?.[otherSide] || {};
    const images = { ashab: 'IMG_3545.jpeg', apostol: 'IMG_3544.jpeg', mee: 'IMG_3546.jpeg' };
    document.getElementById('pvp-player-img').src = images[ownBuild.char_type] || images.ashab;
    document.getElementById('pvp-enemy-img').src = images[otherBuild.char_type] || images.ashab;
    document.getElementById('pvp-player-name').textContent = 'Ты (' + (ownBuild.char_type || 'бой') + ')';
    document.getElementById('pvp-enemy-name').textContent = pvpOpponentName || 'Соперник';
    const gearNames = Object.values(otherBuild.equipped_gear || {}).map(id => RPG_GEAR.find(item => item.id === id)?.name || id);
    renderPvpEnemyBuild({ charType: otherBuild.char_type, hpLevel: otherBuild.upgrade_hp, atkLevel: otherBuild.upgrade_atk, gearNames });
    pvpGameState = {
        myHp: Number(own.hp) || 0, myMaxHp: Number(ownBuild.max_hp) || 1,
        myAtk: Number(ownBuild.attack) || 0, myCrit: Number(ownBuild.crit) || 0,
        myDefense: Number(ownBuild.defense) || 0, myFlatAtkBonus: Number(ownBuild.flat_atk) || 0,
        myAtkPercent: Number(ownBuild.atk_percent) || 0,
        enemyHp: Number(other.hp) || 0, enemyMaxHp: Number(otherBuild.max_hp) || 1,
        enemyName: pvpOpponentName || 'Соперник', enemyMp: Number(other.mp) || 0,
        myMp: Number(own.mp) || 0, isMyTurn: match.status === 'active' && match.current_turn_side === ownSide,
        myBorisHp: Number(own.boris_hp) || 0, enemyBorisHp: Number(other.boris_hp) || 0,
        myParashnikHp: Number(own.parashnik_hp) || 0, enemyParashnikHp: Number(other.parashnik_hp) || 0,
        myDefending: own.defending === true, enemyDefending: other.defending === true,
        myItemUsed: own.item_used === true, myBonusAttacks: Number(own.bonus_attacks) || 0,
        myPotatoBuff: own.potato_buff === true
    };
    pvpBattleStarted = match.status === 'active';
    if (['completed', 'cancelled', 'expired'].includes(match.status)) {
        finishPvpFromServer(match.winner_side === ownSide, match.status);
        return;
    }
    updatePvpUI();
    if (pvpGameState.isMyTurn) enablePvpButtons(); else disablePvpButtons();
    setPvpTurn(pvpGameState.isMyTurn);
}

async function syncPvpMatch() {
    if (!myRoomId || pvpSyncBusy) return;
    pvpSyncBusy = true;
    const roomTopic = myRoomId;
    const currentMatchId = pvpMatchId;
    const account = currentAuthUserId;
    try {
        const match = await invokeRpgPvp('get_match', { room_topic: roomTopic });
        if (currentAuthUserId === account && myRoomId === roomTopic && (!currentMatchId || pvpMatchId === currentMatchId) && (!pvpMatchId || match.match_id === pvpMatchId)) {
            applyAuthoritativePvpMatch(match);
        }
    }
    catch (_) { if (currentAuthUserId === account && pvpBattleStarted && !pvpBattleFinished) logPvp('Нет связи с сервером. Подтверждённое состояние сохранено.'); }
    finally { pvpSyncBusy = false; }
}

function startPvpMatchSync() {
    if (pvpSyncTimer) clearInterval(pvpSyncTimer);
    pvpSyncTimer = setInterval(syncPvpMatch, 1800);
    syncPvpMatch();
}

async function submitPvpIntent(kind, itemId = null) {
    if (!pvpMatchId || pvpMatchVersion === null || pvpActionBusy || pvpBattleFinished) return;
    if (pvpPendingAction && (pvpPendingAction.action_kind !== kind || pvpPendingAction.item_id !== itemId)) {
        alert('Предыдущий запрос не подтверждён. Повторите то же действие.');
        return;
    }
    pvpPendingAction ||= { action_kind: kind, item_id: itemId, action_id: newPvpActionId(), expected_version: pvpMatchVersion };
    const room = myRoomId, matchId = pvpMatchId, account = currentAuthUserId, pendingAction = pvpPendingAction;
    const isCurrent = () => myRoomId === room && pvpMatchId === matchId && currentAuthUserId === account && pvpPendingAction === pendingAction;
    pvpActionBusy = true;
    disablePvpButtons();
    try {
        const result = await invokeRpgPvp('submit_action', {
            room_topic: myRoomId, action_id: pvpPendingAction.action_id,
            expected_version: pvpPendingAction.expected_version,
            action_kind: pvpPendingAction.action_kind, item_id: pvpPendingAction.item_id
        });
        if (!isCurrent()) return;
        pvpPendingAction = null;
        const labels = { attack: 'Обычная атака', defend: 'Защита', skill: 'Способность', use_item: 'Предмет', leave: 'Сдача' };
        logPvp((labels[result.action] || 'Действие') + ((Number(result.damage) || 0) > 0 ? ': ' + result.damage + ' урона.' : '.') + (result.critical ? ' Критический удар.' : ''));
        applyAuthoritativePvpMatch(result);
        if (kind === 'use_item' && result.inventory) {
            currentInventory = result.inventory;
            if (Number.isFinite(Number(result.item_points))) currentItemPoints = Number(result.item_points);
            updateUI();
        }
    } catch (error) {
        if (!isCurrent()) return;
        if (/Stale match version|Not your turn|Match is not active|Match timed out|Not enough mana|Item is not owned|Item is not supported in PvP|Item action is unavailable/.test(error.message || '')) pvpPendingAction = null;
        logPvp('Сервер не подтвердил действие. ' + (error.message || 'Повтор безопасен.'));
        syncPvpMatch();
    } finally {
        if (myRoomId !== room || pvpMatchId !== matchId || currentAuthUserId !== account) return;
        pvpActionBusy = false;
        if (!pvpBattleFinished && pvpGameState.isMyTurn) enablePvpButtons();
    }
}

function handlePvpEnemyAction() { /* Client Broadcasts cannot change combat state. */ }
function pvpAttack() { return submitPvpIntent('attack'); }
function pvpDefend() { return submitPvpIntent('defend'); }
function pvpSkill() { return submitPvpIntent('skill'); }

function openPvpItemMenu() {
    if (!pvpGameState.isMyTurn || pvpGameState.myItemUsed || pvpActionBusy) return;
    const list = document.getElementById('rpg-item-list');
    list.replaceChildren();
    const inventory = getProcessedInventory();
    if (!inventory.length) {
        const empty = document.createElement('p'); empty.textContent = 'Инвентарь пуст.'; list.appendChild(empty);
    }
    inventory.forEach(item => {
        const card = document.createElement('div'); card.className = 'inv-card';
        card.innerHTML = `${getImgTag(item.img)}<div class="inv-card-name">${escapeHtml(item.name)} ×${item.qty}</div>`;
        const use = document.createElement('button'); use.type = 'button'; use.textContent = 'Использовать';
        use.addEventListener('click', () => pvpUseItem(item.name));
        card.appendChild(use); list.appendChild(card);
    });
    document.getElementById('rpg-item-modal').classList.remove('hidden');
}

async function pvpUseItem(itemName) {
    if (!pvpGameState.isMyTurn || pvpGameState.myItemUsed) return;
    const item = currentInventory.find(entry => entry.name === itemName);
    if (!item?.id) return;
    closeItemMenu();
    return submitPvpIntent('use_item', String(item.id));
}

function finishPvpFromServer(won, status) {
    if (pvpBattleFinished) return;
    const room = myRoomId, match = pvpMatchId, account = currentAuthUserId;
    pvpBattleFinished = true; disablePvpButtons();
    document.getElementById('battle-music')?.pause();
    logPvp(status === 'completed' ? (won ? 'Сервер подтвердил победу.' : 'Сервер подтвердил поражение.') : 'Матч завершён сервером: ' + status + '.');
    document.getElementById('pvp-turn-indicator').textContent = won ? 'ПОБЕДА' : 'МАТЧ ЗАВЕРШЁН';
    if (pvpSyncTimer) clearInterval(pvpSyncTimer);
    setTimeout(() => {
        if (room === myRoomId && match === pvpMatchId && account === currentAuthUserId && pvpBattleFinished) leavePvpRoom(false);
    }, 2500);
}

async function endPvpBattle() { if (pvpMatchId && !pvpBattleFinished) return submitPvpIntent('leave'); }

function attachPvpRoomChannel(roomTopic) {
    if (roomChannel) supabaseClient.removeChannel(roomChannel);
    roomChannel = supabaseClient.channel(roomTopic, { config: { broadcast: { self: false }, private: true } });
    const channel = roomChannel, account = currentAuthUserId;
    const isCurrent = () => roomChannel === channel && myRoomId === roomTopic && account === currentAuthUserId;
    roomChannel.on('broadcast', { event: 'chat_message' }, ({ payload }) => { if (isCurrent()) addPvpChatMessage(payload?.nick || '???', payload?.text || ''); });
    roomChannel.subscribe(status => { if (isCurrent() && status === 'SUBSCRIBED') syncPvpMatch(); });
    initPvpChat(roomTopic);
}

async function createPvpRoom() {
    const account = currentAuthUserId, initialRoom = myRoomId, initialMatch = pvpMatchId;
    const isCurrent = () => account === currentAuthUserId && myRoomId === initialRoom && pvpMatchId === initialMatch;
    const roomTopic = 'room_' + Math.random().toString(36).slice(2, 11).padEnd(9, '0');
    const charType = document.getElementById('pvp-char-select').value;
    const registered = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'register_room_membership', data: { topic: roomTopic, kind: 'rpg', inviteeUsername: null, isPublic: true } } });
    if (!isCurrent()) return;
    if (registered.error || !registered.data?.success) { alert(registered.data?.error || 'Не удалось создать комнату.'); return; }
    try {
        const match = await invokeRpgPvp('create_match', { match_id: newPvpActionId(), room_topic: roomTopic, char_type: charType });
        if (!isCurrent()) return;
        myRoomId = roomTopic; pvpMatchId = match.match_id; pvpMatchVersion = Number(match.version);
        isPvpHost = true; currentPvpChar = charType; pvpOpponentName = null; pvpBattleFinished = false; pvpPendingAction = null;
        await lobbyChannel?.track({ room: { roomId: roomTopic, roomName: document.getElementById('pvp-room-name').value.trim() || 'Комната ' + currentUser, hostName: currentUser, hostPts: currentPvpPts, charName: charType, hp: 0, atk: 0 } });
        if (account !== currentAuthUserId || myRoomId !== roomTopic || pvpMatchId !== match.match_id) return;
        closePvpLobby(); attachPvpRoomChannel(roomTopic); switchTab('rpg');
        stopOfflineBattleForPvp();
        document.getElementById('rpg-char-select').classList.add('hidden'); document.getElementById('pvp-battle-screen').classList.remove('hidden');
        startPvpMatchSync();
    } catch (error) { if (account === currentAuthUserId) alert(error.message || 'Не удалось создать матч.'); }
}

async function joinPvpRoom(roomId, charType) {
    const account = currentAuthUserId, initialRoom = myRoomId, initialMatch = pvpMatchId;
    const isCurrent = () => account === currentAuthUserId && myRoomId === initialRoom && pvpMatchId === initialMatch;
    const joinedRoom = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'join_room_membership', data: { topic: roomId } } });
    if (!isCurrent()) return false;
    if (joinedRoom.error || !joinedRoom.data?.success) { alert(joinedRoom.data?.error || 'Нет доступа к комнате.'); return false; }
    try {
        const match = await invokeRpgPvp('join_match', { room_topic: roomId, char_type: charType });
        if (!isCurrent()) return false;
        myRoomId = roomId; pvpMatchId = match.match_id; pvpMatchVersion = Number(match.version);
        isPvpHost = false; currentPvpChar = charType; pvpBattleFinished = false; pvpPendingAction = null;
        closePvpLobby(); switchTab('rpg');
        stopOfflineBattleForPvp();
        document.getElementById('rpg-char-select').classList.add('hidden'); document.getElementById('pvp-battle-screen').classList.remove('hidden');
        attachPvpRoomChannel(roomId); startPvpMatchSync();
        return true;
    } catch (error) { if (isCurrent()) alert(error.message || 'Не удалось подключиться к матчу.'); return false; }
}

async function leavePvpRoom(sendSignal = true) {
    const account = currentAuthUserId, room = myRoomId, match = pvpMatchId;
    const isCurrent = () => account === currentAuthUserId && room === myRoomId && match === pvpMatchId;
    if (sendSignal && isPvpHost && pendingOutgoingChallenge) await syncPvpMatch();
    if (!isCurrent()) return;
    if (sendSignal && isPvpHost && pendingOutgoingChallenge) {
        await clearOutgoingRpgChallenge('Вызов отменён.');
        return;
    }
    if (sendSignal && pvpMatchId && !pvpBattleFinished) {
        if (pvpBattleStarted) return submitPvpIntent('leave');
        try { await invokeRpgPvp('cancel_match', { room_topic: myRoomId }); }
        catch (error) { alert(error.message || 'Не удалось отменить комнату на сервере.'); return; }
    }
    if (!isCurrent()) return;
    if (pvpSyncTimer) clearInterval(pvpSyncTimer);
    pvpSyncTimer = null;
    if (roomChannel) { const channel = roomChannel; roomChannel = null; await supabaseClient.removeChannel(channel); }
    if (!isCurrent()) return;
    if (isPvpHost && lobbyChannel) { try { await lobbyChannel.track({ online: true }); } catch (_) {} }
    if (!isCurrent()) return;
    document.getElementById('pvp-battle-screen')?.classList.add('hidden');
    document.getElementById('rpg-char-select')?.classList.remove('hidden');
    document.getElementById('battle-music')?.pause();
    myRoomId = null; pvpMatchId = null; pvpMatchVersion = null; pvpBattleStarted = false; pvpBattleFinished = false;
    pvpActionBusy = false; pvpPendingAction = null; currentPvpChar = null; pvpOpponentName = null;
}

function updatePvpUI() {
    const attackButton = document.getElementById('pvp-atk-btn');
    if (attackButton) attackButton.textContent = `Обычный удар (+${currentPvpChar === 'apostol' ? 20 : 15} маны)`;
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
        pDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(pvpGameState.myBorisHp/Math.max(1, pvpGameState.myMaxHp*0.4))*100}%; background: #00ff00;"></div></div></div>`;
    }
    if (pvpGameState.myParashnikHp > 0) {
        pDep.innerHTML += `<div class="deployed-item"><img src="img_parashnik.png" onerror="this.src='https://via.placeholder.com/50?text=P'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(pvpGameState.myParashnikHp/30)*100}%; background: #a020f0;"></div></div></div>`;
    }
    if (pvpGameState.enemyBorisHp > 0) {
        eDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(pvpGameState.enemyBorisHp/Math.max(1, pvpGameState.enemyMaxHp*0.4))*100}%; background: #00ff00;"></div></div></div>`;
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
    if (def) def.disabled = pvpGameState.myMp < 50; 
    if (item) item.disabled = pvpGameState.myItemUsed;
    if (skill) skill.disabled = pvpGameState.myMp < 100;
}

function logPvp(msg) {
    const log = document.getElementById('pvp-log');
    if (!log) return;
    const line = document.createElement('div');
    line.textContent = '> ' + String(msg ?? '');
    log.appendChild(line);
    while (log.children.length > 250) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
}

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
let rpgBonusAttacks = 0;
let rpgPotatoBuff = false;
let rpgPlayerBorisHp = 0; let rpgEnemyBorisHp = 0; let rpgPlayerParashnikHp = 0; let rpgEnemyParashnikHp = 0;
let rpgItemUsed = false; let rpgPlayerDefending = false; let rpgEnemyStunned = false;
let enemyTurnTimeout = null;

function stopOfflineBattleForPvp() {
    if (enemyTurnTimeout) clearTimeout(enemyTurnTimeout);
    enemyTurnTimeout = null;
    // Retiring these identities also invalidates already queued timers and
    // in-flight victory/item callbacks captured by captureRpgBattle().
    rpgChar = null; rpgEnemy = null; isPlayerTurn = false;
    document.getElementById('rpg-battle-screen').classList.add('hidden');
    document.getElementById('rpg-item-modal').classList.add('hidden');
}

function changeBackground() {
    let newIndex; do { newIndex = Math.floor(Math.random() * battleBackgrounds.length); } while (newIndex === currentBgIndex && battleBackgrounds.length > 1);
    currentBgIndex = newIndex; document.getElementById('battlefield-bg').style.backgroundImage = `url('${battleBackgrounds[currentBgIndex]}')`;
}

function selectChar(type) {
    if (enemyTurnTimeout) clearTimeout(enemyTurnTimeout);
    currentCharType = type;
    rpgBonusAttacks = 0;
    let baseHp = 0, baseAtk = 0, mpGain = 0, name = "", charClass = "", imgUrl = "";
    if (type === 'ashab') { baseHp = 150; baseAtk = 20; mpGain = 15; name = "Ashab"; charClass = "Берсерк"; imgUrl = "IMG_3545.jpeg"; }
    else if (type === 'apostol') { baseHp = 80; baseAtk = 30; mpGain = 20; name = "Apostol"; charClass = "Чернокнижник"; imgUrl = "IMG_3544.jpeg"; }
    else if (type === 'mee') { baseHp = 110; baseAtk = 18; mpGain = 15; name = "Мээ"; charClass = "Друид"; imgUrl = "IMG_3546.jpeg"; }
    let u = currentUpgrades[type];
    const gearBonus = getGearBonuses(type);
    const equippedHp = baseHp + (u.hp * 20) + gearBonus.hp;
    const rawAtk = baseAtk + (u.atk * 5) + gearBonus.atk;
    rpgChar = { name, class: charClass, maxHp: equippedHp, hp: equippedHp, atk: Math.max(1, Math.round(rawAtk * (1 + (gearBonus.atkPercent || 0) / 100))), mpGain, img: imgUrl, gearBonus };
    // Offline checkpoints: only floors already reached by this character are selectable.
    const maxReachedFloor = Math.max(1, Number(currentMaxFloors?.[type]) || 1);
    const checkpointChoices = [1];
    for (let checkpoint = 5; checkpoint <= maxReachedFloor; checkpoint += 5) checkpointChoices.push(checkpoint);
    let selectedStartFloor = 1;
    if (checkpointChoices.length > 1) {
        const choice = prompt(
            `С какого чекпоинта начать?\nДоступно: ${checkpointChoices.join(', ')}\n\nВведи номер этажа:`,
            String(checkpointChoices[checkpointChoices.length - 1])
        );
        if (choice !== null) {
            const requested = Number.parseInt(choice, 10);
            if (checkpointChoices.includes(requested)) selectedStartFloor = requested;
        }
    }
    rpgFloorMain = selectedStartFloor; rpgFloorSub = 1;
    rpgMana = 0; rpgPlayerBorisHp = 0; rpgPlayerParashnikHp = 0; rpgEnemyBorisHp = 0; rpgEnemyParashnikHp = 0; rpgItemUsed = false; rpgPlayerDefending = false; rpgEnemyStunned = false;
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
    const isBoss = rpgFloorSub === 5;
    let eType = isBoss ? { name: 'КОЛЛЕКТОР МЯСОРУБКИ', hpMult: 2.25, atkMult: 1.45, img: 'enemy_beduin.png' } : enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    let eHp = Math.floor(baseHp * eType.hpMult);
    rpgEnemy = { name: `${isBoss ? '👑 БОСС: ' : ''}${eType.name} (Ур. ${rpgFloorMain}.${rpgFloorSub})`, hp: eHp, maxHp: eHp, atk: Math.floor(baseAtk * eType.atkMult), img: eType.img, isBoss };
    rpgEnemyBorisHp = 0; rpgEnemyParashnikHp = 0; rpgItemUsed = false; rpgPlayerDefending = false; rpgEnemyStunned = false;
    document.getElementById('rpg-floor').innerText = isBoss ? `👑 БОСС-ЭТАЖ ${rpgFloorMain}.${rpgFloorSub} · НАГРАДА УВЕЛИЧЕНА` : `ЭТАЖ ${rpgFloorMain}.${rpgFloorSub}`;
    document.getElementById('rpg-floor').classList.toggle('boss-floor-banner', isBoss);
    document.getElementById('rpg-enemy-img').src = rpgEnemy.img;
    updateRpgUI(); addLog(`На арене появился ${rpgEnemy.name}!`);
    isPlayerTurn = true; enemyIsCharging = false; setTurnIndicator(true); checkButtons();
}

function addLog(msg) {
    const logBox = document.getElementById('rpg-log');
    if (!logBox) return;
    const line = document.createElement('div');
    line.textContent = '> ' + String(msg ?? '');
    logBox.appendChild(line);
    while (logBox.children.length > 300) logBox.firstElementChild.remove();
    logBox.scrollTop = logBox.scrollHeight;
}
function setTurnIndicator(isPlayer) { const ind = document.getElementById('rpg-turn-indicator'); if (isPlayer) { ind.innerText = "ВАШ ХОД"; ind.className = "turn-indicator turn-player"; } else { ind.innerText = "ХОД ВРАГА"; ind.className = "turn-indicator turn-enemy"; } }

function updateRpgUI() {
    const attackButton = document.querySelector('.rpg-actions .btn-atk');
    if (attackButton && rpgChar) attackButton.textContent = `Обычный удар (+${rpgChar.mpGain} маны)`;
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
        pDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgPlayerBorisHp/Math.max(1, rpgChar.maxHp*0.4))*100}%; background: #00ff00;"></div></div></div>`;
    }
    if (rpgPlayerParashnikHp > 0) {
        pDep.innerHTML += `<div class="deployed-item"><img src="img_parashnik.png" onerror="this.src='https://via.placeholder.com/50?text=P'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgPlayerParashnikHp/30)*100}%; background: #a020f0;"></div></div></div>`;
    }
    if (rpgEnemyBorisHp > 0) {
        eDep.innerHTML += `<div class="deployed-item"><img src="img_boris.png" onerror="this.src='https://via.placeholder.com/50?text=B'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgEnemyBorisHp/Math.max(1, rpgEnemy.maxHp*0.4))*100}%; background: #00ff00;"></div></div></div>`;
    }
    if (rpgEnemyParashnikHp > 0) {
        eDep.innerHTML += `<div class="deployed-item"><img src="img_parashnik.png" onerror="this.src='https://via.placeholder.com/50?text=P'"><div class="hp-bar-container"><div class="hp-bar-fill" style="width: ${(rpgEnemyParashnikHp/30)*100}%; background: #a020f0;"></div></div></div>`;
    }
}

function checkButtons() {
    const btns = [document.querySelector('.btn-atk'), document.querySelector('.btn-def'), document.getElementById('rpg-skill-btn'), document.querySelector('.btn-item')];
    if (isPlayerTurn) { 
        btns[0].disabled = false; 
        btns[1].disabled = rpgMana < 50; 
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
    const critChance = (rpgChar.gearBonus && rpgChar.gearBonus.crit) || 0;
    if (critChance > 0 && Math.random() * 100 < critChance) {
        dmg = Math.round(dmg * 1.75);
        addLog(`КРИТИЧЕСКИЙ УДАР! Экипировка усилила атаку до ${dmg} урона.`);
        playSoundEffect('crit');
    }
    if (rpgPotatoBuff) { dmg = Math.round(dmg * 1.15); rpgPotatoBuff = false; addLog(`Картофель усилил удар на 15%: ${dmg} урона.`); }
    if (rpgPlayerParashnikHp > 0) {
        rpgPlayerParashnikHp = Math.max(0, rpgPlayerParashnikHp - dmg);
        addLog(rpgPlayerParashnikHp ? `Ломаешь парашника, установленного врагом: ${rpgPlayerParashnikHp}/30 HP.` : 'Ты уничтожил парашника, установленного врагом!');
    } else if(rpgEnemyBorisHp > 0) {
        rpgEnemyBorisHp -= dmg; addLog(`Ты бьешь Бориса на ${dmg}.`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp = 0; addLog("Борис разрушен!"); }
    } else {
        rpgEnemy.hp -= dmg; addLog(`${rpgChar.name} бьет на ${dmg} урона.`);
    }
    rpgMana = Math.min(rpgMaxMana, rpgMana + rpgChar.mpGain);
    if (rpgEnemyParashnikHp > 0) {
        const poisonDmg = percentOf(rpgEnemy.maxHp, 5);
        rpgEnemy.hp -= poisonDmg;
        rpgEnemy.mp = Math.max(0, (rpgEnemy.mp || 0) - 15);
        rpgEnemyParashnikHp = Math.max(0, rpgEnemyParashnikHp - 10);
        addLog(`Враг отравлен Парашником: -${poisonDmg} HP, -15 маны. У Парашника осталось ${rpgEnemyParashnikHp}/30 HP.`);
        if (rpgEnemyParashnikHp === 0) addLog('Парашник на враге развалился сам!');
    }
    updateRpgUI();
    if (rpgEnemy.hp <= 0) { rpgBonusAttacks = 0; winRpg(); }
    else if (rpgBonusAttacks > 0) {
        rpgBonusAttacks--;
        if (rpgBonusAttacks > 0) { isPlayerTurn = true; setTurnIndicator(true); checkButtons(); addLog(`Бонус защиты: остался ${rpgBonusAttacks} дополнительный удар.`); }
        else { enemyTurnTimeout = scheduleRpgBattle(enemyTurn, 800); }
    } else { enemyTurnTimeout = scheduleRpgBattle(enemyTurn, 800); }
}
function rpgDefend() {
    if (!isPlayerTurn || rpgChar.hp <= 0 || rpgEnemy.hp <= 0) return;
    if (rpgMana < 50) { alert("Мало маны для защиты! Нужно 50."); return; }
    playSoundEffect('protection');
    rpgMana -= 50;
    rpgBonusAttacks = 2;
    isPlayerTurn = false; rpgItemUsed = false; rpgPlayerDefending = true; rpgEnemyStunned = true; setTurnIndicator(false); checkButtons();
    addLog(`${rpgChar.name} защищается (-50 маны). Враг пропускает ход, а ты получаешь 2 удара!`); updateRpgUI(); enemyTurnTimeout = scheduleRpgBattle(() => enemyTurn(false), 800);
}
function rpgSkill() {
    rpgBonusAttacks = 0;
    if (!isPlayerTurn || rpgMana < 100 || rpgChar.hp <= 0 || rpgEnemy.hp <= 0) return;
    playSoundEffect('crit');
    isPlayerTurn = false; rpgMana = 0; rpgItemUsed = false; setTurnIndicator(false); checkButtons(); animateAttack(true);
    triggerScreenShake();
    let dmg = 0;
    if (rpgChar.class === "Берсерк") { dmg = 60 + (currentUpgrades[currentCharType].atk * 10); addLog(`Сокрушающий удар на ${dmg}!`); }
    else if (rpgChar.class === "Чернокнижник") { dmg = Math.floor(Math.random() * 30) + 70 + (currentUpgrades[currentCharType].atk * 10); addLog(`Тёмный ритуал. Урон: ${dmg}!`); }
    else if (rpgChar.class === "Друид") { let heal = percentOf(rpgChar.maxHp, 25) + (currentUpgrades[currentCharType].hp * 5); rpgChar.hp = Math.min(rpgChar.maxHp, rpgChar.hp + heal); addLog(`Исцеление на ${heal} HP!`); playSoundEffect('heal'); }
    if (dmg > 0) {
        dmg = Math.round((dmg + (rpgChar.gearBonus?.atk || 0)) * (1 + (rpgChar.gearBonus?.atkPercent || 0) / 100));
        if (rpgChar.gearBonus?.crit && Math.random() * 100 < rpgChar.gearBonus.crit) { dmg = Math.round(dmg * 1.75); addLog(`КРИТИЧЕСКАЯ СПОСОБНОСТЬ! Урон ${dmg}.`); playSoundEffect('crit'); }
        if (rpgPlayerParashnikHp > 0) { rpgPlayerParashnikHp = Math.max(0, rpgPlayerParashnikHp - dmg); addLog(rpgPlayerParashnikHp ? 'Способность повреждает установленного врагом парашника.' : 'Ты уничтожил парашника, установленного врагом!'); }
        else if(rpgEnemyBorisHp > 0) {
            rpgEnemyBorisHp -= dmg; addLog(`Ты бьешь Бориса способностью.`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp = 0; addLog("Борис разрушен!"); }
        } else {
            rpgEnemy.hp -= dmg; 
        }
    }
    updateRpgUI(); if (rpgEnemy.hp <= 0) winRpg(); else enemyTurnTimeout = scheduleRpgBattle(enemyTurn, 800);
}

function enemyTurn(isPlayerDefending = false) {
    if (!rpgChar || !rpgEnemy) return;
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
            const enemyHeal = percentOf(rpgEnemy.maxHp, 15);
            rpgEnemy.hp = Math.min(rpgEnemy.maxHp, rpgEnemy.hp + enemyHeal);
            addLog(`Враг использует предмет и лечится на ${enemyHeal} HP (15%).`);
            playSoundEffect('heal');
        } else if (itemRoll < 0.6 && rpgEnemyBorisHp <= 0) {
            rpgEnemyBorisHp = percentOf(rpgEnemy.maxHp, 40);
            addLog(`Враг ставит Бориса!`);
            playSoundEffect('thing');
        } else if (itemRoll < 0.8 && rpgPlayerParashnikHp <= 0) {
            rpgPlayerParashnikHp = 30;
            addLog(`Враг ставит Парашника!`);
            playSoundEffect('thing');
        } else {
            playSoundEffect('harmful');
            let dmg = percentOf(rpgChar.maxHp, 20);
            const gearDefense = (getGearBonuses(currentCharType).defense || 0);
            if (gearDefense > 0) { dmg = Math.max(1, Math.floor(dmg * (1 - gearDefense / 100))); addLog(`Броня поглотила часть урона (${gearDefense}%).`); }
            if (isPlayerDefending) { dmg = Math.floor(dmg * 0.35); addLog(`Ты заблокировал предмет, получив ${dmg} (65% срезано).`); }
            if (rpgPlayerBorisHp > 0) { rpgPlayerBorisHp -= dmg; addLog(`Враг швырнул голову барана в Бориса!`); if(rpgPlayerBorisHp<=0){rpgPlayerBorisHp=0; addLog("Твой Борис разрушен!");} }
            else { rpgChar.hp -= dmg; addLog(`Враг швырнул голову барана на ${dmg} урона!`); }
        }
        updateRpgUI();
        if (rpgChar.hp <= 0) { 
            addLog(`Ты сдох...`); isPlayerTurn = false; checkButtons(); document.getElementById('battle-music').pause(); scheduleRpgBattle(() => { document.getElementById('rpg-char-select').classList.remove('hidden'); document.getElementById('rpg-battle-screen').classList.add('hidden'); renderCharStats(); updateUI(); }, 3000);
        } else {
            enemyTurnTimeout = scheduleRpgBattle(() => { isPlayerTurn = true; setTurnIndicator(true); checkButtons(); }, 800);
        }
        return;
    }
    
    let dmg = Math.floor(Math.random() * 10) + rpgEnemy.atk;
    const gearDefense = (getGearBonuses(currentCharType).defense || 0);
    if (gearDefense > 0) { dmg = Math.max(1, Math.floor(dmg * (1 - gearDefense / 100))); }
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
    } else {
        rpgChar.hp -= dmg; 
    }
    
    rpgPlayerDefending = false;
    updateRpgUI();
    
    if (rpgChar.hp <= 0) { 
        addLog(`Ты сдох...`); isPlayerTurn = false; checkButtons(); document.getElementById('battle-music').pause(); scheduleRpgBattle(() => { document.getElementById('rpg-char-select').classList.remove('hidden'); document.getElementById('rpg-battle-screen').classList.add('hidden'); renderCharStats(); updateUI(); }, 3000);
    } else { 
        if(rpgPlayerParashnikHp > 0) {
            const poisonBase = percentOf(rpgChar.maxHp, 5); const poisonDmg = Math.max(1, Math.round(poisonBase * (1 - (rpgChar.gearBonus?.defense || 0) / 100))); const poisonMana = 15;
            rpgChar.hp -= poisonDmg; rpgMana = Math.max(0, rpgMana - poisonMana);
            addLog(`Тебя отравил парашник! -${poisonDmg} HP (5%), -${poisonMana} маны (15%).`);
            rpgPlayerParashnikHp = Math.max(0, rpgPlayerParashnikHp - 10); if (rpgPlayerParashnikHp === 0) addLog('Парашник на тебе развалился сам!');
            updateRpgUI();
            if(rpgChar.hp <= 0) { addLog(`Ты сдох от яда...`); isPlayerTurn = false; checkButtons(); document.getElementById('battle-music').pause(); scheduleRpgBattle(() => { document.getElementById('rpg-char-select').classList.remove('hidden'); document.getElementById('rpg-battle-screen').classList.add('hidden'); renderCharStats(); updateUI(); }, 3000); return; }
        }
        isPlayerTurn = true; setTurnIndicator(true); checkButtons(); 
    }
}

function scheduleRpgBattle(callback, delay) {
    const isCurrent = captureRpgBattle();
    return setTimeout(() => { if (isCurrent()) callback(); }, delay);
}
function captureRpgBattle() {
    const fighter = rpgChar;
    const enemy = rpgEnemy;
    const userId = currentAuthUserId;
    return () => !!fighter && rpgChar === fighter && rpgEnemy === enemy && currentAuthUserId === userId;
}

async function winRpg() {
    const isCurrentBattle = captureRpgBattle();
    if (!isCurrentBattle()) return;
    let reward = Math.min(100, 10 + (rpgFloorMain * 3));
    const wonFloorMain = rpgFloorMain;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'rpg_win', username: currentUser, data: { floorMain: wonFloorMain, floorSub: rpgFloorSub, charType: currentCharType } } });
        if (!isCurrentBattle()) return;
        if (!error && data && data.success) { currentCoins = data.newCoins; if (data.newUpgrades) currentUpgrades = data.newUpgrades; if (data.newMaxFloors) currentMaxFloors = data.newMaxFloors; updateUI(); addLog(`Победа! +${data.earned} монет.${data.bossBonus ? ` БОНУС БОССА: +${data.bossBonus}!` : ''}`); }
        else if (data && data.rewardPaused) { addLog('Победа! Но монеты и серверный рекорд этажа временно не сохраняются до проверки результата сервером.'); }
        else if (data && data.error) { addLog(`Сервер: ${data.error}`); }
    } catch(e) { if (isCurrentBattle()) addLog(`Ошибка сети: ${e.message}`); }
    finally {
        if (!isCurrentBattle()) return;
        const gearState = ensureRpgGear();
        const equippedCharm = gearState.equipped[currentCharType]?.charm;
        if (equippedCharm === 'phoenix_heart' && rpgChar && rpgChar.hp > 0) {
            const phoenixHeal = Math.min(rpgChar.maxHp - rpgChar.hp, Math.round(rpgChar.maxHp * 0.20));
            if (phoenixHeal > 0) { rpgChar.hp += phoenixHeal; addLog(`Сердце феникса восстановило ${phoenixHeal} HP перед следующим этажом.`); }
        }
        rpgFloorSub++;
        if (rpgFloorSub > 5) {
            rpgFloorSub = 1;
            rpgFloorMain++;
            changeBackground();
            if (rpgFloorMain % 5 === 0) {
                const checkpointKey = `rpg_offline_checkpoint_seen_${currentUser || 'guest'}_${currentCharType}_${rpgFloorMain}`;
                if (!localStorage.getItem(checkpointKey)) {
                    addLog(`🎯 Вы достигли чекпоинта — этаж ${rpgFloorMain}!`);
                    localStorage.setItem(checkpointKey, '1');
                }
            }
        }
        rpgMana = Math.min(rpgMaxMana, rpgMana + 30);
        enemyTurnTimeout = setTimeout(() => {
            if (!isCurrentBattle()) return;
            addLog(`=== ЭТАЖ ${rpgFloorMain}.${rpgFloorSub} ===`); spawnEnemy();
        }, 2000);
    }
}

// === CS:GO-STYLE CASE ROULETTE ===
let caseRouletteBusy = false;
let caseOpeningInProgress = false;

function getRoulettePool(price) {
    if (Number(price) === 250) {
        return [
            { name: 'хуйня', rarity: 'Обычное', img: 'img_huynya.png' },
            { name: 'картофель', rarity: 'Редкое', img: 'img_kartofel.png' },
            { name: 'голова барана', rarity: 'Сверхредкое', img: 'img_baran.png' },
            { name: 'коала', rarity: 'Эпическое', img: 'img_koala.png' },
            { name: 'apostol', rarity: 'Легендарное', img: 'img_apostol.png' },
            { name: 'Вам не повезло', rarity: 'Мусор', img: '' }
        ];
    }
    return [
        { name: 'хуйня', rarity: 'Обычное', img: 'img_huynya.png' },
        { name: 'парашник', rarity: 'Редкое', img: 'img_parashnik.png' },
        { name: 'boris', rarity: 'Легендарное', img: 'img_boris.png' },
        { name: 'шприц и лекарство', rarity: 'Эпическое', img: 'img_syringe.png' },
        { name: 'Сбриватель хуйни', rarity: 'Сверхредкое', img: 'img_shaver.png' },
        { name: 'Вам не повезло', rarity: 'Мусор', img: '' }
    ];
}

function rouletteNormalizeItem(item) {
    if (!item) return null;
    const fallback = getRoulettePool(250).concat(getRoulettePool(390))
        .find(entry => entry.name === item.name);
    return {
        name: String(item.name || 'Неизвестный предмет'),
        rarity: item.rarity || (fallback && fallback.rarity) || 'Обычное',
        img: item.img || (fallback && fallback.img) || '',
        points: item.points
    };
}


function ensureCaseRoulette() {
    let style = document.getElementById('case-roulette-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'case-roulette-style';
        style.textContent = `
          #case-roulette-modal {
            position:fixed!important; inset:0!important; z-index:2147483647!important;
            display:flex!important; align-items:center!important; justify-content:center!important;
            box-sizing:border-box!important; padding:18px!important; overflow:auto!important;
            background:rgba(0,0,0,.78)!important;
            font-family:Tahoma,Arial,sans-serif!important; color:#000!important;
          }
          #case-roulette-modal.hidden { display:none!important; }
          #case-roulette-modal * { box-sizing:border-box!important; }
          #case-roulette-modal .case-roulette-window {
            position:relative!important; display:flex!important; flex-direction:column!important;
            width:min(1128px,96vw)!important; max-width:96vw!important; height:auto!important;
            max-height:92vh!important; min-height:0!important; flex:0 0 auto!important;
            margin:auto!important; padding:0!important; overflow:hidden!important;
            flex:none!important; text-align:left!important; color:#000!important;
            background:#c0c0c0!important; border:3px outset #fff!important; border-radius:0!important;
            box-shadow:none!important; font:13px Tahoma,Arial,sans-serif!important;
          }
          #case-roulette-modal .case-roulette-titlebar {
            display:flex!important; align-items:center!important; justify-content:space-between!important;
            gap:12px!important; min-height:46px!important; margin:0!important; padding:5px 7px 5px 10px!important;
            background:linear-gradient(90deg,#000080 0%,#1010b5 45%,#0879bd 78%,#00466f 100%)!important;
            color:#fff!important; font:700 20px Tahoma,Arial,sans-serif!important; text-align:left!important;
          }
          #case-roulette-modal .case-roulette-titlebar h2 {
            margin:0!important; padding:0!important; color:#fff!important;
            font:700 20px Tahoma,Arial,sans-serif!important; text-shadow:none!important;
          }
          #case-roulette-modal .case-roulette-x {
            flex:0 0 30px!important; width:30px!important; height:28px!important; min-height:28px!important;
            margin:0!important; padding:0!important; background:#c0c0c0!important; color:#000!important;
            border:2px outset #fff!important; border-radius:0!important; font:700 18px Tahoma,Arial,sans-serif!important;
            line-height:20px!important; cursor:pointer!important;
          }
          #case-roulette-modal .case-roulette-inner {
            display:block!important; flex:0 0 auto!important; height:auto!important;
            padding:18px 16px 14px!important; min-height:0!important; overflow:visible!important;
          }
          #case-roulette-modal .roulette-viewport {
            position:relative!important; display:block!important; flex:0 0 232px!important;
            width:100%!important; height:232px!important; min-height:232px!important;
            overflow:hidden!important; margin:0!important; padding:0!important;
            background:#c0c0c0!important; border:3px inset #fff!important; border-radius:0!important;
            box-shadow:none!important; filter:none!important; mask:none!important;
          }
          #case-roulette-modal .roulette-viewport::before,
          #case-roulette-modal .roulette-viewport::after { content:none!important; display:none!important; }
          #case-roulette-modal .roulette-viewport::after {
            content:""!important; display:block!important; position:absolute!important; z-index:5!important;
            top:0!important; bottom:0!important; left:50%!important; width:3px!important;
            transform:translateX(-50%)!important; background:#000080!important; pointer-events:none!important;
          }
          #case-roulette-modal .case-roulette-track {
            position:relative!important; display:flex!important; align-items:stretch!important; gap:7px!important;
            height:100%!important; width:max-content!important; padding:8px!important; margin:0!important;
            background:transparent!important; filter:none!important; mask:none!important; will-change:transform!important;
          }
          #case-roulette-modal .case-roulette-card {
            position:relative!important; flex:0 0 140px!important; width:140px!important; height:100%!important;
            display:flex!important; flex-direction:column!important; align-items:center!important; justify-content:center!important;
            gap:7px!important; margin:0!important; padding:8px 6px!important; overflow:hidden!important;
            border:2px outset #fff!important; border-radius:0!important; box-shadow:none!important;
            color:#000!important; font:13px Tahoma,Arial,sans-serif!important; text-align:center!important;
            background:#e7e7e7!important;
          }
          #case-roulette-modal .case-roulette-card img { display:block!important; flex:0 0 84px!important; width:84px!important; height:84px!important; object-fit:contain!important; margin:0 auto!important; }
          #case-roulette-modal .case-roulette-card .roulette-no-image { display:flex!important; align-items:center!important; justify-content:center!important; flex:0 0 84px!important; width:84px!important; height:84px!important; font:44px Arial,sans-serif!important; color:#000!important; }
          #case-roulette-modal .case-roulette-card span { display:block!important; max-width:100%!important; margin:0!important; color:#111!important; font:13px Tahoma,Arial,sans-serif!important; line-height:1.15!important; overflow-wrap:anywhere!important; }
          #case-roulette-modal .case-roulette-card .roulette-item-chance { display:block!important; margin-top:2px!important; color:#666!important; font:12px Tahoma,Arial,sans-serif!important; line-height:1.15!important; }
          #case-roulette-modal .case-roulette-card.rarity-Обычное { background:#e5e5e5!important; }
          #case-roulette-modal .case-roulette-card.rarity-Редкое { background:#dceaff!important; }
          #case-roulette-modal .case-roulette-card.rarity-Эпическое { background:#f0ddff!important; }
          #case-roulette-modal .case-roulette-card.rarity-Сверхредкое { background:#f9dce1!important; }
          #case-roulette-modal .case-roulette-card.rarity-Легендарное { background:#fff1c5!important; }
          #case-roulette-modal .case-roulette-card.rarity-Мусор { background:#c8c8c8!important; }
          #case-roulette-modal #case-roulette-reveal {
            display:flex!important; flex-direction:column!important; align-items:center!important; justify-content:center!important;
            min-height:150px!important; margin:18px 0 0!important; padding:14px!important;
            background:#c0c0c0!important; border:3px inset #fff!important; border-radius:0!important;
            color:#000!important; text-align:center!important; box-shadow:none!important;
          }
          #case-roulette-modal #case-roulette-reveal.hidden { display:none!important; }
          #case-roulette-modal #case-roulette-reveal img { display:block!important; width:100px!important; height:100px!important; object-fit:contain!important; margin:0 auto 7px!important; filter:none!important; }
          #case-roulette-modal #case-roulette-reveal h3 { margin:6px 0!important; color:#000!important; font:700 22px Tahoma,Arial,sans-serif!important; text-shadow:none!important; }
          #case-roulette-modal .case-roulette-actions { display:flex!important; flex-wrap:wrap!important; justify-content:flex-end!important; align-items:center!important; gap:8px!important; margin:14px 0 0!important; padding:0!important; }
          #case-roulette-modal .case-roulette-actions button {
            min-height:38px!important; margin:0!important; padding:7px 18px!important; cursor:pointer!important;
            background:#c0c0c0!important; color:#000!important; border:2px outset #fff!important; border-radius:0!important;
            font:13px Tahoma,Arial,sans-serif!important; box-shadow:none!important; text-shadow:none!important;
          }
          #case-roulette-modal .case-roulette-actions button:active { border-style:inset!important; }
          #case-roulette-modal .case-roulette-actions button:disabled { opacity:.65!important; }
          @media(max-width:600px) {
            #case-roulette-modal { padding:8px!important; }
            #case-roulette-modal .case-roulette-inner { padding:10px!important; overflow:auto!important; }
            #case-roulette-modal .case-roulette-titlebar h2 { font-size:16px!important; }
            #case-roulette-modal .roulette-viewport { flex-basis:190px!important; height:190px!important; min-height:190px!important; }
            #case-roulette-modal .case-roulette-card { flex-basis:116px!important; width:116px!important; }
            #case-roulette-modal .case-roulette-card img, #case-roulette-modal .case-roulette-card .roulette-no-image { flex-basis:68px!important; width:68px!important; height:68px!important; }
          }
          /* Remove vignette/side gradients inside the case window; keep page backdrop and center marker. */
          #case-roulette-modal .case-roulette-window,
          #case-roulette-modal .case-roulette-inner,
          #case-roulette-modal .roulette-viewport,
          #case-roulette-modal .case-roulette-track {
            background-image:none!important; box-shadow:none!important; filter:none!important;
            -webkit-mask-image:none!important; mask-image:none!important;
          }
          #case-roulette-modal .case-roulette-window::before,
          #case-roulette-modal .case-roulette-window::after,
          #case-roulette-modal .case-roulette-inner::before,
          #case-roulette-modal .case-roulette-inner::after,
          #case-roulette-modal .roulette-viewport::before,
          #case-roulette-modal .case-roulette-track::before,
          #case-roulette-modal .case-roulette-track::after {
            content:none!important; display:none!important; background:none!important; box-shadow:none!important;
          }
          #case-roulette-modal .case-roulette-window,
          #case-roulette-modal .case-roulette-inner,
          #case-roulette-modal .roulette-viewport { background-color:#c0c0c0!important; }
        `;
        document.head.appendChild(style);
    }

    let modal = document.getElementById('case-roulette-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'case-roulette-modal';
        modal.className = 'hidden';
        modal.innerHTML = `
          <div class="case-roulette-window" role="dialog" aria-modal="true" aria-label="Открытие кейса">
            <div class="case-roulette-titlebar">
              <h2 id="case-roulette-title">СТАНДАРТНЫЙ КЕЙС</h2>
              <button class="case-roulette-x" type="button" aria-label="Закрыть" onclick="closeCaseRoulette()">×</button>
            </div>
            <div class="case-roulette-inner">
              <div class="roulette-viewport"><div id="case-roulette-track" class="case-roulette-track"></div></div>
              <div id="case-roulette-reveal" class="hidden"></div>
              <div class="case-roulette-actions">
                <button id="case-roulette-skip" type="button" onclick="skipCaseRoulette()">Пропустить прокрутку</button>
                <button id="case-roulette-close" type="button" onclick="closeCaseRoulette()">Закрыть</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modal);
    }
    return modal;
}

function closeCaseRoulette() {
    // Если закрывают во время прокрутки, мгновенно фиксируем настоящий выигрыш.
    if (activeCaseRoulette && !activeCaseRoulette.finished) skipCaseRoulette();
    const modal = document.getElementById('case-roulette-modal');
    if (modal) modal.classList.add('hidden');
}

function makeRouletteCard(item) {
    const card = document.createElement('div');
    card.className = `case-roulette-card rarity-${item.rarity}`;
    if (item.img) {
        const image = document.createElement('img');
        image.src = item.img;
        image.alt = item.name;
        image.onerror = () => { image.style.visibility = 'hidden'; };
        card.appendChild(image);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'roulette-no-image';
        placeholder.textContent = '❌';
        card.appendChild(placeholder);
    }
    const label = document.createElement('span');
    label.textContent = item.name;
    card.appendChild(label);

    // Показываем шанс из существующей базы предметов; систему очков не меняем.
    const chance = document.createElement('small');
    chance.className = 'roulette-item-chance';
    const itemInfo = (typeof itemDatabase !== 'undefined' && itemDatabase[item.name]) || null;
    chance.textContent = itemInfo && itemInfo.chance ? `Шанс ${itemInfo.chance}` : 'Шанс неизвестен';
    chance.style.cssText = 'display:block;margin-top:3px;font-size:11px;line-height:1.2;color:#d7d7d7;text-align:center;';
    card.appendChild(chance);
    return card;
}

function rouletteWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


let activeCaseRoulette = null;

function revealCaseRouletteResult(awardedItem, reveal, closeButton, skipButton) {
    reveal.replaceChildren();
    if (awardedItem.img) {
        const image = document.createElement('img');
        image.src = awardedItem.img;
        image.alt = awardedItem.name;
        image.onerror = () => { image.style.display = 'none'; };
        reveal.appendChild(image);
    } else {
        const noImage = document.createElement('div');
        noImage.style.cssText = 'font:64px Arial,sans-serif;margin:4px;';
        noImage.textContent = '❌';
        reveal.appendChild(noImage);
    }
    const name = document.createElement('h3');
    name.className = `rarity-${awardedItem.rarity}`;
    name.textContent = awardedItem.name;
    reveal.appendChild(name);
    reveal.classList.remove('hidden');
    closeButton.disabled = false;
    skipButton.disabled = true;
}

function skipCaseRoulette() {
    const active = activeCaseRoulette;
    if (!active || active.finished) return;

    // Отключаем transition ДО установки конечной позиции: линия останавливается сразу.
    active.track.style.transition = 'none';
    active.track.style.transform = `translateX(${active.finalX}px)`;
    active.finished = true;
    if (active.timer) clearTimeout(active.timer);
    if (active.resolveStop) active.resolveStop('skipped');
}

async function runCaseRoulette(price, rawAwardedItem) {
    const awardedItem = rouletteNormalizeItem(rawAwardedItem);
    if (!awardedItem) throw new Error('Сервер не вернул выпавший предмет.');

    const modal = ensureCaseRoulette();
    const track = document.getElementById('case-roulette-track');
    const reveal = document.getElementById('case-roulette-reveal');
    const closeButton = document.getElementById('case-roulette-close');
    const skipButton = document.getElementById('case-roulette-skip');
    const title = document.getElementById('case-roulette-title');

    caseRouletteBusy = true;
    modal.classList.remove('hidden');
    closeButton.disabled = false;
    skipButton.disabled = false;
    reveal.classList.add('hidden');
    reveal.replaceChildren();
    title.textContent = Number(price) === 250 ? 'СТАНДАРТНЫЙ КЕЙС' : 'ПРЕМИУМ КЕЙС';

    try {
        const pool = getRoulettePool(price);
        const winnerIndex = 52;
        const totalCards = 60;
        track.replaceChildren();

        // Для напряжения рядом с реальным призом ставим редкий предмет:
        // рулетка может почти остановиться на нём, но финальная позиция всегда соответствует награде сервера.
        const nearMissItem = pool.find(entry => entry.rarity === 'Легендарное')
            || pool.find(entry => entry.rarity === 'Сверхредкое')
            || pool[0];

        for (let i = 0; i < totalCards; i++) {
            let item;
            if (i === winnerIndex) {
                item = awardedItem;
            } else if (i === winnerIndex - 1 && awardedItem.name !== nearMissItem.name) {
                item = nearMissItem;
            } else {
                item = pool[Math.floor(Math.random() * pool.length)];
            }
            track.appendChild(makeRouletteCard(item));
        }

        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const cards = track.querySelectorAll('.case-roulette-card');
        const winnerCard = cards[winnerIndex];
        const nearCard = cards[winnerIndex - 1];
        const viewport = track.parentElement;
        const finalX = viewport.clientWidth / 2 - (winnerCard.offsetLeft + winnerCard.offsetWidth / 2);
        const nearX = viewport.clientWidth / 2 - (nearCard.offsetLeft + nearCard.offsetWidth / 2);

        activeCaseRoulette = {
            track, finalX, finished: false, timer: null, resolveStop: null
        };

        // Первая часть быстро замедляется почти на редком предмете.
        track.style.transition = 'transform 4.4s cubic-bezier(0.08, 0.72, 0.12, 1)';
        track.style.transform = `translateX(${nearX}px)`;

        await new Promise(resolve => {
            activeCaseRoulette.resolveStop = resolve;
            activeCaseRoulette.timer = setTimeout(resolve, 4450);
        });

        if (activeCaseRoulette && activeCaseRoulette.finished) {
            // Skip already snapped to the real award position.
        } else {
            // Финальный медленный докат к настоящему предмету, который вернул сервер.
            track.style.transition = 'transform 2.8s cubic-bezier(0.18, 0.72, 0.22, 1)';
            track.style.transform = `translateX(${finalX}px)`;
            await new Promise(resolve => {
                if (activeCaseRoulette) {
                    activeCaseRoulette.resolveStop = resolve;
                    activeCaseRoulette.timer = setTimeout(resolve, 2850);
                } else resolve();
            });
        }

        // Независимо от способа завершения, фиксируем пиксель-в-пиксель реальную карточку.
        track.style.transition = 'none';
        track.style.transform = `translateX(${finalX}px)`;
        if (activeCaseRoulette && activeCaseRoulette.timer) clearTimeout(activeCaseRoulette.timer);
        if (activeCaseRoulette) activeCaseRoulette.finished = true;
        revealCaseRouletteResult(awardedItem, reveal, closeButton, skipButton);
    } finally {
        activeCaseRoulette = null;
        caseRouletteBusy = false;
        closeButton.disabled = false;
        skipButton.disabled = true;
    }
}


async function openCase(price) {
    const account = currentAuthUserId;
    if (caseOpeningInProgress || caseRouletteBusy) return;
    const resBox = document.getElementById('case-result');
    if (!resBox) return;

    caseOpeningInProgress = true;
    resBox.textContent = 'Открываем кейс...';
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'open_case', username: currentUser, data: { price } }
        });
        if (account !== currentAuthUserId) return;

        if (error) {
            resBox.textContent = 'Ошибка сети: ' + error.message;
            return;
        }
        if (!data || data.error) {
            resBox.textContent = 'Ошибка: ' + ((data && data.error) || 'Нет ответа от сервера.');
            return;
        }

        // Используем значения, которые вернул сервер; рулетка не выбирает награду.
        currentCoins = data.newCoins;
        currentInventory = data.newInventory;
        currentItemPoints = data.newItemPoints;
        updateUI();

        if (!data.droppedItem) {
            resBox.textContent = data.message || 'Кейс открыт, но сервер не вернул предмет.';
            return;
        }

        // Звуки кейсов независимы от настройки звуков тараканов.
        playIndependentAudio('case-open-audio');
        await runCaseRoulette(price, data.droppedItem);
        if (account !== currentAuthUserId) return;

        const item = data.droppedItem;
        if (item.name !== 'Вам не повезло') playIndependentAudio('case-win-audio');
        else playIndependentAudio('case-lose-audio');
        const detailsButton = document.createElement('button');
        detailsButton.className = 'info-btn';
        detailsButton.style.width = '150px';
        detailsButton.textContent = 'Подробнее';
        detailsButton.addEventListener('click', () => openItemInfo(item.name));

        const resultCard = document.createElement('div');
        resultCard.style.cssText = 'background:#fff;border:2px solid #000;padding:15px;display:flex;flex-direction:column;align-items:center;gap:10px;color:#000;';
        // Показываем картинку выпавшего предмета и в блоке результата под кейсами.
        if (item.img) {
            const itemImage = document.createElement('img');
            itemImage.src = item.img;
            itemImage.alt = item.name || 'Выпавший предмет';
            itemImage.style.cssText = 'display:block;width:150px;height:120px;object-fit:contain;margin:0 auto 8px;';
            itemImage.onerror = () => { itemImage.style.display = 'none'; };
            resultCard.appendChild(itemImage);
        }
        const itemName = document.createElement('div');
        itemName.className = `rarity-${item.rarity || 'Обычное'}`;
        itemName.style.fontSize = '20px';
        itemName.textContent = item.name;
        resultCard.appendChild(itemName);
        if (item.name === 'Вам не повезло') {
            const message = document.createElement('div');
            message.textContent = data.message || 'Вам не повезло!';
            resultCard.appendChild(message);
        }
        resultCard.appendChild(detailsButton);
        resBox.replaceChildren(resultCard);
        resBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { if (account !== currentAuthUserId) return;
        console.error('Ошибка открытия кейса:', e);
        resBox.textContent = 'Ошибка открытия кейса: ' + e.message;
    } finally {
        caseOpeningInProgress = false;
    }
}

async function renderInventory() {
    const list = document.getElementById('inventory-list'); list.innerHTML = 'Загрузка...';
    const { data: myListings } = closedTestMode ? { data: [] } : await supabaseClient.from('marketplace').select('*').eq('seller', currentUser);
    list.innerHTML = ''; let processedInv = getProcessedInventory();
    if (processedInv.length === 0 && (!myListings || myListings.length === 0)) { list.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Пусто.</p>'; return; }
    processedInv.forEach((item) => {
        const div = document.createElement('div'); div.className = 'inv-card';
        if (item.qty > 1) div.innerHTML += `<div class="qty-badge">x${item.qty}</div>`;
        div.innerHTML += `
            ${getImgTag(item.img)}
            <div class="inv-card-name"><span class="rarity-${escapeHtml(item.rarity)}">${escapeHtml(item.name)}</span></div>
            <div class="inv-card-buttons">
                <button onclick="sellItem(${safeInlineArg(item.name)})" ${closedTestMode ? 'disabled title="Торговля отключена в закрытом тесте"' : ''} style="background-color: #90ee90;">Продать</button>
                <button class="info-btn" onclick="openItemInfo(${safeInlineArg(item.name)})">Подробнее</button>
            </div>
        `;
        list.appendChild(div);
    });
    if (myListings) {
        myListings.forEach(item => {
            const div = document.createElement('div'); div.className = 'inv-card'; div.style.backgroundColor = '#ffdddd';
            div.innerHTML = `
                ${getImgTag(item.img)}
                <div class="inv-card-name"><span class="rarity-${escapeHtml(item.rarity)}">${escapeHtml(item.item_name)}</span></div>
                <div style="font-size:10px; color:red; margin-bottom:5px;">На продаже: ${item.price}</div>
                <div class="inv-card-buttons">
                    <button onclick="removeListing(${item.id})" style="background-color: #ffcccb;">Снять</button>
                    <button class="info-btn" onclick="openItemInfo(${safeInlineArg(item.item_name)})">Подробнее</button>
                </div>
            `;
            list.appendChild(div);
        });
    }
}

async function sellItem(itemName) {
    const account = currentAuthUserId;
    const realItem = currentInventory.find(i => i.name === itemName);
    if (!realItem) { alert("Предмет не найден!"); return; }
    const price = prompt(`За сколько монет продать "${realItem.name}"?`, 50);
    if (!price || isNaN(price) || price <= 0) return;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'sell_item', username: currentUser, data: { item: realItem, price: parseInt(price) } } });
        if (account !== currentAuthUserId) return;
        if (error) alert("Ошибка сети: " + error.message); else if (data.error) alert(data.error);
        else { currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); renderInventory(); alert("Выставлено на рынок!"); }
    } catch(e) { if (account !== currentAuthUserId) return; alert("Фатальная ошибка: " + e.message); }
}

async function removeListing(listing_id) {
    const account = currentAuthUserId;
    if (!confirm("Снять лот с продажи?")) return;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'remove_listing', username: currentUser, data: { listing_id: listing_id } } });
        if (account !== currentAuthUserId) return;
        if (error) alert("Ошибка сети: " + error.message); else if (data.error) alert(data.error);
        else { currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); renderInventory(); alert("Лот снят с продажи."); }
    } catch(e) { if (account !== currentAuthUserId) return; alert("Фатальная ошибка: " + e.message); }
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
                    <b class="rarity-${escapeHtml(item.rarity)}">${escapeHtml(item.item_name)}</b><br>
                    <small>Продавец: ${escapeHtml(item.seller)}</small>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; width:100px;">
                ${actionBtn}
                <button class="info-btn" onclick="openItemInfo(${safeInlineArg(item.item_name)})">Подробнее</button>
            </div>
        `;
        list.appendChild(div);
    });
}

async function buyItem(listing_id) {
    const account = currentAuthUserId;
    if (!confirm("Купить предмет?")) return;
    try {
        const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'buy_item', username: currentUser, data: { listing_id: listing_id } } });
        if (account !== currentAuthUserId) return;
        if (error) alert("Ошибка сети: " + error.message); else if (data.error) alert(data.error);
        else { currentCoins = data.newCoins; currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); renderMarket(); alert("Успешно куплено!"); }
    } catch(e) { if (account !== currentAuthUserId) return; alert("Фатальная ошибка: " + e.message); }
}

async function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;
    tbody.replaceChildren();
    const loading = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.colSpan = 6;
    loadingCell.textContent = 'Загрузка...';
    loading.appendChild(loadingCell);
    tbody.appendChild(loading);

    const { data, error } = await supabaseClient.from('player_public_profiles').select('username, max_score, item_points, pvp_pts');
    if (error || !Array.isArray(data)) {
        loadingCell.textContent = 'Не удалось загрузить таблицу.';
        return;
    }

    const sorted = data
        .map(u => ({ ...u, total: (Number(u.max_score) || 0) + (Number(u.item_points) || 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    tbody.replaceChildren();
    sorted.forEach((u, i) => {
        const tr = document.createElement('tr');
        if (u.username === currentUser) tr.style.backgroundColor = '#FFFF00';
        const cells = [
            String(i + 1),
            String(u.username ?? ''),
            String(Number(u.pvp_pts) || 0),
            String(Number(u.max_score) || 0),
            String(Number(u.item_points) || 0)
        ];
        cells.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });
        const actionCell = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.style.fontSize = '12px';
        button.textContent = 'Профиль';
        button.addEventListener('click', () => viewProfile(String(u.username ?? '')));
        actionCell.appendChild(button);
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
    });
}

async function viewProfile(username) {
    const modal = document.getElementById('profile-modal');
    const nameEl = document.getElementById('prof-name'); const statsEl = document.getElementById('prof-stats'); const invEl = document.getElementById('prof-inventory');
    nameEl.textContent = "Профиль: " + username; statsEl.innerHTML = "Загрузка..."; invEl.innerHTML = ''; modal.classList.remove('hidden');
    const { data, error } = await supabaseClient.from('player_public_profiles').select('*').eq('username', username).single();
    if (error || !data) { statsEl.textContent = "Ошибка."; return; }
    const state = onlineChannel ? onlineChannel.presenceState() : {};
    const isOnline = state[username] !== undefined;
    let onlineStatusHtml = isOnline ? '<span style="color: #00ff00; font-weight: bold;">● ОНЛАЙН</span>' : '<span style="color: #ff0000; font-weight: bold;">● ОФФЛАЙН</span>';
    let createdStr = data.created_at ? new Date(data.created_at).toLocaleString('ru-RU') : 'Неизвестно';
    let lastOnlineStr = data.last_online ? new Date(data.last_online).toLocaleString('ru-RU') : 'Неизвестно';
    const maxF = data.rpg_max_floors && typeof data.rpg_max_floors === 'object' ? data.rpg_max_floors : {};
    const ups = data.rpg_upgrades && typeof data.rpg_upgrades === 'object' ? data.rpg_upgrades : {};
    const safeNumber = value => {
        const n = Number(value);
        return Number.isFinite(n) ? Math.max(0, Math.min(1000000, n)) : 0;
    };
    statsEl.innerHTML = `
        Статус: ${onlineStatusHtml}<br>Зареган: ${escapeHtml(createdStr)}<br>Был в сети: ${escapeHtml(lastOnlineStr)}<hr style="margin: 5px 0;">
        <b>PTS: <span style="color:orange;">${safeNumber(data.pvp_pts)}</span></b> | Общий счет: ${safeNumber(data.max_score) + safeNumber(data.item_points)}<hr style="margin: 5px 0;">
        <b>Тараканов переебашил за всё время:</b> ${safeNumber(ups.roachKills)}<br><hr style="margin: 5px 0;">
        <b>Статы РПГ:</b><br>
        <span style="color: #d32f2f;">Ashab:</span> Этаж ${safeNumber(maxF.ashab).toFixed(1)} | HP ур.${safeNumber(ups.ashab?.hp)} | ATK ур.${safeNumber(ups.ashab?.atk)}<br>
        <span style="color: #d32f2f;">Apostol:</span> Этаж ${safeNumber(maxF.apostol).toFixed(1)} | HP ур.${safeNumber(ups.apostol?.hp)} | ATK ур.${safeNumber(ups.apostol?.atk)}<br>
        <span style="color: #d32f2f;">Мээ:</span> Этаж ${safeNumber(maxF.mee).toFixed(1)} | HP ур.${safeNumber(ups.mee?.hp)} | ATK ур.${safeNumber(ups.mee?.atk)}
    `;
    const { data: marketItems } = closedTestMode ? { data: [] } : await supabaseClient.from('marketplace').select('*').eq('seller', username);
    let inv = Array.isArray(data.inventory) ? data.inventory : [];
    let grouped = Object.create(null); inv.forEach(item => { const key = String(item?.name ?? ''); if (!grouped[key]) grouped[key] = { ...item, qty: 0 }; grouped[key].qty++; });
    let processedInv = Object.values(grouped).sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));
    if (processedInv.length === 0 && (!marketItems || marketItems.length === 0)) { invEl.innerHTML = "<p style='grid-column: 1/-1;'>Инвентарь пуст.</p>"; }
    else {
        processedInv.forEach(item => {
            const div = document.createElement('div'); div.className = 'inv-card';
            if (item.qty > 1) div.innerHTML += `<div class="qty-badge">x${item.qty}</div>`;
            div.innerHTML += `
                ${getImgTag(item.img)}
                <div class="inv-card-name"><span class="rarity-${escapeHtml(item.rarity)}">${escapeHtml(item.name)}</span></div>
                <div class="inv-card-buttons">
                    <button class="info-btn" onclick="openItemInfo(${safeInlineArg(item.name)})">Подробнее</button>
                </div>
            `;
            invEl.appendChild(div);
        });
        if (marketItems) {
            marketItems.forEach(item => {
                const div = document.createElement('div'); div.className = 'inv-card'; div.style.backgroundColor = '#ffdddd';
                div.innerHTML = `
                    ${getImgTag(item.img)}
                    <div class="inv-card-name"><span class="rarity-${escapeHtml(item.rarity)}">${escapeHtml(item.item_name)}</span></div>
                    <div style="font-size:10px; color:red; margin-bottom:5px;">На продаже</div>
                    <div class="inv-card-buttons">
                        <button class="info-btn" onclick="openItemInfo(${safeInlineArg(item.item_name)})">Подробнее</button>
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
            if (item.rarity === 'Обычное') effectText = "Лечит 15% макс. HP";
            if (item.rarity === 'Редкое' && item.name !== 'парашник' && item.name !== 'картофель') effectText = "+15 к Атаке";
            if(item.name === 'картофель') effectText = "+15% урона на следующий удар";
            if(item.name === 'голова барана') effectText = "20% макс. HP врага";
            if(item.name === 'коала') effectText = "100 маны";
            if(item.name === 'apostol') effectText = "55% макс. HP врага";
            if(item.name === 'парашник') effectText = "Яд: 5% HP и 15% маны/ход";
            if(item.name === 'boris') effectText = "Щит на 40% макс. HP";
            if(item.name === 'шприц и лекарство') effectText = "Лечит 45% макс. HP";
            if(item.name === 'Сбриватель хуйни') effectText = "Борис врага −50% HP; удаляет его Парашника на тебе";
            const div = document.createElement('div'); div.className = 'inv-card';
            if (item.qty > 1) div.innerHTML += `<div class="qty-badge">x${item.qty}</div>`;
            div.innerHTML += `
                ${getImgTag(item.img)}
                <div class="inv-card-name"><span class="rarity-${escapeHtml(item.rarity)}">${escapeHtml(item.name)}</span></div>
                <div style="font-size:10px; margin-bottom:5px;">${effectText}</div>
                <div class="inv-card-buttons">
                    <button onclick="useItemInBattle(${safeInlineArg(item.name)})" style="background-color: #90ee90;">${btnText}</button>
                    <button class="info-btn" onclick="openItemInfo(${safeInlineArg(item.name)})">Подробнее</button>
                </div>
            `;
            list.appendChild(div);
        });
    }
    document.getElementById('rpg-item-modal').classList.remove('hidden');
}
function closeItemMenu() { document.getElementById('rpg-item-modal').classList.add('hidden'); }

async function useItemInBattle(itemName) {
    const isCurrentBattle = captureRpgBattle();
    const inventoryOwner = currentAuthUserId;
    if (!isPlayerTurn || !isCurrentBattle()) return;
    rpgBonusAttacks = 0;
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
        if (!error && data?.success) {
            if (currentAuthUserId === inventoryOwner) { currentInventory = data.newInventory; currentItemPoints = data.newItemPoints; updateUI(); }
        } else {
            if (isCurrentBattle()) { addLog("Ошибка при использовании."); isPlayerTurn = true; rpgItemUsed = false; checkButtons(); }
            return;
        }
    } catch(e) {
        if (isCurrentBattle()) { addLog("Фатальная ошибка сервера."); isPlayerTurn = true; rpgItemUsed = false; checkButtons(); }
        return;
    }
    if (!isCurrentBattle()) return;
    const applyEffect = () => {
        if (!isCurrentBattle()) return;
        if (item.name === 'хуйня') { const heal = percentOf(rpgChar.maxHp, 15); rpgChar.hp = Math.min(rpgChar.maxHp, rpgChar.hp + heal); addLog(`Использовал ${item.name}: +${heal} HP (15% максимального здоровья).`); playSoundEffect('heal'); }
        else if (item.name === 'картофель') { rpgPotatoBuff = true; addLog('Сожрал картофель: следующий обычный удар нанесёт на 15% больше урона!'); }
        else if (item.name === 'голова барана') { 
            let dmg = percentOf(rpgEnemy.maxHp, 20);
            if (rpgEnemyBorisHp > 0) { rpgEnemyBorisHp -= dmg; addLog(`Швырнул голову в Бориса!`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp=0; addLog("Борис разрушен!"); } }
            else { rpgEnemy.hp -= dmg; addLog(`Швырнул ${item.name}. ${dmg} урона!`); }
        }
        else if (item.name === 'коала') { rpgMana = 100; addLog(`Использовал ${item.name}. Мана 100!`); }
        else if (item.name === 'apostol') { 
            let dmg = percentOf(rpgEnemy.maxHp, 55);
            if(rpgEnemyBorisHp > 0) { rpgEnemyBorisHp -= dmg; addLog(`Швырнул Apostol в Бориса!`); if(rpgEnemyBorisHp <= 0) { rpgEnemyBorisHp=0; addLog("Борис разрушен!"); } }
            else { rpgEnemy.hp -= dmg; addLog(`ПРИЗВАН APOSTOL! ${dmg} УРОНА!`); }
        }
        else if (item.name === 'шприц и лекарство') { const heal = percentOf(rpgChar.maxHp, 45); rpgChar.hp = Math.min(rpgChar.maxHp, rpgChar.hp + heal); addLog(`Шприц восстановил ${heal} HP (45% максимального здоровья).`); playSoundEffect('heal'); }
        else if (item.name === 'boris') { rpgPlayerBorisHp += percentOf(rpgChar.maxHp, 40); addLog(`Ты поставил Бориса!`); }
        else if (item.name === 'парашник') { rpgEnemyParashnikHp += 30; addLog(`Ты поставил Парашника врагу!`); }
        else if (item.name === 'Сбриватель хуйни') { if (rpgEnemyBorisHp > 0) { rpgEnemyBorisHp = Math.ceil(rpgEnemyBorisHp / 2); addLog(`Сбриватель срезал половину HP Бориса врага. Осталось ${rpgEnemyBorisHp} HP.`); } if (rpgPlayerParashnikHp > 0) { rpgPlayerParashnikHp = 0; addLog('Сбрил Парашника врага, который отравлял тебя.'); } addLog('Твой Борис и твой Парашник на враге остались нетронуты!'); }
        else if (item.name === 'Вам не повезло') { addLog(`Вы нихуя не сделали.`); }
        updateRpgUI(); 
        if (rpgEnemy.hp <= 0) winRpg(); else {
            if (rpgEnemyParashnikHp > 0 && item.name !== 'Сбриватель хуйни') {
                const poisonDmg = percentOf(rpgEnemy.maxHp, 5); const poisonMana = 15;
                rpgEnemy.hp -= poisonDmg; rpgEnemy.mp = Math.max(0, (rpgEnemy.mp||0) - poisonMana);
                addLog(`Враг отравлен парашником! -${poisonDmg} HP (5%), -${poisonMana} маны (15%).`); rpgEnemyParashnikHp = Math.max(0, rpgEnemyParashnikHp - 10); if (rpgEnemyParashnikHp === 0) addLog('Парашник на враге развалился сам!'); updateRpgUI();
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
let simonGeneration = 0;
const simonTimers = new Set();
function cancelSimonGame() {
    simonGeneration++;
    simonTimers.forEach(clearTimeout); simonTimers.clear();
    gameStarted = false; canClick = false; isPlayingSequence = false;
}
function scheduleSimon(callback, delay) {
    const generation = simonGeneration, account = currentAuthUserId;
    const timer = setTimeout(() => {
        simonTimers.delete(timer);
        if (generation === simonGeneration && account === currentAuthUserId) callback();
    }, delay);
    simonTimers.add(timer);
    return timer;
}

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
    cancelSimonGame();
    gameSequence = []; level = 1; maxPads = 1; gameStarted = false; restartBtn.classList.add('hidden');
    statusText.textContent = "привет ножми"; statusText.style.color = "#00FF00"; pads.forEach(p => p.classList.add('disabled')); updateActivePads();
}

function startSimonGame() {
    cancelSimonGame();
    gameSequence = [];
    playerSequence = [];
    level = 1;
    maxPads = 1;
    gameStarted = true;
    canClick = false;
    isPlayingSequence = false;
    restartBtn.classList.add('hidden');
    statusText.style.color = "#00FF00";
    updateActivePads();
    nextRound();
}

function updateActivePads() { pads.forEach(p => { const id = parseInt(p.dataset.id); if (id <= maxPads) p.classList.remove('disabled'); else p.classList.add('disabled'); }); }
function nextRound() {
    playerSequence = []; statusText.textContent = "ЗАПОМИНАЙТЕ...";
    if (level > 1 && level % 2 === 0 && maxPads < 4) { maxPads++; updateActivePads(); }
    const randomId = Math.floor(Math.random() * maxPads) + 1; gameSequence.push(randomId.toString()); scheduleSimon(playSequence, 500);
}
function playSequence() {
    isPlayingSequence = true; canClick = false;
    gameSequence.forEach((id, index) => {
        scheduleSimon(() => {
            playSound(id);
            if (index === gameSequence.length - 1) { scheduleSimon(() => { isPlayingSequence = false; canClick = true; statusText.textContent = "ВАШ ХОД!"; }, 400); }
        }, index * 600);
    });
}
async function handlePadClick(e) {
    if (!canClick || isPlayingSequence || !gameStarted) return;
    const generation = simonGeneration, account = currentAuthUserId;
    const isCurrentSimon = () => generation === simonGeneration && account === currentAuthUserId;
    const id = e.currentTarget.dataset.id; playSound(id); playerSequence.push(id);
    const currentStep = playerSequence.length - 1;
    if (playerSequence[currentStep] !== gameSequence[currentStep]) {
        canClick = false; gameStarted = false; statusText.textContent = "ОШИБКА!"; statusText.style.color = "#FF0000";
        // Учитываем только полностью пройденные раунды. Первый завершённый раунд тоже оплачивается.
        const currentScore = Math.max(0, level - 1);
        try {
            const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: { action: 'score', username: currentUser, data: { rounds: currentScore } } });
            if (!isCurrentSimon()) return;
            if (error) { statusText.textContent += ` (Ошибка сети: награда не подтверждена)`; }
            else if (data.rewardPaused) { statusText.textContent = `ОШИБКА! Пройдено раундов: ${currentScore}. Онлайн-рекорд и награда временно не сохраняются до серверной проверки.`; }
            else if (data.error) { statusText.textContent += ` (${data.error})`; }
            else {
                currentCoins = data.newCoins;
                if (currentScore > currentHighScore) currentHighScore = currentScore;
                updateUI();
                if (data.earned > 0) {
                    statusText.textContent = `ОШИБКА! Пройдено раундов: ${currentScore}. Получено +${data.earned} монет.`;
                } else {
                    statusText.textContent = 'ОШИБКА! Ни одного раунда не пройдено — награда не начислена.';
                }
            }
        } catch(e) { if (!isCurrentSimon()) return; statusText.textContent += ` (Сбой при начислении награды)`; }
        const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1);
        osc.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 1); restartBtn.classList.remove('hidden'); return;
    }
    if (playerSequence.length === gameSequence.length) {
        canClick = false;
        const completedRound = gameSequence.length;
        level++;
        statusText.textContent = `РАУНД ${completedRound} ПРОЙДЕН! Награды ожидают серверной проверки.`;
        scheduleSimon(nextRound, 1500);
    }
}

pads.forEach(pad => pad.addEventListener('click', handlePadClick));
restartBtn.addEventListener('click', startSimonGame);
statusText.addEventListener('click', () => { if (!gameStarted) startSimonGame(); });

function openFreeOTPWindow() {
    const modal = document.getElementById("freeotp-modal");
    if (modal) modal.style.display = "flex";
}

function closeFreeOTPWindow() {
    const modal = document.getElementById("freeotp-modal");
    if (modal) modal.style.display = "none";
}

function showDemoFreeOTP() {
    const setup = document.getElementById("freeotp-demo-setup");
    const qr = document.getElementById("freeotp-demo-qr");

    if (!setup || !qr) return;

    const demoText = "Unable to";

    qr.src =
        "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" +
        encodeURIComponent(demoText);

    setup.style.display = "block";
}

function checkDemoFreeOTP() {
    const input = document.getElementById("freeotp-demo-code");
    const message = document.getElementById("freeotp-demo-message");

    if (!input || !message) return;

    if (!/^\d{6}$/.test(input.value.trim())) {
        message.textContent = "Введи 6 цифр из приложения";
        return;
    }

    message.textContent =
        "Хуйня ебаная. Ты какую-то лажу ввёл мне нахуй. 2FA не включена.";
}

document.getElementById("freeotp-modal")?.addEventListener("click", function(event) {
    if (event.target === this) closeFreeOTPWindow();
});


/* === ШАХМАТЫ ПРОТИВ STOCKFISH === */
(() => {
  const pieceFiles = {
    w: { k: 'king.png', q: 'queen.png', r: 'rook.png', b: 'bishop.png', n: 'knight.png', p: 'pawn.png' },
    b: { k: 'kingb.png', q: 'queenb.png', r: 'rookb.png', b: 'bishopb.png', n: 'knightb.png', p: 'pawnb.png' }
  };
  const levels = {
    1: { depth: null, random: 100, best: 0, alternative: 0 },
    2: { depth: 2, random: 35, best: 15, alternative: 50 },
    3: { depth: 4, random: 15, best: 30, alternative: 55 },
    4: { depth: 7, random: 5, best: 55, alternative: 40 },
    5: { depth: 12, random: 0, best: 85, alternative: 15 }
  };
  let game = null, engine = null, engineReady = false, engineBusy = false;
  // Список ходов, которые Stockfish вернул через MultiPV для текущей позиции.
  let enginePvCandidates = new Map();
  let enginePvDepth = 0;
  let engineSearchFen = null;
  let humanColor = 'w', level = 3, selectedSquare = null, legalTargets = [], ended = false;
  let onlineChessMode = false, onlineChessRoomId = null, onlineChessChannel = null, onlineChessOpponent = '', applyingRemoteChessMove = false;
  window.appendOnlineChessChat = (...args) => appendOnlineChessChat(...args);
  const $ = id => document.getElementById(id);
  const boardEl = () => $('chess-board');

  function setStatus(text) { if ($('chess-status')) $('chess-status').textContent = text; }
    function appendOnlineChessChat(nick, text) {
    const box = document.getElementById('chess-chat-messages');
    if (!box) return;

    const row = document.createElement('div');
    row.className = 'chess-chat-message';

    const name = document.createElement('span');
    name.className = 'chess-chat-nick';
    name.textContent = nick + ': ';

    const message = document.createElement('span');
    message.textContent = text;

    row.append(name, message);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
}
  function setEngineStatus(text) { if ($('chess-engine-status')) $('chess-engine-status').textContent = text; }
  function setOnlineTurnStatus() {
    if (!onlineChessMode || !game || ended) return;
    const statusEl = $('chess-engine-status');
    if (statusEl) { statusEl.textContent = game.turn() === humanColor ? 'ТВОЙ ХОД' : 'ХОД ПРОТИВНИКА'; statusEl.classList.add('online-turn-status'); }
  }
  // MP3-файлы лежат в корне сайта рядом с index.html и script.js
  const chessSounds = {
    move: new Audio('chess-move.mp3'),
    win: new Audio('chess-win.mp3'),
    lose: new Audio('chess-lose.mp3'),
    draw: new Audio('chess-draw.mp3')
  };
  let chessResultSoundPlayed = false;

  function playChessSound(sound) {
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  function playMoveSound(move) {
    if (!game || !move) return;
    playChessSound(chessSounds.move);
  }

  function playChessResultSound(result) {
    if (chessResultSoundPlayed) return;
    chessResultSoundPlayed = true;
    playChessSound(chessSounds[result]);
  }
  // === КОНЕЦ ЗВУКОВ ===

  function startEngine() {
    if (engine) return;
    try {
      const workerCode = "importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');";
      const workerUrl = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
      engine = new Worker(workerUrl);
      engine.onmessage = event => {
        const line = String(event.data || '');

        if (line === 'uciok') {
          // Настройки движка применяются до первого поиска.
          configureEngine();
        } else if (line === 'readyok') {
          engineReady = true;
          if (!onlineChessMode) {
            setEngineStatus('PEPENAI: подключён');
            if (game && !ended) {
              if (game.turn() !== humanColor) {
                askEngineMove();
              } else {
                setStatus(humanColor === 'w' ? 'Твой ход — белые.' : 'Твой ход — чёрные.');
              }
            }
          }
        } else if (line.startsWith('info ')) {
          // Сохраняем MultiPV-кандидаты только для текущей позиции и самой глубокой итерации.
          if (!engineBusy || !engineSearchFen || !game || game.fen() !== engineSearchFen) return;
          const depthMatch = line.match(/\bdepth\s+(\d+)/);
          const pvMatch = line.match(/\bmultipv\s+(\d+)/);
          const moveMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (!depthMatch || !pvMatch || !moveMatch) return;

          const depth = Number(depthMatch[1]);
          const rank = Number(pvMatch[1]);
          if (depth > enginePvDepth) {
            enginePvDepth = depth;
            enginePvCandidates.clear();
          }
          if (depth === enginePvDepth && rank >= 1 && rank <= 5) {
            enginePvCandidates.set(rank, moveMatch[1]);
          }
        } else if (line.startsWith('bestmove')) {
          if (onlineChessMode) {
            engineBusy = false;
            return;
          }
          // Игнорируем bestmove от stop/старого поиска, если для него нет активной позиции.
          if (!engineBusy || !engineSearchFen) return;
          engineBusy = false;

          const match = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (!match || !game || ended) {
            enginePvCandidates.clear();
            engineSearchFen = null;
            enginePvDepth = 0;
            return;
          }

          const positionAtReply = engineSearchFen || game.fen();
          const gameAtReply = game, accountAtReply = currentAuthUserId;
          if (game.fen() !== positionAtReply) {
            enginePvCandidates.clear();
            engineSearchFen = null;
            enginePvDepth = 0;
            return;
          }

          const uci = chooseEngineMove(match[1]);
          enginePvCandidates.clear();
          engineSearchFen = null;
          enginePvDepth = 0;

          if (!uci) return;

          // Небольшая пауза для естественного ощущения, что бот обдумывает ход.
          setStatus('PEPENAI обдумывает ход…');
          window.setTimeout(() => {
            if (game !== gameAtReply || currentAuthUserId !== accountAtReply) return;
            if (!game || ended || game.fen() !== positionAtReply) return;
            try {
              const from = uci.slice(0, 2), to = uci.slice(2, 4);
              const movingPiece = capturePieceForAnimation(from);
              const playedMove = game.move({
                from,
                to,
                promotion: uci[4] || 'q'
              });
              if (!playedMove) throw new Error('Stockfish выбрал недопустимый ход');
              playMoveSound(playedMove);
              selectedSquare = null;
              legalTargets = [];
              renderBoard();
              animatePieceMove(movingPiece, to);
              updateGameStatus();
            } catch (e) {
              console.error('Ошибка хода PEPENAI:', e);
              setStatus('Не удалось применить ход движка. Начни новую партию.');
            }
          }, 1000);
        } else if (line.startsWith('id name')) {
          if (!onlineChessMode) setEngineStatus('Stockfish: ' + line.slice(7));
        }
      };
      engine.onerror = () => {
        engineReady = false;
        engineBusy = false;
        if (!onlineChessMode) {
          setEngineStatus('PEPENAI: ошибка загрузки');
          setStatus('Не удалось загрузить PEPENAI. Проверь подключение к интернету и перезагрузи страницу.');
        }
      };
      engine.postMessage('uci');
    } catch (e) {
      setEngineStatus('PEPENAI: недоступен');
      setStatus('Браузер не смог запустить PEPENAI. Проверь интернет и настройки безопасности.');
    }
  }
  async function startGame() {
    chessResultSoundPlayed = false;
    try {
      onlineChessMode = false;
      onlineChessRoomId = null;
      onlineChessChannel = null;
      $('chess-opponent-name')?.classList.add('hidden');
      $('chess-engine-status')?.classList.remove('online-turn-status');
      setStatus('Загружаю шахматную библиотеку…');
      const chessModule = await import('https://cdn.jsdelivr.net/npm/chess.js@1.0.0/+esm');
      const ChessClass = chessModule.Chess;
      if (typeof ChessClass !== 'function') {
        throw new Error('Библиотека chess.js не экспортирует Chess');
      }

      humanColor = $('chess-color').value;
      level = Number($('chess-level').value) || 3;
      game = new ChessClass();

      ended = false;
      chessRewardClaimed = false;
      selectedSquare = null;
      legalTargets = [];
      engineBusy = false;

      $('chess-setup').classList.add('hidden');
      $('chess-play').classList.remove('hidden');
      renderBoard();

      if (level === 1) {
        // Первый уровень вообще не запускает Stockfish: только случайные легальные ходы.
        engineBusy = false;
        setEngineStatus('Уровень 1: 100% случайные ходы');
      } else {
        startEngine();
        // Если Worker уже загружен, применяем настройки нового уровня.
        // Если ещё загружается, configureEngine() вызовется после uciok.
        if (engineReady) configureEngine();
      }

      if (humanColor === 'b') {
        if (level === 1) {
          setStatus('Лёгкий бот думает…');
          askEngineMove();
        } else {
          setStatus('Загружаю PEPENAI. Подожди первого хода…');
          if (engineReady) askEngineMove();
        }
      } else {
        setStatus(level === 1 ? 'Твой ход — белые.' : 'Твой ход — белые. PEPENAI загружается…');
      }
    } catch (error) {
      console.error('Ошибка запуска шахмат:', error);
      setStatus('Ошибка загрузки шахмат: ' + error.message);
      setEngineStatus('Не удалось загрузить chess.js');
    }
  }
  function configureEngine() {
    if (!engine) return;

    // Skill Level 20 нужен, чтобы MultiPV показывал честный рейтинг вариантов,
    // а слабость уровней задавалась глубиной и вероятностями из таблицы.
    engineReady = false;
    engineBusy = false;
    engineSearchFen = null;
    enginePvDepth = 0;
    enginePvCandidates.clear();

    engine.postMessage('stop');
    engine.postMessage('setoption name Skill Level value 20');
    engine.postMessage('setoption name MultiPV value 5');
    engine.postMessage('isready');
  }

  function moveToUci(move) {
    return move ? move.from + move.to + (move.promotion || '') : null;
  }

  function randomLegalMoveUci(excludeUci = null) {
    if (!game) return null;
    const moves = game.moves({ verbose: true })
      .map(moveToUci)
      .filter(uci => uci && uci !== excludeUci);
    if (!moves.length) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function chooseEngineMove(bestUci) {
    const cfg = levels[level];
    if (!cfg || !game) return bestUci;

    const roll = Math.random() * 100;

    // Сначала проверяем долю полностью случайных легальных ходов.
    if (roll < cfg.random) {
      return randomLegalMoveUci() || bestUci;
    }

    // Следующая доля — лучший ход, который Stockfish вернул как bestmove.
    if (roll < cfg.random + cfg.best) {
      return bestUci;
    }

    // Остаток заданного процента — альтернативные варианты Stockfish №2–5.
    if (roll < cfg.random + cfg.best + cfg.alternative) {
      const alternatives = Array.from(enginePvCandidates.entries())
      .filter(([rank, uci]) => rank > 1 && uci && uci !== bestUci)
      .sort((a, b) => a[0] - b[0])
      .map(([, uci]) => uci);

      if (alternatives.length) {
        return alternatives[Math.floor(Math.random() * alternatives.length)];
      }

      // Резерв на случай, если движок не вернул строки MultiPV №2–5.
      // Не подменяем альтернативу лучшим ходом, пока есть другие легальные ходы.
      return randomLegalMoveUci(bestUci) || bestUci;
    }

    return bestUci;
  }

  function askEngineMove() {
    if (onlineChessMode || engineBusy || ended || !game ||
        game.turn() === humanColor) return;

    // Уровень 1: 100% случайные допустимые ходы; Stockfish не нужен.
    if (level === 1) {
      engineBusy = true;
      setStatus('Лёгкий бот думает…');
      const positionAtStart = game.fen();
      const gameAtStart = game, accountAtStart = currentAuthUserId;

      window.setTimeout(() => {
        if (game !== gameAtStart || currentAuthUserId !== accountAtStart) return;
        if (!game || ended || game.fen() !== positionAtStart) {
          engineBusy = false;
          return;
        }

        const moves = game.moves({ verbose: true });
        if (!moves.length) {
          engineBusy = false;
          return;
        }

        const move = moves[Math.floor(Math.random() * moves.length)];
        const movingPiece = capturePieceForAnimation(move.from);
        const playedMove = game.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || 'q'
        });

        selectedSquare = null;
        legalTargets = [];
        renderBoard();
        animatePieceMove(movingPiece, move.to);
        playMoveSound(playedMove);
        updateGameStatus();
        engineBusy = false;
      }, 1000);

      return;
    }

    if (!engine || !engineReady) {
      setStatus('Загружаю PEPENAI. Подожди первого хода…');
      return;
    }

    const cfg = levels[level];
    if (!cfg || !cfg.depth) return;

    engineBusy = true;
    enginePvCandidates.clear();
    enginePvDepth = 0;
    engineSearchFen = game.fen();

    setStatus('PEPENAI рассчитывает ход...');
    engine.postMessage('position fen ' + engineSearchFen);
    engine.postMessage('go depth ' + cfg.depth);
  }

  function capturePieceForAnimation(square) {
    const board = boardEl();
    const cell = board && Array.from(board.children).find(el => el.getAttribute('aria-label') === square);
    const img = cell && cell.querySelector('img');
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return { src: img.src, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
  }
  function animatePieceMove(pieceSnapshot, targetSquare) {
    if (!pieceSnapshot) return;
    const board = boardEl();
    const targetCell = board && Array.from(board.children).find(el => el.getAttribute('aria-label') === targetSquare);
    const targetImg = targetCell && targetCell.querySelector('img');
    if (!targetCell || !targetImg) return;
    const end = targetImg.getBoundingClientRect();
    const flyer = document.createElement('img');
    flyer.src = pieceSnapshot.src;
    flyer.alt = '';
    flyer.setAttribute('aria-hidden', 'true');
    flyer.className = 'chess-moving-piece';
    Object.assign(flyer.style, {
      left: pieceSnapshot.rect.left + 'px', top: pieceSnapshot.rect.top + 'px',
      width: pieceSnapshot.rect.width + 'px', height: pieceSnapshot.rect.height + 'px'
    });
    document.body.appendChild(flyer);
    targetImg.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      flyer.style.transform = `translate(${end.left - pieceSnapshot.rect.left}px, ${end.top - pieceSnapshot.rect.top}px)`;
      flyer.style.width = end.width + 'px';
      flyer.style.height = end.height + 'px';
    });
    window.setTimeout(() => {
      flyer.remove();
      if (targetImg.isConnected) targetImg.style.visibility = '';
    }, 480);
  }
  function renderBoard() {
    const board = boardEl();
    if (!board || !game) return;
    board.innerHTML = '';
    const files = humanColor === 'w' ? 'abcdefgh' : 'hgfedcba';
    const ranks = humanColor === 'w' ? '87654321' : '12345678';
    for (const rank of ranks) for (const file of files) {
      const square = file + rank;
      const piece = game.get(square);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'chess-square ' + (((file.charCodeAt(0)-97) + Number(rank)) % 2 ? 'dark' : 'light');
      cell.setAttribute('aria-label', square);
      if (square === selectedSquare) cell.classList.add('selected');
      const target = legalTargets.find(m => m.to === square);
      if (target) cell.classList.add(target.captured ? 'capture-target' : 'move-target');
      if (piece) {
        const img = document.createElement('img');
        img.src = pieceFiles[piece.color][piece.type]; img.alt = piece.color + ' ' + piece.type;
        img.draggable = false;
        img.onerror = () => { img.style.display = 'none'; cell.textContent = ({k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'})[piece.type]; };
        cell.appendChild(img);
      } else if (target) {
        const dot = document.createElement('span'); dot.className = 'chess-move-dot'; cell.appendChild(dot);
      }
      cell.addEventListener('click', () => onSquareClick(square));
      board.appendChild(cell);
    }

    updateMaterialCounter();
  }
function updateMaterialCounter() {
    if (!game) return;

    const whiteBox = document.getElementById('chess-white-lost');
    const blackBox = document.getElementById('chess-black-lost');
    const scoreBox = document.getElementById('chess-material-score');

    if (!whiteBox || !blackBox || !scoreBox) return;

    const moves = game.history({ verbose: true });

    const pieceValues = {
        p: 1,
        n: 3,
        b: 3,
        r: 5,
        q: 9,
        k: 0
    };

    const whiteLost = [];
    const blackLost = [];

    moves.forEach(move => {
        if (!move.captured) return;

        const capturedColor = move.color === 'w' ? 'b' : 'w';
        const capturedPiece = {
            color: capturedColor,
            type: move.captured
        };

        if (capturedColor === 'w') {
            whiteLost.push(capturedPiece);
        } else {
            blackLost.push(capturedPiece);
        }
    });

    function renderLostPieces(container, pieces) {
        container.replaceChildren();

        if (pieces.length === 0) {
            container.textContent = 'Нет потерь';
            return;
        }

        pieces.forEach(piece => {
            const img = document.createElement('img');

            img.className = 'chess-lost-piece';
            img.src = pieceFiles[piece.color][piece.type];
            img.alt = piece.color === 'w'
                ? 'Белая фигура'
                : 'Чёрная фигура';
            img.title = img.alt;

            img.onerror = () => {
                img.replaceWith(
                    document.createTextNode(piece.type.toUpperCase())
                );
            };

            container.appendChild(img);
        });
    }

    renderLostPieces(whiteBox, whiteLost);
    renderLostPieces(blackBox, blackLost);

    const whiteScore = blackLost.reduce(
        (sum, piece) => sum + pieceValues[piece.type], 0
    );

    const blackScore = whiteLost.reduce(
        (sum, piece) => sum + pieceValues[piece.type], 0
    );

const difference = Math.abs(whiteScore - blackScore);

if (difference === 0) {
    scoreBox.textContent = 'Материальный баланс: Равенство';
} else if (whiteScore > blackScore) {
    scoreBox.textContent =
        `Перевес: Материальный план +${difference}`;
} else {
    scoreBox.textContent =
        `Перевес: Потусторонний мир +${difference}`;
}
}
    
  function onSquareClick(square) {
    if (onlineChessMode && !window.onlineChessDelivery?.canPlay()) return;
    if (!game || ended || engineBusy || game.turn() !== humanColor) return;
    const piece = game.get(square);
    const target = legalTargets.find(m => m.to === square);
    if (selectedSquare && target) {
      const moving = game.get(selectedSquare);
      let promotion;
      if (moving && moving.type === 'p' && (square[1] === '8' || square[1] === '1')) {
        const choice = (prompt('Превратить пешку в (q — ферзь, r — ладья, b — слон, n — конь):', 'q') || 'q').toLowerCase();
        promotion = ['q','r','b','n'].includes(choice) ? choice : 'q';
      }
      const movingPiece = capturePieceForAnimation(selectedSquare);
      const playedMove = game.move({
    from: selectedSquare,
    to: square,
    promotion: promotion || 'q'
});
playMoveSound(playedMove);
      selectedSquare = null; legalTargets = [];
      renderBoard();
      animatePieceMove(movingPiece, square);
      updateGameStatus();
      if (onlineChessMode && !applyingRemoteChessMove && onlineChessChannel) {
        window.onlineChessDelivery?.changed();
      } else if (!onlineChessMode && !ended) {
        engineBusy = false;
        askEngineMove();
      }
      return;
    }
    if (piece && piece.color === humanColor) {
      selectedSquare = square;
      legalTargets = game.moves({ square, verbose: true });
    } else {
      selectedSquare = null; legalTargets = [];
    }
    renderBoard();
  }
  let chessRewardClaimed = false;
  async function awardOfflineChessCoins() {
    if (onlineChessMode || chessRewardClaimed || !currentUser) return;
    const gameAtClaim = game, accountAtClaim = currentAuthUserId;
    const rewards = { 1: 25, 2: 50, 3: 75, 4: 150, 5: 200 };
    const opponentLevel = Number(level);
    if (!rewards[opponentLevel]) return;
    chessRewardClaimed = true;
    try {
      const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'chess_reward',
          username: currentUser,
          data: { level: opponentLevel }
        }
      });
      if (game !== gameAtClaim || accountAtClaim !== currentAuthUserId || onlineChessMode) return;
      if (error) throw error;
      if (data?.success) {
        currentCoins = Number(data.newCoins ?? currentCoins);
        updateUI();
        setStatus(`Партия завершена · +${data.earned} монет`);
      } else if (data?.rewardPaused) {
        setStatus('Партия завершена. Монеты временно не начисляются до серверной проверки результата.');
      } else {
        chessRewardClaimed = false;
        console.error('Шахматная награда не начислена:', data?.error);
      }
    } catch (e) {
      if (game !== gameAtClaim || accountAtClaim !== currentAuthUserId || onlineChessMode) return;
      chessRewardClaimed = false;
      console.error('Ошибка шахматной награды:', e);
    }
  }

  function updateGameStatus() {
    if (game.isCheckmate()) {
      ended = true;
      setStatus(game.turn() === humanColor ? 'Мат. Ты проиграл.' : 'Мат! Ты победил!');
      const playerWon = game.turn() !== humanColor;
      playChessResultSound(playerWon ? 'win' : 'lose');
      if (playerWon && !onlineChessMode) {
        awardOfflineChessCoins();
      }
    } else if (game.isDraw()) {
      ended = true; setStatus('Ничья.'); playChessResultSound('draw');
} else if (game.isCheck()) {
  if (onlineChessMode) {
    setStatus(
      game.turn() === humanColor
        ? 'ВАМ ШАХ! ВАШ ХОД.'
        : 'ШАХ СОПЕРНИКУ! ХОД ПРОТИВНИКА.'
    );
  } else {
    setStatus(
      game.turn() === humanColor
        ? 'Шах! Твой ход.'
        : 'Шах PEPENAI.'
    );
  }
    } else {
      setStatus(onlineChessMode ? (game.turn() === humanColor ? 'Твой ход.' : 'Ход противника.') : (game.turn() === humanColor ? 'Твой ход.' : 'Ход PEPENAI…'));
    }
    if (onlineChessMode) {
      if (ended) {
        setEngineStatus('ПАРТИЯ ЗАВЕРШЕНА');
        $('chess-engine-status')?.classList.add('online-turn-status');
      } else {
        setOnlineTurnStatus();
      }
    }
  }
  function resign() {
    if (!game || ended) return;
    if (onlineChessMode && onlineChessChannel) {
      window.onlineChessDelivery?.queue('resign');
    }
    ended = true; engineBusy = false;
    setStatus(onlineChessMode ? 'Ты сдался. Онлайн-партия завершена.' : 'Ты проебал. Нажми «Новая партия / сменить сложность», чтобы сыграть ещё.');
    if (onlineChessMode) setEngineStatus('ПАРТИЯ ЗАВЕРШЕНА');
  }
  function showSetup() {
    window.onlineChessDelivery?.dispose();
    window.cancelChessJoin?.();
    ended = true; engineBusy = false;
    onlineChessMode = false; onlineChessRoomId = null; onlineChessChannel = null; onlineChessOpponent = '';
    $('chess-opponent-name')?.classList.add('hidden');
    $('chess-engine-status')?.classList.remove('online-turn-status');
    $('chess-play').classList.add('hidden');
    $('chess-setup').classList.remove('hidden');
    setStatus('Выбери цвет и сложность.');
  }

  window.finishOnlineChessFromOpponent = function(roomId) {
    if (!onlineChessMode || !game || ended || roomId !== onlineChessRoomId) return;
    ended = true; engineBusy = false;
    selectedSquare = null; legalTargets = [];
    renderBoard();
    setStatus(onlineChessOpponent + ' сдался. Ты победил!');
    setEngineStatus('ПАРТИЯ ЗАВЕРШЕНА');
  };

  window.startOnlineChessBoard = async function(color, roomId, channel, opponentName) {
    const account = currentAuthUserId;
    try {
      const chessModule = await import('https://cdn.jsdelivr.net/npm/chess.js@1.0.0/+esm');
      if (currentAuthUserId !== account || !window.chessRoomIsCurrent?.(roomId, channel)) return false;
      const ChessClass = chessModule.Chess;
      if (typeof ChessClass !== 'function') throw new Error('chess.js не загрузилась');
      onlineChessMode = true; onlineChessRoomId = roomId; onlineChessChannel = channel; onlineChessOpponent = opponentName || 'Соперник';
        const chat = $('chess-online-chat');
const chatMessages = $('chess-chat-messages');
const chatInput = $('chess-chat-input');
const chatSend = $('chess-chat-send');

if (chat) chat.classList.remove('hidden');

if (chatMessages) {
    chatMessages.replaceChildren();
    const info = document.createElement('div');
    info.textContent = 'Ты подключился к чату с ' + onlineChessOpponent + '.';
    chatMessages.appendChild(info);
}

if (chatInput && chatSend && !chat.dataset.ready) {
    chat.dataset.ready = 'true';

    const sendChatMessage = () => {
        const text = chatInput.value.trim();

        if (!text || !onlineChessMode || !onlineChessChannel || !onlineChessRoomId) {
            return;
        }

        if (!window.onlineChessDelivery?.queue('chat', text)) {
            setStatus('Сообщение не отправлено: нет соединения или превышен лимит.');
            return;
        }

        appendOnlineChessChat(currentUser, text);
        chatInput.value = '';
        chatInput.focus();
    };

    chatSend.addEventListener('click', sendChatMessage);

    chatInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendChatMessage();
        }
    });
}
      if (engine) { try { engine.postMessage('stop'); } catch (_) {} }
      engineBusy = false;
      humanColor = color; game = new ChessClass(); ended = false;
      selectedSquare = null; legalTargets = [];
      $('chess-setup').classList.add('hidden');
      $('chess-play').classList.remove('hidden');
      $('chess-multiplayer-menu')?.classList.add('hidden');
      $('chess-multiplayer-panel')?.classList.add('hidden');
      if ($('chess-opponent-name')) {
        $('chess-opponent-name').textContent = 'СОПЕРНИК: ' + onlineChessOpponent;
        $('chess-opponent-name').classList.remove('hidden');
      }
      if ($('chess-engine-status')) { $('chess-engine-status').textContent = ''; $('chess-engine-status').classList.add('online-turn-status'); }
      renderBoard();
      setStatus(color === 'w' ? 'Твой ход.' : 'Ход противника.');
      setOnlineTurnStatus();
      return true;
    } catch (error) { setStatus('Не удалось запустить онлайн-шахматы: ' + error.message); return false; }
  };

  window.getOnlineChessHistory = () => game ? game.history({ verbose: true }).map(move => move.from + move.to + (move.promotion || '')) : [];
  window.reportOnlineChessDelivery = (text, kind) => {
    if (onlineChessMode && !ended) setEngineStatus(text);
    if (kind !== 'sync' && $('chess-chat-delivery-status')) $('chess-chat-delivery-status').textContent = text;
  };
  window.applyOnlineChessMove = function(uci, roomId) {
    if (!onlineChessMode || !game || ended || roomId !== onlineChessRoomId || game.turn() === humanColor) return;
    try {
      applyingRemoteChessMove = true;
      const move = game.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || 'q' });
      if (!move) return;
      selectedSquare = null; legalTargets = [];
      renderBoard(); playMoveSound(move); updateGameStatus();
      setStatus(game.isCheckmate() ? 'Мат! Онлайн-партия завершена.' :
        game.isDraw() ? 'Ничья. Онлайн-партия завершена.' :
        game.isCheck() ? (game.turn() === humanColor ? 'Шах! Твой ход.' : 'Тебе шах. Ход противника.') :
        game.turn() === humanColor ? 'Твой ход.' : 'Ход противника.');
      if (!ended) setOnlineTurnStatus();
      return true;
    } catch (error) { console.warn('Ошибка хода соперника:', error); }
    finally { applyingRemoteChessMove = false; }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const botInfo = {
      1: { avatar: '🐣', name: 'ебаный нахуй даун', text: 'Это просто нахуй ебучий сука долбаёб. Это просто пизда как же он тупой нахуй. Даже айжан жёлтый переиграет этого хуесоса если вы полный ноль в этой компьютерной игре вы можете отточить тут свои навыки' },
      2: { avatar: '🧑‍🎓', name: 'чето умеющий', text: 'Уже старается развивать фигуры и замечать угрозы. Выбирай этого пидара если знаешь основы и хочешь немного потренироваться.' },
      3: { avatar: '🤖', name: 'миха осипов', text: 'Сбалансированный соперник: замечает тактические возможности и наказывает за невнимательные ходы. Подходит для обычной тренировочной партии.' },
      4: { avatar: '🧙', name: 'анатолий карпов', text: 'Сильный противник, который глубже рассчитывает варианты и лучше использует ошибки. Специалист по тюремным шахматам. Подготовься к серьёзной борьбе.' },
      5: { avatar: '👑', name: 'ГАРРИ КАСПАРОВ*', text: ' *ВНЕСЁН В ЕВАНГЕЛИСТСКИЙ ПЕРЕЧЕНЬ СУДЬБЫ. Максимальная доступная сложность PEPENAI в этой игре. Рассчитывает больше вариантов и станет испытанием даже для опытных игроков.' }
    };
    document.querySelectorAll('.chess-bot-card').forEach(card => card.addEventListener('click', () => {
      const chosenLevel = Number(card.dataset.level);
      const info = botInfo[chosenLevel];
      $('chess-level').value = String(chosenLevel);
      document.querySelectorAll('.chess-bot-card').forEach(other => {
        const active = other === card;
        other.classList.toggle('is-selected', active);
        other.setAttribute('aria-pressed', String(active));
      });
      $('chess-bot-detail-avatar').textContent = info.avatar;
      $('chess-bot-detail-name').textContent = info.name;
      $('chess-bot-detail-text').textContent = info.text;
    }));
    if ($('chess-start')) $('chess-start').addEventListener('click', startGame);
    if ($('chess-resign')) $('chess-resign').addEventListener('click', resign);
    if ($('chess-new')) $('chess-new').addEventListener('click', showSetup);
  });
})();

// The inline performance monitor in index.html owns FPS sampling and settings.


(() => {
    const botImages = {
        1: 'king.png',
        2: 'bot2.jpg',
        3: 'bot3.jpg',
        4: 'bot4.jpg',
        5: 'bot5.jpg'
    };

    function setupBotImages() {
        const cards = document.querySelectorAll('.chess-bot-card');

        cards.forEach(card => {
            const level = card.dataset.level;
            const avatar = card.querySelector('.chess-bot-avatar');
            if (!avatar || !botImages[level] || avatar.dataset.imageReady) return;

            const img = document.createElement('img');
            img.src = botImages[level];
            img.alt = `Шахматный бот ${level}`;
            img.onerror = () => {
                img.remove();
                avatar.textContent = '📷';
                console.warn(`Не удалось загрузить ${botImages[level]}`);
            };

            avatar.textContent = '';
            avatar.appendChild(img);
            avatar.dataset.imageReady = 'true';
        });

        const selected = document.querySelector(
            '.chess-bot-card.is-selected'
        );

        if (selected) showDetailImage(selected.dataset.level);
    }

    function showDetailImage(level) {
        const container = document.getElementById('chess-bot-detail-avatar');
        if (!container || !botImages[level]) return;

        const current = container.querySelector('img');
        if (current?.dataset.level === level) return;

        const img = document.createElement('img');
        img.src = botImages[level];
        img.alt = `Шахматный бот ${level}`;
        img.dataset.level = level;

        img.onerror = () => {
            img.remove();
            container.textContent = '📷';
        };

        container.replaceChildren(img);
    }

    document.addEventListener('click', event => {
        const card = event.target.closest('.chess-bot-card');
        if (card) {
            showDetailImage(card.dataset.level);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupBotImages);
    } else {
        setupBotImages();
    }
})();


(() => {
    const overlay = document.getElementById('performance-overlay');
    if (!overlay || overlay.dataset.dragReady) return;

    overlay.dataset.dragReady = 'true';

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    overlay.addEventListener('mousedown', (event) => {
        // Перетаскиваем только левой кнопкой мыши
        if (event.button !== 0) return;

        const rect = overlay.getBoundingClientRect();

        dragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        overlay.classList.add('dragging');

        // Убираем привязку к углу экрана
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.right = 'auto';
        overlay.style.bottom = 'auto';

        event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
        if (!dragging) return;

        const maxX = window.innerWidth - overlay.offsetWidth;
        const maxY = window.innerHeight - overlay.offsetHeight;

        const x = Math.max(0, Math.min(event.clientX - offsetX, maxX));
        const y = Math.max(0, Math.min(event.clientY - offsetY, maxY));

        overlay.style.left = `${x}px`;
        overlay.style.top = `${y}px`;
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
        overlay.classList.remove('dragging');
    });
})();


(() => {
    const overlay = document.getElementById('performance-overlay');
    if (!overlay || overlay.dataset.dragReady) return;

    overlay.dataset.dragReady = 'true';

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    overlay.addEventListener('mousedown', (event) => {
        // Перетаскиваем только левой кнопкой мыши
        if (event.button !== 0) return;

        const rect = overlay.getBoundingClientRect();

        dragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        overlay.classList.add('dragging');

        // Убираем привязку к углу экрана
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.right = 'auto';
        overlay.style.bottom = 'auto';

        event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
        if (!dragging) return;

        const maxX = window.innerWidth - overlay.offsetWidth;
        const maxY = window.innerHeight - overlay.offsetHeight;

        const x = Math.max(0, Math.min(event.clientX - offsetX, maxX));
        const y = Math.max(0, Math.min(event.clientY - offsetY, maxY));

        overlay.style.left = `${x}px`;
        overlay.style.top = `${y}px`;
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
        overlay.classList.remove('dragging');
    });
})();



document.addEventListener('DOMContentLoaded', () => {
    const openButton = document.getElementById('chess-multiplayer-open');
    const backButton = document.getElementById('chess-multiplayer-back');
    const menu = document.getElementById('chess-multiplayer-menu');
    const panel = document.getElementById('chess-multiplayer-panel');
    const status = document.getElementById('chess-multiplayer-status');
    const list = document.getElementById('chess-online-players');
    const inviteModal = document.getElementById('chess-invite-modal');
    const inviteFrom = document.getElementById('chess-invite-from');
    const acceptButton = document.getElementById('chess-invite-accept');
    const declineButton = document.getElementById('chess-invite-decline');
    const outgoingStatus = document.getElementById('chess-outgoing-status');

    if (!openButton || !backButton || !menu || !panel || !status || !list) {
        console.warn('Шахматный мультиплеер: HTML-элементы не найдены.');
        return;
    }

    let chessInviteChannel = null;
    let incomingInvite = null;
    let outgoingInvite = null;
    const chessInviteReplies = new Map();
    const chessInviteLifetime = 30000;
    async function sendChessInviteReply(invite, response) {
        try {
            return await chessInviteChannel.send({ type: 'broadcast', event: 'chess_invite_answer', payload: {
                id: invite.id, from: currentUser, target: invite.from,
                accepted: response === 'accepted', reason: response,
            } });
        } catch (_) { return 'error'; }
    }
    window.disablePendingChessInvite = () => answerChessInvite(false, 'disabled');
    let activeChessRoomChannel = null;
    let chessJoinVersion = 0;
    window.cancelChessJoin = () => {
        chessJoinVersion++;
        const room = activeChessRoomChannel;
        activeChessRoomChannel = null;
        if (room) supabaseClient.removeChannel(room).catch(() => {});
    };
    window.resetChessSession = () => {
        window.onlineChessDelivery?.dispose(); window.cancelChessJoin();
        if (outgoingInvite) { clearTimeout(outgoingInvite.timer); clearTimeout(outgoingInvite.expiryTimer); }
        if (incomingInvite) clearTimeout(incomingInvite.timer);
        outgoingInvite = null; incomingInvite = null; chessInviteReplies.clear();
        inviteModal.classList.add('hidden');
    };

    window.joinChessRoom = async function joinChessRoom(roomId, color, opponentName) {
        const joinVersion = ++chessJoinVersion;
        const account = currentAuthUserId;
        const { data: roomJoin, error: roomJoinError } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { action: 'join_room_membership', data: { topic: 'chess-room-' + roomId } }
        });
        if (joinVersion !== chessJoinVersion || account !== currentAuthUserId) return;
        if (roomJoinError || !roomJoin?.success) {
            if (outgoingStatus) outgoingStatus.textContent = roomJoin?.error || 'Нет доступа к этой шахматной комнате.';
            if (status) status.textContent = roomJoin?.error || 'Нет доступа к этой шахматной комнате.';
            return;
        }
        window.onlineChessDelivery?.dispose();
        const oldRoom = activeChessRoomChannel;
        activeChessRoomChannel = null;
        if (oldRoom) await supabaseClient.removeChannel(oldRoom);
        if (joinVersion !== chessJoinVersion || account !== currentAuthUserId) return;
        const room = supabaseClient.channel('chess-room-' + roomId, {
            config: { broadcast: { self: false }, private: true }
        });
        activeChessRoomChannel = room;
        const isCurrent = () => activeChessRoomChannel === room && account === currentAuthUserId && joinVersion === chessJoinVersion;
        window.chessRoomIsCurrent = (id, channel) => isCurrent() && id === roomId && channel === room;
        let boardStarted = false;
        let delivery = null;
        room.on('broadcast', { event: 'chess_delivery' }, message => { if (isCurrent()) delivery?.receive(message.payload); });
        room.subscribe(async state => {
            if (!isCurrent()) return;
            if (state === 'SUBSCRIBED') {
                // Re-subscription must preserve the existing board and result.
                if (boardStarted) { delivery?.setConnected(true); return; }
                boardStarted = true;
                if (await window.startOnlineChessBoard?.(color, roomId, room, opponentName) === false) { boardStarted = false; return; }
                if (!isCurrent()) return;
                delivery = createChessDelivery({ roomId, from: currentUser, peer: opponentName, isCurrent,
                    send: payload => room.send({ type: 'broadcast', event: 'chess_delivery', payload }),
                    history: () => window.getOnlineChessHistory(),
                    applyMove: move => window.applyOnlineChessMove(move, roomId),
                    status: (text, kind) => window.reportOnlineChessDelivery(text, kind),
                    chat: (name, text) => window.appendOnlineChessChat(name, text),
                    resign: () => window.finishOnlineChessFromOpponent(roomId),
                    setTimer: setTimeout, clearTimer: clearTimeout, newId: () => crypto.randomUUID(),
                });
                window.onlineChessDelivery = delivery;
                delivery.setConnected(true);
            } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(state)) {
                delivery?.setConnected(false);
                if (outgoingStatus) outgoingStatus.textContent = 'Не удалось подключить шахматную комнату. Попробуй вызвать игрока снова.';
            }
        });
    };

    function renderChessOnlinePlayers() {
        if (!onlineChannel) {
            status.textContent = 'Сначала войди в аккаунт на сайте.';
            return;
        }

        const players = Object.keys(onlineChannel.presenceState())
            .filter(name => name !== currentUser);

        list.replaceChildren();

        if (players.length === 0) {
            status.textContent = 'Других игроков онлайн пока нет.';
            return;
        }

        status.textContent = 'Игроки онлайн: ' + players.length;

        players.forEach(name => {
            const item = document.createElement('div');
            item.className = 'pvp-room-item';

            const nick = document.createElement('strong');
            nick.textContent = name;

            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Вызвать на шахматы';

            button.addEventListener('click', () => sendChessInvite(name));

            item.append(nick, button);
            list.appendChild(item);
        });
    }

    async function sendChessInvite(target) {
        if (!chessInviteChannel || outgoingInvite || incomingInvite) {
            outgoingStatus.textContent = 'Канал недоступен или уже есть приглашение.';
            return;
        }
        const account = currentAuthUserId;
        const pending = { id: crypto.randomUUID(), target, account, received: false, timer: null, expiresAt: Date.now() + chessInviteLifetime };
        outgoingInvite = pending;
        const current = () => outgoingInvite === pending && currentAuthUserId === account;
        const retry = async () => {
            if (!current()) return;
            if (Date.now() >= pending.expiresAt) {
                outgoingInvite = null;
                outgoingStatus.textContent = pending.received ? 'Время ожидания ответа истекло.' : 'Получатель недоступен: доставка не подтверждена.';
                return;
            }
            try {
                await chessInviteChannel.send({ type: 'broadcast', event: 'chess_invite', payload: {
                    id: pending.id, from: currentUser, target, expiresAt: pending.expiresAt,
                } });
                const serverDeadline = chessInviteChannel.deadline?.(pending.id);
                if (current() && Number.isFinite(serverDeadline)) {
                    pending.expiresAt = serverDeadline;
                    clearTimeout(pending.expiryTimer);
                    pending.expiryTimer = setTimeout(() => {
                        if (!current()) return;
                        outgoingInvite = null; outgoingStatus.textContent = 'Серверный срок приглашения истёк.';
                    }, Math.max(0, serverDeadline - Date.now()));
                }
            } catch (_) {}
            if (!current()) return;
            outgoingStatus.textContent = pending.received ? 'Получение подтверждено. Ожидаем решения…' : 'Ожидаем подтверждения доставки…';
            pending.timer = setTimeout(retry, 3000);
        };
        pending.expiryTimer = setTimeout(() => {
            if (!current()) return;
            outgoingInvite = null; outgoingStatus.textContent = 'Время ожидания приглашения истекло.';
        }, chessInviteLifetime);
        try {
            const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
                body: { action: 'register_room_membership', data: { topic: 'chess-room-' + pending.id, kind: 'chess', inviteeUsername: target, isPublic: false } }
            });
            if (!current()) return;
            if (error || !data?.success) throw new Error(data?.error || 'Не удалось создать защищённую шахматную комнату.');
            await retry();
        } catch (error) {
            if (!current()) return;
            clearTimeout(pending.timer); clearTimeout(pending.expiryTimer); outgoingInvite = null;
            outgoingStatus.textContent = error.message || 'Ошибка сети при отправке приглашения.';
        }
    }

    async function handleIncomingInvite(payload) {
        const data = payload?.payload, account = currentAuthUserId;
        if (!account || !data || data.target !== currentUser || typeof data.id !== 'string') return;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) return;
        if (!Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now() || data.expiresAt > Date.now() + chessInviteLifetime + 5000) return;
        for (const [id, reply] of chessInviteReplies) if (reply.expiresAt <= Date.now() || reply.account !== account) chessInviteReplies.delete(id);
        const cached = chessInviteReplies.get(data.id);
        if (cached) { await sendChessInviteReply(cached, cached.response); return; }
        let invitation, error;
        try {
            ({ data: invitation, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, {
                body: { action: 'validate_room_invitation', data: { topic: 'chess-room-' + data.id, kind: 'chess' } }
            }));
        } catch (_) { return; }
        if (account !== currentAuthUserId || error || !invitation?.success || invitation.kind !== 'chess' || !invitation.hostUsername || data.expiresAt <= Date.now()) return;
        if (chessInviteReplies.has(data.id)) {
            const reply = chessInviteReplies.get(data.id); await sendChessInviteReply(reply, reply.response); return;
        }
        const invite = { id: data.id, from: String(invitation.hostUsername), account, expiresAt: data.expiresAt, response: 'received', timer: null };
        if (localStorage.getItem('chessInvitesEnabled') === 'false') invite.response = 'disabled';
        else if (incomingInvite || outgoingInvite || window.onlineChessDelivery?.isActive()) invite.response = 'busy';
        if (chessInviteReplies.size >= 100) return;
        chessInviteReplies.set(invite.id, invite);
        if (invite.response === 'received') {
            incomingInvite = invite;
            inviteFrom.textContent = invite.from; inviteModal.classList.remove('hidden');
            invite.timer = setTimeout(() => {
                if (incomingInvite !== invite || currentAuthUserId !== account) return;
                incomingInvite = null; invite.response = 'expired'; inviteModal.classList.add('hidden');
            }, Math.max(0, invite.expiresAt - Date.now()));
        }
        await sendChessInviteReply(invite, invite.response);
    }

    async function answerChessInvite(accepted, reason = 'declined') {
        const invite = incomingInvite;
        if (!invite || invite.account !== currentAuthUserId || invite.expiresAt <= Date.now()) return;
        incomingInvite = null; clearTimeout(invite.timer);
        invite.response = accepted ? 'accepted' : reason;
        inviteModal.classList.add('hidden');
        const result = await sendChessInviteReply(invite, invite.response);
        if (invite.account !== currentAuthUserId) return;
        status.textContent = result === 'ok' ? (accepted ? 'Ответ отправлен. Подключаемся…' : 'Приглашение отклонено.') : 'Ответ не подтверждён каналом. Повторим при повторной доставке приглашения.';
        if (accepted) { switchTab('chess'); await window.joinChessRoom(invite.id, 'b', invite.from); }
    }

    openButton.addEventListener('click', () => {
        menu.classList.add('hidden');
        panel.classList.remove('hidden');
        renderChessOnlinePlayers();
    });

    backButton.addEventListener('click', () => {
        if (outgoingInvite) {
            const invite = outgoingInvite;
            outgoingInvite = null; clearTimeout(invite.timer); clearTimeout(invite.expiryTimer);
            chessInviteChannel?.cancel?.(invite.id);
        }
        panel.classList.add('hidden');
        menu.classList.remove('hidden');
    });

    if (acceptButton) {
        acceptButton.addEventListener('click', () => answerChessInvite(true));
    }

    if (declineButton) {
        declineButton.addEventListener('click', () => answerChessInvite(false));
    }

    if (onlineChannel) {
        onlineChannel.on('presence', { event: 'sync' }, () => {
            if (!panel.classList.contains('hidden')) {
                renderChessOnlinePlayers();
            }
        });
    }

    chessInviteChannel = createServerChessInvitations({
        invoke: body => supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body }),
        account: () => currentAuthUserId, username: () => currentUser,
        setTimer: setTimeout, clearTimer: clearTimeout,
    });

    chessInviteChannel
        .on('broadcast', { event: 'chess_invite' }, handleIncomingInvite)
        .on('broadcast', { event: 'chess_invite_answer' }, payload => {
            const data = payload.payload;

            if (!data || !outgoingInvite) return;
            if (data.id !== outgoingInvite.id) return;
            if (data.target !== currentUser) return;
            if (data.from !== outgoingInvite.target || outgoingInvite.account !== currentAuthUserId || outgoingInvite.expiresAt <= Date.now()) return;
            if (!['received', 'accepted', 'declined', 'disabled', 'busy', 'expired', 'cancelled'].includes(data.reason) || data.accepted !== (data.reason === 'accepted')) return;
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
        })
        .subscribe(result => {
            if (result === 'SUBSCRIBED') {
                renderChessOnlinePlayers();
            } else if (result === 'CHANNEL_ERROR' || result === 'TIMED_OUT') {
                if (status) {
                    status.textContent = 'Ошибка подключения шахматных приглашений.';
                }
            }
        });
});


/* Настройки входящих дуэлей */
(() => {
    const rpgToggle = document.getElementById('rpg-invites-toggle');
    const chessToggle = document.getElementById('chess-invites-toggle');

    if (!rpgToggle || !chessToggle) return;
    let serverInviteSettings = null;
    window.syncServerInviteSettings = async (save = false) => {
        if (!currentAuthUserId) return false;
        const account = currentAuthUserId;
        try {
            const { data, error } = await supabaseClient.functions.invoke(EDGE_FUNCTION_NAME, { body: {
                action: 'game_invitation', data: { op: 'settings', value: save ? JSON.stringify({ rpg: rpgToggle.checked, chess: chessToggle.checked }) : '' }
            } });
            if (account !== currentAuthUserId) return false;
            if (error || !data?.success) throw new Error('Настройки приглашений не сохранены на сервере.');
            if (!save && data.configured === false && (localStorage.getItem('rpgInvitesEnabled') === 'false' || localStorage.getItem('chessInvitesEnabled') === 'false')) {
                rpgToggle.checked = localStorage.getItem('rpgInvitesEnabled') !== 'false';
                chessToggle.checked = localStorage.getItem('chessInvitesEnabled') !== 'false';
                return window.syncServerInviteSettings(true);
            }
            serverInviteSettings = { rpg: data.rpg === true, chess: data.chess === true };
            rpgToggle.checked = serverInviteSettings.rpg; chessToggle.checked = serverInviteSettings.chess;
            localStorage.setItem('rpgInvitesEnabled', String(rpgToggle.checked));
            localStorage.setItem('chessInvitesEnabled', String(chessToggle.checked));
            return true;
        } catch (_) {
            if (account !== currentAuthUserId) return false;
            if (serverInviteSettings) { rpgToggle.checked = serverInviteSettings.rpg; chessToggle.checked = serverInviteSettings.chess; }
            const info = document.getElementById('chess-outgoing-status');
            if (info) info.textContent = 'Не удалось подтвердить настройки приглашений. Проверьте соединение.';
            return false;
        }
    };

    rpgToggle.checked =
        localStorage.getItem('rpgInvitesEnabled') !== 'false';

    chessToggle.checked =
        localStorage.getItem('chessInvitesEnabled') !== 'false';

    rpgToggle.addEventListener('change', () => {
        window.syncServerInviteSettings(true);
        localStorage.setItem(
            'rpgInvitesEnabled',
            String(rpgToggle.checked)
        );

        if (!rpgToggle.checked) {
            const modal = document.getElementById('pvp-receive-modal');
            if (modal) modal.classList.add('hidden');
        }
    });

    chessToggle.addEventListener('change', () => {
        window.syncServerInviteSettings(true);
        localStorage.setItem(
            'chessInvitesEnabled',
            String(chessToggle.checked)
        );

        if (!chessToggle.checked) {
            window.disablePendingChessInvite?.();
            const modal = document.getElementById('chess-invite-modal');
            if (modal) modal.classList.add('hidden');
        }
    });
})();





/* === СЛУЧАЙНЫЕ АФОРИЗМЫ: только когда сайт открыт и пользователь вошёл === */
(() => {
    const quotes = [
        { text: 'Тише едешь — дальше будешь.', author: 'Народная мудрость' },
        { text: 'Знание — сила.', author: 'Фрэнсис Бэкон' },
        { text: 'Лучше поздно, чем никогда.', author: 'Народная мудрость' },
        { text: 'Не ошибается тот, кто ничего не делает.', author: 'Народная мудрость' },
        { text: 'Есть две мирные формы насилия: закон и приличия.', author: 'Иоганн Гёте' },
        { text: 'Опыт — это имя, которое каждый даёт своим ошибкам.', author: 'Оскар Уайльд' },
        { text: 'Путь в тысячу ли начинается с первого шага.', author: 'Лао-цзы' },
        { text: 'Если хочешь изменить мир, начни с себя.', author: 'Махатма Ганди' },
        { text: 'Мысль изречённая есть ложь.', author: 'Фёдор Тютчев' },
        { text: 'Краткость — сестра таланта.', author: 'Антон Чехов' },
        { text: 'Время — деньги.', author: 'Бенджамин Франклин' },
        { text: 'Ничто так не обманывает нас, как наше мнение.', author: 'Леонардо да Винчи' },
        { text: 'Самое трудное — познать самого себя.', author: 'Фалес' },
        { text: 'Сомнение — начало мудрости.', author: 'Аристотель' },
        { text: 'Победа любит подготовку.', author: 'Эмилий Павел' },
        { text: 'Даже длинная дорога состоит из маленьких шагов.', author: 'Автор неизвестен' },
        { text: 'Не всё то золото, что блестит.', author: 'Народная мудрость' },
        { text: 'Семь раз отмерь, один раз отрежь.', author: 'Народная мудрость' },
        { text: 'Мудрый меняет мнение, глупец — никогда.', author: 'Иммануил Кант' },
        { text: 'У кого есть зачем жить, тот выдержит почти любое как.', author: 'Фридрих Ницше' },
        { text: 'КОЛОРИТНАЯ ЖИРУХА РАЗДВИГАЙ ПИЗДУ.', author: 'Фридрих Ницше' },
        { text: 'Иногда молчание — лучший ответ.', author: 'Далай-лама XIV' },
        { text: 'Самая большая ошибка — бояться ошибиться.', author: 'Элберт Хаббард' },
        { text: 'Делай что можешь, с тем, что имеешь, там, где ты есть.', author: 'Теодор Рузвельт' },
        { text: 'Терпение горько, но плод его сладок.', author: 'Жан-Жак Руссо' },
        { text: 'Кто владеет информацией, тот владеет миром.', author: 'Натан Ротшильд' },
        { text: 'Не количество лет, а качество жизни имеет значение.', author: 'Сенека' },
        { text: 'Будь собой; прочие роли уже заняты.', author: 'Оскар Уайльд' },
        { text: 'Самый верный способ предсказать будущее — создать его.', author: 'Питер Друкер' },
        { text: 'Всё проходит. И это тоже пройдёт.', author: 'Персидская пословица' }
    ];

    const popup = document.getElementById('aphorism-popup');
    const textEl = document.getElementById('aphorism-text');
    const authorEl = document.getElementById('aphorism-author');
    const mainScreen = document.getElementById('main-screen');
    if (!popup || !textEl || !authorEl || !mainScreen) return;

    const INTERVAL_MS = 60_000;
    const DISPLAY_MS = 12_000;
    let lastIndex = -1;
    let liked = false;
    let nextTimer = null;
    let hideTimer = null;
    let nextRemaining = INTERVAL_MS;
    let hideRemaining = DISPLAY_MS;
    let nextStartedAt = 0;
    let hideStartedAt = 0;
    let showing = false;

    function eligible() {
        return document.visibilityState === 'visible' &&
            !mainScreen.classList.contains('hidden');
    }

    function pickQuote() {
        let index;
        do {
            index = Math.floor(Math.random() * quotes.length);
        } while (quotes.length > 1 && index === lastIndex);
        lastIndex = index;
        return quotes[index];
    }

    function renderQuote(index = null) {
        let quote;
        if (index !== null) {
            lastIndex = (index + quotes.length) % quotes.length;
            quote = quotes[lastIndex];
        } else {
            quote = pickQuote();
        }
        textEl.textContent = '«' + quote.text + '»';
        authorEl.textContent = '— ' + quote.author;
        liked = false;
        const likeButton = document.getElementById('aphorism-like');
        if (likeButton) likeButton.textContent = '♡';
    }

    function clearNextTimer() {
        if (nextTimer !== null) {
            clearTimeout(nextTimer);
            nextTimer = null;
            nextRemaining = Math.max(0, nextRemaining - (Date.now() - nextStartedAt));
        }
    }
    function clearHideTimer() {
        if (hideTimer !== null) {
            clearTimeout(hideTimer);
            hideTimer = null;
            hideRemaining = Math.max(0, hideRemaining - (Date.now() - hideStartedAt));
        }
    }

    function scheduleNext() {
        if (!eligible() || nextTimer !== null) return;
        nextStartedAt = Date.now();
        nextTimer = setTimeout(() => {
            nextTimer = null;
            nextRemaining = INTERVAL_MS;
            renderQuote();
            popup.classList.remove('hidden');
            showing = true;
            hideRemaining = DISPLAY_MS;
            scheduleHide();
            scheduleNext();
        }, nextRemaining);
    }

    function scheduleHide() {
        if (!eligible() || !showing || hideTimer !== null) return;
        hideStartedAt = Date.now();
        hideTimer = setTimeout(() => {
            hideTimer = null;
            hideRemaining = DISPLAY_MS;
            popup.classList.add('hidden');
            showing = false;
        }, hideRemaining);
    }

    function pauseTimers() {
        clearNextTimer();
        clearHideTimer();
        // Hide the popup while the browser tab or game screen is not active.
        popup.classList.add('hidden');
    }

    function syncTimers() {
        if (eligible()) {
            if (showing) {
                popup.classList.remove('hidden');
                scheduleHide();
            }
            scheduleNext();
        } else {
            pauseTimers();
        }
    }

    document.addEventListener('visibilitychange', syncTimers);
    const observer = new MutationObserver(syncTimers);
    observer.observe(mainScreen, { attributes: true, attributeFilter: ['class'] });

    document.getElementById('aphorism-close')?.addEventListener('click', () => {
        popup.classList.add('hidden');
        showing = false;
        clearHideTimer();
        hideRemaining = DISPLAY_MS;
    });
    document.getElementById('aphorism-next')?.addEventListener('click', () => {
        renderQuote(lastIndex + 1);
        popup.classList.remove('hidden');
        showing = true;
        clearHideTimer();
        hideRemaining = DISPLAY_MS;
        scheduleHide();
    });
    document.getElementById('aphorism-prev')?.addEventListener('click', () => {
        renderQuote(lastIndex - 1);
        popup.classList.remove('hidden');
        showing = true;
        clearHideTimer();
        hideRemaining = DISPLAY_MS;
        scheduleHide();
    });
    document.getElementById('aphorism-like')?.addEventListener('click', () => {
        liked = !liked;
        const button = document.getElementById('aphorism-like');
        if (button) button.textContent = liked ? '♥' : '♡';
    });

    syncTimers();
})();
