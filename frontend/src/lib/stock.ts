const LOW_STOCK = 5;

export const stockLabel = (stock: number): string => {
  if (!Number.isFinite(stock) || stock <= 0) return 'Sold out';
  return stock <= LOW_STOCK ? `Only ${stock} left` : `${stock} in stock`;
};
