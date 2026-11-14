/** The API sends cents of COP. Pesos are written with a dot between thousands: $1.234.567. */
export const formatCop = (cents: number): string => {
  if (!Number.isSafeInteger(cents) || cents < 0) return '-';
  const pesos = String(Math.floor(cents / 100));
  return `$${pesos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};
