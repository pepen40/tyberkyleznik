import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const case1Loot = [
    { name: "хуйня", rarity: "Обычное", points: 1, chance: 40, img: "img_huynya.png" },
    { name: "картофель", rarity: "Редкое", points: 5, chance: 25, img: "img_kartofel.png" },
    { name: "голова барана", rarity: "Сверхредкое", points: 15, chance: 15, img: "img_baran.png" },
    { name: "коала", rarity: "Эпическое", points: 30, chance: 10, img: "img_koala.png" },
    { name: "apostol", rarity: "Легендарное", points: 100, chance: 3, img: "img_apostol.png" },
    { name: "Вам не повезло", rarity: "Мусор", points: 0, chance: 6, img: "" }
];
const case2Loot = [
    { name: "хуйня", rarity: "Обычное", points: 1, chance: 30, img: "img_huynya.png" },
    { name: "парашник", rarity: "Редкое", points: 10, chance: 20, img: "img_parashnik.png" },
    { name: "boris", rarity: "Легендарное", points: 60, chance: 3, img: "img_boris.png" },
    { name: "шприц и лекарство", rarity: "Эпическое", points: 25, chance: 12, img: "img_syringe.png" },
    { name: "Сбриватель хуйни", rarity: "Сверхредкое", points: 15, chance: 7, img: "img_shaver.png" },
    { name: "Вам не повезло", rarity: "Мусор", points: 0, chance: 28, img: "" }
];

const VALID_CHARS = ['ashab', 'apostol', 'mee'];


const RPG_GEAR = [{"id": "wood_blade", "name": "дрын", "slot": "weapon", "price": 100, "atkPercent": 6, "atk": 0, "hp": 0, "crit": 0, "defense": 0}, {"id": "iron_edge", "name": "ну нихуевенький такой ножик", "slot": "weapon", "price": 450, "atkPercent": 10, "atk": 0, "hp": 0, "crit": 0, "defense": 0}, {"id": "berserker_axe", "name": "кувалда пидора", "slot": "weapon", "price": 1200, "atkPercent": 13, "atk": 0, "hp": 0, "crit": 3, "defense": 0}, {"id": "void_blade", "name": "хуйня ( мощная)", "slot": "weapon", "price": 3500, "atkPercent": 15, "atk": 0, "hp": 0, "crit": 9, "defense": 0}, {"id": "patched_vest", "name": "накидка пидора", "slot": "armor", "price": 120, "atkPercent": 0, "atk": 0, "hp": 25, "crit": 0, "defense": 3}, {"id": "iron_plate", "name": "костюм для игры в бодминтон", "slot": "armor", "price": 500, "atkPercent": 0, "atk": 0, "hp": 65, "crit": 0, "defense": 8}, {"id": "guardian_shell", "name": "наряд хуйни", "slot": "armor", "price": 1500, "atkPercent": 0, "atk": 0, "hp": 130, "crit": 0, "defense": 12}, {"id": "abyss_armor", "name": "фембойский костюмчик", "slot": "armor", "price": 3500, "atkPercent": 0, "atk": 0, "hp": 220, "crit": 0, "defense": 18}, {"id": "lucky_charm", "name": "мочевой пузырь дельфина", "slot": "charm", "price": 300, "atkPercent": 0, "atk": 0, "hp": 0, "crit": 3, "defense": 0}, {"id": "wolf_fang", "name": "окоченелости амжана жолтого", "slot": "charm", "price": 950, "atkPercent": 0, "atk": 5, "hp": 15, "crit": 5, "defense": 0}, {"id": "phoenix_heart", "name": "щенячий цобот", "slot": "charm", "price": 2200, "atkPercent": 0, "atk": 0, "hp": 50, "crit": 0, "defense": 0}, {"id": "king_relic", "name": "мясо пидора с изюмом", "slot": "charm", "price": 5000, "atkPercent": 0, "atk": 12, "hp": 80, "crit": 8, "defense": 5}];

const DAILY_QUESTS: Record<string, { metric: string; target: number; reward: number }> = {
  wins3: { metric: 'wins', target: 3, reward: 75 },
  boss1: { metric: 'bosses', target: 1, reward: 150 },
  spend500: { metric: 'spent', target: 500, reward: 50 },
};
const RPG_ACHIEVEMENTS: Record<string, { metric: string; target: number; reward: number }> = {
  first_win: { metric: 'totalWins', target: 1, reward: 50 },
  ten_wins: { metric: 'totalWins', target: 10, reward: 200 },
  fifty_wins: { metric: 'totalWins', target: 50, reward: 600 },
  first_boss: { metric: 'totalBosses', target: 1, reward: 150 },
  ten_bosses: { metric: 'totalBosses', target: 10, reward: 750 },
};
function ensureRpgProgress(upgrades: any) {
  const today = new Date().toISOString().slice(0, 10);
  let p = upgrades.rpgDaily;
  if (!p || typeof p !== 'object') p = {};
  if (p.date !== today) p = { ...p, date: today, wins: 0, bosses: 0, spent: 0, claimed: [] };
  p.wins = Math.max(0, Number(p.wins) || 0); p.bosses = Math.max(0, Number(p.bosses) || 0); p.spent = Math.max(0, Number(p.spent) || 0);
  p.totalWins = Math.max(0, Number(p.totalWins) || 0); p.totalBosses = Math.max(0, Number(p.totalBosses) || 0);
  p.claimed = Array.isArray(p.claimed) ? p.claimed : []; p.achievementsClaimed = Array.isArray(p.achievementsClaimed) ? p.achievementsClaimed : [];
  upgrades.rpgDaily = p; return p;
}

function ensureGearState(upgrades: any) {
  if (!upgrades.rpgGear || typeof upgrades.rpgGear !== 'object') {
    upgrades.rpgGear = { owned: [], equipped: { ashab: { weapon: null, armor: null, charm: null }, apostol: { weapon: null, armor: null, charm: null }, mee: { weapon: null, armor: null, charm: null } } };
  }
  if (!Array.isArray(upgrades.rpgGear.owned)) upgrades.rpgGear.owned = [];
  if (!upgrades.rpgGear.equipped || typeof upgrades.rpgGear.equipped !== 'object') upgrades.rpgGear.equipped = {};
  for (const char of VALID_CHARS) {
    if (!upgrades.rpgGear.equipped[char]) upgrades.rpgGear.equipped[char] = { weapon: null, armor: null, charm: null };
    for (const slot of ['weapon', 'armor', 'charm']) {
      if (!(slot in upgrades.rpgGear.equipped[char])) upgrades.rpgGear.equipped[char][slot] = null;
    }
  }
  return upgrades.rpgGear;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) throw new Error("Нет SUPABASE_SERVICE_ROLE_KEY в секретах!");
    const authorization = req.headers.get('Authorization') || '';
    const tokenMatch = authorization.match(/^Bearer\\s+(.+)$/i);
    if (!tokenMatch) {
      return new Response(JSON.stringify({ success: false, error: 'Требуется авторизация.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
      });
    }
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(tokenMatch[1]);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ success: false, error: 'Недействительная или истёкшая сессия.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
      });
    }
    const { action, data } = await req.json();
    if (typeof action !== 'string' || !action) {
      return new Response(JSON.stringify({ success: false, error: 'Не указано действие.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      });
    }
    const { data: player, error } = await supabaseAdmin
      .from('players').select('*').eq('user_id', authData.user.id).single();
    if (error || !player) {
      return new Response(JSON.stringify({ success: false, error: 'Профиль игрока не найден.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403
      });
    }
    let currentCoins = player.coins || 0; 
    let currentItemPoints = player.item_points || 0;
    let currentInv = player.inventory || [];
    let currentUpgrades = player.rpg_upgrades || {"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}};
    ensureGearState(currentUpgrades);
    let currentMaxFloors = player.rpg_max_floors || {"ashab":0,"apostol":0,"mee":0};

    if (action === 'chess_reward') {
      const level = Number(data?.level);
      const rewards: Record<number, number> = { 1: 25, 2: 50, 3: 75, 4: 150, 5: 200 };
      const earned = rewards[level];
      if (!earned) {
        return new Response(JSON.stringify({ success: false, error: 'Некорректный уровень шахматного бота.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      const newCoins = Number(currentCoins) + earned;
      const { error: saveError } = await supabaseAdmin.from('players')
        .update({ coins: newCoins })
        .eq('id', player.id);
      if (saveError) throw new Error('Не удалось сохранить шахматную награду: ' + saveError.message);
      return new Response(JSON.stringify({ success: true, earned, newCoins }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'daily_status') {
      const progress = ensureRpgProgress(currentUpgrades);
      const { error: saveError } = await supabaseAdmin.from('players').update({ rpg_upgrades: currentUpgrades }).eq('id', player.id);
      if (saveError) throw new Error("Не удалось обновить контракты: " + saveError.message);
      return new Response(JSON.stringify({ success: true, progress, newUpgrades: currentUpgrades, newCoins: currentCoins }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'claim_rpg_reward') {
      const progress = ensureRpgProgress(currentUpgrades);
      const kind = String(data?.kind || ''); const id = String(data?.id || '');
      const catalog: any = kind === 'daily' ? DAILY_QUESTS : kind === 'achievement' ? RPG_ACHIEVEMENTS : null;
      if (!catalog || !catalog[id]) return new Response(JSON.stringify({ success: false, error: 'Неизвестная награда.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      const def = catalog[id]; const claimedList = kind === 'daily' ? progress.claimed : progress.achievementsClaimed;
      if (claimedList.includes(id)) return new Response(JSON.stringify({ success: false, error: 'Эта награда уже получена.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      if ((Number(progress[def.metric]) || 0) < def.target) return new Response(JSON.stringify({ success: false, error: 'Контракт ещё не выполнен.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      claimedList.push(id); const earned = def.reward; const newCoins = currentCoins + earned;
      const { error: saveError } = await supabaseAdmin.from('players').update({ coins: newCoins, rpg_upgrades: currentUpgrades }).eq('id', player.id);
      if (saveError) throw new Error('Не удалось сохранить награду: ' + saveError.message);
      return new Response(JSON.stringify({ success: true, earned, newCoins, newUpgrades: currentUpgrades, progress }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'score') {
      // Награда за каждый успешно завершённый раунд:
      // раунд 1 = 20, раунд 2 = 22, раунд 3 = 24 и далее +2 за раунд.
      // Сумма: 20 + 22 + ... + (20 + 2 * (rounds - 1)).
      const rounds = Math.max(0, Math.min(100, Math.floor(Number(data?.rounds) || 0)));
      const earnedCoins = Math.min(500, rounds * (rounds + 19));

      const newCoins = currentCoins + earnedCoins;
      const newMaxScore = Math.max(player.max_score || 0, rounds);
      const { error: updateError } = await supabaseAdmin
        .from('players')
        .update({ max_score: newMaxScore, coins: newCoins })
        .eq('id', player.id);

      if (updateError) throw new Error("Ошибка начисления: " + updateError.message);

      return new Response(JSON.stringify({
        success: true,
        newCoins,
        earned: earnedCoins
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (action === 'roach_clear') {
      const roachKills = Math.max(0, Number(currentUpgrades.roachKills) || 0);
      currentUpgrades.roachKills = roachKills + 9;
      const earned = 150;
      const newCoins = currentCoins + earned;
      const { error: saveError } = await supabaseAdmin.from('players')
        .update({ coins: newCoins, rpg_upgrades: currentUpgrades })
        .eq('id', player.id);
      if (saveError) throw new Error('Не удалось сохранить награду за бойню: ' + saveError.message);
      return new Response(JSON.stringify({
        success: true, earned, newCoins, newUpgrades: currentUpgrades,
        roachKills: currentUpgrades.roachKills
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'rpg_win') {
      const floorMain = Math.max(1, Math.min(500, Math.floor(Number(data.floorMain) || 1)));
      const floorSub = Math.max(1, Math.min(5, Math.floor(Number(data.floorSub) || 1)));
      const safeFloor = floorMain; const isBoss = floorSub === 5;
      const progress = ensureRpgProgress(currentUpgrades);
      progress.wins += 1; progress.totalWins += 1;
      if (isBoss) { progress.bosses += 1; progress.totalBosses += 1; }
      const baseReward = Math.min(100, 10 + (safeFloor * 3));
      const bossBonus = isBoss ? Math.min(90, Math.round(35 + (safeFloor * 1.5))) : 0;
      const earnedCoins = baseReward + bossBonus; const newCoins = currentCoins + earnedCoins;
      const { error: saveError } = await supabaseAdmin.from('players').update({ coins: newCoins, rpg_upgrades: currentUpgrades }).eq('id', player.id);
      if (saveError) throw new Error('Не удалось сохранить награду за бой: ' + saveError.message);
      return new Response(JSON.stringify({ success: true, newCoins, earned: earnedCoins, bossBonus, newUpgrades: currentUpgrades, progress }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'open_case') {
      const price = Number(data.price);
      if (price !== 250 && price !== 390) {
          return new Response(JSON.stringify({ error: "Неверная цена кейса" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
      const currentLoot = price === 390 ? case2Loot : case1Loot;
      if (currentCoins < price) {
          return new Response(JSON.stringify({ error: `Мало монет! Нужно ${price}.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
      let roll = Math.random() * 100, currentChance = 0, droppedItem = null;
      for (let item of currentLoot) {
          currentChance += item.chance;
          if (roll <= currentChance) { droppedItem = item; break; }
      }
      if (!droppedItem) droppedItem = currentLoot[currentLoot.length - 1];
      let resultMessage = "";
      if (droppedItem.name !== "Вам не повезло") {
          currentInv.push({ ...droppedItem, id: Date.now().toString() });
          currentItemPoints += droppedItem.points;
          resultMessage = `Выпало: ${droppedItem.name} (${droppedItem.rarity}) +${droppedItem.points} очков!`;
      } else {
          resultMessage = "Вам не повезло. Вы нихуя не выиграли.";
      }
      await supabaseAdmin.from('players').update({ coins: currentCoins - price, inventory: currentInv, item_points: currentItemPoints }).eq('id', player.id)
      return new Response(JSON.stringify({ message: resultMessage, newCoins: currentCoins - price, newInventory: currentInv, newItemPoints: currentItemPoints, droppedItem: droppedItem }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (action === 'sell_item') {
      if (!data.item || !data.item.id) return new Response(JSON.stringify({ error: "Предмет не передан" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      const sellPrice = Math.max(1, Math.floor(Number(data.price) || 1));
      let itemIndex = currentInv.findIndex((i: any) => i.id === data.item.id);
      if (itemIndex === -1) return new Response(JSON.stringify({ error: "Предмет не найден" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      let itemToSell = currentInv[itemIndex];
      currentInv.splice(itemIndex, 1); 
      currentItemPoints -= itemToSell.points; 
      await supabaseAdmin.from('players').update({ inventory: currentInv, item_points: currentItemPoints }).eq('id', player.id);
      await supabaseAdmin.from('marketplace').insert([{
          seller: player.username, item_name: itemToSell.name, rarity: itemToSell.rarity, points: itemToSell.points, price: sellPrice, img: itemToSell.img || ""
      }]);
      return new Response(JSON.stringify({ success: true, newInventory: currentInv, newItemPoints: currentItemPoints }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (action === 'remove_listing') {
      const { data: listing } = await supabaseAdmin.from('marketplace').select('*').eq('id', data.listing_id).single();
      if (!listing) return new Response(JSON.stringify({ error: "Лот не найден" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      if (listing.seller !== player.username) return new Response(JSON.stringify({ error: "Это не твой лот" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      currentInv.push({ name: listing.item_name, rarity: listing.rarity, points: listing.points, img: listing.img || "", id: Date.now().toString() });
      currentItemPoints += listing.points; 
      await supabaseAdmin.from('players').update({ inventory: currentInv, item_points: currentItemPoints }).eq('id', player.id);
      await supabaseAdmin.from('marketplace').delete().eq('id', listing.id);
      return new Response(JSON.stringify({ success: true, newInventory: currentInv, newItemPoints: currentItemPoints }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (action === 'buy_item') {
      const { data: listing } = await supabaseAdmin.from('marketplace').select('*').eq('id', data.listing_id).single();
      if (!listing) return new Response(JSON.stringify({ error: "Лот уже куплен" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      if (listing.seller === player.username) return new Response(JSON.stringify({ error: "Нельзя купить свой лот" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      if (currentCoins < listing.price) return new Response(JSON.stringify({ error: "Мало монет!" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      const { data: seller } = await supabaseAdmin.from('players').select('*').eq('username', listing.seller).single();
      currentInv.push({ name: listing.item_name, rarity: listing.rarity, points: listing.points, img: listing.img || "", id: Date.now().toString() });
      currentItemPoints += listing.points; 
      await supabaseAdmin.from('players').update({ coins: currentCoins - listing.price, inventory: currentInv, item_points: currentItemPoints }).eq('id', player.id);
      if (seller) await supabaseAdmin.from('players').update({ coins: (seller.coins || 0) + listing.price }).eq('id', seller.id);
      await supabaseAdmin.from('marketplace').delete().eq('id', listing.id);
      return new Response(JSON.stringify({ success: true, newCoins: currentCoins - listing.price, newInventory: currentInv, newItemPoints: currentItemPoints }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (action === 'consume_item') {
       let itemIndex = currentInv.findIndex((i: any) => i.id === data.item_id);
       if (itemIndex === -1) return new Response(JSON.stringify({ error: "Предмет не найден" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
       let consumedItem = currentInv[itemIndex];
       currentInv.splice(itemIndex, 1); 
       currentItemPoints -= consumedItem.points; 
       await supabaseAdmin.from('players').update({ inventory: currentInv, item_points: currentItemPoints }).eq('id', player.id);
       return new Response(JSON.stringify({ success: true, newInventory: currentInv, newItemPoints: currentItemPoints }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (action === 'buy_upgrade') {
        let charType = data.charType;
        let statType = data.statType;
        if (!VALID_CHARS.includes(charType)) return new Response(JSON.stringify({ error: "Неверный персонаж" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        if (statType !== 'hp' && statType !== 'atk') return new Response(JSON.stringify({ error: "Неверный стат" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        let u = currentUpgrades[charType];
        let cost = statType === 'hp' ? (100 + (u.hp * 50)) : (150 + (u.atk * 50));
        if (currentCoins < cost) return new Response(JSON.stringify({ error: "Мало монет, бомж!" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        currentCoins -= cost;
        const progress = ensureRpgProgress(currentUpgrades); progress.spent += cost;
        currentUpgrades[charType][statType]++;
        await supabaseAdmin.from('players').update({ coins: currentCoins, rpg_upgrades: currentUpgrades }).eq('id', player.id);
        return new Response(JSON.stringify({ success: true, newCoins: currentCoins, newUpgrades: currentUpgrades }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (action === 'update_floor') {
        let charType = data.charType;
        if (!VALID_CHARS.includes(charType)) return new Response(JSON.stringify({ error: "Неверный персонаж" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        let floor = Math.max(0, Math.floor(Number(data.floor) || 0));
        if (floor > currentMaxFloors[charType]) {
            currentMaxFloors[charType] = floor;
            await supabaseAdmin.from('players').update({ rpg_max_floors: currentMaxFloors }).eq('id', player.id);
        }
        return new Response(JSON.stringify({ success: true, newMaxFloors: currentMaxFloors }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (action === 'pvp_result') {
        const isWin = data.win === true;
        let newPts = isWin ? (player.pvp_pts || 0) + 15 : Math.max(0, (player.pvp_pts || 0) - 15);
        await supabaseAdmin.from('players').update({ pvp_pts: newPts }).eq('id', player.id);
        return new Response(JSON.stringify({ success: true, newPts: newPts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }


    if (action === 'buy_gear') {
      const itemId = String(data?.itemId || '');
      const item = RPG_GEAR.find((g: any) => g.id === itemId);
      if (!item) return new Response(JSON.stringify({ success: false, error: "Такого предмета нет в каталоге." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      const gearState = ensureGearState(currentUpgrades);
      if (gearState.owned.includes(itemId)) return new Response(JSON.stringify({ success: false, error: "Этот предмет уже есть в коллекции." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      if (currentCoins < item.price) return new Response(JSON.stringify({ success: false, error: `Не хватает монет. Нужно ${item.price}.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      currentCoins -= item.price;
      const progress = ensureRpgProgress(currentUpgrades); progress.spent += item.price;
      gearState.owned.push(itemId);
      const { error: saveError } = await supabaseAdmin.from('players').update({ coins: currentCoins, rpg_upgrades: currentUpgrades }).eq('id', player.id);
      if (saveError) throw new Error("Не удалось сохранить покупку: " + saveError.message);
      return new Response(JSON.stringify({ success: true, newCoins: currentCoins, newUpgrades: currentUpgrades, itemId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'equip_gear') {
      const itemId = String(data?.itemId || '');
      const charType = String(data?.charType || '');
      const shouldUnequip = data?.unequip === true;
      if (!VALID_CHARS.includes(charType)) return new Response(JSON.stringify({ success: false, error: "Неизвестный боец." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      const gearState = ensureGearState(currentUpgrades);
      const equipped = gearState.equipped[charType];
      if (shouldUnequip) {
        const slot = Object.keys(equipped).find((key: string) => equipped[key] === itemId);
        if (!slot) return new Response(JSON.stringify({ success: false, error: "Этот предмет не надет на выбранного бойца." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        equipped[slot] = null;
      } else {
        const item = RPG_GEAR.find((g: any) => g.id === itemId);
        if (!item || !gearState.owned.includes(itemId)) return new Response(JSON.stringify({ success: false, error: "Предмет не найден в твоей коллекции." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        equipped[item.slot] = itemId;
      }
      const { error: saveError } = await supabaseAdmin.from('players').update({ rpg_upgrades: currentUpgrades }).eq('id', player.id);
      if (saveError) throw new Error("Не удалось сохранить экипировку: " + saveError.message);
      return new Response(JSON.stringify({ success: true, newUpgrades: currentUpgrades }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    return new Response(JSON.stringify({ error: "Неизвестное действие" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})