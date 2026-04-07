export interface ParsedDocumentContent {
  id: string;
  text: string;
  page?: number;
}

export interface OcrResult {
  isScanned: boolean;
  content: ParsedDocumentContent[];
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const isPdfDocument = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

export const isDocxDocument = (file: File) =>
  file.type === DOCX_MIME || file.name.toLowerCase().endsWith('.docx');

let pdfModulePromise: Promise<any> | null = null;
let pdfWorkerUrlPromise: Promise<string> | null = null;

const getPdfModule = async () => {
  if (!pdfModulePromise) {
    pdfModulePromise = import('pdfjs-dist/legacy/build/pdf.js').then((module) => (module as any).default ?? module);
  }

  const pdfjsLib = await pdfModulePromise;

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    if (!pdfWorkerUrlPromise) {
      pdfWorkerUrlPromise = import('pdfjs-dist/build/pdf.worker.min.js?url').then((module) => module.default);
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = await pdfWorkerUrlPromise;
  }

  return pdfjsLib;
};

const getMammothModule = async () => {
  const module = await import('mammoth/mammoth.browser');
  return ((module as any).default ?? module) as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
};

const getTesseractModule = async () => {
  const Tesseract = await import('tesseract.js');
  return (Tesseract.default ?? Tesseract) as any;
};

export const parsePdfFile = async (file: File): Promise<ParsedDocumentContent[]> => {
  const pdfjsLib = await getPdfModule();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const extractedLines: ParsedDocumentContent[] = [];
  let hasTextContent = false;

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
      .join(' ')
      .trim();

    if (pageText) {
      hasTextContent = true;
      extractedLines.push({
        id: `p-${pageIndex}`,
        text: pageText,
        page: pageIndex,
      });
    }
  }

  // If no text was extracted, it's likely a scanned PDF
  if (!hasTextContent) {
    throw new Error('PDF_IS_SCANNED');
  }

  return extractedLines;
};

export const parseScannedPdfWithOcr = async (file: File, onProgress?: (progress: number) => void): Promise<ParsedDocumentContent[]> => {
  const Tesseract = await getTesseractModule();
  const pdfjsLib = await getPdfModule();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const extractedLines: ParsedDocumentContent[] = [];
  const totalPages = pdf.numPages;
  let worker: any = null;
  
  try {
    worker = await Tesseract.createWorker('eng');

    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      
      // Render page to canvas
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (!context) continue;

      const renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;

      // Run OCR on the canvas image using shared worker
      const { data } = await worker.recognize(canvas);
      const pageText = data.text.trim();

      if (pageText) {
        extractedLines.push({
          id: `p-${pageIndex}`,
          text: pageText,
          page: pageIndex,
        });
      }

      // Report progress
      if (onProgress) {
        const progress = Math.round((pageIndex / totalPages) * 100);
        onProgress(progress);
      }
    }
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }

  return extractedLines;
};

const normalizeDocxLine = (line: string) => line.replace(/\s+/g, ' ').trim();

const normalizeSoToken = (line: string) =>
  line
    .replace(/\bS\s*\.\s*O\s*\.?\s*/gi, 'S.O. ')
    .replace(/\bStanding\s+Order\b/gi, 'Standing Order');

const isHeadingLikeLine = (line: string) => {
  const isUppercaseHeading = line.length <= 120 && /[A-Z]/.test(line) && line === line.toUpperCase();
  const isNumberedHeading = /^\d{1,3}(?:\.\d+)*[.)]?\s+[A-Za-z]/.test(line);
  const isSectionLabel = /^(?:chapter|section|part|appendix)\b/i.test(line);
  const isSoHeading = /^(?:S\.?\s*O\.?|Standing\s*Order)\s*\d+/i.test(line);

  return isUppercaseHeading || isNumberedHeading || isSectionLabel || isSoHeading;
};

export const parseDocxFile = async (file: File): Promise<ParsedDocumentContent[]> => {
  const mammoth = await getMammothModule();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  const rawLines = result.value.replace(/\r/g, '').split('\n');
  const blocks: ParsedDocumentContent[] = [];
  let currentPage: number | undefined;
  let buffer = '';

  const flushBuffer = () => {
    const text = normalizeSoToken(normalizeDocxLine(buffer));
    if (!text) return;
    blocks.push({
      id: `d-${blocks.length}`,
      text,
      page: currentPage,
    });
    buffer = '';
  };

  for (const rawLine of rawLines) {
    const line = normalizeDocxLine(rawLine);

    if (!line) {
      flushBuffer();
      continue;
    }

    const pageMatch = line.match(/^page\s+(\d+)$/i);
    if (pageMatch) {
      flushBuffer();
      currentPage = Number(pageMatch[1]);
      continue;
    }

    if (isHeadingLikeLine(line)) {
      flushBuffer();
      blocks.push({
        id: `d-${blocks.length}`,
        text: normalizeSoToken(line),
        page: currentPage,
      });
      continue;
    }

    if (!buffer) {
      buffer = line;
    } else if (buffer.endsWith('-')) {
      buffer = `${buffer.slice(0, -1)}${line}`;
    } else {
      buffer = `${buffer} ${line}`;
    }
  }

  flushBuffer();

  if (blocks.length > 0) {
    return blocks;
  }

  return rawLines
    .map((line) => normalizeSoToken(normalizeDocxLine(line)))
    .filter(Boolean)
    .map((line, index) => ({
      id: `d-${index}`,
      text: line,
    }));
};