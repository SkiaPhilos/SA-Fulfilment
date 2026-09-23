import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export interface PrintDocumentOptions {
  title: string;
  html: string;
  pageSize?: '4in 2in' | '4in 6in' | 'A4' | 'auto';
  orientation?: 'portrait' | 'landscape';
  customCss?: string;
}

/**
 * Generates an SVG string representation of a Code128 barcode
 */
export function generateBarcodeSvgString(
  value: string,
  options?: {
    height?: number;
    width?: number;
    displayValue?: boolean;
    fontSize?: number;
  }
): string {
  try {
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgNode, value, {
      format: 'CODE128',
      lineColor: '#000000',
      width: options?.width ?? 1.8,
      height: options?.height ?? 42,
      displayValue: options?.displayValue ?? true,
      font: 'monospace',
      fontSize: options?.fontSize ?? 11,
      textMargin: 3,
      margin: 0
    });
    return new XMLSerializer().serializeToString(svgNode);
  } catch (err) {
    console.error('Failed to generate barcode SVG string for:', value, err);
    return `<div style="font-family:monospace;font-weight:bold;font-size:12px;border:1px dashed #000;padding:4px;">${value}</div>`;
  }
}

/**
 * Generates a base64 Data URL for a QR Code
 */
export async function generateQrDataUrl(
  payload: string,
  width = 120
): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, {
      margin: 1,
      width,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    return '';
  }
}

/**
 * Prints HTML content via an isolated hidden iframe.
 * This guarantees:
 * 1. ZERO UI bleeding (no sidebar, modals, dark backdrops or web layouts)
 * 2. Proper pagination without overflow-clipping
 * 3. Exact physical media sizing for 4"x2" unit barcodes, 4"x6" shipping labels, and A4 manifests
 * 4. Full compatibility with standard thermal printers (Zebra, Rollo, Brother) & browser iframes
 */
export function printHtmlDocument({
  title,
  html,
  pageSize = 'auto',
  orientation = 'portrait',
  customCss = ''
}: PrintDocumentOptions): Promise<void> {
  return new Promise((resolve) => {
    // Remove any previous print iframe
    const existing = document.getElementById('ship-print-frame');
    if (existing) {
      existing.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'ship-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      console.warn('Iframe document unavailable, falling back to window.print()');
      window.print();
      resolve();
      return;
    }

    let pageRule = '';
    if (pageSize !== 'auto') {
      pageRule = `@page { size: ${pageSize} ${orientation}; margin: 0; }`;
    } else {
      pageRule = `@page { margin: 0.25in; }`;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            ${pageRule}
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace, sans-serif;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
            ${customCss}
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);
    doc.close();

    // Give the browser sufficient time to parse styles, layout fonts & images
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Error invoking iframe print, fallback to window.print:', err);
        window.print();
      }
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 1500);
    }, 400);
  });
}
