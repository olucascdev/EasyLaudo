const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost/api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

function buildUrl(path: string) {
  return `${API_URL}${path}`;
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as ApiEnvelope<unknown>;
    return payload.error || "Falha na requisicao.";
  } catch {
    return "Falha na requisicao.";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {})
    }
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Falha na requisicao.");
  }

  return payload.data;
}

function getFilenameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return undefined;
  }

  const match = disposition.match(/filename="?(.*?)"?$/i);
  return match?.[1];
}

async function requestBlob(path: string, init?: RequestInit) {
  const response = await fetch(buildUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(response.headers.get("Content-Disposition"))
  };
}

async function uploadBlob<T>(path: string, formData: FormData): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: formData
  });
}

export const api = {
  get: requestJson,
  post: <T>(path: string, body?: unknown) =>
    requestJson<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined
    }),
  delete: <T>(path: string) =>
    requestJson<T>(path, {
      method: "DELETE"
    }),
  upload: uploadBlob,
  blob: requestBlob
};
