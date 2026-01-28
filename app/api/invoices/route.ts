import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, access, constants } from 'fs/promises';
import { join } from 'path';

const INVOICES_FILE = join(process.cwd(), 'data', 'invoices.json');
const OLD_INVOICES_FILE = join(process.cwd(), 'data', 'old-invoices.json');

export async function GET() {
  try {
    const data = await readFile(INVOICES_FILE, 'utf-8');
    const invoices = JSON.parse(data);
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error reading invoices:', error);
    return NextResponse.json(
      { error: 'Failed to read invoices file' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const invoices = await request.json();
    
    if (!Array.isArray(invoices)) {
      return NextResponse.json(
        { error: 'Invalid data: expected an array' },
        { status: 400 }
      );
    }

    // Backup current invoices.json to old-invoices.json before saving
    try {
      // Check if invoices.json exists
      await access(INVOICES_FILE, constants.F_OK);
      
      // Read current file
      const currentData = await readFile(INVOICES_FILE, 'utf-8');
      
      // Write backup to old-invoices.json
      await writeFile(OLD_INVOICES_FILE, currentData, 'utf-8');
    } catch (error) {
      // If invoices.json doesn't exist or can't be read, that's okay - just continue
      console.log('No existing file to backup, or backup failed:', error);
    }

    // Write new data to invoices.json
    await writeFile(INVOICES_FILE, JSON.stringify(invoices, null, 2), 'utf-8');
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully saved ${invoices.length} invoice(s) to file. Previous version backed up to old-invoices.json` 
    });
  } catch (error) {
    console.error('Error saving invoices:', error);
    return NextResponse.json(
      { error: 'Failed to save invoices file' },
      { status: 500 }
    );
  }
}

