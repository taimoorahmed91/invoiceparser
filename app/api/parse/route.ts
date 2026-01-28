import { NextRequest, NextResponse } from 'next/server';
import { parseInvoiceText, ParsedInvoice } from '@/lib/parseInvoice';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    const results: { filename: string; invoice: ParsedInvoice | null; error?: string }[] = [];

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        results.push({
          filename: file.name,
          invoice: null,
          error: 'File is not a PDF',
        });
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Use pdfjs-dist with Node.js configuration
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');

        // Disable worker for serverless environment
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';

        const loadingTask = pdfjsLib.getDocument({
          data: uint8Array,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        });

        const pdfDocument = await loadingTask.promise;
        let fullText = '';

        // Extract text from all pages with layout preservation
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();

          // Sort items by position (top to bottom, left to right)
          const items = textContent.items as any[];
          items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5]; // y position (top to bottom)
            if (Math.abs(yDiff) > 5) return yDiff > 0 ? 1 : -1; // Different lines
            return a.transform[4] - b.transform[4]; // x position (left to right)
          });

          let currentY = items[0]?.transform[5];
          let pageText = '';

          for (const item of items) {
            const y = item.transform[5];
            const text = item.str;

            // Add newline if we moved to a new line (y position changed significantly)
            if (currentY !== undefined && Math.abs(currentY - y) > 5) {
              pageText += '\n';
              currentY = y;
            }

            pageText += text + ' ';
          }

          fullText += pageText + '\n';
        }

        const invoice = parseInvoiceText(fullText);

        results.push({
          filename: file.name,
          invoice,
        });
      } catch (err) {
        console.error('PDF parse error:', err);
        results.push({
          filename: file.name,
          invoice: null,
          error: `Failed to parse PDF: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
