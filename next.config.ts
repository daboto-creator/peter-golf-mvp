import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@napi-rs/canvas",
    "pdfjs-dist",
    "tesseract.js",
    "@tesseract.js-data/spa",
  ],
  outputFileTracingIncludes: {
    "/partner/onboarding/documentos": [
      "./node_modules/@tesseract.js-data/spa/4.0.0/spa.traineddata.gz",
      "./node_modules/tesseract.js/src/worker-script/node/index.js",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/build/pdf.worker.mjs",
    ],
    "/api/qa/pdf-extraction": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/build/pdf.worker.mjs",
    ],
  },
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
