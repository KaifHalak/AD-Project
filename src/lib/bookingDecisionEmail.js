import nodemailer from "nodemailer";

function getBookingViewId(type, id) {
  return `${type}-${id}`;
}

function formatBookingType(type) {
  return type === "lab" ? "Lab" : "Equipment";
}

function formatDecision(decision) {
  return decision === "approved" ? "approved" : "rejected";
}

function formatReviewerRole(reviewerRole) {
  return reviewerRole === "unit_leader" ? "Unit Leader" : "PPMU";
}

function getBookingDetailsLines(booking) {
  const type = booking.booking_type === "equipment" ? "equipment" : "lab";
  const lines = [`Type: ${type}`];

  if (type === "equipment") {
    lines.push(`Equipment name: ${booking.item_name || booking.item_id || "-"}`);
  } else {
    lines.push(`Lab name: ${booking.item_name || booking.item_id || "-"}`);
  }

  lines.push(`Date: ${booking.booking_date}`);
  lines.push(`Time: ${booking.start_time} - ${booking.end_time}`);

  return lines;
}

function getBookingDetailsHtml(booking) {
  const type = booking.booking_type === "equipment" ? "equipment" : "lab";
  const rows = [`<li><strong>Type:</strong> ${escapeHtml(type)}</li>`];

  if (type === "equipment") {
    rows.push(
      `<li><strong>Equipment name:</strong> ${escapeHtml(
        booking.item_name || booking.item_id || "-",
      )}</li>`,
    );
  } else {
    rows.push(
      `<li><strong>Lab name:</strong> ${escapeHtml(
        booking.item_name || booking.item_id || "-",
      )}</li>`,
    );
  }

  rows.push(`<li><strong>Date:</strong> ${escapeHtml(booking.booking_date)}</li>`);
  rows.push(
    `<li><strong>Time:</strong> ${escapeHtml(booking.start_time)} - ${escapeHtml(
      booking.end_time,
    )}</li>`,
  );

  return rows;
}

function getEmailFromAddress() {
  return (
    process.env.BOOKING_EMAIL_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    ""
  );
}

function getSmtpPort() {
  const parsedPort = Number(process.env.SMTP_PORT || 587);
  return Number.isInteger(parsedPort) ? parsedPort : 587;
}

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

function buildDecisionEmail({ booking, requester, processRecord }) {
  const reviewerName = formatReviewerRole(processRecord.reviewer_role);
  const bookingType = formatBookingType(booking.booking_type);
  const decision = formatDecision(processRecord.decision);
  const isApproved = processRecord.decision === "approved";
  const reason = processRecord.remarks || processRecord.rejection_reason || "";
  const subject = `${bookingType} booking ${decision} by ${reviewerName}`;
  const greetingName = requester.username || requester.email || "there";
  const nextStep =
    processRecord.reviewer_role === "unit_leader" && isApproved
      ? "Your booking is now waiting for PPMU review."
      : processRecord.reviewer_role === "ppmu" && isApproved
        ? "Your booking is now fully approved."
        : "Please review the reason below before submitting a new request.";

  const lines = [
    `Hi ${greetingName},`,
    "",
    `${reviewerName} has ${decision} your ${bookingType.toLowerCase()} booking.`,
    "",
    ...getBookingDetailsLines(booking),
  ];

  if (!isApproved && reason) {
    lines.push("", `Rejection reason: ${reason}`);
  }

  lines.push("", nextStep, "", "AD Booking System");

  const htmlReason =
    !isApproved && reason
      ? `<p><strong>Rejection reason:</strong> ${escapeHtml(reason)}</p>`
      : "";

  return {
    to: requester.email,
    subject,
    text: lines.join("\n"),
    html: [
      `<p>Hi ${escapeHtml(greetingName)},</p>`,
      `<p>${escapeHtml(reviewerName)} has ${escapeHtml(decision)} your ${escapeHtml(
        bookingType.toLowerCase(),
      )} booking.</p>`,
      "<ul>",
      ...getBookingDetailsHtml(booking),
      "</ul>",
      htmlReason,
      `<p>${escapeHtml(nextStep)}</p>`,
      "<p>AD Booking System</p>",
    ].join(""),
  };
}

function buildSubmittedEmail({ booking, requester }) {
  const bookingType = formatBookingType(booking.booking_type);
  const subject = `${bookingType} booking request received`;
  const greetingName = requester.username || requester.email || "there";
  const type = booking.booking_type === "equipment" ? "equipment" : "lab";
  const message = `Your ${type} booking has been accepted and is now waiting for Unit Leader and PPMU review.`;

  const lines = [
    `Hi ${greetingName},`,
    "",
    message,
    "",
    ...getBookingDetailsLines(booking),
    "",
    "AD Booking System",
  ];

  return {
    to: requester.email,
    subject,
    text: lines.join("\n"),
    html: [
      `<p>Hi ${escapeHtml(greetingName)},</p>`,
      `<p>${escapeHtml(message)}</p>`,
      "<ul>",
      ...getBookingDetailsHtml(booking),
      "</ul>",
      "<p>AD Booking System</p>",
    ].join(""),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchBookingRequester(admin, type, id) {
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, booking_type, item_id, user_id, booking_date, start_time, end_time, item_name",
    )
    .eq("id", getBookingViewId(type, id))
    .maybeSingle();

  if (bookingError || !booking) {
    return {
      error: bookingError || new Error("Booking not found for notification."),
    };
  }

  const { data: requester, error: requesterError } = await admin
    .from("users")
    .select("id, username, email")
    .eq("id", booking.user_id)
    .maybeSingle();

  if (requesterError || !requester?.email) {
    return {
      error:
        requesterError ||
        new Error("Booking requester email not found for notification."),
    };
  }

  return { booking, requester };
}

async function sendEmailWithSmtp(email) {
  const from = getEmailFromAddress();

  if (!hasSmtpConfig()) {
    return {
      skipped: true,
      reason: "SMTP_HOST, SMTP_USER, or SMTP_PASS is not configured.",
    };
  }

  if (!from) {
    return { skipped: true, reason: "BOOKING_EMAIL_FROM is not configured." };
  }

  const port = getSmtpPort();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return {
    sent: true,
    provider: "smtp",
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

export async function sendBookingDecisionEmail({
  admin,
  type,
  id,
  processRecord,
}) {
  const { booking, requester, error } = await fetchBookingRequester(
    admin,
    type,
    id,
  );

  if (error) {
    console.error("Booking decision email lookup failed:", error);
    return { sent: false, error: error.message };
  }

  const email = buildDecisionEmail({ booking, requester, processRecord });

  try {
    const result = await sendEmailWithSmtp(email);

    if (result.skipped) {
      return { sent: false, skipped: true, reason: result.reason };
    }

    return { sent: true };
  } catch (smtpError) {
    console.error("Booking decision email failed:", smtpError);
    return { sent: false, error: smtpError.message };
  }
}

export async function sendBookingSubmittedEmail({ booking, requester }) {
  if (!requester?.email) {
    return {
      sent: false,
      error: "Booking requester email not found for notification.",
    };
  }

  const email = buildSubmittedEmail({ booking, requester });

  try {
    const result = await sendEmailWithSmtp(email);

    if (result.skipped) {
      return { sent: false, skipped: true, reason: result.reason };
    }

    return { sent: true };
  } catch (smtpError) {
    console.error("Booking submitted email failed:", smtpError);
    return { sent: false, error: smtpError.message };
  }
}
