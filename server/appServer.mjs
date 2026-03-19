import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.resolve(repoRoot, 'dist');
const appBase = '/Ministry-Manager/';
const previewMode = process.argv.includes('--preview');
const host = process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PORT || (previewMode ? '4173' : '3000'), 10);

const stripMatchingQuotes = (value) => {
  if (value.length < 2) {
    return value;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
};

const normalizeEnvValue = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return stripMatchingQuotes(trimmed);
};

const loadDotEnv = () => {
  const envPath = path.resolve(repoRoot, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, 'utf8');
  for (const rawLine of raw.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = normalizeEnvValue(line.slice(separatorIndex + 1));
  }
};

loadDotEnv();

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
  console.warn('Using legacy VITE_GEMINI_API_KEY on the server. Move it to GEMINI_API_KEY to keep it server-side only.');
}

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
};

const apiPaths = new Set(['/api/gemini', `${appBase}api/gemini`]);

const setCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
};

const writeJson = (response, statusCode, payload) => {
  setCorsHeaders(response);
  response.statusCode = statusCode;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(`${JSON.stringify(payload)}\n`);
};

const extractErrorMessage = (error) => {
  const parseNestedMessage = (value) => {
    if (!value || typeof value !== 'object') {
      return '';
    }

    if (typeof value.error?.message === 'string') {
      return value.error.message;
    }

    return '';
  };

  if (error instanceof Error && error.message) {
    try {
      const parsedMessage = JSON.parse(error.message);
      const nestedMessage = parseNestedMessage(parsedMessage);
      if (nestedMessage) {
        return nestedMessage;
      }
    } catch {
      // Ignore non-JSON error messages and keep the raw message below.
    }

    return error.message;
  }

  if (typeof error === 'string') {
    try {
      const parsedMessage = JSON.parse(error);
      const nestedMessage = parseNestedMessage(parsedMessage);
      if (nestedMessage) {
        return nestedMessage;
      }
    } catch {
      // Ignore non-JSON error messages and keep the raw message below.
    }

    return error;
  }

  const nestedMessage = parseNestedMessage(error);
  if (nestedMessage) {
    return nestedMessage;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') {
      try {
        const parsedMessage = JSON.parse(serialized);
        const extracted = parseNestedMessage(parsedMessage);
        if (extracted) {
          return extracted;
        }
      } catch {
        // Ignore parsing failures and keep the serialized form below.
      }

      return serialized;
    }
  } catch {
    // Ignore serialization errors and fall back below.
  }

  return String(error ?? 'Unknown Gemini proxy error');
};

const isRejectedKeyError = (message) =>
  /reported as leaked|permission_denied|api key.+(?:invalid|rejected|disabled|revoked)|status":"PERMISSION_DENIED"|code":403/iu.test(message);

const readRequestBody = async (request) =>
  new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });

    request.on('end', () => resolve(rawBody));
    request.on('error', reject);
  });

const getGeminiStatusPayload = () => {
  if (!ai) {
    return {
      ok: false,
      message: 'GEMINI_API_KEY is not configured on the server. Add it to .env and restart the secure app server.',
    };
  }

  return {
    ok: true,
    message: 'Gemini proxy reachable. A real request is still required to confirm the current key is accepted.',
  };
};

const handleGeminiProxyRequest = async (request, response) => {
  if (request.method === 'OPTIONS') {
    setCorsHeaders(response);
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method === 'GET') {
    const status = getGeminiStatusPayload();
    writeJson(response, status.ok ? 200 : 503, status);
    return;
  }

  if (request.method !== 'POST') {
    writeJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!ai) {
    writeJson(response, 503, {
      error: 'GEMINI_API_KEY is not configured on the server. Add it to .env and restart the secure app server.',
    });
    return;
  }

  let payload;
  try {
    const rawBody = await readRequestBody(request);
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    writeJson(response, 400, { error: extractErrorMessage(error) || 'Invalid JSON request body.' });
    return;
  }

  const model = typeof payload?.model === 'string' ? payload.model.trim() : '';
  if (!model) {
    writeJson(response, 400, { error: 'A Gemini model name is required.' });
    return;
  }

  if (payload?.contents === undefined) {
    writeJson(response, 400, { error: 'Gemini request contents are required.' });
    return;
  }

  try {
    const result = await ai.models.generateContent({
      model,
      contents: payload.contents,
      config: payload.config,
    });

    writeJson(response, 200, {
      text: result.text || '',
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    writeJson(response, isRejectedKeyError(message) ? 403 : 502, {
      error: message,
    });
  }
};

const safeJoinFromDist = (relativePath) => {
  const resolvedPath = path.resolve(distRoot, relativePath);
  if (!resolvedPath.startsWith(distRoot)) {
    return null;
  }
  return resolvedPath;
};

const sendFile = async (response, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  const contents = await readFile(filePath);
  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  response.end(contents);
};

const servePreviewAsset = async (requestPath, response) => {
  if (!existsSync(distRoot)) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('dist/ is missing. Run npm run build before npm run preview:secure.\n');
    return;
  }

  if (requestPath === '/' || requestPath === '') {
    response.statusCode = 302;
    response.setHeader('Location', appBase);
    response.end();
    return;
  }

  const normalizedPath = requestPath === appBase.slice(0, -1)
    ? ''
    : requestPath.startsWith(appBase)
      ? requestPath.slice(appBase.length)
      : requestPath.replace(/^\/+/, '');

  const assetPath = safeJoinFromDist(normalizedPath || 'index.html');
  if (assetPath) {
    try {
      const assetStats = await stat(assetPath);
      if (assetStats.isFile()) {
        await sendFile(response, assetPath);
        return;
      }
    } catch {
      // Fall through to SPA fallback.
    }
  }

  const spaEntryPath = safeJoinFromDist('index.html');
  if (!spaEntryPath) {
    response.statusCode = 500;
    response.end('Unable to resolve preview entry file.\n');
    return;
  }

  await sendFile(response, spaEntryPath);
};

const startServer = async () => {
  const vite = previewMode
    ? null
    : await createViteServer({
        root: repoRoot,
        server: {
          middlewareMode: true,
        },
        appType: 'spa',
      });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    const requestPath = decodeURIComponent(url.pathname);

    if (apiPaths.has(requestPath)) {
      await handleGeminiProxyRequest(request, response);
      return;
    }

    if (previewMode) {
      await servePreviewAsset(requestPath, response);
      return;
    }

    vite.middlewares(request, response, () => {
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end('Not found.\n');
    });
  });

  server.listen(port, host, () => {
    const modeLabel = previewMode ? 'secure preview' : 'secure dev';
    console.log(`Ministry Manager ${modeLabel} server running at http://${host}:${port}${appBase}`);
    const status = getGeminiStatusPayload();
    console.log(status.message);
  });
};

startServer().catch((error) => {
  console.error(extractErrorMessage(error));
  process.exitCode = 1;
});