// Course completion certificates are the template PDF (exported from Canva) with three
// pieces of text written onto it. To use a new template:
//   1. In Canva, leave the name, course and date areas blank and Download → PDF Print.
//   2. Save it as public/certificates/template.pdf (only the first page is used).
//   3. Adjust the positions below until the text sits where you want it.
// Positions are fractions of the page, measured from the top-left corner, so they work
// at any page size: x 0.5 is the horizontal centre, y 0.5 the vertical middle. `y` is the
// text's baseline (the line letters sit on). `font` is either a .ttf/.otf file under
// public/certificates/fonts/ (free Google Fonts work well; keep the licence beside it) or one
// of the built-in PDF fonts: Helvetica, HelveticaBold, HelveticaOblique, TimesRoman,
// TimesRomanBold, TimesRomanItalic, TimesRomanBoldItalic, Courier, CourierBold.
// The template uses Alice and Montserrat; the name is in Archivo Black.
export const CERTIFICATE_TEMPLATE = {
  file: "/certificates/template.pdf",
  fields: {
    recipientName: { x: 0.5, y: 0.445, size: 38, minSize: 20, maxWidth: 0.62, font: "/certificates/fonts/ArchivoBlack-Regular.ttf", color: "#22335b", align: "center" },
    courseTitle: { x: 0.5, y: 0.578, size: 26, minSize: 14, maxWidth: 0.74, font: "/certificates/fonts/Alice-Regular.ttf", color: "#1b1b1b", align: "center" },
    completedOn: { x: 0.5, y: 0.735, size: 14, minSize: 10, maxWidth: 0.3, font: "/certificates/fonts/Montserrat-SemiBold.ttf", color: "#22335b", align: "center" },
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
