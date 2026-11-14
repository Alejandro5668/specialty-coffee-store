const LOW_STOCK = 5;

export const stockLabel = (stock: number): string => {
  if (!Number.isFinite(stock) || stock <= 0) return 'Agotado';
  if (stock === 1) return 'Queda 1';
  return stock <= LOW_STOCK ? `Quedan ${stock}` : `${stock} disponibles`;
};
