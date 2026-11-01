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
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
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
    const cooldowns: Record<string, number> = {
      chess_reward: 60,
      roach_clear: 60,
      score: 3,
      rpg_win: 3,
      pvp_result: 3,
      claim_rpg_reward: 2
    };
    const cooldownSeconds = cooldowns[action];
    if (cooldownSeconds) {
      const { data: allowed, error: cooldownError } = await supabaseAdmin.rpc('check_action_cooldown', {
        p_user_id: authData.user.id,
        p_action: action,
        p_cooldown_seconds: cooldownSeconds
      });
      if (cooldownError) throw new Error('Не удалось проверить частоту действий: ' + cooldownError.message);
      if (allowed !== true) {
        return new Response(JSON.stringify({ success: false, error: 'Слишком часто. Подожди немного.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429
        });
      }
    }

    const dailyCaps: Record<string, number> = { chess_reward:200, score:500, roach_clear:150, rpg_win:500, pvp_result:150 };
    if (Object.prototype.hasOwnProperty.call(dailyCaps, action)) {
      let requested = 0;
      if (action === 'chess_reward') requested = ({1:25,2:50,3:75,4:150,5:200} as Record<number,number>)[Number(data?.level)] || 0;
      else if (action === 'score') { const rounds=Math.max(0,Math.min(100,Math.floor(Number(data?.rounds)||0))); requested=Math.min(500,rounds*(rounds+19)); }
      else if (action === 'roach_clear') requested=150;
      else if (action === 'rpg_win') { const floor=Math.max(1,Math.min(500,Math.floor(Number(data?.floorMain)||1))); const sub=Math.max(1,Math.min(5,Math.floor(Number(data?.floorSub)||1))); requested=Math.min(100,10+floor*3)+(sub===5?Math.min(90,Math.round(35+floor*1.5)):0); }
      else if (action === 'pvp_result') requested=data?.win === true ? 15 : 0;
      if (requested>0) {
        const {data:allowed,error:budgetError}=await supabaseAdmin.rpc('consume_reward_budget',{p_user_id:authData.user.id,p_action:action,p_amount:requested,p_daily_limit:dailyCaps[action]});
        if(budgetError) throw new Error('Ошибка проверки дневного лимита: '+budgetError.message);
        if(allowed!==true) return new Response(JSON.stringify({success:false,error:'Дневной лимит наград исчерпан.'}),{headers:{...corsHeaders,'Content-Type':'application/json'},status:429});
      }
    }

    let currentCoins = player.coins || 0; 
    let currentItemPoints = player.item_points || 0;
    let currentInv = player.inventory || [];
    let currentUpgrades = player.rpg_upgrades || {"ashab":{"hp":0,"atk":0},"apostol":{"hp":0,"atk":0},"mee":{"hp":0,"atk":0}};
    ensureGearState(currentUpgrades);
    let currentMaxFloors = player.rpg_max_floors || {"ashab":0,"apostol":0,"mee":0};

    if (action === 'chess_reward') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('add_chess_reward_atomic',{p_user_id:authData.user.id,p_level:Number(data?.level)});
      if(txError) throw new Error('Не удалось сохранить шахматную награду: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'daily_status') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('ensure_rpg_daily_status',{p_user_id:authData.user.id});
      if(txError) throw new Error('Не удалось обновить контракты: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'claim_rpg_reward') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('claim_rpg_reward_atomic',{
        p_user_id:authData.user.id,p_kind:String(data?.kind||''),p_id:String(data?.id||'')
      });
      if(txError) throw new Error('Не удалось сохранить награду: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'score') {
      const rounds=Math.max(0,Math.min(100,Math.floor(Number(data?.rounds)||0)));
      const {data:result,error:txError}=await supabaseAdmin.rpc('record_simon_score_atomic',{p_user_id:authData.user.id,p_rounds:rounds});
      if(txError) throw new Error('Ошибка начисления: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'roach_clear') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('record_roach_clear_atomic',{p_user_id:authData.user.id});
      if(txError) throw new Error('Не удалось сохранить награду за бойню: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'rpg_win') {
      const floorMain=Math.max(1,Math.min(500,Math.floor(Number(data?.floorMain)||1)));
      const floorSub=Math.max(1,Math.min(5,Math.floor(Number(data?.floorSub)||1)));
      const {data:result,error:txError}=await supabaseAdmin.rpc('record_rpg_win_atomic',{
        p_user_id:authData.user.id,p_char:String(data?.charType||''),p_floor_main:floorMain,p_floor_sub:floorSub
      });
      if(txError) throw new Error('Не удалось сохранить награду за бой: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'open_case') {
      const price=Number(data?.price);
      if(price!==250 && price!==390) return new Response(JSON.stringify({success:false,error:'Неверная цена кейса'}),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
      const currentLoot=price===390?case2Loot:case1Loot;
      let roll=Math.random()*100,currentChance=0,droppedItem=null;
      for(const item of currentLoot){currentChance+=item.chance;if(roll<=currentChance){droppedItem=item;break;}}
      if(!droppedItem)droppedItem=currentLoot[currentLoot.length-1];
      const {data:result,error:txError}=await supabaseAdmin.rpc('open_player_case',{
        p_user_id:authData.user.id,p_price:price,p_item:droppedItem
      });
      if(txError) throw new Error('Не удалось открыть кейс: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'sell_item') {
      const itemId = String(data?.item?.id || '');
      const price = Math.floor(Number(data?.price));
      const { data: result, error: txError } = await supabaseAdmin.rpc('marketplace_sell_item', {
        p_user_id: authData.user.id, p_item_id: itemId, p_price: price
      });
      if (txError) throw new Error('Ошибка выставления лота: ' + txError.message);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: result?.success ? 200 : 400 });
    }

    if (action === 'remove_listing') {
      const listingId = Number(data?.listing_id);
      if (!Number.isSafeInteger(listingId) || listingId < 1) return new Response(JSON.stringify({ success:false,error:'Некорректный лот' }), { headers:{...corsHeaders,'Content-Type':'application/json'},status:400 });
      const { data: result, error: txError } = await supabaseAdmin.rpc('marketplace_remove_listing', {
        p_user_id: authData.user.id, p_listing_id: listingId
      });
      if (txError) throw new Error('Ошибка снятия лота: ' + txError.message);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: result?.success ? 200 : 400 });
    }

    if (action === 'buy_item') {
      const listingId = Number(data?.listing_id);
      if (!Number.isSafeInteger(listingId) || listingId < 1) return new Response(JSON.stringify({ success:false,error:'Некорректный лот' }), { headers:{...corsHeaders,'Content-Type':'application/json'},status:400 });
      const { data: result, error: txError } = await supabaseAdmin.rpc('marketplace_buy_listing', {
        p_user_id: authData.user.id, p_listing_id: listingId
      });
      if (txError) throw new Error('Ошибка покупки лота: ' + txError.message);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: result?.success ? 200 : 400 });
    }

    if (action === 'consume_item') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('consume_player_item',{
        p_user_id:authData.user.id,p_item_id:String(data?.item_id||'')
      });
      if(txError) throw new Error('Ошибка использования предмета: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'buy_upgrade') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('buy_rpg_upgrade',{
        p_user_id:authData.user.id,p_char:String(data?.charType||''),p_stat:String(data?.statType||'')
      });
      if(txError) throw new Error('Не удалось сохранить улучшение: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'pvp_result') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('apply_pvp_result',{p_user_id:authData.user.id,p_win:data?.win===true});
      if(txError) throw new Error('Ошибка обновления PvP-очков: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }


    if (action === 'buy_gear') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('purchase_rpg_gear',{
        p_user_id:authData.user.id,p_item_id:String(data?.itemId||'')
      });
      if(txError) throw new Error('Не удалось сохранить покупку: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    if (action === 'equip_gear') {
      const {data:result,error:txError}=await supabaseAdmin.rpc('set_rpg_gear',{
        p_user_id:authData.user.id,p_char:String(data?.charType||''),p_item_id:String(data?.itemId||''),p_unequip:data?.unequip===true
      });
      if(txError) throw new Error('Не удалось сохранить экипировку: '+txError.message);
      return new Response(JSON.stringify(result),{headers:{...corsHeaders,'Content-Type':'application/json'},status:200});
    }

    return new Response(JSON.stringify({ error: "Неизвестное действие" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})