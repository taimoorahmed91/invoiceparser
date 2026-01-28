import { NextRequest, NextResponse } from 'next/server';
import { parseInvoiceText, ParsedInvoice } from '@/lib/parseInvoice';
import { PDFParse } from 'pdf-parse';

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

        const parser = new PDFParse({ data: uint8Array });
        const pdfData = await parser.getText();

        const invoice = parseInvoiceText(pdfData.text);

        results.push({
          filename: file.name,
          invoice,
        });
      } catch (err) {
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
