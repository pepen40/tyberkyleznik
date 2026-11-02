import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ success: false, error: 'Метод не поддерживается.' }, 405)
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return json({ success: false, error: 'Ожидается JSON-запрос.' }, 415)
  }
  try {
    const raw = await req.text()
    if (raw.length > 4096) return json({ success: false, error: 'Слишком большой запрос.' }, 413)
    let body: any
    try { body = JSON.parse(raw) } catch { return json({ success: false, error: 'Некорректный JSON.' }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ success: false, error: 'Некорректный запрос.' }, 400)

    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) throw new Error('Supabase environment is incomplete')
    const bearer = req.headers.get('authorization') || ''
    const token = bearer.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return json({ success: false, error: 'Требуется авторизация.' }, 401)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user?.id) return json({ success: false, error: 'Сессия недействительна.' }, 401)
    const userId = auth.user.id
    const action = body.action
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}

    let result: any
    if (action === 'create_match') {
      const charType = String(data.char_type || '')
      const roomTopic = String(data.room_topic || '')
      const matchId = String(data.match_id || '')
      if (!['ashab', 'apostol', 'mee'].includes(charType) ||
          !/^room_[a-z0-9]{9}$/.test(roomTopic) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId)) {
        return json({ success: false, error: 'Некорректные параметры создания матча.' }, 400)
      }
      const { data: rpcData, error } = await admin.rpc('create_rpg_pvp_match', {
        p_user_id: userId, p_match_id: matchId, p_room_topic: roomTopic, p_char_type: charType,
      })
      if (error) throw error
      result = rpcData
    } else if (action === 'join_match') {
      const charType = String(data.char_type || '')
      const roomTopic = String(data.room_topic || '')
      if (!['ashab', 'apostol', 'mee'].includes(charType) || !/^room_[a-z0-9]{9}$/.test(roomTopic)) {
        return json({ success: false, error: 'Некорректные параметры подключения.' }, 400)
      }
      const { data: rpcData, error } = await admin.rpc('join_rpg_pvp_match', {
        p_user_id: userId, p_room_topic: roomTopic, p_char_type: charType,
      })
      if (error) throw error
      result = rpcData
    } else if (action === 'get_match') {
      const roomTopic = String(data.room_topic || '')
      if (!/^room_[a-z0-9]{9}$/.test(roomTopic)) return json({ success: false, error: 'Некорректная комната.' }, 400)
      const { data: rpcData, error } = await admin.rpc('get_rpg_pvp_match', {
        p_user_id: userId, p_room_topic: roomTopic,
      })
      if (error) throw error
      result = rpcData
    } else {
      return json({ success: false, error: 'Неизвестное действие.' }, 400)
    }
    return json(result)
  } catch (error) {
    console.error('rpg-pvp error:', error)
    return json({ success: false, error: 'Внутренняя ошибка сервера.' }, 500)
  }
})
