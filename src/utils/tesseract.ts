import { createWorker, OEM, PSM } from "tesseract.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

//   await worker.setParameters({
//     tessedit_ocr_engine_mode: OEM.LSTM_ONLY.toString(),
//     tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
//   });

export async function ocrPdfWithTesseract(
  pdfBuffer: any,
  outputName: string
): Promise<string> {
  const isLocal = process.env.NODE_ENV === "local";
  const tempDir = isLocal
    ? path.join(process.cwd(), `ocr-${outputName}`)
    : path.join("/tmp", `ocr-${outputName}`);
  const tempPdfPath = path.join(tempDir, "input.pdf");
  const imagePrefix = path.join(tempDir, "page");

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  fs.writeFileSync(tempPdfPath, pdfBuffer);

  const pdftoppmPath = isLocal
    ? `"C:\\Users\\USER\\poppler-24.08.0\\Library\\bin\\pdftoppm.exe"`
    : "pdftoppm";

  execSync(
    `${pdftoppmPath} -png -singlefile "${tempPdfPath}" "${imagePrefix}"`
  );

  const imageFiles = fs
    .readdirSync(tempDir)
    .filter((file) => file.endsWith(".png"))
    .map((file) => path.join(tempDir, file));

  if (imageFiles.length === 0) {
    throw new Error("No images were generated from the PDF.");
  }

  const worker = await createWorker("eng");

    await worker.setParameters({
      tessedit_ocr_engine_mode: OEM.LSTM_ONLY.toString(),
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

  let fullText = "";
  for (const imgPath of imageFiles) {
    let text = (await worker.recognize(imgPath)).data.text.trim();
    fullText += text + "\n\n";
  }

  await worker.terminate();

  imageFiles.forEach((f) => fs.unlinkSync(f));
  fs.unlinkSync(tempPdfPath);
  fs.rmdirSync(tempDir);

  return fullText.trim();
}
