// An explicit demo limit for buffered multipart uploads; larger inputs use GEA upload grants.
export const maxUploadBytes = 4 * 1024 * 1024;
export const maxMessageFiles = 10;

export function fileDownloadPath(id: string) {
  return `/api/files/content?fileId=${encodeURIComponent(id)}`;
}

// Saved GEA messages carry managed content URLs, which require backend OAuth.
export function messageFileDownloadPath(url: string) {
  try {
    const match =
      /^\/api\/v1\/(?:files|artifacts)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/content$/i.exec(
        new URL(url, "http://message.invalid").pathname,
      );
    return match ? fileDownloadPath(match[1]!) : undefined;
  } catch {
    return undefined;
  }
}
