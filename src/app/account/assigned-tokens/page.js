"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import Loader from "@/components/loader";
import { useAccountSession } from "../account-session-context";

function formatDate(dateISOString) {
  if (!dateISOString) {
    return "-";
  }

  return new Date(dateISOString).toLocaleString();
}

function sortTokens(tokens, sortConfig) {
  const sorted = [...tokens];

  sorted.sort((left, right) => {
    let comparison = 0;

    if (sortConfig.column === "genTime") {
      comparison =
        new Date(left.genTime).getTime() - new Date(right.genTime).getTime();
    }

    if (sortConfig.column === "expiry") {
      comparison =
        new Date(left.expiry).getTime() - new Date(right.expiry).getTime();
    }

    if (sortConfig.column === "status") {
      const statusRank = {
        active: 0,
        expired: 1,
      };

      comparison =
        (statusRank[left.status] || 99) - (statusRank[right.status] || 99);
    }

    if (sortConfig.direction === "desc") {
      return comparison * -1;
    }

    return comparison;
  });

  return sorted;
}

function SortableHeader({ label, column, sortConfig, onSort }) {
  const isActive = sortConfig.column === column;
  const marker = isActive ? (sortConfig.direction === "asc" ? " ▲" : " ▼") : "";

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 text-left font-semibold text-text-main hover:text-primary"
      title="Sort"
    >
      {label}
      <span>{marker}</span>
    </button>
  );
}

export default function AssignedTokensPage() {
  const { accessToken } = useAccountSession();

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isExpiringOne, setIsExpiringOne] = useState(false);
  const [isExpiringAll, setIsExpiringAll] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    column: "genTime",
    direction: "desc",
  });

  const [modalToken, setModalToken] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTokens() {
      setIsPageLoading(true);
      setErrorMessage("");
      setActionMessage("");

      try {
        await fetchTokens(accessToken, isMounted);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setErrorMessage("Server error while loading assigned tokens.");
        }
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    }

    loadTokens();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const sortedTokens = useMemo(
    () => sortTokens(tokens, sortConfig),
    [tokens, sortConfig],
  );

  async function fetchTokens(token, isMountedCheck = true) {
    setIsTableLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/pic/tokens", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (isMountedCheck) {
          setErrorMessage(
            responseData?.error || "Could not load token records.",
          );
        }
        return;
      }

      if (isMountedCheck) {
        setTokens(responseData.tokens || []);
      }
    } catch (error) {
      console.error(error);
      if (isMountedCheck) {
        setErrorMessage("Server error while loading token records.");
      }
    } finally {
      if (isMountedCheck) {
        setIsTableLoading(false);
      }
    }
  }

  function handleSort(column) {
    setSortConfig((current) => {
      if (current.column === column) {
        return {
          column,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        column,
        direction: "asc",
      };
    });
  }

  async function handleExpireOne() {
    if (!modalToken || !accessToken) {
      return;
    }

    const tokenIdToExpire = modalToken.id;

    setActionMessage("");
    setErrorMessage("");

    try {
      setIsExpiringOne(true);
      const response = await fetch("/api/pic/tokens/manual-expire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tokenId: modalToken.id }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not expire token.");
        return;
      }

      setActionMessage("Token expired successfully.");
      setTokens((currentTokens) =>
        currentTokens.map((tokenRow) =>
          tokenRow.id === tokenIdToExpire
            ? {
                ...tokenRow,
                status: "expired",
                manualExpire: true,
              }
            : tokenRow,
        ),
      );
      setModalToken(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while expiring token.");
    } finally {
      setIsExpiringOne(false);
    }
  }

  async function handleExpireAll() {
    if (!accessToken) {
      return;
    }

    setActionMessage("");
    setErrorMessage("");

    try {
      setIsExpiringAll(true);
      const response = await fetch("/api/pic/tokens/expire-all", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData?.error || "Could not expire all tokens.");
        return;
      }

      const expiredCount = responseData?.expiredCount || 0;
      setActionMessage(`Expired ${expiredCount} active token(s).`);
      await fetchTokens(accessToken, true);
    } catch (error) {
      console.error(error);
      setErrorMessage("Server error while expiring all tokens.");
    } finally {
      setIsExpiringAll(false);
    }
  }

  if (isPageLoading) {
    return <Loader fullScreen={false} />;
  }

  return (
    <>
      <section className="min-h-full w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <div className="w-full space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Assigned Tokens
            </h1>
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-warning/20 bg-white px-3 py-2 text-sm text-warning">
              {errorMessage}
            </p>
          ) : null}

          {actionMessage ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {actionMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 md:flex-row">
            <Button
              onClick={handleExpireAll}
              disabled={isExpiringAll || isTableLoading || tokens.length === 0}
              className="md:w-auto"
            >
              {isExpiringAll ? "Expiring all..." : "Expire all tokens"}
            </Button>
          </div>

          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
            Tip: Active status is clickable. Click an active badge to manually
            expire that token.
          </p>

          <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-light bg-background-main/60">
                  <th className="px-3 py-3 text-left font-semibold text-text-main">
                    ID
                  </th>
                  <th className="px-3 py-3 text-left text-text-main">
                    <SortableHeader
                      label="Generation Time"
                      column="genTime"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-text-main">
                    <SortableHeader
                      label="Expiry"
                      column="expiry"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-text-main">
                    Token
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-text-main">
                    User Email
                  </th>
                  <th className="px-3 py-3 text-left text-text-main">
                    <SortableHeader
                      label="Status"
                      column="status"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {isTableLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-text-muted"
                    >
                      Loading token records...
                    </td>
                  </tr>
                ) : null}

                {!isTableLoading && sortedTokens.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-text-muted"
                    >
                      No token records found.
                    </td>
                  </tr>
                ) : null}

                {!isTableLoading
                  ? sortedTokens.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border-light/70"
                      >
                        <td className="px-3 py-3 text-text-main">{row.id}</td>
                        <td className="px-3 py-3 text-text-main">
                          {formatDate(row.genTime)}
                        </td>
                        <td className="px-3 py-3 text-text-main">
                          {formatDate(row.expiry)}
                        </td>
                        <td className="px-3 py-3 font-mono text-text-main">
                          {row.token}
                        </td>
                        <td className="px-3 py-3 text-text-main">
                          {row.userEmail}
                        </td>
                        <td className="px-3 py-3">
                          {row.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => setModalToken(row)}
                              className="cursor-pointer rounded-full border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 underline decoration-dotted underline-offset-2 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-300"
                              title="Click to manually expire token"
                              aria-label={`Manually expire token ${row.token}`}
                            >
                              active
                            </button>
                          ) : (
                            <span className="rounded-full border border-warning/20 bg-white px-2 py-1 text-xs font-semibold text-warning">
                              expired
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {modalToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border-light bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">
              Manually Expire Token
            </h2>
            <p className="mt-2 text-sm text-text-main">
              Expire token <span className="font-mono">{modalToken.token}</span>{" "}
              for {modalToken.userEmail}?
            </p>

            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setModalToken(null)}
                disabled={isExpiringOne}
              >
                Cancel
              </Button>
              <Button onClick={handleExpireOne} disabled={isExpiringOne}>
                {isExpiringOne ? "Expiring..." : "Expire token"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
