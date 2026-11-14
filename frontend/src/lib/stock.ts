const LOW_STOCK = 5;

/** "queda 1" or "quedan 3": the verb agrees with the number. */
export const remaining = (stock: number): string => (stock === 1 ? 'queda 1' : `quedan ${stock}`);

export const stockLabel = (stock: number): string => {
  if (!Number.isFinite(stock) || stock <= 0) return 'Agotado';
  if (stock <= LOW_STOCK) return `${remaining(stock)[0].toUpperCase()}${remaining(stock).slice(1)}`;
  return `${stock} disponibles`;
};
