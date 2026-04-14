export async function fetchVerificationStatus(accessToken) {
  const response = await fetch("/api/auth/verification-status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
