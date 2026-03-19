import { GoogleGenAI } from "npm:@google/genai@1.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

const extractErrorMessage = (error: unknown) => {
  const parseNestedMessage = (value: unknown) => {
    if (!value || typeof value !== 'object') {
      return '';
    }

    const maybeError = value as { error?: { message?: string } };
    return typeof maybeError.error?.message === 'string' ? maybeError.error.message : '';
  };

  if (error instanceof Error && error.message) {
    try {
      const parsedMessage = JSON.parse(error.message);
      const nestedMessage = parseNestedMessage(parsedMessage);
      if (nestedMessage) {
        return nestedMessage;
      }
    } catch {
      // Keep the raw message below.
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
      // Keep the raw message below.
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
        // Keep the serialized value below.
      }

      return serialized;
    }
  } catch {
    // Ignore serialization errors and fall back below.
  }

  return String(error ?? 'Unknown Gemini function error');
};

const isRejectedKeyError = (message: string) =>
  /reported as leaked|permission_denied|api key.+(?:invalid|rejected|disabled|revoked)|status":"PERMISSION_DENIED"|code":403/iu.test(message);

const writeJson = (payload: unknown, status = 200) =>
  new Response(`${JSON.stringify(payload)}\n`, {
    status,
    headers: corsHeaders,
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';

  if (request.method === 'GET') {
    return writeJson(
      geminiApiKey
        ? {
            ok: true,
            message: 'Gemini edge function reachable. A real request is still required to confirm the current key is accepted.',
          }
        : {
            ok: false,
            message: 'GEMINI_API_KEY is not configured in Supabase Edge Function secrets.',
          },
      geminiApiKey ? 200 : 503,
    );
  }

  if (request.method !== 'POST') {
    return writeJson({ error: 'Method not allowed.' }, 405);
  }

  if (!geminiApiKey) {
    return writeJson(
      {
        error: 'GEMINI_API_KEY is not configured in Supabase Edge Function secrets. Set it and redeploy the function.',
      },
      503,
    );
  }

  let payload: { model?: string; contents?: unknown; config?: Record<string, unknown> } = {};
  try {
    payload = await request.json();
  } catch (error) {
    return writeJson({ error: extractErrorMessage(error) || 'Invalid JSON request body.' }, 400);
  }

  const model = typeof payload.model === 'string' ? payload.model.trim() : '';
  if (!model) {
    return writeJson({ error: 'A Gemini model name is required.' }, 400);
  }

  if (payload.contents === undefined) {
    return writeJson({ error: 'Gemini request contents are required.' }, 400);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const result = await ai.models.generateContent({
      model,
      contents: payload.contents,
      config: payload.config,
    });

    return writeJson({ text: result.text || '' }, 200);
  } catch (error) {
    const message = extractErrorMessage(error);
    return writeJson({ error: message }, isRejectedKeyError(message) ? 403 : 502);
  }
});