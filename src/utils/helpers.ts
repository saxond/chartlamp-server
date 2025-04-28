export function formatResponse(status: Boolean, message: string, data?: any) {
    return { status, message, ...data };
}

export function normalizeDate(dateInput: string) {
  // Attempt to parse the date using the Date object
  let parsedDate = new Date(dateInput);

  // Handle cases where the format isn't automatically parsed
if (isNaN(parsedDate.getTime())) {
  // Check for "DD-MM-YYYY" format (e.g., 25-09-2016)
  const ddMmYyyyMatch = dateInput.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddMmYyyyMatch) {
    const [, day, month, year] = ddMmYyyyMatch;
    parsedDate = new Date(`${year}-${month}-${day}`);
  } else {
    throw new Error(`Invalid date format: ${dateInput}`);
  }
}

  // Format the date into YYYY-MM-DD
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
