import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateMarketplaceSale } from './marketplace-policy.ts';

Deno.test('marketplace sale accepts a valid item ID and bounded integer price', () => {
  assertEquals(validateMarketplaceSale('owned-item-id', 1), {
    success: true,
    itemId: 'owned-item-id',
    price: 1,
  });
  assertEquals(validateMarketplaceSale('x'.repeat(128), 100000).success, true);
});

Deno.test('marketplace sale rejects invalid item IDs and prices before calling privileged RPC', () => {
  for (const itemId of ['', 'x'.repeat(129), 42, null, undefined]) {
    assertEquals(validateMarketplaceSale(itemId, 50).success, false);
  }
  for (const price of [0, -1, 100001, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '50', null, undefined]) {
    assertEquals(validateMarketplaceSale('owned-item-id', price).success, false);
  }
});

Deno.test('Edge Function validates seller input before calling marketplace RPC', async () => {
  const source = await Deno.readTextFile(new URL('../award-coins/index.ts', import.meta.url));
  const start = source.indexOf("if (action === 'sell_item')");
  const end = source.indexOf("if (action === 'remove_listing')", start);
  const sellBranch = source.slice(start, end);
  const validationIndex = sellBranch.indexOf('validateMarketplaceSale(data?.item?.id, data?.price)');
  const rpcIndex = sellBranch.indexOf("rpc('marketplace_sell_item'");
  assertEquals(validationIndex >= 0, true);
  assertEquals(rpcIndex > validationIndex, true);
});
