// NexusBooks — PDF/EPUB Preview Reader
const Reader = (() => {
  let pdfDoc = null;
  let currentPage = 1;
  let maxPages = 10;
  let totalPages = 1;

  function open(previewUrl, bookTitle, allowedPages = 10) {
    maxPages = allowedPages;
    currentPage = 1;

    const modal = document.getElementById('reader-modal');
    if (!modal) { createModal(); }

    document.getElementById('reader-title').textContent = bookTitle;
    document.getElementById('reader-modal').classList.add('open');
    document.body.style.overflow = 'hidden';

    if (previewUrl.endsWith('.pdf') || previewUrl.includes('pdf')) {
      loadPDF(previewUrl);
    } else {
      loadEPUB(previewUrl);
    }
  }

  function close() {
    document.getElementById('reader-modal')?.classList.remove('open');
    document.body.style.overflow = '';
    pdfDoc = null;
    currentPage = 1;
  }

  function createModal() {
    const m = document.createElement('div');
    m.id = 'reader-modal';
    m.className = 'reader-modal';
    m.innerHTML = `
      <div class="reader-backdrop" onclick="Reader.close()"></div>
      <div class="reader-panel">
        <div class="reader-header">
          <h3 id="reader-title">Preview</h3>
          <div class="reader-controls">
            <button onclick="Reader.prevPage()" id="btn-prev">← Prev</button>
            <span id="reader-page-info">Page 1</span>
            <button onclick="Reader.nextPage()" id="btn-next">Next →</button>
            <button onclick="Reader.close()" class="reader-close">✕</button>
          </div>
        </div>
        <div class="reader-body">
          <canvas id="pdf-canvas"></canvas>
          <div id="epub-viewer" style="display:none;"></div>
          <div id="reader-loader" class="loader"><div class="loader__ring"></div></div>
        </div>
        <div class="reader-footer">
          <div class="reader-lock" id="reader-lock" style="display:none;">
            <div class="reader-lock__content">
              <span class="lock-icon">🔒</span>
              <p>Preview ends here. Purchase to read the full book.</p>
              <button class="btn btn--primary" onclick="Reader.close()">Get Full Access</button>
            </div>
          </div>
          <div class="reader-progress">
            <div class="reader-progress__bar" id="reader-progress-bar"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);
  }

  async function loadPDF(url) {
    const loader = document.getElementById('reader-loader');
    const canvas = document.getElementById('pdf-canvas');
    if (loader) loader.style.display = 'flex';

    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfDoc = await pdfjsLib.getDocument(url).promise;
      totalPages = Math.min(pdfDoc.numPages, maxPages);
      if (loader) loader.style.display = 'none';
      await renderPDFPage(currentPage);
    } catch (e) {
      if (loader) loader.style.display = 'none';
      canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align:center;padding:2rem;">Preview unavailable. Please purchase to read.</p>`;
    }
  }

  async function renderPDFPage(pageNum) {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: 1.4 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    updatePageInfo();
  }

  function updatePageInfo() {
    const info = document.getElementById('reader-page-info');
    const bar = document.getElementById('reader-progress-bar');
    const lock = document.getElementById('reader-lock');
    if (info) info.textContent = `Page ${currentPage} of ${totalPages}`;
    if (bar) bar.style.width = `${(currentPage / totalPages) * 100}%`;
    if (currentPage >= totalPages && lock) {
      lock.style.display = 'flex';
    } else if (lock) {
      lock.style.display = 'none';
    }
    document.getElementById('btn-prev').disabled = currentPage <= 1;
    document.getElementById('btn-next').disabled = currentPage >= totalPages;
  }

  async function nextPage() {
    if (currentPage >= totalPages) return;
    currentPage++;
    await renderPDFPage(currentPage);
  }

  async function prevPage() {
    if (currentPage <= 1) return;
    currentPage--;
    await renderPDFPage(currentPage);
  }

  function loadEPUB(url) {
    const viewer = document.getElementById('epub-viewer');
    const canvas = document.getElementById('pdf-canvas');
    const loader = document.getElementById('reader-loader');
    if (canvas) canvas.style.display = 'none';
    if (viewer) viewer.style.display = 'block';
    if (loader) loader.style.display = 'none';
    if (viewer) {
      viewer.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;border-radius:8px;"></iframe>`;
    }
    updatePageInfo();
  }

  return { open, close, nextPage, prevPage };
})();
