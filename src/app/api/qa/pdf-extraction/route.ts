import { PDFDocument, StandardFonts } from "pdf-lib";
import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import {
  extractPdfText,
  PdfTextExtractionError,
} from "@/lib/identity-verification/csf-document-extractor";
import { analyzeAddressProofDocument } from "@/lib/identity-verification/address-proof-document-extractor";

export const runtime = "nodejs";

async function syntheticPdf(lines: string[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, index) =>
    page.drawText(line, { x: 48, y: 740 - index * 24, size: 14, font }),
  );
  return new Uint8Array(await pdf.save());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isStaging = serverEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(
    "xdulakstgsgdujjylhox",
  );
  if (!isStaging || url.searchParams.get("synthetic") !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const csfBytes = await syntheticPdf([
    "BEST ROUND QA DOCUMENT",
    "RFC: ABCD010101AB1",
    "Nombre (s): PRUEBA",
    "Primer Apellido: BEST",
    "Segundo Apellido: ROUND",
  ]);
  const addressBytes = await syntheticPdf([
    "RECIBO DE ELECTRICIDAD CFE",
    "Titular: PRUEBA BEST ROUND",
    "Domicilio: AVENIDA QA 123 COLONIA CENTRO CP 01010",
    "Fecha: 01/09/2026",
  ]);
  try {
    const csf = await extractPdfText(csfBytes);
    const address = await extractPdfText(addressBytes);
    const addressAnalysis = await analyzeAddressProofDocument({
      bytes: addressBytes,
      mimeType: "application/pdf",
      legalType: "INDIVIDUAL",
      registeredName: "PRUEBA BEST ROUND",
      registeredAddress: "AV QA 123, CENTRO, 01010",
      now: new Date("2026-09-01T12:00:00Z"),
    });
    return NextResponse.json({
      csf: {
        pagesInspected: csf.pagesInspected,
        textExtractionStatus: csf.text.includes("ABCD010101AB1")
          ? "SUCCESS"
          : "FAILED",
        expectedRfcParsable: /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\b/.test(csf.text),
      },
      address: {
        pagesInspected: address.pagesInspected,
        textExtractionStatus: address.text.includes("PRUEBA BEST ROUND")
          ? "SUCCESS"
          : "FAILED",
        analysisResult: addressAnalysis.result,
        documentTypeDetected: addressAnalysis.documentType !== null,
      },
    });
  } catch (error) {
    const code =
      error instanceof PdfTextExtractionError
        ? error.code
        : "PDF_TEXT_EXTRACTION_FAILED";
    return NextResponse.json(
      {
        csf: {
          pagesInspected: 0,
          textExtractionStatus: "FAILED",
          errorCode: code,
        },
        address: {
          pagesInspected: 0,
          textExtractionStatus: "FAILED",
          errorCode: code,
        },
      },
      { status: 500 },
    );
  }
}
