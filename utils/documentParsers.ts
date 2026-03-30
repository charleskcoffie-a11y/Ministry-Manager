export interface ParsedDocumentContent {
  id: string;
  text: string;
  page?: number;
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

export const parsePdfFile = async (file: File): Promise<ParsedDocumentContent[]> => {
  const pdfjsLib = await getPdfModule();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const extractedLines: ParsedDocumentContent[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
      .join(' ')
      .trim();

    if (!pageText) {
      continue;
    }

    extractedLines.push({
      id: `p-${pageIndex}`,
      text: pageText,
      page: pageIndex,
    });
  }

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