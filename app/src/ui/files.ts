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

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Hands an .ics file to the calendar. On iOS a text/calendar data URL opens the
 * «Add to Calendar» sheet; elsewhere the file is downloaded and opened by the calendar app.
 */
export function openCalendarFile(name: string, ics: string): void {
  if (isIos()) {
    const opened = window.open(`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`, '_blank');
    if (opened) return;
  }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
