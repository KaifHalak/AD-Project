/**
 * Sends login request to the login API route using email and password.
 * Returns parsed JSON so UI code can directly check success or error.
 */
export async function loginWithEmailPassword(email, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
