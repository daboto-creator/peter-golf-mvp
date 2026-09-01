// @vitest-environment node

import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";

vi.mock("server-only", () => ({}));

import { analyzeCsfDocument } from "@/lib/identity-verification/csf-document-extractor";

describe("CSF document extraction", () => {
  it("prefers embedded PDF text and does not hard fail when the QR is unreadable", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612, 792]);
    page.drawText("CONSTANCIA DE SITUACION FISCAL", {
      x: 48,
      y: 730,
      size: 14,
      font,
    });
    page.drawText("RFC: TEXA900101AB1", { x: 48, y: 690, size: 12, font });
    page.drawText("Nombre (s): ANA", { x: 48, y: 660, size: 12, font });
    page.drawText("Primer Apellido: PRUEBA", {
      x: 48,
      y: 630,
      size: 12,
      font,
    });
    page.drawText("Segundo Apellido: SINTETICA", {
      x: 48,
      y: 600,
      size: 12,
      font,
    });

    const result = await analyzeCsfDocument({
      bytes: await pdf.save(),
      mimeType: "application/pdf",
      legalType: "SOLE_PROPRIETOR",
      registeredRfc: "TEXA900101AB1",
      registeredName: "Ana Prueba Sintetica",
    });

    expect(result).toMatchObject({
      extractionSource: "PDF_TEXT",
      extractedRfc: "TEXA900101AB1",
      extractedName: "ANA PRUEBA SINTETICA",
      rfcMatches: true,
      nameMatches: true,
      qrStatus: "NOT_VERIFIED",
      result: "REVIEW_REQUIRED",
      warningCodes: ["SAT_QR_UNREADABLE"],
    });
  });

  it("reads an embedded QR and validates the official SAT destination", async () => {
    const rfc = "TEX900101AB1";
    const destination = `https://siat.sat.gob.mx/app/qr/faces/pages/mobile/validadorqr.jsf?D1=10&D2=1&D3=100000_${rfc}`;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const qr = await pdf.embedPng(
      await QRCode.toBuffer(destination, { width: 240 }),
    );
    const page = pdf.addPage([612, 792]);
    page.drawText(`RFC: ${rfc}`, { x: 48, y: 690, size: 12, font });
    page.drawText(
      "Denominacion/Razon Social: EQUIPO SINTETICO DE GOLF SA DE CV",
      { x: 48, y: 660, size: 12, font },
    );
    page.drawImage(qr, { x: 330, y: 480, width: 200, height: 200 });

    const result = await analyzeCsfDocument({
      bytes: await pdf.save(),
      mimeType: "application/pdf",
      legalType: "LEGAL_ENTITY",
      registeredRfc: rfc,
      registeredName: "Equipo Sintetico de Golf SA de CV",
    });

    expect(result).toMatchObject({
      result: "PASSED",
      qrStatus: "VERIFIED",
      qrRfc: rfc,
      rfcMatches: true,
      nameMatches: true,
    });
  });

  it("uses local Spanish OCR as the fallback for an image CSF", async () => {
    const canvas = createCanvas(1800, 1000);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.font = "64px Arial";
    context.fillText("CONSTANCIA DE SITUACION FISCAL", 70, 120);
    context.fillText("RFC: TEXA900101AB1", 70, 270);
    context.fillText("Nombre (s): ANA", 70, 420);
    context.fillText("Primer Apellido: PRUEBA", 70, 570);
    context.fillText("Segundo Apellido: SINTETICA", 70, 720);

    const result = await analyzeCsfDocument({
      bytes: canvas.toBuffer("image/png"),
      mimeType: "image/png",
      legalType: "SOLE_PROPRIETOR",
      registeredRfc: "TEXA900101AB1",
      registeredName: "Ana Prueba Sintetica",
    });

    expect(result.extractionSource).toBe("OCR");
    expect(result.confidence).toEqual(expect.any(Number));
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.result).toBe("REVIEW_REQUIRED");
  }, 20_000);
});
