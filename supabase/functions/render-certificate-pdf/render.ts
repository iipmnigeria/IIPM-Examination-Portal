import {
  degrees,
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from 'npm:pdf-lib@1.17.1';
// @deno-types="npm:@types/qrcode@1.5.5"
import QRCode from 'npm:qrcode@1.5.4';

export const CERTIFICATE_RENDERER_VERSION = 'phase1c-pdf-lib-1';

export type CertificateOverlayElement = {
  id?: string;
  fieldKey?: string;
  label?: string;
  dataType?: 'text' | 'date' | 'number' | 'qr' | 'asset';
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  heightPct?: number;
  fontSizePt?: number;
  fontFamily?: 'serif' | 'sans' | 'mono';
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  rotation?: number;
  opacity?: number;
  uppercase?: boolean;
  prefix?: string;
  suffix?: string;
  customText?: string;
  assetId?: string | null;
  zIndex?: number;
};

export type ManagedCertificateRenderContext = {
  jobId: string;
  certificate: {
    id: string;
    certificateNumber: string;
    verificationCode: string;
    holderName: string;
    certificateTitle: string;
    examinationTitle: string;
    examinationCode?: string | null;
    programmeId: string;
    programmeCode: string;
    programmeTitle: string;
    score: number;
    passMark: number;
    grade?: string | null;
    issueDate: string;
    completionDate: string;
    issuedAt: string;
    revisionNumber: number;
    productCode: string;
  };
  institution: {
    id: string;
    code: string;
    name: string;
    shortName?: string | null;
    website?: string | null;
  };
  master: {
    assignmentId: string;
    templateId: string;
    templateCode: string;
    templateName: string;
    versionId: string;
    versionNumber: number;
    sourceFormat: 'pdf' | 'png' | 'jpeg';
    storageBucket: string;
    storagePath: string;
    mimeType: string;
    sha256: string;
    pageWidthPoints?: number | null;
    pageHeightPoints?: number | null;
    orientation: 'portrait' | 'landscape';
    pageSize: 'A4' | 'Letter' | 'Legal' | 'Custom';
    overlaySchema: CertificateOverlayElement[];
    overlaySha256: string;
    qualityStatus: 'passed' | 'waived';
  };
  assets: Array<{
    id: string;
    assetType: string;
    name: string;
    storageBucket: string;
    storagePath: string;
    mimeType: 'image/png' | 'image/jpeg';
    sha256: string;
    pixelWidth?: number | null;
    pixelHeight?: number | null;
    metadata?: Record<string, unknown>;
  }>;
  verificationUrl: string;
  fileName: string;
};

export type LoadedCertificateAsset = {
  id: string;
  mimeType: 'image/png' | 'image/jpeg';
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
};

export type ManagedCertificateRenderInput = {
  context: ManagedCertificateRenderContext;
  masterBytes: Uint8Array;
  assets: Map<string, LoadedCertificateAsset>;
};

type TextFit = {
  size: number;
  lines: string[];
  lineHeight: number;
};

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const LETTER_PORTRAIT: [number, number] = [612, 792];
const LEGAL_PORTRAIT: [number, number] = [612, 1008];

const finite = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const requirePercentageBox = (
  element: CertificateOverlayElement,
): { xPct: number; yPct: number; widthPct: number; heightPct: number } => {
  const xPct = finite(element.xPct, Number.NaN);
  const yPct = finite(element.yPct, Number.NaN);
  const widthPct = finite(element.widthPct, Number.NaN);
  const heightPct = finite(element.heightPct, Number.NaN);
  const name = element.id || element.fieldKey || 'unknown';

  if (![xPct, yPct, widthPct, heightPct].every(Number.isFinite)) {
    throw new Error(`Overlay element ${name} has incomplete percentage coordinates.`);
  }
  if (
    xPct < 0 ||
    yPct < 0 ||
    widthPct <= 0 ||
    heightPct <= 0 ||
    xPct + widthPct > 100.001 ||
    yPct + heightPct > 100.001
  ) {
    throw new Error(`Overlay element ${name} is outside the certificate page.`);
  }
  return { xPct, yPct, widthPct, heightPct };
};

const parseHexColour = (value?: string): ReturnType<typeof rgb> => {
  const match = String(value || '#0f172a').trim().match(/^#([0-9a-f]{6})$/i);
  const hex = match?.[1] || '0f172a';
  return rgb(
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  );
};

const fontNameForElement = (element: CertificateOverlayElement): StandardFonts => {
  const family = element.fontFamily || 'sans';
  const bold = finite(element.fontWeight, 500) >= 600;
  const italic = String(element.label || '').toLowerCase().includes('italic');

  if (family === 'serif') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === 'mono') {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
};

const formatDate = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const signatureMetadata = (
  context: ManagedCertificateRenderContext,
): Record<string, unknown> => {
  const signature = context.assets.find((asset) => asset.assetType === 'signature');
  return signature?.metadata || {};
};

const dynamicValues = (
  context: ManagedCertificateRenderContext,
): Record<string, string> => {
  const certificate = context.certificate;
  const signature = signatureMetadata(context);
  const score = Number(certificate.score);
  const passMark = Number(certificate.passMark);

  return {
    holderName: certificate.holderName,
    certificateTitle: certificate.certificateTitle,
    programmeTitle: certificate.programmeTitle,
    programmeCode: certificate.programmeCode,
    examinationTitle: certificate.examinationTitle,
    examinationCode: certificate.examinationCode || '',
    score: Number.isFinite(score) ? `${score.toFixed(score % 1 === 0 ? 0 : 1)}%` : '',
    passMark: Number.isFinite(passMark)
      ? `${passMark.toFixed(passMark % 1 === 0 ? 0 : 1)}%`
      : '',
    grade: certificate.grade || '',
    issueDate: formatDate(certificate.issueDate),
    completionDate: formatDate(certificate.completionDate),
    certificateNumber: certificate.certificateNumber,
    verificationCode: certificate.verificationCode,
    qrCode: context.verificationUrl,
    institutionName: context.institution.name,
    institutionShortName: context.institution.shortName || context.institution.code,
    institutionWebsite: context.institution.website || '',
    signatoryName: String(signature.signatoryName || signature.name || ''),
    signatoryTitle: String(signature.signatoryTitle || signature.title || ''),
    customText: '',
  };
};

const resolveElementText = (
  element: CertificateOverlayElement,
  values: Record<string, string>,
): string => {
  const fieldKey = element.fieldKey || '';
  let text = fieldKey === 'customText'
    ? String(element.customText || '')
    : String(values[fieldKey] || '');

  if (element.uppercase) text = text.toUpperCase();
  return `${element.prefix || ''}${text}${element.suffix || ''}`;
};

const textWidth = (
  font: PDFFont,
  text: string,
  size: number,
  letterSpacing: number,
): number => {
  const spacing = Math.max(0, text.length - 1) * letterSpacing;
  return font.widthOfTextAtSize(text, size) + spacing;
};

const splitLongWord = (
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  letterSpacing: number,
): string[] => {
  if (!word) return [''];
  const chunks: string[] = [];
  let current = '';
  for (const character of word) {
    const candidate = `${current}${character}`;
    if (current && textWidth(font, candidate, size, letterSpacing) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

const wrapText = (
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  letterSpacing: number,
): string[] => {
  const paragraphs = String(text).replace(/\r/g, '').split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const originalWord of words) {
      const wordParts = textWidth(font, originalWord, size, letterSpacing) > maxWidth
        ? splitLongWord(originalWord, font, size, maxWidth, letterSpacing)
        : [originalWord];

      for (const part of wordParts) {
        const candidate = current ? `${current} ${part}` : part;
        if (current && textWidth(font, candidate, size, letterSpacing) > maxWidth) {
          lines.push(current);
          current = part;
        } else {
          current = candidate;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
};

const fitText = (
  text: string,
  font: PDFFont,
  preferredSize: number,
  width: number,
  height: number,
  lineHeightFactor: number,
  letterSpacing: number,
): TextFit => {
  let size = clamp(preferredSize, 4, 160);
  const minimumSize = 4;

  while (size >= minimumSize) {
    const lines = wrapText(text, font, size, width, letterSpacing);
    const lineHeight = size * lineHeightFactor;
    const totalHeight = Math.max(size, lines.length * lineHeight);
    const widest = Math.max(
      ...lines.map((line) => textWidth(font, line, size, letterSpacing)),
      0,
    );
    if (widest <= width + 0.01 && totalHeight <= height + 0.01) {
      return { size, lines, lineHeight };
    }
    size -= 0.5;
  }

  throw new Error(`Text field cannot fit its approved box without dropping below 4 points: ${text}`);
};

const drawLineWithSpacing = (
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  letterSpacing: number,
  color: ReturnType<typeof rgb>,
  opacity: number,
  rotation: number,
): void => {
  if (!text) return;
  if (Math.abs(letterSpacing) < 0.001 || Math.abs(rotation) > 0.001) {
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color,
      opacity,
      rotate: degrees(rotation),
    });
    return;
  }

  let cursor = x;
  for (const character of text) {
    page.drawText(character, {
      x: cursor,
      y,
      size,
      font,
      color,
      opacity,
    });
    cursor += font.widthOfTextAtSize(character, size) + letterSpacing;
  }
};

const dataUrlBytes = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',', 2)[1] || '';
  const decoded = atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const pageSizeForImageMaster = (
  context: ManagedCertificateRenderContext,
): [number, number] => {
  const configuredWidth = finite(context.master.pageWidthPoints, 0);
  const configuredHeight = finite(context.master.pageHeightPoints, 0);
  if (configuredWidth > 0 && configuredHeight > 0) {
    return [configuredWidth, configuredHeight];
  }

  const portrait = context.master.pageSize === 'Letter'
    ? LETTER_PORTRAIT
    : context.master.pageSize === 'Legal'
    ? LEGAL_PORTRAIT
    : A4_PORTRAIT;

  return context.master.orientation === 'landscape'
    ? [portrait[1], portrait[0]]
    : portrait;
};

const embedRasterImage = async (
  document: PDFDocument,
  mimeType: string,
  bytes: Uint8Array,
): Promise<PDFImage> => {
  if (mimeType === 'image/png') return await document.embedPng(bytes);
  if (mimeType === 'image/jpeg') return await document.embedJpg(bytes);
  throw new Error(`Unsupported raster image type: ${mimeType}`);
};

const createDocumentFromMaster = async (
  context: ManagedCertificateRenderContext,
  masterBytes: Uint8Array,
): Promise<{ document: PDFDocument; page: PDFPage }> => {
  if (context.master.sourceFormat === 'pdf') {
    const document = await PDFDocument.load(masterBytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    if (document.getPageCount() !== 1) {
      throw new Error('A managed certificate master must contain exactly one PDF page.');
    }
    return { document, page: document.getPage(0) };
  }

  const document = await PDFDocument.create();
  const [width, height] = pageSizeForImageMaster(context);
  const page = document.addPage([width, height]);
  const image = await embedRasterImage(document, context.master.mimeType, masterBytes);
  page.drawImage(image, { x: 0, y: 0, width, height });
  return { document, page };
};

const drawTextElement = async (
  document: PDFDocument,
  page: PDFPage,
  element: CertificateOverlayElement,
  text: string,
  fontCache: Map<string, PDFFont>,
): Promise<void> => {
  if (!text) return;

  const { width, height } = page.getSize();
  const box = requirePercentageBox(element);
  const x = width * box.xPct / 100;
  const boxWidth = width * box.widthPct / 100;
  const boxHeight = height * box.heightPct / 100;
  const top = height * (1 - box.yPct / 100);
  const bottom = top - boxHeight;

  const fontName = fontNameForElement(element);
  let font = fontCache.get(fontName);
  if (!font) {
    font = await document.embedFont(fontName);
    fontCache.set(fontName, font);
  }

  const lineHeightFactor = clamp(finite(element.lineHeight, 1.15), 0.8, 3);
  const letterSpacing = clamp(finite(element.letterSpacing, 0), -2, 12);
  const fit = fitText(
    text,
    font,
    finite(element.fontSizePt, 12),
    boxWidth,
    boxHeight,
    lineHeightFactor,
    letterSpacing,
  );
  const totalHeight = Math.max(fit.size, fit.lines.length * fit.lineHeight);
  let y = bottom + (boxHeight + totalHeight) / 2 - fit.size;

  for (const line of fit.lines) {
    const lineWidth = textWidth(font, line, fit.size, letterSpacing);
    const alignment = element.textAlign || 'center';
    const lineX = alignment === 'left'
      ? x
      : alignment === 'right'
      ? x + boxWidth - lineWidth
      : x + (boxWidth - lineWidth) / 2;

    drawLineWithSpacing(
      page,
      line,
      lineX,
      y,
      fit.size,
      font,
      letterSpacing,
      parseHexColour(element.color),
      clamp(finite(element.opacity, 1), 0.05, 1),
      clamp(finite(element.rotation, 0), -180, 180),
    );
    y -= fit.lineHeight;
  }
};

const drawQrElement = async (
  document: PDFDocument,
  page: PDFPage,
  element: CertificateOverlayElement,
  value: string,
): Promise<void> => {
  if (!value) return;
  const { width, height } = page.getSize();
  const box = requirePercentageBox(element);
  const x = width * box.xPct / 100;
  const boxWidth = width * box.widthPct / 100;
  const boxHeight = height * box.heightPct / 100;
  const top = height * (1 - box.yPct / 100);
  const bottom = top - boxHeight;
  const size = Math.min(boxWidth, boxHeight);
  const qrDataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 720,
    color: {
      dark: String(element.color || '#0f172a'),
      light: '#ffffff',
    },
  });
  const qrImage = await document.embedPng(dataUrlBytes(qrDataUrl));
  page.drawImage(qrImage, {
    x: x + (boxWidth - size) / 2,
    y: bottom + (boxHeight - size) / 2,
    width: size,
    height: size,
    opacity: clamp(finite(element.opacity, 1), 0.05, 1),
    rotate: degrees(clamp(finite(element.rotation, 0), -180, 180)),
  });
};

const drawAssetElement = async (
  document: PDFDocument,
  page: PDFPage,
  element: CertificateOverlayElement,
  loadedAssets: Map<string, LoadedCertificateAsset>,
): Promise<void> => {
  const assetId = String(element.assetId || '').trim();
  if (!assetId) throw new Error(`Asset field ${element.fieldKey || ''} has no approved asset binding.`);
  const loaded = loadedAssets.get(assetId);
  if (!loaded) throw new Error(`Approved certificate asset ${assetId} was not loaded.`);

  const { width, height } = page.getSize();
  const box = requirePercentageBox(element);
  const x = width * box.xPct / 100;
  const boxWidth = width * box.widthPct / 100;
  const boxHeight = height * box.heightPct / 100;
  const top = height * (1 - box.yPct / 100);
  const bottom = top - boxHeight;
  const image = await embedRasterImage(document, loaded.mimeType, loaded.bytes);
  const dimensions = image.scale(1);
  const scale = Math.min(boxWidth / dimensions.width, boxHeight / dimensions.height);
  const drawWidth = dimensions.width * scale;
  const drawHeight = dimensions.height * scale;

  page.drawImage(image, {
    x: x + (boxWidth - drawWidth) / 2,
    y: bottom + (boxHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
    opacity: clamp(finite(element.opacity, 1), 0.05, 1),
    rotate: degrees(clamp(finite(element.rotation, 0), -180, 180)),
  });
};

export async function renderManagedCertificate(
  input: ManagedCertificateRenderInput,
): Promise<Uint8Array> {
  const { context, masterBytes, assets } = input;
  if (!context.master.overlaySchema?.length) {
    throw new Error('The approved certificate master has no visual overlay fields.');
  }

  const { document, page } = await createDocumentFromMaster(context, masterBytes);
  const values = dynamicValues(context);
  const fontCache = new Map<string, PDFFont>();

  const elements = [...context.master.overlaySchema].sort(
    (left, right) => finite(left.zIndex, 0) - finite(right.zIndex, 0),
  );

  for (const element of elements) {
    requirePercentageBox(element);
    const dataType = element.dataType || (
      element.fieldKey === 'qrCode'
        ? 'qr'
        : element.assetId
        ? 'asset'
        : 'text'
    );

    if (dataType === 'qr') {
      await drawQrElement(document, page, element, context.verificationUrl);
    } else if (dataType === 'asset') {
      await drawAssetElement(document, page, element, assets);
    } else {
      await drawTextElement(
        document,
        page,
        element,
        resolveElementText(element, values),
        fontCache,
      );
    }
  }

  if (document.getPageCount() !== 1) {
    throw new Error('The server renderer must produce exactly one certificate page.');
  }

  document.setTitle(`${context.certificate.certificateTitle} — ${context.certificate.holderName}`);
  document.setAuthor(context.institution.name);
  document.setSubject(
    `Verifiable certificate ${context.certificate.certificateNumber}`,
  );
  document.setKeywords([
    context.institution.code,
    context.certificate.programmeCode,
    context.certificate.certificateNumber,
    'verifiable certificate',
  ]);
  document.setCreator('AgileCert Certificate Server Renderer');
  document.setProducer(`${CERTIFICATE_RENDERER_VERSION} · pdf-lib`);
  document.setCreationDate(new Date());
  document.setModificationDate(new Date());

  return await document.save({
    useObjectStreams: false,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
}
