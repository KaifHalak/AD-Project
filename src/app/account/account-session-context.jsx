"use client";

import { createContext, useContext } from "react";

const AccountSessionContext = createContext(null);

export function AccountSessionProvider({ value, children }) {
  return (
    <AccountSessionContext.Provider value={value}>
      {children}
    </AccountSessionContext.Provider>
  );
}

export function useAccountSession() {
  const session = useContext(AccountSessionContext);

  if (!session) {
    throw new Error("useAccountSession must be used within AccountSessionProvider.");
  }

  return session;
}
