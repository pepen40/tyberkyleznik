# Server-authoritative RPG PvP — PR2A

This branch starts the authoritative engine work for RPG “Скотобойня”.

## Scope of this slice
- Add a database-side fighter-build calculator that reads the authenticated player's stored upgrades and equipped/owned gear.
- The client must never provide HP, ATK, crit, defense, or gear bonuses as trusted values.
- The helper is executable only by service_role and pins an empty search_path.
- Add pgTAP checks for existence, execution grants, SECURITY DEFINER, and search_path.

## Deliberately not included
- No production Supabase migration was applied.
- No Edge Function was deployed or replaced.
- No client combat or Realtime flow was switched.
- No PvP points, coins, or rewards were enabled.
- No technical-win or disconnect result is trusted yet.

## Next slice
Implement match creation/join and one transactional action endpoint against the existing pvp_matches/action ledger. Reimplement all RPG combat rules server-side (three fighters, attack, defend, class skill, all item effects, poison, Boris, Parashnik, bonus attacks, mana, crit, armor, item consumption and disconnect outcomes) before wiring the client.
