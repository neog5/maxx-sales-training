// Course completion certificates are the template PDF (exported from Canva) with three
// pieces of text written onto it. To use a new template:
//   1. In Canva, leave the name, course and date areas blank and Download → PDF Print.
//   2. Save it as public/certificates/template.pdf (only the first page is used).
//   3. Adjust the positions below until the text sits where you want it.
// Positions are fractions of the page, measured from the top-left corner, so they work
// at any page size: x 0.5 is the horizontal centre, y 0.5 the vertical middle. `y` is the
// text's baseline (the line letters sit on). Fonts are the PDF standard fonts:
// Helvetica, HelveticaBold, HelveticaOblique, TimesRoman, TimesRomanBold, TimesRomanItalic,
// TimesRomanBoldItalic, Courier, CourierBold.
export const CERTIFICATE_TEMPLATE = {
  file: "/certificates/template.pdf",
  fields: {
    recipientName: { x: 0.5, y: 0.47, size: 40, minSize: 22, maxWidth: 0.7, font: "TimesRomanBoldItalic", color: "#14254a", align: "center" },
    courseTitle: { x: 0.5, y: 0.645, size: 24, minSize: 13, maxWidth: 0.74, font: "TimesRomanBold", color: "#14254a", align: "center" },
    completedOn: { x: 0.5, y: 0.8, size: 15, minSize: 10, maxWidth: 0.4, font: "Helvetica", color: "#33405c", align: "center" },
  },
};

export function formatCertificateDate(value, { local = false } = {}) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", ...(local ? {} : { timeZone: "UTC" }) }).format(new Date(value));
}

// The text that goes into each field, from a row of the certificates table.
export function certificateFieldValues(certificate, { local = false } = {}) {
  return {
    recipientName: certificate.recipient_name,
    courseTitle: certificate.course_title,
    completedOn: formatCertificateDate(certificate.issued_at, { local }),
  };
}

// Where to draw one field, in PDF points from the bottom-left corner. Long text shrinks
// (down to minSize) to fit maxWidth. `measure(text, size)` returns the text's width.
export function layoutField({ text, field, pageWidth, pageHeight, measure }) {
  const maxWidth = (field.maxWidth ?? 1) * pageWidth;
  const minSize = field.minSize ?? field.size;
  let size = field.size;
  while (size > minSize && measure(text, size) > maxWidth) size = Math.max(minSize, size - 0.5);
  const width = measure(text, size);
  const anchor = field.x * pageWidth;
  const x = field.align === "center" ? anchor - width / 2 : field.align === "right" ? anchor - width : anchor;
  return { x, y: pageHeight * (1 - field.y), size, width };
}

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value;
  const number = parseInt(full, 16);
  return { r: ((number >> 16) & 255) / 255, g: ((number >> 8) & 255) / 255, b: (number & 255) / 255 };
}

export function certificateFileName(certificate) {
  const slug = (text) => String(text).trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Certificate-${slug(certificate.course_code)}-${slug(certificate.recipient_name)}.pdf`;
}
