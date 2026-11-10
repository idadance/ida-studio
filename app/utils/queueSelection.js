export function getQueueSelectionValue({
  sixersSelected,
  photoSalesSelected,
  soloDuetSelected,
  selectedEventId,
  selectedPerformanceId,
}) {
  if (sixersSelected) {
    return "sixers";
  }

  if (photoSalesSelected) {
    return "photo-sales";
  }

  if (soloDuetSelected) {
    return "solo-duet";
  }

  if (selectedEventId) {
    return `event:${selectedEventId}`;
  }

  if (selectedPerformanceId) {
    return `performance:${selectedPerformanceId}`;
  }

  return "";
}
