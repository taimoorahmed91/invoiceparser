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
        const buffer = Buffer.from(arrayBuffer);

        // Use unpdf - serverless-friendly PDF parser
        const { extractText } = await import('unpdf');

        // Extract text (returns { totalPages, text: string[] })
        const { text } = await extractText(buffer, {
          mergePages: false, // Keep pages separate
        });

        // Join all pages with newlines
        const fullText = Array.isArray(text) ? text.join('\n\n') : text;

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
