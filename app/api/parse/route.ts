import { NextRequest, NextResponse } from 'next/server';
import { parseInvoiceText, ParsedInvoice } from '@/lib/parseInvoice';
import '@/lib/pdf-polyfills'; // Load polyfills first
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker for serverless environment
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

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

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
          disableFontFace: true,
        });

        const pdfDocument = await loadingTask.promise;
        let fullText = '';

        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
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
