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

function valueList(values) {
  const uniqueValues = [
    ...new Set((values || []).map((value) => valueOrDash(value)).filter((value) => value !== "-")),
  ];

  if (uniqueValues.length === 0) return "-";
  if (uniqueValues.length === 1) return uniqueValues[0];
  return "Multiple";
}

function getItemStatus(item) {
  return String(item?.approvalStatus || item?.resourceStatus || item?.status || "")
    .trim()
    .toLowerCase();
}

function getItemStatusLabel(item) {
  const status = getItemStatus(item);

  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return valueOrDash(item?.approvalStatus || item?.resourceStatus || item?.status);
}

function getBillableItemTotal(item) {
  return getItemStatus(item) === "rejected" ? 0 : Number(item?.totalPrice || 0);
}

function normalizeQuotationItems({
  bookingType,
  resourceName,
  resourceId,
  resourceLocation,
  resourceStatus,
  resourceCourse,
  resourceDescription,
  resourceQuantity,
  resourceLabId,
  startDate,
  endDate,
  startTime,
  endTime,
  bookingDayCount,
  durationHours,
  pricePerHour,
  totalPrice,
  purpose,
  items,
}) {
  if (Array.isArray(items) && items.length > 0) {
    return items;
  }

  return [
    {
      bookingType,
      resourceName,
      resourceId,
      resourceLocation,
      resourceStatus,
      resourceCourse,
      resourceDescription,
      resourceQuantity,
      resourceLabId,
      startDate,
      endDate,
      startTime,
      endTime,
      bookingDayCount,
      durationHours,
      pricePerHour,
      totalPrice,
      purpose,
    },
  ];
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

function drawSection(doc, title, rows, x, y, width) {
  const usableRows = rows.filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (!usableRows.length) return y;

  y = drawSectionTitle(doc, title, x, y, width);

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

function drawQuotationItemCard({
  doc,
  item,
  index,
  bookingType,
  votNumber,
  margin,
  pageWidth,
  contentWidth,
  y,
}) {
  const itemTotalHours =
    Number(item.durationHours || 0) * Number(item.bookingDayCount || 0);
  const itemStatus = getItemStatusLabel(item);
  const itemTotal = getBillableItemTotal(item);
  const detailLines = [
    `Status: ${itemStatus}`,
    `Resource ID: ${valueOrDash(item.resourceId)}`,
    `Type: ${valueOrDash(item.bookingType || bookingType)}`,
    `Date: ${formatDateRange(item.startDate, item.endDate)}`,
    `Time: ${valueOrDash(item.startTime)} - ${valueOrDash(item.endTime)}`,
    `VOT: ${valueOrDash(votNumber)}`,
    `Price / Unit: ${formatRmFromUsd(item.pricePerHour || 0)}`,
    `Qty: ${itemTotalHours} hr`,
    `Total: ${formatRmFromUsd(itemTotal)}`,
  ];
  const wrappedDetailLines = doc.splitTextToSize(
    detailLines.join("\n"),
    contentWidth - 8,
  );
  const blockHeight = Math.max(52, wrappedDetailLines.length * 4.5 + 18);

  y = addPageIfNeeded(doc, y, blockHeight + 6);
  doc.setFillColor(248, 247, 242);
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(margin, y - 4, contentWidth, blockHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text(`${index + 1}. ${valueOrDash(item.resourceName)}`, margin + 4, y + 3);

  doc.setFontSize(8);
  doc.setTextColor(itemStatus === "Rejected" ? 180 : 20, itemStatus === "Rejected" ? 30 : 120, 70);
  doc.text(formatRmFromUsd(itemTotal), pageWidth - margin - 4, y + 3, {
    align: "right",
  });

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(wrappedDetailLines, margin + 4, y + 10);

  return y + blockHeight + 6;
}

export function createQuotationPdfDoc({
  bookingType,
  quotationNumber = "DRAFT",
  quotationDate,
  resourceName,
  resourceId,
  requester = {},
  requesterIdentifier,
  requesterFaculty,
  requesterContact,
  studentStatus,
  studyLevel,
  study_level: studyLevelSnake,
  lecturerName,
  lecturerEmail,
  lecturerContact,
  lectName,
  lectEmail,
  lectContact,
  staffName,
  staffEmail,
  staffContact,
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
  items,
} = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const tableWidth = pageWidth - margin * 2;
  const dateText = quotationDate || todayText();
  const quotationItems = normalizeQuotationItems({
    bookingType,
    resourceName,
    resourceId,
    resourceLocation,
    resourceStatus,
    resourceCourse,
    resourceDescription,
    resourceQuantity,
    resourceLabId,
    startDate,
    endDate,
    startTime,
    endTime,
    bookingDayCount,
    durationHours,
    pricePerHour,
    totalPrice,
    purpose,
    items,
  });
  const hasItemizedQuotation = Array.isArray(items) && items.length > 0;
  const totalAmount = quotationItems.reduce(
    (sum, item) => sum + getBillableItemTotal(item),
    0,
  );
  const displayTotalPrice = hasItemizedQuotation
    ? totalAmount
    : Number(totalPrice || totalAmount);
  const totalHours = quotationItems.reduce(
    (sum, item) =>
      sum +
      Number(item.durationHours || 0) * Number(item.bookingDayCount || 0),
    0,
  );

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(120, 0, 45);
  doc.text("UTM", margin, 24);
  doc.setFontSize(8);
  doc.text("UNIVERSITI TEKNOLOGI MALAYSIA", margin, 30);

  doc.setTextColor(25, 25, 25);
  doc.setFontSize(10);
  doc.text(
    "PUSAT PENGURUSAN MAKMAL UNIVERSITI (PPMU)",
    pageWidth - margin,
    18,
    {
      align: "right",
    },
  );
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
  doc.text("QUOTATION", pageWidth / 2, y, { align: "center" });
  doc.setDrawColor(170, 0, 70);
  doc.line(margin, y + 4, pageWidth - margin, y + 4);

  y += 16;
  doc.setFillColor(248, 247, 242);
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(margin, y - 5, tableWidth, 22, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(170, 0, 70);
  doc.text("Quotation Information", margin + 4, y + 2);
  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Quotation No: ${valueOrDash(quotationNumber)}`, margin + 4, y + 9);
  doc.text(`Date: ${dateText}`, margin + 4, y + 15);
  doc.text(`Total Amount: ${formatRmFromUsd(displayTotalPrice)}`, pageWidth - margin - 4, y + 15, {
    align: "right",
  });

  y += 30;
  y = drawSectionTitle(doc, "Read First", margin, y, tableWidth);
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
      ["Student Status", studentStatus || studyLevel || studyLevelSnake],
    ],
    margin,
    y,
    tableWidth,
  );

  y = drawSection(
    doc,
    "Lecturer Information",
    [
      ["Lecturer Name", lecturerName || lectName],
      ["Lecturer Email", lecturerEmail || lectEmail],
      ["Lecturer Contact", lecturerContact || lectContact],
    ],
    margin,
    y,
    tableWidth,
  );

  y = drawSection(
    doc,
    "Staff Information",
    [
      ["Staff Name", staffName],
      ["Staff Email", staffEmail],
      ["Staff Contact", staffContact],
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
      ["Resource Name", resourceName || valueList(quotationItems.map((item) => item.resourceName))],
      ["Resource ID", resourceId || valueList(quotationItems.map((item) => item.resourceId))],
      ["Location", resourceLocation || valueList(quotationItems.map((item) => item.resourceLocation))],
      ["Status", resourceStatus || valueList(quotationItems.map((item) => item.resourceStatus))],
      ["Course", resourceCourse || valueList(quotationItems.map((item) => item.resourceCourse))],
      ["Description", resourceDescription || valueList(quotationItems.map((item) => item.resourceDescription))],
      ["Quantity", resourceQuantity || valueList(quotationItems.map((item) => item.resourceQuantity))],
      ["Lab ID", resourceLabId || valueList(quotationItems.map((item) => item.resourceLabId))],
      ["Start Date", formatDate(startDate || quotationItems[0]?.startDate)],
      ["End Date", formatDate(endDate || quotationItems[0]?.endDate || quotationItems[0]?.startDate)],
      [
        "Booking Days",
        `${quotationItems.reduce(
          (sum, item) => sum + Number(item.bookingDayCount || 0),
          0,
        )} weekday${quotationItems.length === 1 && Number(quotationItems[0]?.bookingDayCount || 0) === 1 ? "" : "s"}`,
      ],
      ["Start Time", startTime || valueList(quotationItems.map((item) => item.startTime))],
      ["End Time", endTime || valueList(quotationItems.map((item) => item.endTime))],
      ["Daily Duration", durationHours ? `${durationHours} hr` : valueList(quotationItems.map((item) => `${item.durationHours || 0} hr`))],
      ["Total Duration", `${totalHours} hr`],
      ["VOT Number", votNumber],
      ["Price Per Hour", pricePerHour ? formatRmFromUsd(pricePerHour) : valueList(quotationItems.map((item) => formatRmFromUsd(item.pricePerHour || 0)))],
      ["Total Price", formatRmFromUsd(displayTotalPrice)],
      ["Purpose", purpose || valueList(quotationItems.map((item) => item.purpose))],
    ],
    margin,
    y,
    tableWidth,
  );

  y = drawSectionTitle(doc, "Quotation Summary", margin, y + 4, tableWidth);
  quotationItems.forEach((item, index) => {
    y = drawQuotationItemCard({
      doc,
      item,
      index,
      bookingType,
      votNumber,
      margin,
      pageWidth,
      contentWidth: tableWidth,
      y,
    });
  });

  y = addPageIfNeeded(doc, y, 18);
  doc.setFillColor(248, 247, 242);
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(margin, y - 4, tableWidth, 16, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL AMOUNT (RM):", margin + 4, y + 5);
  doc.setTextColor(170, 0, 70);
  doc.text(formatRmFromUsd(displayTotalPrice), pageWidth - margin - 4, y + 5, {
    align: "right",
  });
  doc.setTextColor(25, 25, 25);

  y = drawSectionTitle(doc, "Terms and Conditions", margin, y + 22, tableWidth);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
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

  y = drawSectionTitle(doc, "Customer Confirmation", margin, y + 8, tableWidth);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y = drawWrappedText(doc, BOOKING_AGREEMENT_TEXT, margin, y, tableWidth);
  y += 10;
  doc.text(`Name: ${valueOrDash(requester.username)}`, margin, y);
  y += 8;
  // doc.text("Signature: (                                      )", margin, y);
  // y += 8;
  doc.text(`Date: ${dateText}`, margin, y);

  return doc;
}

export function createQuotationPdfBuffer(payload = {}) {
  const doc = createQuotationPdfDoc(payload);
  return Buffer.from(doc.output("arraybuffer"));
}

export function downloadQuotationPdf(payload = {}) {
  const doc = createQuotationPdfDoc(payload);
  const fileName = `${getFileSafeName(payload.quotationNumber || "quotation")}.pdf`;
  doc.save(fileName || "quotation.pdf");
}
