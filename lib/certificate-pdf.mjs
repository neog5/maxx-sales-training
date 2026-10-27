import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { CERTIFICATE_TEMPLATE, certificateFieldValues, hexToRgb, layoutField } from "./certificates.mjs";

const fetchBytes = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.arrayBuffer();
};

// Writes a certificate's name, course and date onto the first page of the template PDF.
// Kept apart from certificates.mjs so pdf-lib only loads where a PDF is actually made.
// `loadFile(path)` returns the bytes of a font file named in the template (fetched by default).
export async function renderCertificatePdf(templateBytes, certificate, { template = CERTIFICATE_TEMPLATE, local = false, loadFile = fetchBytes } = {}) {
  const source = await PDFDocument.load(templateBytes);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [page] = await pdf.copyPages(source, [0]);
  pdf.addPage(page);
  pdf.setTitle(`Certificate of Completion – ${certificate.course_title}`);
  pdf.setAuthor("Maxx Orthopedics");
  pdf.setSubject(`${certificate.recipient_name} · ${certificate.certificate_number}`);

  // Some exports (Canva included) start the page box away from 0,0, so offset by its corner.
  const { x: originX, y: originY, width: pageWidth, height: pageHeight } = page.getMediaBox();
  const values = certificateFieldValues(certificate, { local });
  const fonts = new Map();
  for (const [key, field] of Object.entries(template.fields)) {
    if (!values[key]) continue;
    if (!fonts.has(field.font)) {
      // Built-in names (Helvetica, TimesRoman…) or a font file path such as /certificates/fonts/Alice-Regular.ttf.
      const embedded = field.font in StandardFonts
        ? await pdf.embedFont(StandardFonts[field.font])
        : await pdf.embedFont(await loadFile(field.font), { subset: true });
      fonts.set(field.font, embedded);
    }
    const font = fonts.get(field.font);
    const text = encodable(values[key], font);
    const { x, y, size } = layoutField({ text, field, pageWidth, pageHeight, measure: (value, fontSize) => font.widthOfTextAtSize(value, fontSize) });
    const { r, g, b } = hexToRgb(field.color || "#000000");
    page.drawText(text, { x: originX + x, y: originY + y, size, font, color: rgb(r, g, b) });
  }
  return pdf.save();
}

// Fonts don't cover every character (the built-in ones only Western European). Missing
// ones fall back to their unaccented letter (ő → o), or "?" when there is none.
function encodable(text, font) {
  const supported = new Set(font.getCharacterSet());
  return [...text].map((char) => {
    if (supported.has(char.codePointAt(0))) return char;
    const base = char.normalize("NFD")[0];
    return supported.has(base.codePointAt(0)) ? base : "?";
  }).join("");
}
