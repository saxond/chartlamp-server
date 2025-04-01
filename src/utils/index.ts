import axios from "axios";
// import chalk from "chalk";
import fs from "fs";
import { dynamicImport } from "tsimportlib";

async function appLogger(message: string, color = "yellow") {
  const chalk = (await dynamicImport("chalk", module)).default;
  //@ts-ignore
  console.log(chalk[color].bold(message));
}

async function appErrorLogger(message: string) {
  const chalk = (await dynamicImport("chalk", module)).default;

  //@ts-ignore
  console.log(chalk.bgRed.bold(message));
}

async function fetchPdfFromUrl(documentUrl: string) {
  try {
    const response = await axios.get(documentUrl, {
      responseType: "arraybuffer", // Important to get binary data
    });
    return response.data;
  } catch (err) {
    console.error("Error fetching PDF from URL:", err);
    throw err;
  }
}

async function writePdfBytesToFile(fileName: string, pdfBytes: any) {
  await fs.promises.writeFile(fileName, pdfBytes);
  console.log(`Saved: ${fileName}`);
}

async function loadPdfJs() {
  const pdfjsLib = await dynamicImport(
    "pdfjs-dist/legacy/build/pdf.mjs",
    module
  );
  return pdfjsLib;
}

export {
  appErrorLogger,
  appLogger,
  fetchPdfFromUrl,
  loadPdfJs,
  writePdfBytesToFile,
};
