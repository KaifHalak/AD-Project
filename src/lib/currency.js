export function formatRm(amount) {
  const value = amount === null || amount === undefined || amount === "" ? 0 : amount;
  return `RM ${value}`;
}
