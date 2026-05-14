export const MOCK_VOT_ACCOUNTS = {
  sufficient: {
    projectGrantVotNo: "Q.J130000.3851.19J91",
    expenseVot: "27000",
    hasSufficientFunds: true,
  },
  insufficient: {
    projectGrantVotNo: "Q.J130000.3851.19J90",
    expenseVot: "27000",
    hasSufficientFunds: false,
  },
};

export function validateMockVotFunding({ projectGrantVotNo, expenseVot }) {
  const normalizedProjectGrantVotNo = String(projectGrantVotNo || "")
    .trim()
    .toUpperCase();
  const normalizedExpenseVot = String(expenseVot || "").trim();

  if (!normalizedProjectGrantVotNo || !normalizedExpenseVot) {
    return {
      ok: false,
      status: 400,
      error: "Please enter Project / Grant VOT No. and Expense VOT.",
    };
  }

  const account = Object.values(MOCK_VOT_ACCOUNTS).find(
    (item) =>
      item.projectGrantVotNo === normalizedProjectGrantVotNo &&
      item.expenseVot === normalizedExpenseVot,
  );

  if (!account) {
    return {
      ok: false,
      status: 400,
      error: "Invalid VOT details. Please use a valid mock VOT account.",
    };
  }

  if (!account.hasSufficientFunds) {
    return {
      ok: false,
      status: 402,
      error: "Insufficient funds for this VOT account.",
    };
  }

  return { ok: true, account };
}
