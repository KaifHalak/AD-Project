"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  GraduationCap,
  MapPin,
  Microscope,
  Search,
  UserRound,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentSession } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import { formatRmFromUsd } from "@/lib/currency";
import {
  calculateItemTotal,
  getBookingDates,
  getStoredBookingRequestItems,
  saveStoredBookingRequestItems,
} from "@/lib/bookingRequest";
import {
  END_TIME_OPTIONS,
  START_TIME_OPTIONS,
  getDefaultBookingDateString,
} from "@/lib/bookingConstraints";

function getTodayDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(today.getDate()).padStart(2, "0")}`;
}

function getUniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
}

function truncate(value, maxLength = 115) {
  const text = String(value || "No description provided.");
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function scheduleMatchesDate(item, selectedDate) {
  return String(item.start_date) <= selectedDate && String(item.end_date) >= selectedDate;
}

export function BookingContent({ initialLabId = "", initialEquipmentId = "" }) {
  const router = useRouter();
  const [labs, setLabs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [selectedProgramme, setSelectedProgramme] = useState("All Programmes");
  const [search, setSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [selectedLabId, setSelectedLabId] = useState(initialLabId);
  const [selectedEquipmentId, setSelectedEquipmentId] =
    useState(initialEquipmentId);
  const [activeLabView, setActiveLabView] = useState("equipment");
  const [scheduleDate, setScheduleDate] = useState(getTodayDateString());
  const [labSchedule, setLabSchedule] = useState([]);
  const [basketEquipmentIds, setBasketEquipmentIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [addSuccessMessage, setAddSuccessMessage] = useState("");
  const [form, setForm] = useState({
    startDate: getDefaultBookingDateString(),
    endDate: getDefaultBookingDateString(),
    startTime: "09:00",
    endTime: "11:00",
    bookingReason: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data: sessionData } = await getCurrentSession();
      if (!isMounted) return;

      if (!sessionData?.session) {
        router.replace("/");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const [labsResult, equipmentResult] = await Promise.all([
        supabase
          .from("labs")
          .select("id, name, description, location, status, price_per_hour, course")
          .order("name", { ascending: true }),
        supabase
          .from("equipment")
          .select("id, name, description, location, status, price_per_hour, course, lab_id, staff_name, staff_email, staff_contact")
          .order("name", { ascending: true }),
      ]);

      if (!isMounted) return;

      if (labsResult.error || equipmentResult.error) {
        console.error(labsResult.error || equipmentResult.error);
        setErrorMessage("Could not load booking catalog.");
      } else {
        setLabs(labsResult.data || []);
        setEquipment(equipmentResult.data || []);
      }

      setBasketEquipmentIds(
        new Set(getStoredBookingRequestItems().map((item) => item.equipmentId)),
      );
      setIsLoading(false);
    }

    init();

    function refreshBasket() {
      setBasketEquipmentIds(
        new Set(getStoredBookingRequestItems().map((item) => item.equipmentId)),
      );
    }

    window.addEventListener("booking-request-updated", refreshBasket);
    window.addEventListener("storage", refreshBasket);

    return () => {
      isMounted = false;
      window.removeEventListener("booking-request-updated", refreshBasket);
      window.removeEventListener("storage", refreshBasket);
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
  const visibleSchedule = labSchedule.filter((item) =>
    scheduleMatchesDate(item, scheduleDate),
  );

  useEffect(() => {
    if (selectedEquipment?.lab_id) {
      loadSchedule(selectedEquipment.lab_id);
    }
  }, [selectedEquipment?.id, selectedEquipment?.lab_id]);

  async function loadSchedule(labId) {
    setIsScheduleLoading(true);
    setLabSchedule([]);
    setErrorMessage("");

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("equipment_bookings")
      .select("id, equipment_id, start_date, end_date, start_time, end_time, status")
      .eq("lab_id", labId)
      .in("status", [
        "pending",
        "under_unit_leader_review",
        "under_ppmu_review",
        "approved",
      ])
      .order("start_date", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMessage("Could not load the lab schedule.");
      setIsScheduleLoading(false);
      return;
    }

    setLabSchedule(data || []);
    setIsScheduleLoading(false);
  }

  function openLab(labId) {
    setSelectedLabId(labId);
    setSelectedEquipmentId("");
    setEquipmentSearch("");
    setActiveLabView("equipment");
    setMessage("");
    setErrorMessage("");
    router.push(`/booking/${encodeURIComponent(labId)}`);
  }

  function openSchedule() {
    if (!selectedLab) return;
    setActiveLabView("schedule");
    loadSchedule(selectedLab.id);
  }

  function openEquipmentView() {
    setActiveLabView("equipment");
    setErrorMessage("");
  }

  function openEquipmentDetail(item) {
    if (basketEquipmentIds.has(item.id) || item.status === "maintenance") return;
    setSelectedEquipmentId(item.id);
    setMessage("");
    setErrorMessage("");
    setAddSuccessMessage("");
    loadSchedule(item.lab_id);
    router.push(`/booking/${encodeURIComponent(item.lab_id)}/${encodeURIComponent(item.id)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "startDate" && current.endDate < value ? { endDate: value } : {}),
    }));
  }

  async function handleAddToRequest(event) {
    event.preventDefault();

    if (!selectedEquipment) return;

    setIsChecking(true);
    setErrorMessage("");
    setMessage("");

    try {
      const { data: sessionData } = await getCurrentSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch("/api/bookings/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          equipmentId: selectedEquipment.id,
          ...form,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "This item is not available.");
        return;
      }

      const lab = labs.find((item) => item.id === selectedEquipment.lab_id);
      const datesResult = getBookingDates(form.startDate, form.endDate);
      const dayCount = datesResult.dates?.length || 1;
      const total = calculateItemTotal({
        pricePerHour: selectedEquipment.price_per_hour,
        startTime: form.startTime,
        endTime: form.endTime,
        dayCount,
      });
      const nextItems = [
        ...getStoredBookingRequestItems(),
        {
          clientId: `${selectedEquipment.id}-${Date.now()}`,
          equipmentId: selectedEquipment.id,
          equipmentName: selectedEquipment.name,
          equipmentDescription: selectedEquipment.description || "",
          labId: selectedEquipment.lab_id,
          labName: lab?.name || selectedEquipment.lab_id,
          startDate: form.startDate,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime,
          bookingReason: form.bookingReason,
          pricePerHour: selectedEquipment.price_per_hour || 0,
          estimatedTotal: total,
          staffName: selectedEquipment.staff_name || "",
          staffEmail: selectedEquipment.staff_email || "",
          staffContact: selectedEquipment.staff_contact || "",
        },
      ];

      saveStoredBookingRequestItems(nextItems);
      setBasketEquipmentIds(
        new Set(nextItems.map((item) => item.equipmentId)),
      );
      setAddSuccessMessage(`${selectedEquipment.name} added to your booking request.`);
      setForm((current) => ({ ...current, bookingReason: "" }));
      setTimeout(() => {
        setSelectedLabId("");
        setSelectedEquipmentId("");
        setAddSuccessMessage("");
        router.push("/booking");
      }, 900);
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while checking availability.");
    } finally {
      setIsChecking(false);
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
              router.replace(`/booking/${encodeURIComponent(selectedLab.id)}`);
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
              <p className="text-3xl font-semibold text-primary">
                {formatRmFromUsd(selectedEquipment.price_per_hour || 0)}/hr
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard
              icon={<UserRound className="h-4 w-4 text-primary" />}
              label="Staff Name"
              value={selectedEquipment.staff_name || "-"}
            />
            <InfoCard
              icon={<UserRound className="h-4 w-4 text-primary" />}
              label="Staff Email"
              value={selectedEquipment.staff_email || "-"}
            />
            <InfoCard
              icon={<UserRound className="h-4 w-4 text-primary" />}
              label="Staff Contact"
              value={selectedEquipment.staff_contact || "-"}
            />
          </div>

          <SchedulePanel
            scheduleDate={scheduleDate}
            setScheduleDate={setScheduleDate}
            visibleSchedule={visibleSchedule}
            isScheduleLoading={isScheduleLoading}
          />

          <form
            onSubmit={handleAddToRequest}
            className="rounded-3xl border border-border-light bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-semibold text-text-main">
              Add to Request
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Start Date">
                <Input
                  type="date"
                  value={form.startDate}
                  min={getDefaultBookingDateString()}
                  onChange={(event) => updateForm("startDate", event.target.value)}
                  required
                />
              </Field>
              <Field label="End Date">
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(event) => updateForm("endDate", event.target.value)}
                  required
                />
              </Field>
              <Field label="Start Time">
                <select
                  value={form.startTime}
                  onChange={(event) => updateForm("startTime", event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm text-text-main outline-none focus:border-primary"
                >
                  {START_TIME_OPTIONS.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </Field>
              <Field label="End Time">
                <select
                  value={form.endTime}
                  onChange={(event) => updateForm("endTime", event.target.value)}
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm text-text-main outline-none focus:border-primary"
                >
                  {END_TIME_OPTIONS.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </Field>
              <Field label="Purpose / Reason" full>
                <textarea
                  value={form.bookingReason}
                  onChange={(event) => updateForm("bookingReason", event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
                  placeholder="Describe how this equipment will be used..."
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-col items-end gap-3">
              <Button
                type="submit"
                disabled={isChecking || basketEquipmentIds.has(selectedEquipment.id)}
                className="w-auto"
              >
                {basketEquipmentIds.has(selectedEquipment.id)
                  ? "Already in Request"
                  : isChecking
                    ? "Checking..."
                    : "Add to Request"}
              </Button>
              {addSuccessMessage ? (
                <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                  {addSuccessMessage}
                </p>
              ) : null}
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
          <h1 className="text-3xl font-semibold text-text-main">Booking</h1>
          <p className="mt-2 text-sm text-text-muted">
            Browse labs, choose equipment, and add each item to one request.
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
                    (item) => item.status !== "maintenance",
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
                          {availableCount} equipment available
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
                          / {labEquipment.length} equipment available
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
                router.push("/booking");
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

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openEquipmentView}
                className={`inline-flex h-11 items-center justify-center rounded-xl border px-4 text-base font-semibold transition-colors ${
                  activeLabView === "equipment"
                    ? "border-primary bg-primary text-white"
                    : "border-border-light bg-white text-text-main hover:bg-background-main"
                }`}
              >
                Equipment
              </button>
              <button
                type="button"
                onClick={openSchedule}
                className={`inline-flex h-11 items-center justify-center rounded-xl border px-4 text-base font-semibold transition-colors ${
                  activeLabView === "schedule"
                    ? "border-primary bg-primary text-white"
                    : "border-border-light bg-white text-text-main hover:bg-background-main"
                }`}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                View Schedule
              </button>
            </div>

            {activeLabView === "equipment" ? (
              <div className="space-y-5">
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

                {filteredLabEquipment.map((item) => {
                  const isAlreadyInRequest = basketEquipmentIds.has(item.id);
                  const isUnavailable =
                    item.status === "maintenance" || isAlreadyInRequest;

                  return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => openEquipmentDetail(item)}
                    disabled={isUnavailable}
                    className="flex w-full flex-col gap-4 rounded-2xl border border-border-light bg-white p-6 text-left transition-colors hover:border-primary focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 md:flex-row md:items-center md:justify-between"
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
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                              item.status === "maintenance"
                                ? "bg-yellow-100 text-yellow-700"
                                : isAlreadyInRequest
                                  ? "bg-border-light text-text-muted"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {item.status === "maintenance"
                              ? "Maintenance"
                              : isAlreadyInRequest
                                ? "Already in request"
                                : "Available"}
                          </span>
                          <span className="font-semibold text-primary">
                            {formatRmFromUsd(item.price_per_hour || 0)}/hr
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {isAlreadyInRequest ? "Already in basket" : "View Details"}
                    </span>
                  </button>
                  );
                })}

                {filteredLabEquipment.length === 0 ? (
                  <p className="rounded-xl border border-border-light bg-white px-4 py-8 text-sm text-text-muted">
                    No equipment found in this lab.
                  </p>
                ) : null}
              </div>
            ) : (
              <SchedulePanel
                scheduleDate={scheduleDate}
                setScheduleDate={setScheduleDate}
                visibleSchedule={visibleSchedule}
                isScheduleLoading={isScheduleLoading}
              />
            )}
          </section>
        )}
      </section>
    </main>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`${full ? "md:col-span-2" : ""} block space-y-2`}>
      <span className="text-sm font-semibold text-text-main">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-2 break-words font-semibold text-text-main">{value}</p>
    </div>
  );
}

function SchedulePanel({
  scheduleDate,
  setScheduleDate,
  visibleSchedule,
  isScheduleLoading,
}) {
  return (
    <div className="rounded-3xl border border-border-light bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-text-main">Schedule</h3>
          <p className="mt-1 text-sm text-text-muted">
            Showing unavailable blocks for the selected date.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-text-main">Date</span>
          <Input
            type="date"
            value={scheduleDate}
            onChange={(event) => setScheduleDate(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-border-light bg-background-main p-4">
        <p className="text-sm font-semibold text-text-main">{scheduleDate}</p>
        <div className="mt-4 space-y-3">
          {isScheduleLoading ? (
            <p className="text-sm text-text-muted">Loading schedule...</p>
          ) : visibleSchedule.length === 0 ? (
            <p className="text-sm text-text-muted">
              No pending or approved bookings are currently shown for this date.
            </p>
          ) : (
            visibleSchedule.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 rounded-xl border border-border-light bg-white px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
              >
                <span className="font-semibold text-text-main">
                  {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}
                </span>
                <span className="text-text-muted">
                  {item.equipment_id} | {item.status?.replaceAll("_", " ")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return <BookingContent />;
}
