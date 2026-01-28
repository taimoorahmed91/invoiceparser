const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function test() {
  const buffer = fs.readFileSync('../faktura-fa-mys-453-12-2025.pdf');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const textNormalized = result.text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  // Check if the main pattern matches anything first
  const lineItemPattern = /(\d+)\s+([A-ZŻŹĆĄĘŁÓŃŚ][A-ZŻŹĆĄĘŁÓŃŚa-zżźćąęłóńś\s\/\-\d\.,:]+?)\s+-?\s*(\d[\d\s]*\.\d{2})\s+(\d+\.?\d*)\s+(UNIT|SZT|M3|M²)\s+(\d[\d\s]*\.\d{2})\s+(?:ZW|(\d+)%?)\s*\|?\s*(\d[\d\s]*\.?\d*)\s+(\d[\d\s]*\.\d{2})/gi;
  
  let match;
  let mainPatternMatches = 0;
  while ((match = lineItemPattern.exec(textNormalized)) !== null) {
    mainPatternMatches++;
    console.log('Main pattern match:', match[1], match[2].substring(0, 30));
  }
  console.log('Main pattern total matches:', mainPatternMatches);
  
  // Test fallback
  console.log('\n--- Fallback test ---');
  const textBeforeTotal = textNormalized.split(/TOTAL|RAZEM/i)[0];
  const segments = textBeforeTotal.split(/(?=\b\d+\s+(?:CZYNSZ|RENT|ZUŻYCIE|OPŁATA|CONSUMPTION))/i);
  
  let fallbackCount = 0;
  for (const segment of segments) {
    const numMatch = segment.match(/^(\d+)\s+/);
    if (!numMatch) continue;
    
    const amounts = segment.match(/(\d+\.\d{2,})/g) || [];
    if (amounts.length >= 2) {
      fallbackCount++;
      console.log('Fallback item', numMatch[1], '- amounts:', amounts.length);
    }
  }
  console.log('Fallback total:', fallbackCount);
}
test().catch(console.error);
