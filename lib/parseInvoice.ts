export interface LineItem {
  no: number;
  description: string;
  netPrice: number;
  quantity: number;
  unit: string;
  netValue: number;
  tax: string;
  grossValue: number;
}

export type InvoiceType = 'Rent' | 'Parking' | 'Utility' | 'Other';

export interface ParsedInvoice {
  invoiceNumber: string;
  issueDate: string;
  saleDate: string;
  dueDate: string;
  invoiceType: InvoiceType;
  seller: {
    name: string;
    address: string;
    nip: string;
  };
  purchaser: {
    name: string;
    address: string;
  };
  payment: {
    method: string;
    accountNumber: string;
  };
  lineItems: LineItem[];
  totals: {
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
  };
  currency: string;
}

export function parseInvoiceText(text: string): ParsedInvoice {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Extract invoice number
  const invoiceNumberMatch = text.match(/(?:No\.|Nr|Invoice.*?No\.?)\s*[:/]?\s*(FA\/[A-Z]+\/\d+\/\d+\/\d+)/i)
    || text.match(/(?:Faktura|Invoice).*?(FA\/[A-Z]+\/\d+\/\d+\/\d+)/i)
    || text.match(/(FA\/[A-Z]+\/\d+\/\d+\/\d+)/i);
  const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] : 'Unknown';

  // Extract dates (DD/MM/YYYY format) - use [\s\S] to match across newlines
  const issueDateMatch = text.match(/DATE OF ISSUE[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)
    || text.match(/DATA WYSTAWIENIA[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);
  const saleDateMatch = text.match(/DATE OF SALE[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)
    || text.match(/DATA SPRZEDA[ŻZ]Y[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);
  const dueDateMatch = text.match(/DUE DATE[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)
    || text.match(/TERMIN P[ŁL]ATNO[ŚS]CI[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);

  const issueDate = issueDateMatch ? issueDateMatch[1] : '';
  const saleDate = saleDateMatch ? saleDateMatch[1] : '';
  const dueDate = dueDateMatch ? dueDateMatch[1] : '';

  // Extract seller info
  const sellerMatch = text.match(/SELLER.*?SPRZEDAWCA\s*([\s\S]*?)(?:PURCHASER|NABYWCA)/i)
    || text.match(/SPRZEDAWCA\s*([\s\S]*?)(?:NABYWCA)/i);
  let sellerName = '';
  let sellerAddress = '';
  let sellerNip = '';

  if (sellerMatch) {
    const sellerBlock = sellerMatch[1];
    const nipMatch = sellerBlock.match(/NIP[:\s]*(\d+)/i);
    sellerNip = nipMatch ? nipMatch[1] : '';

    const sellerLines = sellerBlock.split('\n').map(l => l.trim()).filter(Boolean);
    if (sellerLines.length > 0) {
      sellerName = sellerLines[0];
      const addressLines = sellerLines.slice(1).filter(l => !l.startsWith('NIP'));
      sellerAddress = addressLines.join(', ');
    }
  }

  // Extract purchaser info
  const purchaserMatch = text.match(/PURCHASER.*?NABYWCA\s*([\s\S]*?)(?:PAYMENT|SPOSÓB)/i)
    || text.match(/NABYWCA\s*([\s\S]*?)(?:PAYMENT|SPOSÓB|TRANSFER)/i);
  let purchaserName = '';
  let purchaserAddress = '';

  if (purchaserMatch) {
    const purchaserLines = purchaserMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    if (purchaserLines.length > 0) {
      purchaserName = purchaserLines[0];
      purchaserAddress = purchaserLines.slice(1).join(', ');
    }
  }

  // Extract payment info
  const paymentMethodMatch = text.match(/PAYMENT METHOD.*?(TRANSFER|CASH|PRZELEW)/i);
  const accountMatch = text.match(/ACCOUNT.*?NUMBER.*?(\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i)
    || text.match(/NUMER KONTA.*?(\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i)
    || text.match(/(\d{2}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/);

  const paymentMethod = paymentMethodMatch ? paymentMethodMatch[1] : 'TRANSFER';
  const accountNumber = accountMatch ? accountMatch[1].replace(/\s+/g, ' ') : '';

  // Extract line items
  let lineItems: LineItem[] = [];
  const textNormalized = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const parseNumber = (str: string) => parseFloat(str.replace(/\s/g, '').replace(',', '.'));

  // Helper to clean up descriptions to friendly names
  const cleanDescription = (desc: string): string => {
    const upper = desc.toUpperCase();
    if (upper.includes('ZIMNEJ WODY') || upper.includes('COLD WATER')) return 'Cold Water';
    if (upper.includes('CIEPŁEJ WODY') || upper.includes('HOT WATER')) return 'Hot Water';
    if (upper.includes('CIEPŁA') || upper.includes('HEATING')) return 'Central Heating';
    if (upper.includes('ENERGII ELEKTRYCZNEJ') || upper.includes('ELECTRICITY')) return 'Electricity';
    if (upper.includes('ODPADY') || upper.includes('WASTE')) return 'Waste Management';
    if (upper.includes('CZYNSZ ZA MIEJSCE PARKINGOWE') || upper.includes('PARKING')) return 'Parking Rent';
    if (upper.includes('CZYNSZ ZA LOKAL')) return 'Rent';
    return desc.trim().replace(/\s+/g, ' ').substring(0, 50);
  };

  // Generic pattern: find numbered items with prices ending in UNIT/SZT/M3 followed by amounts
  // Matches patterns like: "1 CZYNSZ ZA LOKAL - 123.45 1.00 UNIT 123.45 ZW | 0.00 123.45"
  // Description MUST start with invoice keywords to avoid matching legal text like "ARTICLE 43 PARAGRAPH..."
  const lineItemPattern = /(\d+)\s+((?:CZYNSZ|RENT|ZUŻYCIE|OPŁATA|CONSUMPTION)[A-ZŻŹĆĄĘŁÓŃŚa-zżźćąęłóńś\s\/\-\d\.,:]+?)\s+-?\s*(\d[\d\s]*\.\d{2,})\s+(\d+\.?\d*)\s+(UNIT|SZT|M3|M²)\s+(\d[\d\s]*\.\d{2,})\s+(?:ZW|(\d+)%?)\s*\|?\s*(\d[\d\s]*\.?\d*)\s+(\d[\d\s]*\.\d{2,})/gi;

  let match;
  while ((match = lineItemPattern.exec(textNormalized)) !== null) {
    const taxPercent = match[7] || '0';
    lineItems.push({
      no: parseInt(match[1]),
      description: cleanDescription(match[2]),
      netPrice: parseNumber(match[3]),
      quantity: parseFloat(match[4]),
      unit: match[5],
      netValue: parseNumber(match[6]),
      tax: `${taxPercent}%`,
      grossValue: parseNumber(match[9]),
    });
  }

  // Fallback: Split by numbered items and extract amounts
  // Always try fallback and use it if it finds more items than main pattern
  {
    const fallbackItems: LineItem[] = [];
    // Remove TOTAL/RAZEM section to avoid capturing totals as line items
    const textBeforeTotal = textNormalized.split(/TOTAL|RAZEM/i)[0];

    // Find all segments that start with a number followed by text containing key invoice terms
    const segments = textBeforeTotal.split(/(?=\b\d+\s+(?:CZYNSZ|RENT|ZUŻYCIE|OPŁATA|CONSUMPTION))/i);

    for (const segment of segments) {
      const numMatch = segment.match(/^(\d+)\s+/);
      if (!numMatch) continue;

      const itemNo = parseInt(numMatch[1]);

      // Match amounts with 2+ decimal places (handles both 134.10 and 134.100000)
      // Also match integers that might be quantities (like 44, 238, etc.)
      const amounts = segment.match(/(\d+\.\d{2,})/g) || [];
      const integers = segment.match(/\b(\d{1,4})\b/g) || []; // Match 1-4 digit integers (likely quantities)

      if (amounts.length >= 2) {
        const grossValue = parseNumber(amounts[amounts.length - 1]!);
        const netValue = parseNumber(amounts[amounts.length - 2]!);
        
        // Try to find quantity: it might be the second-to-last number in the entire segment
        // or it might be an integer between the description and the amounts

        // Check for tax percentage
        const taxMatch = segment.match(/(\d+)%/);
        const taxPercent = taxMatch ? taxMatch[1] : '0';

        // Extract quantity from description - try multiple patterns
        let quantity = 1;
        let unit = 'UNIT';
        
        // Pattern 1: "ROZLICZENIOWYM X.XX M³" or "ROZLICZENIOWYM X,XX M³"
        let consumptionMatch = segment.match(/ROZLICZENIOWYM\s+(\d+[.,]?\d*)\s*(M³|M3|KWH|GJ|CJ)/i);
        
        // Pattern 2: Look for quantity patterns like "X.XX M³", "X,XX KWH", "X.XX GJ" in the segment
        if (!consumptionMatch) {
          consumptionMatch = segment.match(/(\d+[.,]\d+)\s*(M³|M3|KWH|GJ|CJ|M\s*3)/i);
        }
        
        // Pattern 3: Look for "ZUŻYCIE: X.XX" or "CONSUMPTION: X.XX" followed by unit
        if (!consumptionMatch) {
          consumptionMatch = segment.match(/(?:ZUŻYCIE|CONSUMPTION)[:\s]+(\d+[.,]?\d*)\s*(M³|M3|KWH|GJ|CJ)/i);
        }
        
        // Pattern 4: Look for patterns like "X.XX M³" or "X,XX KWH" anywhere in the segment (more flexible)
        if (!consumptionMatch) {
          // Try to find number with unit, but avoid matching prices (which usually have 2 decimal places)
          const quantityUnitMatch = segment.match(/(\d+[.,]\d{1,3})\s*(M³|M3|KWH|GJ|CJ|M\s*3)/i);
          if (quantityUnitMatch) {
            // Make sure it's not a price (prices usually have exactly 2 decimal places)
            const numStr = quantityUnitMatch[1].replace(',', '.');
            const num = parseFloat(numStr);
            // If it looks like a reasonable quantity (not a large price), use it
            if (num > 0 && num < 10000) {
              consumptionMatch = quantityUnitMatch;
            }
          }
        }
        
        // Pattern 5: For Electricity specifically, look for KWH patterns more aggressively
        if (!consumptionMatch && segment.match(/ENERGII|ELECTRICITY/i)) {
          const kwhMatch = segment.match(/(\d+[.,]?\d*)\s*KWH/i) || segment.match(/KWH[:\s]*(\d+[.,]?\d*)/i);
          if (kwhMatch) {
            quantity = parseFloat(kwhMatch[1].replace(',', '.'));
            unit = 'KWH';
            consumptionMatch = kwhMatch; // Set flag so we don't override unit below
          }
        }
        
        // Pattern 6: For Central Heating, look for GJ patterns
        if (!consumptionMatch && segment.match(/CIEPŁA|HEATING/i)) {
          const gjMatch = segment.match(/(\d+[.,]?\d*)\s*GJ/i) || segment.match(/GJ[:\s]*(\d+[.,]?\d*)/i);
          if (gjMatch) {
            quantity = parseFloat(gjMatch[1].replace(',', '.'));
            unit = 'GJ';
            consumptionMatch = gjMatch;
          }
        }
        
        // Pattern 7: For Water, look for M3 patterns
        if (!consumptionMatch && segment.match(/WODY|WATER/i)) {
          const m3Match = segment.match(/(\d+[.,]?\d*)\s*(M³|M3|M\s*3)/i) || segment.match(/(M³|M3|M\s*3)[:\s]*(\d+[.,]?\d*)/i);
          if (m3Match) {
            quantity = parseFloat((m3Match[1] || m3Match[2]).replace(',', '.'));
            unit = 'M3';
            consumptionMatch = m3Match;
          }
        }
        
        // Pattern 8: If no quantity found yet, look for integer quantity before unit keywords
        // Format might be: "description ... 44 KWH ... amounts" or "description ... 44 ... KWH ... amounts"
        if (!consumptionMatch) {
          // Look for pattern: number followed by unit (KWH, M3, GJ, etc.)
          const quantityBeforeUnit = segment.match(/(\d+)\s+(KWH|M3|M³|GJ|CJ)/i) || segment.match(/(\d+[.,]\d+)\s+(KWH|M3|M³|GJ|CJ)/i);
          if (quantityBeforeUnit) {
            quantity = parseFloat(quantityBeforeUnit[1].replace(',', '.'));
            unit = quantityBeforeUnit[2].toUpperCase().replace(/\s+/g, '');
            if (unit === 'M³' || unit === 'M3') unit = 'M3';
            consumptionMatch = quantityBeforeUnit;
          }
        }
        
        // Pattern 9: Extract quantity as integer that appears between description and amounts
        // This handles cases where quantity is a standalone integer (like 44) in the row
        if (!consumptionMatch && amounts.length >= 2) {
          // Find the position of the first amount
          const firstAmountIndex = segment.indexOf(amounts[0]!);
          const beforeAmounts = segment.substring(0, firstAmountIndex);
          
          // Look for integers in the part before amounts (excluding item number)
          const integersBeforeAmounts = beforeAmounts.match(/\b(\d{1,4})\b/g) || [];
          
          // Filter out the item number (usually single digit at start) and very small numbers
          const candidateQuantities = integersBeforeAmounts
            .map(num => parseInt(num))
            .filter(num => num > 1 && num < 10000);
          
          // If we find a reasonable integer, use it as quantity
          if (candidateQuantities.length > 0) {
            // Take the last reasonable integer before amounts (most likely to be quantity)
            quantity = candidateQuantities[candidateQuantities.length - 1]!;
            // Detect unit from context
            if (segment.match(/KWH|ENERGII|ELECTRICITY/i)) unit = 'KWH';
            else if (segment.match(/GJ|CIEPŁA|HEATING/i)) unit = 'GJ';
            else if (segment.match(/M3|M³|WODY|WATER/i)) unit = 'M3';
            consumptionMatch = [quantity.toString()]; // Set flag
          }
        }

        if (consumptionMatch) {
          if (consumptionMatch.length > 1) {
            // Standard pattern match with unit
            quantity = parseFloat(consumptionMatch[1].replace(',', '.'));
            unit = consumptionMatch[2]?.toUpperCase().replace(/\s+/g, '') || unit;
            if (unit === 'M³' || unit === 'M3') unit = 'M3';
          }
          // If consumptionMatch is just a flag array, quantity and unit are already set above
        } else {
          // If no quantity found, try to infer from netPrice and grossValue
          // For utilities, if netPrice seems reasonable and grossValue exists, 
          // we might be able to calculate quantity = grossValue / netPrice
          // But this is risky, so we'll keep quantity = 1 as default
          // However, we can try to detect unit from description
          const descUpper = segment.toUpperCase();
          if (descUpper.includes('KWH') || descUpper.includes('ENERGII ELEKTRYCZNEJ')) {
            unit = 'KWH';
          } else if (descUpper.includes('M3') || descUpper.includes('M³') || descUpper.includes('WODY')) {
            unit = 'M3';
          } else if (descUpper.includes('GJ') || descUpper.includes('CIEPŁA')) {
            unit = 'GJ';
          }
        }

        // Net price = Gross / Quantity (calculated)
        const netPrice = quantity > 0 ? Math.round((grossValue / quantity) * 100) / 100 : grossValue;

        // Extract and clean description
        const description = cleanDescription(segment);

        fallbackItems.push({
          no: itemNo,
          description: description.substring(0, 100),
          netPrice: netPrice,
          quantity: quantity,
          unit: unit,
          netValue: netValue,
          tax: `${taxPercent}%`,
          grossValue: grossValue,
        });
      }
    }

    // Use fallback if it found more items than main pattern
    if (fallbackItems.length > lineItems.length) {
      lineItems = fallbackItems;
    }
  }

  // Extract totals
  const parseAmount = (str: string) => {
    if (!str) return 0;
    return parseFloat(str.replace(/\s/g, '').replace(',', '.')) || 0;
  };

  let netTotal = 0;
  let taxTotal = 0;
  let grossTotal = 0;

  // First, try to get gross total from "Total to pay" / "PLN" (most reliable)
  const totalToPayMatch = text.match(/(?:Total to pay|RAZEM DO ZAP[ŁL]ATY)[:\s]*(?:PLN)?\s*(\d[\d\s,\.]+)/i)
    || text.match(/PLN\s*(\d[\d\s,\.]+)/i);
  if (totalToPayMatch) {
    grossTotal = parseAmount(totalToPayMatch[1]);
  }

  // Get net total from TOTAL/RAZEM section
  const totalMatch = text.match(/TOTAL[\s\S]*?RAZEM\s*(\d[\d\s,\.]+)/i);
  if (totalMatch) {
    netTotal = parseAmount(totalMatch[1]);
  }

  // Calculate tax as difference if we have both
  if (grossTotal > 0 && netTotal > 0) {
    taxTotal = grossTotal - netTotal;
  } else if (grossTotal > 0 && netTotal === 0) {
    netTotal = grossTotal; // If no net, assume same as gross (no tax)
  } else if (netTotal > 0 && grossTotal === 0) {
    grossTotal = netTotal; // If no gross found, use net
  }

  // Determine currency
  const currencyMatch = text.match(/(?:PLN|EUR|USD|GBP)/i);
  const currency = currencyMatch ? currencyMatch[0].toUpperCase() : 'PLN';

  // Determine invoice type based on line items
  const determineInvoiceType = (): InvoiceType => {
    const descriptions = lineItems.map(item => item.description.toLowerCase());
    const hasUtility = descriptions.some(d =>
      ['cold water', 'hot water', 'central heating', 'electricity', 'waste management'].includes(d)
    );
    const hasParking = descriptions.some(d => d.includes('parking'));
    const hasRent = descriptions.some(d => d === 'rent');

    if (hasUtility) return 'Utility';
    if (hasParking) return 'Parking';
    if (hasRent) return 'Rent';
    return 'Other';
  };

  return {
    invoiceNumber,
    issueDate,
    saleDate,
    dueDate,
    invoiceType: determineInvoiceType(),
    seller: {
      name: sellerName,
      address: sellerAddress,
      nip: sellerNip,
    },
    purchaser: {
      name: purchaserName,
      address: purchaserAddress,
    },
    payment: {
      method: paymentMethod,
      accountNumber,
    },
    lineItems,
    totals: {
      netTotal,
      taxTotal,
      grossTotal,
    },
    currency,
  };
}
