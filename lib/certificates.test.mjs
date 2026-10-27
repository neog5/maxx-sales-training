import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { renderCertificatePdf } from "./certificate-pdf.mjs";
import { CERTIFICATE_TEMPLATE, certificateFieldValues, certificateFileName, hexToRgb, layoutField } from "./certificates.mjs";

const certificate = {
  certificate_number: "MXO-2026-000001",
  recipient_name: "Jordan Rivera",
  course_title: "Freedom PCK Revision Knee: Surgical Technique",
  course_code: "MXO-101",
  issued_at: "2026-10-26T15:00:00Z",
};
const measure = (text, size) => text.length * size * 0.5;

test("centres a field and converts the top-based position to PDF coordinates", () => {
  const field = { x: 0.5, y: 0.25, size: 10, align: "center" };
  const layout = layoutField({ text: "abcd", field, pageWidth: 800, pageHeight: 600, measure });
  assert.deepEqual(layout, { x: 390, y: 450, size: 10, width: 20 });
});

test("left and right alignment anchor the text at x", () => {
  const base = { x: 0.5, y: 0, size: 10 };
  assert.equal(layoutField({ text: "abcd", field: { ...base, align: "left" }, pageWidth: 800, pageHeight: 600, measure }).x, 400);
  assert.equal(layoutField({ text: "abcd", field: { ...base, align: "right" }, pageWidth: 800, pageHeight: 600, measure }).x, 380);
});

test("shrinks long text to fit the maximum width, but not below the minimum size", () => {
  const field = { x: 0.5, y: 0.5, size: 40, minSize: 10, maxWidth: 0.5, align: "center" };
  const fits = layoutField({ text: "x".repeat(40), field, pageWidth: 800, pageHeight: 600, measure });
  assert.ok(fits.width <= 400 && fits.size === 20);
  const tooLong = layoutField({ text: "x".repeat(400), field, pageWidth: 800, pageHeight: 600, measure });
  assert.equal(tooLong.size, 10);
});

test("fills the name, course and completion date", () => {
  assert.deepEqual(certificateFieldValues(certificate), {
    recipientName: "Jordan Rivera",
    courseTitle: "Freedom PCK Revision Knee: Surgical Technique",
    completedOn: "October 26, 2026",
  });
  assert.deepEqual(Object.keys(CERTIFICATE_TEMPLATE.fields).sort(), ["completedOn", "courseTitle", "recipientName"]);
});

test("builds a safe download file name", () => {
  assert.equal(certificateFileName({ ...certificate, recipient_name: "Ana  O'Neil / Smith" }), "Certificate-MXO-101-Ana-O-Neil-Smith.pdf");
});

test("parses hex colours", () => {
  assert.deepEqual(hexToRgb("#ff0000"), { r: 1, g: 0, b: 0 });
  assert.deepEqual(hexToRgb("#fff"), { r: 1, g: 1, b: 1 });
});

test("renders a one-page PDF from the template, including names outside the standard fonts", async () => {
  const template = fs.readFileSync(new URL("../public/certificates/template.pdf", import.meta.url));
  const loadFile = async (path) => fs.readFileSync(new URL(`../public${path}`, import.meta.url));
  const bytes = await renderCertificatePdf(template, { ...certificate, recipient_name: "Zoë Kovács-Đuričić 李" }, { loadFile });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.match(pdf.getTitle(), /Freedom PCK/);
});
