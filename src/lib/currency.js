const USD_TO_MYR_RATE = 3.92;

export function convertUsdToMyr(amount) {
  return Number(amount || 0) * USD_TO_MYR_RATE;
}

export function formatRmFromUsd(amount) {
  return `RM ${convertUsdToMyr(amount).toFixed(2)}`;
}
