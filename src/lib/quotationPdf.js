import { jsPDF } from "jspdf";
import { formatRmFromUsd } from "@/lib/currency";

export const BOOKING_AGREEMENT_TEXT =
  "I (the undersigned), hereby agree to the service offer and prices provided by PPMU UTMKL and have read and understood the Terms and Conditions set by PPMU UTMKL";

const READ_FIRST_ITEMS = [
  "Application shall be made at least 3 working days before usage.",
  "All information provided in this form must be TRUE upon submission.",
  "If the equipment requested from applicants are to be brought outside the laboratory / workshop, an application letter endorsed by Supervisor / Project Leader / Lecturer needs to be submitted to the Director of Administration of Deputy Vice-Chancellor (Research & Innovation), UTMKL.",
  "The office has the right to reject any activity from the applicant if the activities are suspected to have high risks to the staff / environment and/or can cause damage to the instrument.",
  "For further inquiries on the availability of laboratory and equipment, kindly contact the staff of the respective laboratory.",
];

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

function formatDateRange(startDate, endDate) {
  if (!endDate || startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

function todayText() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getFileSafeName(value) {
  return String(value || "quotation")
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

function drawSection(doc, title, rows, x, y, width) {
  const usableRows = rows.filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (!usableRows.length) return y;

  y = addPageIfNeeded(doc, y, 14 + usableRows.length * 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, x, y);
  y += 2;
  doc.line(x, y, x + width, y);
  y += 7;

  doc.setFontSize(9);
  usableRows.forEach(([label, value]) => {
    y = addPageIfNeeded(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    y = drawWrappedText(doc, valueOrDash(value), x + 42, y, width - 42, 4.5);
    y += 2;
  });

  return y + 4;
}

export function downloadQuotationPdf({
  bookingType,
  quotationNumber = "DRAFT",
  quotationDate,
  resourceName,
  resourceId,
  requester = {},
  requesterIdentifier,
  requesterFaculty,
  requesterContact,
  pic = {},
  picCode,
  startDate,
  endDate,
  startTime,
  endTime,
  bookingDayCount = 1,
  durationHours = 0,
  pricePerHour = 0,
  totalPrice = 0,
  votNumber,
  purpose,
  resourceLocation,
  resourceStatus,
  resourceCourse,
  resourceDescription,
  resourceQuantity,
  resourceLabId,
} = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const tableWidth = pageWidth - margin * 2;
  const totalHours = Number(durationHours || 0) * Number(bookingDayCount || 0);
  const dateText = quotationDate || todayText();

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(120, 0, 45);
  doc.text("UTM", margin, 24);

  doc.setFontSize(8);
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA", margin, 30);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.text(
    "PUSAT PENGURUSAN MAKMAL UNIVERSITI (PPMU)",
    pageWidth - margin,
    18,
    {
      align: "right",
    },
  );
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA (UTM)", pageWidth - margin, 24, {
    align: "right",
  });
  doc.text("JALAN SULTAN YAHYA PETRA", pageWidth - margin, 30, {
    align: "right",
  });
  doc.text("54100 KUALA LUMPUR", pageWidth - margin, 36, {
    align: "right",
  });

  let y = 54;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `QUOTATION NO: ${valueOrDash(quotationNumber)}`,
    pageWidth - margin,
    54,
    {
      align: "right",
    },
  );
  doc.text(`DATE: ${dateText}`, pageWidth - margin, 62, { align: "right" });

  y = 76;
  doc.setFontSize(13);
  doc.text("QUOTATION", pageWidth / 2, y, { align: "center" });
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Read first", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  READ_FIRST_ITEMS.forEach((item, index) => {
    y = addPageIfNeeded(doc, y, 12);
    y = drawWrappedText(
      doc,
      `${index + 1}. ${item}`,
      margin,
      y,
      tableWidth,
      4.5,
    );
    y += 2;
  });

  y += 6;
  y = drawSection(
    doc,
    "User Information",
    [
      ["Username", requester.username],
      ["Role", requester.role],
      ["Email", requester.email],
      ["ID", requesterIdentifier],
      ["Faculty", requesterFaculty],
      ["Contact Number", requesterContact],
    ],
    margin,
    y,
    tableWidth,
  );

  y = drawSection(
    doc,
    "PIC Information",
    [
      ["PIC Username", pic.username],
      ["PIC Role", pic.role],
      ["PIC Email", pic.email],
      ["Code Used", picCode],
    ],
    margin,
    y,
    tableWidth,
  );

  y = drawSection(
    doc,
    bookingType === "Lab Booking" ? "Lab Information" : "Equipment Information",
    [
      ["Request Type", bookingType],
      ["Resource Name", resourceName],
      ["Resource ID", resourceId],
      ["Location", resourceLocation],
      ["Status", resourceStatus],
      ["Course", resourceCourse],
      ["Description", resourceDescription],
      ["Quantity", resourceQuantity],
      ["Lab ID", resourceLabId],
      ["Start Date", formatDate(startDate)],
      ["End Date", formatDate(endDate || startDate)],
      [
        "Booking Days",
        `${bookingDayCount} weekday${bookingDayCount === 1 ? "" : "s"}`,
      ],
      ["Start Time", startTime],
      ["End Time", endTime],
      ["Daily Duration", `${durationHours} hr`],
      ["Total Duration", `${totalHours} hr`],
      ["VOT Number", votNumber],
      ["Price Per Hour", formatRmFromUsd(pricePerHour)],
      ["Total Price", formatRmFromUsd(totalPrice)],
      ["Purpose", purpose],
    ],
    margin,
    y,
    tableWidth,
  );

  y = addPageIfNeeded(doc, y + 4, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Quotation Summary", margin, y);

  y += 7;
  const columns = [
    { label: "NO.", x: margin, width: 10, align: "center" },
    { label: "ITEM", x: margin + 10, width: 80 },
    { label: "PRICE / UNIT", x: margin + 90, width: 28, align: "center" },
    { label: "QTY", x: margin + 118, width: 24, align: "center" },
    {
      label: "TOTAL (RM)",
      x: margin + 142,
      width: tableWidth - 142,
      align: "center",
    },
  ];
  const tableTop = y;
  doc.rect(margin, tableTop, tableWidth, 11);
  doc.setFont("helvetica", "bold");
  columns.forEach((column, index) => {
    if (index > 0) doc.line(column.x, tableTop, column.x, tableTop + 11);
    doc.text(column.label, column.x + column.width / 2, tableTop + 7, {
      align: column.align || "left",
    });
  });

  const itemText = `${valueOrDash(resourceName)} (${valueOrDash(bookingType)})\nResource ID: ${valueOrDash(resourceId)}\nDate: ${formatDateRange(startDate, endDate)}\nTime: ${valueOrDash(startTime)} - ${valueOrDash(endTime)}\nVOT: ${valueOrDash(votNumber)}`;
  const itemLines = doc.splitTextToSize(itemText, 76);
  const rowTop = tableTop + 11;
  const rowHeight = Math.max(27, itemLines.length * 5 + 4);
  doc.rect(margin, rowTop, tableWidth, rowHeight);
  columns.slice(1).forEach((column) => {
    doc.line(column.x, rowTop, column.x, rowTop + rowHeight);
  });

  doc.setFont("helvetica", "normal");
  doc.text("1", margin + 5, rowTop + 8, { align: "center" });
  doc.text(itemLines, margin + 13, rowTop + 6);
  doc.text(formatRmFromUsd(pricePerHour), margin + 104, rowTop + 8, {
    align: "center",
  });
  doc.text(`${totalHours} hr`, margin + 130, rowTop + 8, { align: "center" });
  doc.text(formatRmFromUsd(totalPrice), pageWidth - margin - 4, rowTop + 8, {
    align: "right",
  });

  const totalTop = rowTop + rowHeight;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL AMOUNT (RM):", margin + 114, totalTop + 7);
  doc.rect(margin + 142, totalTop, tableWidth - 142, 9);
  doc.text(formatRmFromUsd(totalPrice), pageWidth - margin - 4, totalTop + 7, {
    align: "right",
  });

  y = addPageIfNeeded(doc, totalTop + 16, 60);
  doc.setFont("helvetica", "bold");
  doc.text("Terms and Conditions:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  [
    "This quotation is issued by PPMU, UTM Kuala Lumpur.",
    "Bookings are subject to approval and resource availability.",
    "Payment shall be made within fourteen (14) days from the invoice date.",
    "Services or usage may proceed only after the booking request is approved.",
    "Results, reports, or booking confirmations will be released after payment is completed, where applicable.",
  ].forEach((term, index) => {
    y = drawWrappedText(doc, `${index + 1}. ${term}`, margin, y, tableWidth);
    y += 2;
  });

  y = addPageIfNeeded(doc, y + 10, 50);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Confirmation", margin, y);
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  y = drawWrappedText(doc, BOOKING_AGREEMENT_TEXT, margin, y, tableWidth);
  y += 10;
  doc.text(`Name: ${valueOrDash(requester.username)}`, margin, y);
  y += 8;
  // doc.text("Signature: (                                      )", margin, y);
  // y += 8;
  doc.text(`Date: ${dateText}`, margin, y);

  const fileName = `${getFileSafeName(quotationNumber)}.pdf`;
  doc.save(fileName || "quotation.pdf");
}
