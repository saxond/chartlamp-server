import { appLogger } from ".";

import { appErrorLogger } from ".";

import { CaseModel } from "../models/case.model";
import { DocumentModel } from "../models/document.model";

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

export async function updatePercentageCompletion(
  caseId: string,
  pageNumber: number,
  totalPages: number,
  currentExtractionState: string,
  denominator = 4
) {
  console.log(
    "🔄 updatePercentageCompletion:",
    caseId,
    `page ${pageNumber}/${totalPages}`,
    currentExtractionState
  );

  try {
    if (totalPages === 0) throw new Error("Total pages cannot be zero");

    const caseDocCount = await DocumentModel.countDocuments({ case: caseId });
    const denominatorByCaseDocCount = caseDocCount * denominator;

    const pageContribution = 100 / totalPages;
    const newContributionRaw = pageContribution / denominatorByCaseDocCount;
    const newContribution = Math.round(newContributionRaw); // round to whole number

    console.log("🔢 rounded contribution this step:", newContribution);

    // Fetch current percentage
    const currentCase = await CaseModel.findById(caseId);
    if (!currentCase) throw new Error("Case not found");

    const currentCompletion = Math.round(currentCase.percentageCompletion || 0);
    const updatedCompletion = Math.min(currentCompletion + newContribution, 95); // cap at 95%

    // Update case
    const updatedCase = await CaseModel.findByIdAndUpdate(
      caseId,
      {
        $set: {
          percentageCompletion: updatedCompletion,
          currentExtractionState,
        },
      },
      { new: true }
    );

    if (updatedCase) {
      appLogger(
        `✅ Updated case ${caseId} to ${updatedCase.percentageCompletion}%`
      );
    }

    return updatedCase;
  } catch (error: any) {
    appErrorLogger(
      `❌ Error updating completion percentage for case ${caseId}: ${error?.message}`
    );
    throw error;
  }
}

export function* lazyPageIndices(totalPages: number): Generator<number> {
  for (let i = 0; i < totalPages; i++) {
    yield i;
  }
}

// Allow GC/IO to catch up every iteration
export async function safeLoopPause(delayMs = 5): Promise<void> {
  return new Promise((res) => setTimeout(res, delayMs));
}
