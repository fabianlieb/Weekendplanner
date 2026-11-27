// Hand a generated file to the user: share sheet on the iPhone, download elsewhere.

export async function shareOrDownload(name: string, text: string, type = 'application/json'): Promise<void> {
  const file = new File([text], name, { type });
  // On the iPhone the share sheet offers saving to the Files app.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
