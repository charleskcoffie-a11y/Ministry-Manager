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

  console.log('[OCR] Creating shared Tesseract worker for', totalPages, 'pages');
  let worker: any = null;
  
  try {
    worker = await Tesseract.createWorker('eng');
    console.log('[OCR] Worker created successfully');

    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
      console.log(`[OCR] Processing page ${pageIndex}/${totalPages}`);
      const page = await pdf.getPage(pageIndex);
      
      // Render page to canvas
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (!context) {
        console.warn(`[OCR] Could not get canvas context for page ${pageIndex}`);
        continue;
      }

      console.log(`[OCR] Rendering page ${pageIndex} to canvas`);
      const renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;

      // Run OCR on the canvas image using shared worker
      console.log(`[OCR] Running recognition on page ${pageIndex}`);
      const { data } = await worker.recognize(canvas);
      const pageText = data.text.trim();

      if (pageText) {
        extractedLines.push({
          id: `p-${pageIndex}`,
          text: pageText,
          page: pageIndex,
        });
        console.log(`[OCR] Page ${pageIndex} extracted:`, pageText.substring(0, 100) + '...');
      } else {
        console.warn(`[OCR] Page ${pageIndex} returned empty text`);
      }

      // Report progress
      if (onProgress) {
        const progress = Math.round((pageIndex / totalPages) * 100);
        console.log(`[OCR] Progress: ${progress}%`);
        onProgress(progress);
      }
    }
  } finally {
    if (worker) {
      console.log('[OCR] Terminating worker');
      await worker.terminate();
      console.log('[OCR] Worker terminated');
    }
  }

  console.log('[OCR] OCR complete. Extracted', extractedLines.length, 'pages');
  return extractedLines;
};

export const parseDocxFile = async (file: File): Promise<ParsedDocumentContent[]> => {
  const mammoth = await getMammothModule();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  return result.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `d-${index}`,
      text: line,
    }));
};