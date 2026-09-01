// @vitest-environment node

import { createCanvas } from "@napi-rs/canvas";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { analyzeCsfDocument } from "@/lib/identity-verification/csf-document-extractor";

const PHYSICAL_RFC = "TEXA900101AB1";
const LEGAL_RFC = "TEX900101AB1";

function officialSatDestination(rfc: string) {
  return `https://siat.sat.gob.mx/app/qr/faces/pages/mobile/validadorqr.jsf?D1=10&D2=1&D3=100000_${rfc}`;
}

async function addPhysicalText(
  page: PDFPage,
  font: PDFFont,
  options: { repeatRfc?: boolean; fragmentedLayout?: boolean } = {},
) {
  page.drawText("CONSTANCIA DE SITUACION FISCAL", {
    x: 48,
    y: 730,
    size: 14,
    font,
  });
  if (options.fragmentedLayout) {
    page.drawText("RFC:", { x: 48, y: 690, size: 12, font });
    page.drawText("TEXA", { x: 170, y: 690, size: 12, font });
    page.drawText("900101", { x: 205, y: 690, size: 12, font });
    page.drawText("AB1", { x: 255, y: 690, size: 12, font });
    page.drawText("Nombre (s):", { x: 48, y: 650, size: 12, font });
    page.drawText("ANA MARIA", { x: 210, y: 650, size: 12, font });
    page.drawText("Primer Apellido:", { x: 48, y: 620, size: 12, font });
    page.drawText("PRUEBA", { x: 210, y: 620, size: 12, font });
    page.drawText("Segundo Apellido:", { x: 48, y: 590, size: 12, font });
    page.drawText("SINTETICA", { x: 210, y: 590, size: 12, font });
  } else {
    page.drawText(`RFC: ${PHYSICAL_RFC}`, { x: 48, y: 690, size: 12, font });
    page.drawText("Nombre (s): ANA MARIA", { x: 48, y: 650, size: 12, font });
    page.drawText("Primer Apellido: PRUEBA", {
      x: 48,
      y: 620,
      size: 12,
      font,
    });
    page.drawText("Segundo Apellido: SINTETICA", {
      x: 48,
      y: 590,
      size: 12,
      font,
    });
  }
  if (options.repeatRfc) {
    page.drawText(`Registro Federal de Contribuyentes: ${PHYSICAL_RFC}`, {
      x: 48,
      y: 550,
      size: 10,
      font,
    });
  }
}

async function addQr(
  pdf: PDFDocument,
  page: PDFPage,
  payload: string,
  width = 250,
) {
  const qr = await pdf.embedPng(await QRCode.toBuffer(payload, { width: 420 }));
  page.drawImage(qr, {
    x: Math.max(30, 612 - width - 40),
    y: 300,
    width,
    height: width,
  });
}

async function analyzePhysicalPdf(pdf: PDFDocument) {
  return analyzeCsfDocument({
    bytes: await pdf.save(),
    mimeType: "application/pdf",
    legalType: "SOLE_PROPRIETOR",
    registeredRfc: PHYSICAL_RFC,
    registeredName: "Ana Maria Prueba Sintetica",
  });
}

describe("CSF PDF extraction", () => {
  it("reconstructs fragmented page-one spans, split names, and repeated RFC values without OCR", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612, 792]);
    await addPhysicalText(page, font, {
      fragmentedLayout: true,
      repeatRfc: true,
    });

    const result = await analyzePhysicalPdf(pdf);

    expect(result).toMatchObject({
      extractionSource: "PDF_TEXT",
      extractedRfc: PHYSICAL_RFC,
      extractedName: "ANA MARIA PRUEBA SINTETICA",
      rfcMatches: true,
      nameMatches: true,
      qrStatus: "NOT_AVAILABLE",
      result: "REVIEW_REQUIRED",
      warningCodes: ["SAT_QR_MISSING"],
      diagnostics: {
        pdfPagesInspected: 1,
        usefulTextSignalDetected: true,
        qrPagesAttempted: [1],
        qrDecoded: false,
        ocrUsed: false,
      },
    });
  });

  it("decodes and validates an official QR on page one", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612, 792]);
    await addPhysicalText(page, font);
    await addQr(pdf, page, officialSatDestination(PHYSICAL_RFC));

    const result = await analyzePhysicalPdf(pdf);

    expect(result).toMatchObject({
      result: "PASSED",
      qrStatus: "VERIFIED",
      qrRfc: PHYSICAL_RFC,
      diagnostics: { qrPagesAttempted: [1], qrDecoded: true },
    });
  });

  it("inspects later pages and decodes the larger official QR on page three", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    await addPhysicalText(pdf.addPage([612, 792]), font);
    pdf.addPage([612, 792]).drawText("ACTIVIDADES ECONOMICAS", {
      x: 48,
      y: 730,
      size: 14,
      font,
    });
    const qrPage = pdf.addPage([612, 792]);
    await addQr(pdf, qrPage, officialSatDestination(PHYSICAL_RFC), 360);

    const result = await analyzePhysicalPdf(pdf);

    expect(result).toMatchObject({
      result: "PASSED",
      qrStatus: "VERIFIED",
      extractionSource: "PDF_TEXT",
      diagnostics: {
        pdfPagesInspected: 3,
        qrPagesAttempted: [1, 3],
        qrDecoded: true,
        ocrUsed: false,
      },
    });
  });

  it("combines useful embedded text across multiple pages", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([612, 792]).drawText("CONSTANCIA DE SITUACION FISCAL", {
      x: 48,
      y: 730,
      size: 14,
      font,
    });
    await addPhysicalText(pdf.addPage([612, 792]), font);
    const thirdPage = pdf.addPage([612, 792]);
    await addQr(pdf, thirdPage, officialSatDestination(PHYSICAL_RFC), 340);

    const result = await analyzePhysicalPdf(pdf);

    expect(result).toMatchObject({
      extractedRfc: PHYSICAL_RFC,
      extractedName: "ANA MARIA PRUEBA SINTETICA",
      extractionSource: "PDF_TEXT",
      result: "PASSED",
      diagnostics: { pdfPagesInspected: 3, ocrUsed: false },
    });
  });

  it("extracts a Persona Moral legal name from embedded text", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612, 792]);
    page.drawText("CONSTANCIA DE SITUACION FISCAL", {
      x: 48,
      y: 730,
      size: 14,
      font,
    });
    page.drawText(`RFC: ${LEGAL_RFC}`, { x: 48, y: 690, size: 12, font });
    page.drawText("Nombre, denominacion o razon social:", {
      x: 48,
      y: 650,
      size: 12,
      font,
    });
    page.drawText("EQUIPO SINTETICO DE GOLF SA DE CV", {
      x: 48,
      y: 620,
      size: 12,
      font,
    });
    await addQr(pdf, page, officialSatDestination(LEGAL_RFC));

    const result = await analyzeCsfDocument({
      bytes: await pdf.save(),
      mimeType: "application/pdf",
      legalType: "LEGAL_ENTITY",
      registeredRfc: LEGAL_RFC,
      registeredName: "Equipo Sintetico de Golf SA de CV",
    });

    expect(result).toMatchObject({
      extractionSource: "PDF_TEXT",
      extractedRfc: LEGAL_RFC,
      extractedName: "EQUIPO SINTETICO DE GOLF SA DE CV",
      result: "PASSED",
      diagnostics: { ocrUsed: false },
    });
  });

  it("uses OCR when embedded PDF text is absent", async () => {
    const canvas = createCanvas(1800, 1000);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.font = "64px Arial";
    context.fillText("CONSTANCIA DE SITUACION FISCAL", 70, 120);
    context.fillText(`RFC: ${PHYSICAL_RFC}`, 70, 270);
    context.fillText("Nombre (s): ANA MARIA", 70, 420);
    context.fillText("Primer Apellido: PRUEBA", 70, 570);
    context.fillText("Segundo Apellido: SINTETICA", 70, 720);
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([900, 500]);
    const image = await pdf.embedPng(canvas.toBuffer("image/png"));
    page.drawImage(image, { x: 0, y: 0, width: 900, height: 500 });

    const result = await analyzePhysicalPdf(pdf);

    expect(result.extractionSource).toBe("OCR");
    expect(result.confidence).toEqual(expect.any(Number));
    expect(result.diagnostics).toMatchObject({
      usefulTextSignalDetected: false,
      ocrUsed: true,
    });
  }, 20_000);

  it("falls back to OCR when embedded text is non-empty but insufficient", async () => {
    const canvas = createCanvas(1800, 1000);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.font = "64px Arial";
    context.fillText(`RFC: ${PHYSICAL_RFC}`, 70, 270);
    context.fillText("Nombre (s): ANA MARIA", 70, 420);
    context.fillText("Primer Apellido: PRUEBA", 70, 570);
    context.fillText("Segundo Apellido: SINTETICA", 70, 720);
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([900, 500]);
    page.drawText("Documento emitido por el SAT", {
      x: 20,
      y: 475,
      size: 10,
      font,
    });
    const image = await pdf.embedPng(canvas.toBuffer("image/png"));
    page.drawImage(image, { x: 0, y: 0, width: 900, height: 500 });

    const result = await analyzePhysicalPdf(pdf);

    expect(result.extractionSource).toBe("MIXED");
    expect(result.diagnostics).toMatchObject({
      usefulTextSignalDetected: false,
      ocrUsed: true,
    });
  }, 20_000);

  it("keeps a decoded non-official QR under deterministic review", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612, 792]);
    await addPhysicalText(page, font);
    await addQr(pdf, page, "https://example.test/not-sat");

    const result = await analyzePhysicalPdf(pdf);

    expect(result).toMatchObject({
      result: "REVIEW_REQUIRED",
      qrStatus: "NOT_VERIFIED",
      officialQrDestination: null,
      warningCodes: ["SAT_QR_DESTINATION_NOT_OFFICIAL"],
      diagnostics: { qrDecoded: true },
    });
  });

  it("fails safely for malformed PDFs", async () => {
    await expect(
      analyzeCsfDocument({
        bytes: new TextEncoder().encode("not-a-pdf"),
        mimeType: "application/pdf",
        legalType: "SOLE_PROPRIETOR",
        registeredRfc: PHYSICAL_RFC,
        registeredName: "Ana Maria Prueba Sintetica",
      }),
    ).rejects.toThrow();
  });
});
