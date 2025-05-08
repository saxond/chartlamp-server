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

// export async function updatePercentageCompletion(
//   caseId: string,
//   pageNumber: number,
//   totalPages: number,
//   currentExtractionState: string,
//   denominator = 4
// ) {
//   console.log(
//     "updatePercentageCompletion",
//     caseId,
//     pageNumber,
//     totalPages,
//     currentExtractionState,
//     denominator
//   );
//   try {
//     if (totalPages === 0) throw new Error("Total pages cannot be zero");

//     const caseDocCount = await DocumentModel.countDocuments({ case: caseId });

//     const denominatorByCaseDocCount = caseDocCount * denominator;

//     let newContribution: number;

//     // Calculate the contribution as half of the page's value
//     const pageContribution = 100 / totalPages;
//     newContribution = pageContribution / denominatorByCaseDocCount;

//     // Fetch the current completion percentage from the database
//     const currentCase = await CaseModel.findById(caseId);
//     if (!currentCase) {
//       throw new Error(`Case with ID ${caseId} not found`);
//     }

//     // Accumulate the new percentage with the existing one
//     const currentPercentage = currentCase.percentageCompletion || 0;
//     let accumulatedPercentage = currentPercentage + newContribution;

//     // Ensure it does not exceed 100%
//     accumulatedPercentage = Math.min(Math.round(accumulatedPercentage), 100);

//     // Update the accumulated percentage
//     const updatedCase = await CaseModel.findByIdAndUpdate(
//       caseId,
//       { percentageCompletion: accumulatedPercentage, currentExtractionState },
//       { new: true }
//     );

//     appLogger(
//       `Updated case ${caseId} with accumulated completion percentage: ${accumulatedPercentage}%`
//     );
//     return updatedCase;
//   } catch (error: any) {
//     appErrorLogger(
//       `Error updating completion percentage for case ${caseId}: ${error?.message}`
//     );
//     throw error;
//   }
// }

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
    const newContribution = pageContribution / denominatorByCaseDocCount;

    console.log("🔢 contribution this step:", newContribution.toFixed(4));

    // Atomic increment
    const updatedCase = await CaseModel.findByIdAndUpdate(
      caseId,
      {
        $inc: { percentageCompletion: newContribution },
        $set: { currentExtractionState },
      },
      { new: true }
    );

    if (updatedCase) {
      appLogger(
        `✅ Updated case ${caseId} to ~${updatedCase.percentageCompletion?.toFixed(
          2
        )}%`
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
