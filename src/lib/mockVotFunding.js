export const MOCK_VOT_ACCOUNTS = {
  sufficient: {
    grantNumber: "Q.J130000.3851.19J91",
    votNumber: "23",
    hasSufficientFunds: true,
  },
  insufficient: {
    grantNumber: "Q.J130000.3851.19J90",
    votNumber: "23",
    hasSufficientFunds: false,
  },
};

export const MOCK_VOT_OPTIONS = [
  { value: "23", label: "23 - Lab bookings" },
  { value: "30", label: "30 - Transportation" },
  { value: "31", label: "31 - Consumables" },
  { value: "35", label: "35 - Equipment rental" },
];

export function validateMockVotFunding({
  projectGrantVotNo,
  expenseVot,
  grantNumber,
  votNumber,
}) {
  const normalizedGrantNumber = String(grantNumber || projectGrantVotNo || "")
    .trim()
    .toUpperCase();
  const normalizedVotNumber = String(votNumber || expenseVot || "").trim();

  if (!normalizedGrantNumber || !normalizedVotNumber) {
    return {
      ok: false,
      status: 400,
      error: "Please enter Grant Number and VOT Number.",
    };
  }

  const selectedVot = MOCK_VOT_OPTIONS.find(
    (option) => option.value === normalizedVotNumber,
  );

  if (!selectedVot) {
    return {
      ok: false,
      status: 400,
      error: "Please select a valid VOT number.",
    };
  }

  const account = Object.values(MOCK_VOT_ACCOUNTS).find(
    (item) => item.grantNumber === normalizedGrantNumber,
  );

  if (!account) {
    return {
      ok: false,
      status: 400,
      error: "Invalid grant number. Please use a valid mock grant.",
    };
  }

  if (!account.hasSufficientFunds) {
    return {
      ok: false,
      status: 402,
      error: "Insufficient funds for this grant.",
    };
  }

  return { ok: true, account, vot: selectedVot };
}
