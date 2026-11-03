/** Starts a browser download for an in-memory file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: some browsers read the blob asynchronously after click().
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(text: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}
