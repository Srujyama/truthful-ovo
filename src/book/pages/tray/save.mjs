// Hands the reader a file (the browser saves it wherever its downloads go), and
// puts a letter on their clipboard.

export function saveFile(name, contents, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // an older browser, or a page that is not allowed the clipboard: the old way still works there
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(box);
    box.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { done = false; }
    box.remove();
    return done;
  }
}
