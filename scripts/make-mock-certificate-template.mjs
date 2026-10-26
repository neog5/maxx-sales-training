// Draws the placeholder certificate template at public/certificates/template.pdf.
// Replace that file with the Canva export; this script is only for the mock.
// Usage: node scripts/make-mock-certificate-template.mjs
import fs from "node:fs";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { hexToRgb } from "../lib/certificates.mjs";

const color = (hex) => { const { r, g, b } = hexToRgb(hex); return rgb(r, g, b); };
const navy = color("#14254a");
const gold = color("#b8924a");
const muted = color("#5b6478");

const pdf = await PDFDocument.create();
const page = pdf.addPage([841.89, 595.28]); // A4 landscape
const { width, height } = page.getSize();
const fromTop = (y) => height - y;
const serif = await pdf.embedFont(StandardFonts.TimesRoman);
const sans = await pdf.embedFont(StandardFonts.Helvetica);
const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

const centred = (text, y, font, size, fill) =>
  page.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y: fromTop(y), size, font, color: fill });
const spaced = (text) => [...text].join(" ");

page.drawRectangle({ x: 0, y: 0, width, height, color: color("#fbf8f1") });
page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: navy, borderWidth: 3 });
page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: gold, borderWidth: 1 });

const logo = await pdf.embedPng(await sharp("public/maxx-ortho-logo.webp").png().toBuffer());
const logoSize = logo.scaleToFit(130, 50);
page.drawImage(logo, { x: (width - logoSize.width) / 2, y: fromTop(54 + logoSize.height), ...logoSize });

centred(spaced("CERTIFICATE OF COMPLETION"), 158, sansBold, 20, navy);
centred("This certifies that", 212, serif, 15, muted);
page.drawLine({ start: { x: width * 0.2, y: fromTop(296) }, end: { x: width * 0.8, y: fromTop(296) }, thickness: 0.75, color: gold });
centred("has successfully completed the course", 336, serif, 15, muted);
page.drawLine({ start: { x: width * 0.35, y: fromTop(484) }, end: { x: width * 0.65, y: fromTop(484) }, thickness: 0.75, color: gold });
centred(spaced("DATE OF COMPLETION"), 500, sans, 8, muted);
centred("Sample certificate template", 548, sans, 7, color("#a3a9b6"));

fs.mkdirSync("public/certificates", { recursive: true });
fs.writeFileSync("public/certificates/template.pdf", await pdf.save());
console.log("Wrote public/certificates/template.pdf");
