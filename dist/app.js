const $ = (selector) => document.querySelector(selector);
const dropzone = $('#dropzone');
const input = $('#file-input');
const fileCard = $('#file-card');
const inputPane = $('.input-pane');
const actionRow = $('.action-row');
const processButton = $('#process-button');
const compressButton = $('#compress-button');
const statusPanel = $('#status-panel');
const errorMessage = $('#error-message');
const results = $('#results');
const coverCard = $('.cover-card');
const pdfResultStatus = $('#pdf-result-status');
const metadataKeys = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];
const compressionSettings = { dpi: 150, imageQuality: 0.85, colorMode: 'No Change', colorSpace: 'srgb' };
let selectedFile = null;
let outputUrls = [];

$('#output-pdf-name').textContent = 'document.pdf';
$('#output-cover-name').textContent = 'cover.webp';
const workspaceTitle = $('#workspace-title');
if (workspaceTitle) workspaceTitle.innerHTML = 'Polish your PDF<br /><i>in one click.</i>';
$('#results-title').innerHTML = 'Your clean files<br /><i>are ready.</i>';

const formatBytes = (bytes) => { if (!bytes) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0)} ${units[index]}`; };
const setError = (message) => { errorMessage.textContent = message; errorMessage.classList.remove('hidden'); };
const clearError = () => { errorMessage.textContent = ''; errorMessage.classList.add('hidden'); };
const setStatus = (title, detail) => { $('#status-title').textContent = title; $('#status-detail').textContent = detail; };

function configureResults(mode = 'clean') {
  const isCompress = mode === 'compress';
  results.classList.toggle('compress-mode', isCompress);
  coverCard.classList.toggle('hidden', isCompress);
  $('#results-title').innerHTML = isCompress ? 'Your compressed PDF<br /><i>is ready.</i>' : 'Your clean files<br /><i>are ready.</i>';
  $('.output-state').textContent = isCompress ? 'PDF ONLY' : 'PDF + WEBP';
  pdfResultStatus.textContent = isCompress ? 'COMPRESSED' : 'CLEANED';
  $('#action-hint').textContent = isCompress ? `${compressionSettings.dpi} DPI · Quality ${compressionSettings.imageQuality * 100}% · Color ${compressionSettings.colorMode}` : 'WebP cover ไม่เกิน 500 KB';
  $('#check-metadata strong').textContent = 'Metadata';
  $('#check-metadata small').textContent = isCompress ? 'พยายามคงข้อมูลเดิม' : 'ล้างข้อมูลแล้ว';
  $('#check-render strong').textContent = isCompress ? 'คุณภาพ' : 'หน้าแรก';
  $('#check-render small').textContent = isCompress ? 'ลดลงเล็กน้อย' : 'เรนเดอร์ตรงกัน';
  $('#check-cover strong').textContent = isCompress ? 'ขนาดไฟล์' : 'WebP';
  $('#check-cover small').textContent = isCompress ? 'เล็กลงหรือเท่าเดิม' : 'ไม่เกิน 500 KB';
}

function explainError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (/password|encrypted|encryption|passwordexception/.test(message)) return 'PDF นี้มีรหัสผ่านหรือการเข้ารหัส จึงไม่สามารถลบ Metadata ได้โดยไม่มีรหัสผ่าน';
  if (/worker|pdf renderer|pdf\.js|metadata library/.test(message)) return 'เครื่องมืออ่าน PDF โหลดไม่ครบ กรุณารีเฟรชหน้าเว็บแล้วลองใหม่';
  if (/invalid|parse|malformed|unexpected|xref|cross-reference|eof|trailer/.test(message)) return 'โครงสร้าง PDF นี้ซับซ้อนหรือไม่สมบูรณ์ กรุณาเปิดไฟล์แล้วเลือก Save As PDF ใหม่';
  if (/webp export/.test(message)) return 'เบราว์เซอร์นี้ไม่รองรับการสร้าง WebP กรุณาใช้ Chrome หรือ Edge เวอร์ชันล่าสุด';
  if (/jpeg export/.test(message)) return 'เบราว์เซอร์นี้ไม่รองรับการบีบอัดภาพ กรุณาใช้ Chrome หรือ Edge เวอร์ชันล่าสุด';
  return 'ไม่สามารถประมวลผล PDF นี้ได้ กรุณาลองเปิดแล้ว Save As PDF ใหม่';
}

async function isPdfFile(file) {
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const text = new TextDecoder().decode(header);
  return text.includes('%PDF-') || file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function setFile(file) {
  clearError();
  if (!file) return;
  if (!(await isPdfFile(file))) { setError('ไฟล์นี้ไม่ใช่ PDF ที่อ่านได้ กรุณาเลือกไฟล์ PDF'); return; }
  selectedFile = file;
  $('#file-name').textContent = file.name || 'document.pdf';
  $('#file-size').textContent = formatBytes(file.size);
  fileCard.classList.remove('hidden');
  processButton.disabled = false;
  compressButton.disabled = false;
  dropzone.classList.add('has-file');
  dropzone.appendChild(fileCard);
  results.classList.remove('ready');
  configureResults('clean');
}

dropzone.addEventListener('click', () => input.click());
dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
input.addEventListener('change', (event) => { void setFile(event.target.files[0]); });
['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('dragover'); }));
dropzone.addEventListener('drop', (event) => { void setFile(event.dataTransfer.files[0]); });
$('#remove-file').addEventListener('click', (event) => { event.stopPropagation(); resetAll(); });
$('#reset-button').addEventListener('click', resetAll);

function resetAll() {
  outputUrls.forEach((url) => URL.revokeObjectURL(url));
  outputUrls = [];
  selectedFile = null;
  input.value = '';
  inputPane.insertBefore(fileCard, actionRow);
  fileCard.classList.add('hidden');
  dropzone.classList.remove('has-file');
  processButton.disabled = true;
  compressButton.disabled = true;
  results.classList.remove('ready');
  configureResults('clean');
  statusPanel.classList.add('hidden');
  clearError();
}

function configurePdfJs() {
  if (!window.pdfjsLib) throw new Error('PDF renderer is unavailable');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

async function openPdf(data) {
  configurePdfJs();
  // PDF.js may transfer/detach an ArrayBuffer while parsing it. Always pass a
  // copy so later verification and pdf-lib metadata work still see the bytes.
  const safeBytes = data instanceof ArrayBuffer ? new Uint8Array(data.slice(0)) : new Uint8Array(data).slice();
  return window.pdfjsLib.getDocument({ data: safeBytes, stopAtErrors: false, useSystemFonts: true }).promise;
}

async function renderPage(data, pageNumber = 1, targetMax = 1400) {
  const pdf = await openPdf(data);
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1.5, targetMax / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale: Math.max(0.2, scale) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport }).promise;
  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('WebP export failed')), 'image/webp', quality));
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('JPEG export failed')), 'image/jpeg', quality));
}

async function createCover(fileBuffer, maxKB) {
  let canvas = await renderPage(fileBuffer, 1, 1400);
  let quality = 0.82;
  const maxBytes = maxKB * 1024;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= maxBytes || (canvas.width <= 180 && canvas.height <= 180)) return blob;
    if (quality > 0.42) quality = Math.max(0.38, quality - 0.1);
    else canvas = await renderPage(fileBuffer, 1, Math.max(180, Math.round(Math.max(canvas.width, canvas.height) * 0.78)));
  }
  return canvasToBlob(canvas, 0.34);
}

async function stripMetadata(buffer) {
  if (!window.PDFLib) throw new Error('PDF metadata library is unavailable');
  const { PDFDocument, PDFName, PDFDict } = window.PDFLib;
  const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false, ignoreEncryption: false, throwOnInvalidObject: false });
  const infoRef = pdfDoc.context.trailerInfo.Info;
  if (infoRef) {
    const info = pdfDoc.context.lookup(infoRef);
    if (info instanceof PDFDict) metadataKeys.forEach((key) => info.delete(PDFName.of(key)));
  }
  const rootRef = pdfDoc.context.trailerInfo.Root;
  if (rootRef) {
    const catalog = pdfDoc.context.lookup(rootRef);
    if (catalog && typeof catalog.delete === 'function') catalog.delete(PDFName.of('Metadata'));
  }
  return pdfDoc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false, objectsPerTick: 50 });
}

async function compressPdf(buffer, onProgress) {
  if (!window.PDFLib) throw new Error('PDF metadata library is unavailable');
  const { PDFDocument } = window.PDFLib;
  const sourcePdf = await openPdf(buffer);
  const outputPdf = await PDFDocument.create();
  const sourceMetadata = await sourcePdf.getMetadata().catch(() => ({ info: {} }));
  const info = sourceMetadata.info || {};
  if (info.Title) outputPdf.setTitle(String(info.Title));
  if (info.Author) outputPdf.setAuthor(String(info.Author));
  if (info.Subject) outputPdf.setSubject(String(info.Subject));
  if (info.Keywords) outputPdf.setKeywords(String(info.Keywords).split(',').map((keyword) => keyword.trim()).filter(Boolean));
  if (info.Creator) outputPdf.setCreator(String(info.Creator));
  if (info.Producer) outputPdf.setProducer(String(info.Producer));
  if (info.CreationDate instanceof Date) outputPdf.setCreationDate(info.CreationDate);
  if (info.ModDate instanceof Date) outputPdf.setModificationDate(info.ModDate);

  for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
    onProgress?.(pageNumber, sourcePdf.numPages);
    const sourcePage = await sourcePdf.getPage(pageNumber);
    const pageViewport = sourcePage.getViewport({ scale: 1 });
    const renderScale = compressionSettings.dpi / 72;
    const viewport = sourcePage.getViewport({ scale: renderScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false, colorSpace: compressionSettings.colorSpace });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await sourcePage.render({ canvasContext: context, viewport, background: 'white' }).promise;
    const jpeg = await canvasToJpegBlob(canvas, compressionSettings.imageQuality);
    const jpegBytes = new Uint8Array(await jpeg.arrayBuffer());
    const embeddedImage = await outputPdf.embedJpg(jpegBytes);
    const outputPage = outputPdf.addPage([pageViewport.width, pageViewport.height]);
    outputPage.drawImage(embeddedImage, { x: 0, y: 0, width: pageViewport.width, height: pageViewport.height });
    sourcePage.cleanup();
    canvas.width = 1;
    canvas.height = 1;
  }

  const optimizedBytes = await outputPdf.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false, objectsPerTick: 50 });
  const originalBytes = new Uint8Array(buffer);
  const outputBytes = optimizedBytes.byteLength < originalBytes.byteLength ? optimizedBytes : originalBytes.slice();
  return { bytes: outputBytes, reduced: outputBytes.byteLength < originalBytes.byteLength };
}

function hasXmpMetadata(metadata) {
  if (!metadata?.metadata) return false;
  if (typeof metadata.metadata.getAll === 'function') return Object.keys(metadata.metadata.getAll()).length > 0;
  return false;
}

async function readVerification(originalBytes, cleanedBytes, coverBlob) {
  const originalPdf = await openPdf(originalBytes);
  const cleanedPdf = await openPdf(cleanedBytes);
  const pagesMatch = originalPdf.numPages === cleanedPdf.numPages;
  const [originalCanvas, cleanedCanvas] = await Promise.all([renderPage(originalBytes, 1, 1100), renderPage(cleanedBytes, 1, 1100)]);
  let differentPixels = 0;
  let renderMatch = originalCanvas.width === cleanedCanvas.width && originalCanvas.height === cleanedCanvas.height;
  if (renderMatch) {
    const originalPixels = originalCanvas.getContext('2d').getImageData(0, 0, originalCanvas.width, originalCanvas.height).data;
    const cleanedPixels = cleanedCanvas.getContext('2d').getImageData(0, 0, cleanedCanvas.width, cleanedCanvas.height).data;
    for (let index = 0; index < originalPixels.length; index += 4) {
      if (Math.abs(originalPixels[index] - cleanedPixels[index]) > 6 || Math.abs(originalPixels[index + 1] - cleanedPixels[index + 1]) > 6 || Math.abs(originalPixels[index + 2] - cleanedPixels[index + 2]) > 6) differentPixels += 1;
    }
    renderMatch = differentPixels / (originalCanvas.width * originalCanvas.height) <= 0.001;
  }
  const metadata = await cleanedPdf.getMetadata().catch(() => ({ info: {}, metadata: null }));
  const remainingInfo = metadataKeys.filter((key) => metadata.info && metadata.info[key] !== undefined && metadata.info[key] !== null && String(metadata.info[key]).trim() !== '');
  const metadataCleared = remainingInfo.length === 0 && !hasXmpMetadata(metadata);
  return { pagesMatch, renderMatch, metadataCleared, coverWithinLimit: Boolean(coverBlob), differentPixels };
}

async function readCompressionVerification(originalBytes, compressedBytes) {
  const originalPdf = await openPdf(originalBytes);
  const compressedPdf = await openPdf(compressedBytes);
  const pagesMatch = originalPdf.numPages === compressedPdf.numPages;
  const [originalCanvas, compressedCanvas] = await Promise.all([renderPage(originalBytes, 1, 1100), renderPage(compressedBytes, 1, 1100)]);
  let differentPixels = 0;
  let renderMatch = originalCanvas.width === compressedCanvas.width && originalCanvas.height === compressedCanvas.height;
  if (renderMatch) {
    const originalPixels = originalCanvas.getContext('2d').getImageData(0, 0, originalCanvas.width, originalCanvas.height).data;
    const compressedPixels = compressedCanvas.getContext('2d').getImageData(0, 0, compressedCanvas.width, compressedCanvas.height).data;
    for (let index = 0; index < originalPixels.length; index += 4) {
      if (Math.abs(originalPixels[index] - compressedPixels[index]) > 6 || Math.abs(originalPixels[index + 1] - compressedPixels[index + 1]) > 6 || Math.abs(originalPixels[index + 2] - compressedPixels[index + 2]) > 6) differentPixels += 1;
    }
    renderMatch = differentPixels / (originalCanvas.width * originalCanvas.height) <= 0.05;
  }
  const [originalMetadata, compressedMetadata] = await Promise.all([
    originalPdf.getMetadata().catch(() => ({ info: {} })),
    compressedPdf.getMetadata().catch(() => ({ info: {} }))
  ]);
  const metadataPreserved = metadataKeys.every((key) => String(originalMetadata.info?.[key] ?? '') === String(compressedMetadata.info?.[key] ?? ''));
  return { pagesMatch, renderMatch, metadataPreserved, sizeNotLarger: compressedBytes.byteLength <= originalBytes.byteLength, differentPixels };
}

function updateCheck(id, passed) {
  const item = $(`#${id}`);
  item.classList.toggle('check-pass', passed);
  item.classList.toggle('check-fail', !passed);
  item.querySelector('.check-mark').textContent = passed ? '✓' : '!';
}

processButton.addEventListener('click', async () => {
  if (!selectedFile) return;
  clearError();
  processButton.disabled = true;
  compressButton.disabled = true;
  statusPanel.classList.remove('hidden');
  setStatus('กำลังอ่านไฟล์…', 'ตรวจสอบโครงสร้าง PDF และจำนวนหน้า');
  try {
    const buffer = await selectedFile.arrayBuffer();
    const maxKB = 500;
    await openPdf(buffer);
    setStatus('กำลังลบ metadata…', 'ใช้โหมดอ่าน PDF แบบ tolerant โดยไม่บีบอัดเนื้อหา');
    const cleanedBytes = await stripMetadata(buffer);
    setStatus('กำลังสร้าง cover…', `เรนเดอร์หน้าแรกเป็น WebP ไม่เกิน ${maxKB} KB`);
    const cover = await createCover(buffer, maxKB);
    setStatus('กำลังตรวจสอบผลลัพธ์…', 'เปรียบเทียบจำนวนหน้า metadata และการเรนเดอร์หน้าแรก');
    const verification = await readVerification(buffer, cleanedBytes, cover);
    const allPassed = verification.pagesMatch && verification.renderMatch && verification.metadataCleared && verification.coverWithinLimit && cover.size <= maxKB * 1024;
    configureResults('clean');
    const pdfBlob = new Blob([cleanedBytes], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const coverUrl = URL.createObjectURL(cover);
    outputUrls = [pdfUrl, coverUrl];
    const pdfName = selectedFile.name || 'document.pdf';
    const coverName = 'cover.webp';
    $('#output-pdf-name').textContent = pdfName;
    $('#pdf-result-meta').textContent = `${formatBytes(pdfBlob.size)} · ไฟล์ใหม่ · ไม่บีบอัด`;
    $('#pdf-download').href = pdfUrl;
    $('#pdf-download').download = pdfName;
    $('#output-cover-name').textContent = coverName;
    $('#cover-result-meta').textContent = `${formatBytes(cover.size)} · หน้าแรก · สูงสุด ${formatBytes(maxKB * 1024)}`;
    $('#cover-download').href = coverUrl;
    $('#cover-download').download = coverName;
    $('#cover-preview').src = coverUrl;
    updateCheck('check-pages', verification.pagesMatch);
    updateCheck('check-metadata', verification.metadataCleared);
    updateCheck('check-render', verification.renderMatch);
    updateCheck('check-cover', verification.coverWithinLimit && cover.size <= maxKB * 1024);
    $('#verification-summary').textContent = allPassed ? 'ผ่าน 4/4 รายการ' : 'มีรายการที่ต้องตรวจซ้ำ';
    $('#overall-badge').textContent = allPassed ? '✓ ตรวจสอบแล้ว' : '! ตรวจสอบซ้ำ';
    $('#overall-badge').classList.toggle('warning-badge', !allPassed);
    statusPanel.classList.add('hidden');
    results.classList.remove('hidden');
    results.classList.add('ready');
  } catch (error) {
    statusPanel.classList.add('hidden');
    processButton.disabled = false;
    compressButton.disabled = false;
    setError(explainError(error));
    console.error('PDF Prep Studio processing error:', error);
  }
});

compressButton.addEventListener('click', async () => {
  if (!selectedFile) return;
  clearError();
  processButton.disabled = true;
  compressButton.disabled = true;
  statusPanel.classList.remove('hidden');
  setStatus('กำลังอ่านไฟล์…', 'ตรวจสอบโครงสร้าง PDF และจำนวนหน้า');
  try {
    const buffer = await selectedFile.arrayBuffer();
    await openPdf(buffer);
    setStatus('กำลังบีบอัด PDF…', `${compressionSettings.dpi} DPI · Quality ${compressionSettings.imageQuality * 100}% · Color ${compressionSettings.colorMode}`);
    const compressed = await compressPdf(buffer, (pageNumber, totalPages) => setStatus(`กำลังบีบอัดหน้า ${pageNumber}/${totalPages}…`, `${compressionSettings.dpi} DPI · Quality ${compressionSettings.imageQuality * 100}% · ไม่ปรับสี`));
    setStatus('กำลังตรวจสอบคุณภาพ…', 'เปรียบเทียบจำนวนหน้า metadata และการเรนเดอร์หน้าแรก');
    const verification = await readCompressionVerification(buffer, compressed.bytes);
    const allPassed = verification.pagesMatch && verification.renderMatch && verification.metadataPreserved && verification.sizeNotLarger;
    configureResults('compress');
    const pdfBlob = new Blob([compressed.bytes], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    outputUrls = [pdfUrl];
    const pdfName = selectedFile.name || 'document.pdf';
    $('#output-pdf-name').textContent = pdfName;
    $('#pdf-result-meta').textContent = `${formatBytes(pdfBlob.size)} · ${compressed.reduced ? `${compressionSettings.dpi} DPI · Quality ${compressionSettings.imageQuality * 100}% · Color ${compressionSettings.colorMode}` : 'ไฟล์เดิมเหมาะสมอยู่แล้ว'}`;
    $('#pdf-download').href = pdfUrl;
    $('#pdf-download').download = pdfName;
    updateCheck('check-pages', verification.pagesMatch);
    updateCheck('check-metadata', verification.metadataPreserved);
    updateCheck('check-render', verification.renderMatch);
    updateCheck('check-cover', verification.sizeNotLarger);
    $('#verification-summary').textContent = allPassed ? 'ผ่าน 4/4 รายการ' : 'มีรายการที่ต้องตรวจซ้ำ';
    $('#overall-badge').textContent = allPassed ? '✓ ตรวจสอบแล้ว' : '! ตรวจสอบซ้ำ';
    $('#overall-badge').classList.toggle('warning-badge', !allPassed);
    statusPanel.classList.add('hidden');
    results.classList.remove('hidden');
    results.classList.add('ready');
  } catch (error) {
    statusPanel.classList.add('hidden');
    processButton.disabled = false;
    compressButton.disabled = false;
    setError(explainError(error));
    console.error('PDF Prep Studio compression error:', error);
  }
});
