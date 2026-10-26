import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { CERTIFICATE_TEMPLATE, certificateFieldValues, hexToRgb, layoutField } from "./certificates.mjs";

// Writes a certificate's name, course and date onto the first page of the template PDF.
// Kept apart from certificates.mjs so pdf-lib only loads where a PDF is actually made.
export async function renderCertificatePdf(templateBytes, certificate, { template = CERTIFICATE_TEMPLATE, local = false } = {}) {
  const source = await PDFDocument.load(templateBytes);
  const pdf = await PDFDocument.create();
  const [page] = await pdf.copyPages(source, [0]);
  pdf.addPage(page);
  pdf.setTitle(`Certificate of Completion – ${certificate.course_title}`);
  pdf.setAuthor("Maxx Orthopedics");
  pdf.setSubject(`${certificate.recipient_name} · ${certificate.certificate_number}`);

  const { width: pageWidth, height: pageHeight } = page.getSize();
  const values = certificateFieldValues(certificate, { local });
  const fonts = new Map();
  for (const [key, field] of Object.entries(template.fields)) {
    if (!values[key]) continue;
    if (!fonts.has(field.font)) fonts.set(field.font, await pdf.embedFont(StandardFonts[field.font]));
    const font = fonts.get(field.font);
    const text = encodable(values[key], font);
    const { x, y, size } = layoutField({ text, field, pageWidth, pageHeight, measure: (value, fontSize) => font.widthOfTextAtSize(value, fontSize) });
    const { r, g, b } = hexToRgb(field.color || "#000000");
    page.drawText(text, { x, y, size, font, color: rgb(r, g, b) });
  }
  return pdf.save();
}

// The standard fonts only cover Western European characters. Others fall back to their
// unaccented letter (ő → o), or "?" when there is none, instead of failing the PDF.
function encodable(text, font) {
  const supported = new Set(font.getCharacterSet());
  return [...text].map((char) => {
    if (supported.has(char.codePointAt(0))) return char;
    const base = char.normalize("NFD")[0];
    return supported.has(base.codePointAt(0)) ? base : "?";
  }).join("");
}
