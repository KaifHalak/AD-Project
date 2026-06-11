"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Eye,
  MapPin,
  ShoppingCart,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRmFromUsd } from "@/lib/currency";
import {
  getStoredBookingRequestItems,
  saveStoredBookingRequestItems,
} from "@/lib/bookingRequest";

function formatDateRange(item) {
  if (item.startDate === item.endDate) return item.startDate;
  return `${item.startDate} to ${item.endDate}`;
}

export default function CompleteBookingPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState({
    requesterIdentifier: "",
    requesterFaculty: "",
    requesterContact: "",
    studyLevel: "",
    lectName: "",
    lectEmail: "",
    lectContact: "",
    votNumber: "",
    requestDetails: "",
    picCode: "",
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

      setItems(getStoredBookingRequestItems());
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const total = useMemo(
    () =>
      items.reduce((sum, item) => sum + Number(item.estimatedTotal || 0), 0),
    [items],
  );

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateReason(clientId, bookingReason) {
    const nextItems = items.map((item) =>
      item.clientId === clientId ? { ...item, bookingReason } : item,
    );
    setItems(nextItems);
    saveStoredBookingRequestItems(nextItems);
    setSelectedItem((current) =>
      current?.clientId === clientId ? { ...current, bookingReason } : current,
    );
  }

  function removeItem(clientId) {
    const nextItems = items.filter((item) => item.clientId !== clientId);
    setItems(nextItems);
    saveStoredBookingRequestItems(nextItems);
    setSelectedItem(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (items.length === 0) {
      setErrorMessage("Add at least one equipment item before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: sessionData } = await getCurrentSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          items: items.map((item) => ({
            equipmentId: item.equipmentId,
            startDate: item.startDate,
            endDate: item.endDate,
            startTime: item.startTime,
            endTime: item.endTime,
            bookingReason: item.bookingReason,
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Could not submit booking request.");
        return;
      }

      saveStoredBookingRequestItems([]);
      setItems([]);
      setSuccessMessage(data.message || "Booking request submitted.");
      setTimeout(() => router.push("/booking-records"), 900);
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while submitting your request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-full bg-background-main px-4 py-6 md:px-7 md:py-8">
      <section className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-7">
          <button
            type="button"
            onClick={() => router.push("/booking")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to booking
          </button>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-text-main">
                Complete Booking
              </h1>
              <p className="mt-2 text-sm text-text-muted">
                Review all selected equipment before submitting one request.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border-light bg-white px-4 py-2 text-sm font-semibold text-text-main">
              <ShoppingCart className="h-4 w-4 text-primary" />
              {items.length} item{items.length === 1 ? "" : "s"} in request
            </span>
          </div>

          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-border-light bg-white px-4 py-12 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 font-semibold text-text-main">
                  No equipment selected
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Add equipment from the booking page to build your request.
                </p>
                <Button
                  type="button"
                  onClick={() => router.push("/booking")}
                  className="mt-5"
                >
                  Browse Labs
                </Button>
              </div>
            ) : null}

            {items.map((item, index) => (
              <article
                key={item.clientId}
                className="rounded-2xl border border-border-light bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
                        Item {index + 1}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold text-text-main">
                      {item.equipmentName}
                    </h2>
                    <div className="grid gap-2 text-sm text-text-muted md:grid-cols-2">
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {item.labName}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {formatDateRange(item)} | {item.startTime} -{" "}
                        {item.endTime}
                      </span>
                    </div>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-text-main">
                        Reason
                      </span>
                      <textarea
                        value={item.bookingReason || ""}
                        onChange={(event) =>
                          updateReason(item.clientId, event.target.value)
                        }
                        rows={3}
                        className="w-full resize-none rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
                      />
                    </label>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3">
                    <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-left md:text-right">
                      <p className="text-xs font-semibold uppercase text-text-muted">
                        Est. Price
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-primary">
                        {formatRmFromUsd(item.estimatedTotal || 0)}
                      </p>
                    </div>
                    <div className="flex gap-2 md:flex-col">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => removeItem(item.clientId)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border-light bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-xl font-semibold text-text-main">
            Request Details
          </h2>
          <div className="mt-4 rounded-xl border border-border-light bg-background-main p-4">
            <p className="text-sm text-text-muted">Estimated total</p>
            <p className="mt-1 text-3xl font-semibold text-primary">
              {formatRmFromUsd(total)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <FormSection title="User Details">
              <Field label="User ID" required>
                <Input
                  value={form.requesterIdentifier}
                  onChange={(event) =>
                    updateForm("requesterIdentifier", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Faculty" required>
                <Input
                  value={form.requesterFaculty}
                  onChange={(event) =>
                    updateForm("requesterFaculty", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Contact Number" required>
                <Input
                  value={form.requesterContact}
                  onChange={(event) =>
                    updateForm("requesterContact", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Study Level" required>
                <select
                  value={form.studyLevel}
                  onChange={(event) =>
                    updateForm("studyLevel", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm text-text-main outline-none transition-colors focus:border-primary"
                  required
                >
                  <option value="">Select study level</option>
                  <option value="diploma">Diploma</option>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="postgraduate">Postgraduate</option>
                </select>
              </Field>
            </FormSection>

            <FormSection title="Lecturer Details">
              <Field label="Lecturer Name" required>
                <Input
                  value={form.lectName}
                  onChange={(event) =>
                    updateForm("lectName", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Lecturer Email" required>
                <Input
                  type="email"
                  value={form.lectEmail}
                  onChange={(event) =>
                    updateForm("lectEmail", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Lecturer Contact" required>
                <Input
                  value={form.lectContact}
                  onChange={(event) =>
                    updateForm("lectContact", event.target.value)
                  }
                  required
                />
              </Field>

              <Field label="VOT Number" required>
                <Input
                  value={form.votNumber}
                  onChange={(event) =>
                    updateForm("votNumber", event.target.value)
                  }
                  required
                />
              </Field>
            </FormSection>

            <FormSection title="Request Details">
              <Field label="PIC Token" required>
                <Input
                  value={form.picCode}
                  onChange={(event) =>
                    updateForm("picCode", event.target.value)
                  }
                  maxLength={6}
                  placeholder="6-character code"
                  required
                />
              </Field>
              <Field label="Additional Request Details">
                <textarea
                  value={form.requestDetails}
                  onChange={(event) =>
                    updateForm("requestDetails", event.target.value)
                  }
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
                />
              </Field>
            </FormSection>

            <div className="space-y-3 pt-2">
              {errorMessage ? (
                <p className="rounded-xl border border-warning/20 bg-white px-4 py-3 text-sm font-medium text-warning">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                  {successMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting ? "Submitting..." : "Submit Booking Request"}
              </Button>
            </div>
          </form>
        </aside>
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl border border-border-light bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-text-main">
                  {selectedItem.equipmentName}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {selectedItem.equipmentId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border border-border-light px-3 py-2 text-sm font-semibold text-text-muted hover:bg-background-main"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 text-sm md:grid-cols-2">
              <Detail label="Lab" value={selectedItem.labName} />
              <Detail label="Date" value={formatDateRange(selectedItem)} />
              <Detail
                label="Time"
                value={`${selectedItem.startTime} - ${selectedItem.endTime}`}
              />
              <Detail
                label="Estimated Price"
                value={formatRmFromUsd(selectedItem.estimatedTotal || 0)}
              />
              <Detail
                label="Staff Name"
                value={selectedItem.staffName || "-"}
              />
              <Detail
                label="Staff Email"
                value={selectedItem.staffEmail || "-"}
              />
              <Detail
                label="Staff Contact"
                value={selectedItem.staffContact || "-"}
              />
              <Detail
                label="Price Per Hour"
                value={formatRmFromUsd(selectedItem.pricePerHour || 0)}
              />
            </div>

            <div className="mt-5 rounded-xl border border-border-light bg-background-main p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-text-main">
                <Wrench className="h-4 w-4 text-primary" />
                Reason
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">
                {selectedItem.bookingReason || "No reason provided."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-border-light bg-background-main p-4">
      <h3 className="text-sm font-semibold uppercase text-primary">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children, required = false }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-text-main">
        {label}
        {required ? <span className="text-warning"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-border-light bg-background-main p-3">
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-main">{value}</p>
    </div>
  );
}
