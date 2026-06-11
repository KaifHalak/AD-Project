import { jsPDF } from "jspdf";
import { formatRmFromUsd } from "@/lib/currency";

function valueOrDash(value) {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return new Date().toLocaleString("en-GB");
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : "-";
}

function getFileSafeName(value) {
  return String(value || "booking-request-receipt")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function drawWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(valueOrDash(text), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addPageIfNeeded(doc, y, neededHeight) {
  if (y + neededHeight <= 280) return y;
  doc.addPage();
  return 20;
}

function drawSectionTitle(doc, title, x, y, width) {
  y = addPageIfNeeded(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(170, 0, 70);
  doc.text(title, x, y);
  doc.setDrawColor(220, 220, 220);
  doc.line(x, y + 2, x + width, y + 2);
  doc.setTextColor(25, 25, 25);
  return y + 9;
}

function drawKeyValueRows(doc, rows, x, y, width) {
  doc.setFontSize(9);

  rows.forEach(([label, value]) => {
    y = addPageIfNeeded(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    y = drawWrappedText(doc, valueOrDash(value), x + 48, y, width - 48, 4.5);
    y += 2;
  });

  return y + 4;
}

function getReceiptItems(booking) {
  return Array.isArray(booking?.items) ? booking.items : [];
}

function getEstimatedItemTotal(item) {
  return Number(item?.total_price || item?.estimatedTotal || 0);
}

function getEstimatedTotal(booking, items) {
  if (items.length > 0) {
    return items.reduce((sum, item) => sum + getEstimatedItemTotal(item), 0);
  }

  return Number(booking?.total_price || booking?.final_total_price || 0);
}

export function createBookingReceiptPdfDoc(booking = {}) {
  const items = getReceiptItems(booking);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const receiptNumber = `BRR-${valueOrDash(booking.id)}`;
  const estimatedTotal = getEstimatedTotal(booking, items);

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(120, 0, 45);
  doc.text("UTM", margin, 24);
  doc.setFontSize(8);
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA", margin, 30);

  doc.setTextColor(25, 25, 25);
  doc.setFontSize(10);
  doc.text("PUSAT PENGURUSAN MAKMAL UNIVERSITI (PPMU)", pageWidth - margin, 18, {
    align: "right",
  });
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA KUALA LUMPUR", pageWidth - margin, 24, {
    align: "right",
  });
  doc.text("JALAN SULTAN YAHYA PETRA", pageWidth - margin, 30, {
    align: "right",
  });
  doc.text("54100 KUALA LUMPUR", pageWidth - margin, 36, {
    align: "right",
  });

  let y = 52;
  doc.setFontSize(15);
  doc.text("BOOKING REQUEST RECEIPT", pageWidth / 2, y, { align: "center" });
  doc.setDrawColor(170, 0, 70);
  doc.line(margin, y + 4, pageWidth - margin, y + 4);

  y += 16;
  y = drawSectionTitle(doc, "Request Information", margin, y, contentWidth);
  y = drawKeyValueRows(
    doc,
    [
      ["Receipt / Request No.", receiptNumber],
      ["Booking ID", booking.id],
      ["Submission Date", formatDateTime(booking.created_at)],
      ["Current Status", "Pending"],
      [
        "Note",
        "This receipt confirms that your booking request has been submitted. Approval is subject to PPMU review.",
      ],
    ],
    margin,
    y,
    contentWidth,
  );

  y = drawSectionTitle(doc, "Requester Information", margin, y, contentWidth);
  y = drawKeyValueRows(
    doc,
    [
      ["Name", booking.user_name],
      ["Email", booking.user_email],
      ["User / Matric / Staff ID", booking.requester_identifier],
      ["Faculty", booking.requester_faculty],
      ["Contact Number", booking.requester_contact],
      ["Student Status", booking.study_level || booking.studyLevel],
    ],
    margin,
    y,
    contentWidth,
  );

  y = drawSectionTitle(doc, "Lecturer Information", margin, y, contentWidth);
  y = drawKeyValueRows(
    doc,
    [
      ["Lecturer Name", booking.lect_name || booking.lecturerName],
      ["Lecturer Email", booking.lect_email || booking.lecturerEmail],
      ["Lecturer Contact", booking.lect_contact || booking.lecturerContact],
    ],
    margin,
    y,
    contentWidth,
  );

  y = drawSectionTitle(doc, "Booking Request Details", margin, y, contentWidth);
  y = drawKeyValueRows(
    doc,
    [
      ["VOT Number", booking.vot_number],
      ["PIC Token / Code Used", booking.pic_token || booking.token],
      ["Additional Details", booking.request_details || "No additional details provided."],
    ],
    margin,
    y,
    contentWidth,
  );

  y = drawSectionTitle(doc, "Requested Equipment Summary", margin, y, contentWidth);

  if (items.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No equipment items found for this request.", margin, y);
    y += 10;
  } else {
    items.forEach((item, index) => {
      const detailLines = [
        `Equipment ID: ${valueOrDash(item.equipment_id || item.equipmentId)}`,
        `Lab: ${valueOrDash(item.lab_name || item.labName)} / ${valueOrDash(item.lab_id || item.labId)}`,
        `Staff in Charge: ${valueOrDash(item.staff_name || item.staffName)}`,
        `Date: ${formatDate(item.start_date || item.startDate)} to ${formatDate(item.end_date || item.endDate || item.start_date || item.startDate)}`,
        `Time: ${formatTime(item.start_time || item.startTime)} - ${formatTime(item.end_time || item.endTime)}`,
        `Purpose: ${valueOrDash(item.booking_reason || item.bookingReason)}`,
        `Estimated Price: ${formatRmFromUsd(getEstimatedItemTotal(item))}`,
      ];
      const wrappedDetailLines = doc.splitTextToSize(
        detailLines.join("\n"),
        contentWidth - 8,
      );
      const blockHeight = Math.max(48, wrappedDetailLines.length * 4.5 + 16);

      y = addPageIfNeeded(doc, y, blockHeight + 6);
      doc.setFillColor(248, 247, 242);
      doc.setDrawColor(225, 225, 225);
      doc.roundedRect(margin, y - 4, contentWidth, blockHeight, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${valueOrDash(item.equipment_name || item.equipmentName)}`, margin + 4, y + 3);
      doc.setFontSize(8);
      doc.setTextColor(170, 0, 70);
      doc.text("Status: Pending", pageWidth - margin - 4, y + 3, {
        align: "right",
      });
      doc.setTextColor(25, 25, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(wrappedDetailLines, margin + 4, y + 10);
      y += blockHeight + 6;
    });
  }

  y = drawSectionTitle(doc, "Summary", margin, y, contentWidth);
  y = drawKeyValueRows(
    doc,
    [
      ["Total Requested Items", items.length],
      ["Estimated Total Amount", formatRmFromUsd(estimatedTotal)],
      ["Overall Status", "Pending Review"],
    ],
    margin,
    y,
    contentWidth,
  );

  y = addPageIfNeeded(doc, y, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(170, 0, 70);
  y = drawWrappedText(
    doc,
    "This is a booking request receipt only. It does not confirm approval. Approved items and final payable amount may change after review by PPMU.",
    margin,
    y,
    contentWidth,
    4.5,
  );

  return doc;
}

export function createBookingReceiptPdfBuffer(booking = {}) {
  const doc = createBookingReceiptPdfDoc(booking);
  return Buffer.from(doc.output("arraybuffer"));
}

export function downloadBookingReceiptPdf(booking = {}) {
  const doc = createBookingReceiptPdfDoc(booking);
  const receiptNumber = `BRR-${valueOrDash(booking.id)}`;
  doc.save(`${getFileSafeName(receiptNumber)}.pdf`);
}
