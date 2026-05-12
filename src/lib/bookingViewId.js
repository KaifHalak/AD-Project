export function parseBookingViewId(id) {
  const match = /^(lab|equipment)-(\d+)$/.exec(String(id || ""));

  if (!match) {
    return null;
  }

  return {
    bookingType: match[1],
    sourceId: Number(match[2]),
  };
}

export function getBookingProcessKey(bookingType, sourceId) {
  return `${bookingType}-${sourceId}`;
}
