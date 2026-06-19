"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  GraduationCap,
  MapPin,
  Microscope,
  Save,
  Search,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRm } from "@/lib/currency";
import { getCurrentSession } from "@/lib/supabase/auth";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "maintenance", label: "Under Maintenance" },
  { value: "unavailable", label: "Unavailable" },
];

function getUniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
}

function truncate(value, maxLength = 115) {
  const text = String(value || "No description provided.");
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function normalizeStatus(value) {
  if (value === "maintenance") return "maintenance";
  if (value === "unavailable") return "unavailable";
  return "available";
}

function getStatusLabel(value) {
  const status = normalizeStatus(value);

  if (status === "maintenance") return "Under Maintenance";
  if (status === "unavailable") return "Unavailable";
  return "Available";
}

function getStatusClass(value) {
  const status = normalizeStatus(value);

  if (status === "maintenance") return "bg-yellow-100 text-yellow-700";
  if (status === "unavailable") return "bg-red-100 text-red-700";
  return "bg-emerald-100 text-emerald-700";
}

export default function EditEquipmentPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [labs, setLabs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [selectedProgramme, setSelectedProgramme] = useState("All Programmes");
  const [search, setSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [selectedLabId, setSelectedLabId] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    pricePerHour: "",
    status: "available",
  });

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const { data: sessionData } = await getCurrentSession();
        const token = sessionData?.session?.access_token;

        if (!isMounted) return;

        if (!token) {
          router.replace("/");
          return;
        }

        setAccessToken(token);

        const response = await fetch("/api/ppmu/equipment", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const responseData = await response.json();

        if (!isMounted) return;

        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/");
            return;
          }

          setErrorMessage(
            responseData?.error || "Could not load equipment catalog.",
          );
          setIsLoading(false);
          return;
        }

        setLabs(responseData.labs || []);
        setEquipment(responseData.equipment || []);
      } catch (error) {
        console.error(error);

        if (isMounted) {
          setErrorMessage("Server error while loading equipment catalog.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const programmes = useMemo(
    () => getUniqueValues([...labs, ...equipment], "course"),
    [labs, equipment],
  );
  const equipmentByLab = useMemo(() => {
    const grouped = new Map();

    for (const item of equipment) {
      grouped.set(item.lab_id, [...(grouped.get(item.lab_id) || []), item]);
    }

    return grouped;
  }, [equipment]);
  const selectedLab = labs.find((lab) => lab.id === selectedLabId);
  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId);
  const selectedLabEquipment = equipmentByLab.get(selectedLabId) || [];
  const keyword = search.trim().toLowerCase();
  const filteredLabs = labs.filter((lab) => {
    const labEquipment = equipmentByLab.get(lab.id) || [];
    const matchesProgramme =
      selectedProgramme === "All Programmes" ||
      lab.course === selectedProgramme ||
      labEquipment.some((item) => item.course === selectedProgramme);
    const matchesSearch =
      !keyword ||
      lab.name?.toLowerCase().includes(keyword) ||
      lab.location?.toLowerCase().includes(keyword) ||
      labEquipment.some((item) => item.name?.toLowerCase().includes(keyword));

    return matchesProgramme && matchesSearch;
  });
  const equipmentKeyword = equipmentSearch.trim().toLowerCase();
  const filteredLabEquipment = selectedLabEquipment.filter((item) => {
    if (!equipmentKeyword) return true;

    return (
      item.name?.toLowerCase().includes(equipmentKeyword) ||
      item.id?.toLowerCase().includes(equipmentKeyword) ||
      item.description?.toLowerCase().includes(equipmentKeyword)
    );
  });

  function openLab(labId) {
    setSelectedLabId(labId);
    setSelectedEquipmentId("");
    setEquipmentSearch("");
    setMessage("");
    setErrorMessage("");
  }

  function openEquipmentDetail(item) {
    setSelectedEquipmentId(item.id);
    setForm({
      pricePerHour:
        item.price_per_hour === null || item.price_per_hour === undefined
          ? ""
          : String(item.price_per_hour),
      status: normalizeStatus(item.status),
    });
    setMessage("");
    setErrorMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!selectedEquipment || !accessToken) return;

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/ppmu/equipment", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          equipmentId: selectedEquipment.id,
          pricePerHour: Number(form.pricePerHour),
          status: form.status,
        }),
      });
      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/");
          return;
        }

        setErrorMessage(responseData?.error || "Could not update equipment.");
        return;
      }

      setEquipment((current) =>
        current.map((item) =>
          item.id === responseData.equipment.id ? responseData.equipment : item,
        ),
      );
      setMessage(`${responseData.equipment.name} updated.`);
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while updating equipment.");
    } finally {
      setIsSaving(false);
    }
  }

  if (selectedLab && selectedEquipment) {
    return (
      <main className="min-h-full bg-background-main px-4 py-6 md:px-7 md:py-8">
        <section className="mx-auto max-w-7xl space-y-7">
          <button
            type="button"
            onClick={() => {
              setSelectedEquipmentId("");
              setMessage("");
              setErrorMessage("");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {selectedLab.name}
          </button>

          {message ? (
            <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {message}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm font-medium text-warning">
              {errorMessage}
            </p>
          ) : null}

          <div className="rounded-3xl border border-border-light bg-white p-7 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Activity className="h-8 w-8" />
                </div>
                <h1 className="mt-5 text-4xl font-semibold text-text-main">
                  {selectedEquipment.name}
                </h1>
                <p className="mt-2 text-sm text-text-muted">
                  {selectedEquipment.id} | {selectedLab.name}
                </p>
                <p className="mt-5 max-w-4xl text-base leading-relaxed text-text-muted">
                  {selectedEquipment.description || "No description provided."}
                </p>
              </div>
              <div className="space-y-3 lg:text-right">
                <p className="text-3xl font-semibold text-primary">
                  {formatRm(selectedEquipment.price_per_hour || 0)}/hr
                </p>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${getStatusClass(
                    selectedEquipment.status,
                  )}`}
                >
                  {getStatusLabel(selectedEquipment.status)}
                </span>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSave}
            className="rounded-3xl border border-border-light bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-semibold text-text-main">
              Edit Equipment
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Price Per Hour">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.pricePerHour}
                  onChange={(event) =>
                    updateForm("pricePerHour", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm text-text-main outline-none focus:border-primary"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="w-auto gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-background-main px-4 py-6 md:px-7 md:py-8">
      <section className="mx-auto max-w-7xl space-y-8">
        {!selectedLab ? (
          <div>
            <h1 className="text-3xl font-semibold text-text-main">
              Edit Equipment
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Browse labs, choose equipment, then update price and availability.
            </p>
          </div>
        ) : null}

        {message ? (
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm font-medium text-warning">
            {errorMessage}
          </p>
        ) : null}

        {!selectedLab ? (
          <>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search labs or equipment..."
                  className="pl-11"
                  aria-label="Search labs or equipment"
                />
              </label>
              <label className="relative block">
                <GraduationCap className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <select
                  value={selectedProgramme}
                  onChange={(event) => setSelectedProgramme(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white pl-11 pr-4 text-sm font-semibold text-text-main outline-none transition-colors focus:border-primary"
                >
                  <option>All Programmes</option>
                  {programmes.map((programme) => (
                    <option key={programme}>{programme}</option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-sm text-text-muted">
              Showing{" "}
              <span className="font-semibold text-text-main">
                {filteredLabs.length}
              </span>{" "}
              lab{filteredLabs.length === 1 ? "" : "s"}
            </p>

            {isLoading ? (
              <p className="rounded-xl border border-border-light bg-white px-4 py-8 text-sm text-text-muted">
                Loading labs...
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredLabs.map((lab) => {
                  const labEquipment = equipmentByLab.get(lab.id) || [];
                  const availableCount = labEquipment.filter(
                    (item) => normalizeStatus(item.status) === "available",
                  ).length;
                  const programmeLabels = [
                    ...new Set(
                      [lab.course, ...labEquipment.map((item) => item.course)].filter(
                        Boolean,
                      ),
                    ),
                  ].slice(0, 2);

                  return (
                    <button
                      type="button"
                      key={lab.id}
                      onClick={() => openLab(lab.id)}
                      className="h-full rounded-3xl border border-border-light bg-white p-7 text-left shadow-sm transition-colors hover:border-primary focus:border-primary focus:outline-none"
                    >
                      <div className="mb-7 flex items-start justify-between gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Microscope className="h-8 w-8" />
                        </div>
                        <span className="inline-flex items-center gap-2 text-sm text-text-muted">
                          <span className="h-3 w-3 rounded-full bg-emerald-300" />
                          {availableCount} available
                        </span>
                      </div>

                      <h2 className="text-2xl font-semibold text-text-main">
                        {lab.name}
                      </h2>
                      <p className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                        <MapPin className="h-4 w-4" />
                        {lab.location || "-"}
                      </p>
                      <p className="mt-4 min-h-12 text-base leading-relaxed text-text-muted">
                        {truncate(lab.description)}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {programmeLabels.map((programme) => (
                          <span
                            key={programme}
                            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary"
                          >
                            {programme}
                          </span>
                        ))}
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-border-light pt-5">
                        <span className="flex items-center gap-2 text-sm text-text-muted">
                          <Wrench className="h-4 w-4" />
                          <span className="font-semibold text-text-main">
                            {availableCount}
                          </span>
                          / {labEquipment.length} available
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          Select
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <section className="space-y-7">
            <button
              type="button"
              onClick={() => {
                setSelectedLabId("");
                setSelectedEquipmentId("");
                setMessage("");
                setErrorMessage("");
              }}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to labs
            </button>

            <div>
              <h2 className="text-4xl font-semibold text-text-main">
                {selectedLab.name}
              </h2>
              <div className="mt-4 flex flex-wrap gap-5 text-sm text-text-muted">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {selectedLab.location || "-"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  {selectedLab.course || "-"}
                </span>
              </div>
              <p className="mt-4 max-w-4xl text-lg leading-relaxed text-text-muted">
                {selectedLab.description || "No description provided."}
              </p>
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={equipmentSearch}
                onChange={(event) => setEquipmentSearch(event.target.value)}
                placeholder="Search equipment in this lab..."
                className="pl-11"
                aria-label="Search equipment in this lab"
              />
            </label>

            <div className="space-y-5">
              {filteredLabEquipment.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => openEquipmentDetail(item)}
                  className="flex w-full flex-col gap-4 rounded-2xl border border-border-light bg-white p-6 text-left transition-colors hover:border-primary focus:border-primary focus:outline-none md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Activity className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-text-main">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-sm text-text-muted">
                        {item.id} | {truncate(item.description, 95)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${getStatusClass(
                            item.status,
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                        <span className="font-semibold text-primary">
                          {formatRm(item.price_per_hour || 0)}/hr
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    Edit
                  </span>
                </button>
              ))}

              {filteredLabEquipment.length === 0 ? (
                <p className="rounded-xl border border-border-light bg-white px-4 py-8 text-sm text-text-muted">
                  No equipment found in this lab.
                </p>
              ) : null}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-text-main">{label}</span>
      {children}
    </label>
  );
}
