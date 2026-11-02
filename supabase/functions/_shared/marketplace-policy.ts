export type MarketplaceSaleValidation =
  | { success: true; itemId: string; price: number }
  | { success: false; error: string };

export function validateMarketplaceSale(itemIdValue: unknown, priceValue: unknown): MarketplaceSaleValidation {
  if (typeof itemIdValue !== 'string' || itemIdValue.length === 0 || itemIdValue.length > 128) {
    return { success: false, error: 'Invalid item identifier.' };
  }
  if (typeof priceValue !== 'number' || !Number.isSafeInteger(priceValue) || priceValue < 1 || priceValue > 100000) {
    return { success: false, error: 'Price must be an integer between 1 and 100000.' };
  }
  return { success: true, itemId: itemIdValue, price: priceValue };
}
