'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import InvoiceCard from '@/components/InvoiceCard';
import ToastComponent, { Toast } from '@/components/Toast';
import { ParsedInvoice, InvoiceType, LineItem } from '@/lib/parseInvoice';
import {
  StoredInvoice,
  loadInvoices,
  saveInvoices,
  addInvoice,
  deleteInvoice,
  generateId,
  clearAllInvoices,
  exportToJson,
  importFromJson,
  loadManualValues,
  saveManualValues,
  getManualValue,
  setManualValue,
} from '@/lib/storage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ParseResult {
  filename: string;
  invoice: ParsedInvoice | null;
  error?: string;
}

const typeColors: Record<InvoiceType, { bg: string; text: string; badge: string }> = {
  Rent: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 dark:bg-blue-900' },
  Parking: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900' },
  Utility: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', badge: 'bg-green-100 dark:bg-green-900' },
  Other: { bg: 'bg-gray-50 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', badge: 'bg-gray-100 dark:bg-gray-700' },
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthFromDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length >= 2) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return monthNames[monthIndex];
    }
  }
  return '-';
}

function getMonthYearFromDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length >= 3) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]} ${year}`;
    }
  }
  return 'Unknown';
}

export default function Home() {
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<ParseResult[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<StoredInvoice | null>(null);
  const [filterType, setFilterType] = useState<InvoiceType | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [showGraphs, setShowGraphs] = useState(false);
  const [showUtilityGross, setShowUtilityGross] = useState(false);
  const [showUtilityQuantity, setShowUtilityQuantity] = useState(false);
  const [showUtilityUnitPrice, setShowUtilityUnitPrice] = useState(false);
  const [showYearOverYear, setShowYearOverYear] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const [manualValues, setManualValues] = useState<Record<string, number>>({});
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [undoStack, setUndoStack] = useState<StoredInvoice[][]>([]);
  const [sortField, setSortField] = useState<'date' | 'amount' | 'type' | 'number' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [comparingInvoices, setComparingInvoices] = useState<[StoredInvoice | null, StoredInvoice | null]>([null, null]);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editType, setEditType] = useState<InvoiceType>('Other');
  const [editGrossTotal, setEditGrossTotal] = useState<string>('');
  const [editNetTotal, setEditNetTotal] = useState<string>('');
  const [editTaxTotal, setEditTaxTotal] = useState<string>('');

  // Toast helper function
  const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Load filters and dark mode from localStorage
  useEffect(() => {
    const savedFilters = localStorage.getItem('invoice-parser-filters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        if (filters.filterType) setFilterType(filters.filterType);
        if (filters.filterMonth) setFilterMonth(filters.filterMonth);
        if (filters.searchQuery) setSearchQuery(filters.searchQuery);
        if (filters.dateRangeStart) setDateRangeStart(filters.dateRangeStart);
        if (filters.dateRangeEnd) setDateRangeEnd(filters.dateRangeEnd);
      } catch (e) {
        console.error('Failed to load filters:', e);
      }
    }

    const savedDarkMode = localStorage.getItem('invoice-parser-dark-mode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Save filters to localStorage
  useEffect(() => {
    const filters = {
      filterType,
      filterMonth,
      searchQuery,
      dateRangeStart,
      dateRangeEnd,
    };
    localStorage.setItem('invoice-parser-filters', JSON.stringify(filters));
  }, [filterType, filterMonth, searchQuery, dateRangeStart, dateRangeEnd]);

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('invoice-parser-dark-mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('invoice-parser-dark-mode', 'false');
    }
  }, [darkMode]);

  // Load invoices from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load from Supabase
        const stored = await loadInvoices();
        setInvoices(stored);
      } catch (error) {
        console.error('Failed to load invoices from Supabase:', error);
        setInvoices([]);
      }

      // Load manual values from Supabase
      try {
        const manual = await loadManualValues();
        setManualValues(manual);
      } catch (error) {
        console.error('Failed to load manual values:', error);
        setManualValues({});
      }
    };

    loadData();
  }, []);

  // Get unique types and months for sidebar
  const { typeGroups, monthGroups } = useMemo(() => {
    const types: Record<string, number> = {};
    const months: Record<string, number> = {};

    invoices.forEach((inv) => {
      const type = inv.invoice.invoiceType;
      types[type] = (types[type] || 0) + 1;

      const monthYear = getMonthYearFromDate(inv.invoice.issueDate);
      months[monthYear] = (months[monthYear] || 0) + 1;
    });

    return { typeGroups: types, monthGroups: months };
  }, [invoices]);

  // Prepare chart data - monthly totals by type
  const chartData = useMemo(() => {
    const monthlyData: Record<string, { month: string; Rent: number; Parking: number; Utility: number }> = {};

    invoices.forEach((inv) => {
      const monthYear = getMonthYearFromDate(inv.invoice.issueDate);
      const type = inv.invoice.invoiceType;
      const amount = inv.invoice.totals.grossTotal;

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { month: monthYear, Rent: 0, Parking: 0, Utility: 0 };
      }

      if (type === 'Rent' || type === 'Parking' || type === 'Utility') {
        monthlyData[monthYear][type] += amount;
      }
    });

    // Sort by date
    return Object.values(monthlyData).sort((a, b) => {
      const [aMonth, aYear] = a.month.split(' ');
      const [bMonth, bYear] = b.month.split(' ');
      const aIndex = monthNames.indexOf(aMonth);
      const bIndex = monthNames.indexOf(bMonth);
      if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
      return aIndex - bIndex;
    });
  }, [invoices]);

  // Year-over-year comparison data
  const yearOverYearData = useMemo(() => {
    const byMonthYear: Record<string, Record<string, { Rent: number; Parking: number; Utility: number }>> = {};
    
    invoices.forEach((inv) => {
      const monthYear = getMonthYearFromDate(inv.invoice.issueDate);
      const [month, year] = monthYear.split(' ');
      const type = inv.invoice.invoiceType;
      const amount = inv.invoice.totals.grossTotal;

      if (!byMonthYear[month]) {
        byMonthYear[month] = {};
      }
      if (!byMonthYear[month][year]) {
        byMonthYear[month][year] = { Rent: 0, Parking: 0, Utility: 0 };
      }

      if (type === 'Rent' || type === 'Parking' || type === 'Utility') {
        byMonthYear[month][year][type] += amount;
      }
    });

    return byMonthYear;
  }, [invoices]);

  // Prepare chart data with all months (including 0 values)
  const allMonths = useMemo(() => {
    return chartData.map((item) => item.month);
  }, [chartData]);

  // Prepare rental chart data - all months with Rent values (0 if no data)
  const rentalChartData = useMemo(() => {
    const dataMap = new Map(
      chartData.map((item) => [
        item.month,
        {
          month: item.month, // Use full month-year as unique key
          value: item.Rent,
          fullLabel: item.month,
        },
      ])
    );

    return allMonths.map((month, index) => {
      const existing = dataMap.get(month);
      const dataPoint = existing || {
        month: month, // Use full month-year as unique key
        value: 0,
        fullLabel: month,
      };
      return {
        ...dataPoint,
        index: index,
        name: month,
      };
    });
  }, [chartData, allMonths]);

  // Prepare utility chart data - all months with Utility values (0 if no data)
  const utilityChartData = useMemo(() => {
    const dataMap = new Map(
      chartData.map((item) => [
        item.month,
        {
          month: item.month, // Use full month-year as unique key
          value: item.Utility,
          fullLabel: item.month,
        },
      ])
    );

    return allMonths.map((month, index) => {
      const existing = dataMap.get(month);
      const dataPoint = existing || {
        month: month, // Use full month-year as unique key
        value: 0,
        fullLabel: month,
      };
      return { ...dataPoint, name: month, index };
    });
  }, [chartData, allMonths]);

  // Prepare parking chart data - all months with Parking values (0 if no data)
  const parkingChartData = useMemo(() => {
    const dataMap = new Map(
      chartData.map((item) => [
        item.month,
        {
          month: item.month, // Use full month-year as unique key
          value: item.Parking,
          fullLabel: item.month,
        },
      ])
    );

    return allMonths.map((month, index) => {
      const existing = dataMap.get(month);
      const dataPoint = existing || {
        month: month, // Use full month-year as unique key
        value: 0,
        fullLabel: month,
      };
      return { ...dataPoint, name: month, index };
    });
  }, [chartData, allMonths]);

  // Five utility subtypes for line items
  const utilityCategories = [
    { key: 'Cold Water', color: '#3b82f6', label: 'Cold Water' },
    { key: 'Hot Water', color: '#fb923c', label: 'Hot Water' },
    { key: 'Electricity', color: '#f59e42', label: 'Electricity' },
    { key: 'Central Heating', color: '#10b981', label: 'Central Heating' },
    { key: 'Waste Management', color: '#6366f1', label: 'Waste Management' },
  ];

  // Prepare chart data for each utility subtype
  const utilityChartsData = useMemo(() => {
    return utilityCategories.map(cat => {
      const valuesByMonth: Record<string, number> = {};
      invoices.forEach(inv => {
        const month = getMonthYearFromDate(inv.invoice.issueDate);
        inv.invoice.lineItems.forEach(item => {
          const descLower = item.description.toLowerCase();
          let matches = false;
          
          // Match based on keywords for each category
          if (cat.key === 'Cold Water') {
            matches = descLower === 'cold water' || descLower.includes('zimnej wody') || descLower.includes('cold water');
          } else if (cat.key === 'Hot Water') {
            matches = descLower === 'hot water' || descLower.includes('ciepłej wody') || descLower.includes('hot water');
          } else if (cat.key === 'Electricity') {
            matches = descLower === 'electricity' || descLower.includes('energii elektrycznej') || descLower.includes('electricity');
          } else if (cat.key === 'Central Heating') {
            matches = descLower === 'central heating' || descLower.includes('ciepła') || descLower.includes('heating');
          } else if (cat.key === 'Waste Management') {
            matches = descLower.includes('odpadami') || descLower.includes('waste') || descLower.includes('gospodarka odpadami');
          }
          
          if (matches) {
            // Exclude "Manual Heating Calculation" rows from graphs
            if (descLower.includes('manual heating calculation') || descLower.includes('manual calculation')) {
              return;
            }
            valuesByMonth[month] = (valuesByMonth[month] || 0) + (item.grossValue ?? 0);
          }
        });
      });
      return allMonths.map((month, index) => ({
        month: month, // Use full month-year as unique key
        value: valuesByMonth[month] || 0,
        fullLabel: month,
        name: month,
        index,
      }));
    });
  }, [invoices, allMonths]);

  // Prepare chart data for each utility subtype (quantities)
  const utilityQuantityChartsData = useMemo(() => {
    return utilityCategories.map(cat => {
      const valuesByMonth: Record<string, number> = {};
      invoices.forEach(inv => {
        const month = getMonthYearFromDate(inv.invoice.issueDate);
        inv.invoice.lineItems.forEach(item => {
          const descLower = item.description.toLowerCase();
          let matches = false;

          // Match based on keywords for each category
          if (cat.key === 'Cold Water') {
            matches = descLower === 'cold water' || descLower.includes('zimnej wody') || descLower.includes('cold water');
          } else if (cat.key === 'Hot Water') {
            matches = descLower === 'hot water' || descLower.includes('ciepłej wody') || descLower.includes('hot water');
          } else if (cat.key === 'Electricity') {
            matches = descLower === 'electricity' || descLower.includes('energii elektrycznej') || descLower.includes('electricity');
          } else if (cat.key === 'Central Heating') {
            matches = descLower === 'central heating' || descLower.includes('ciepła') || descLower.includes('heating');
          } else if (cat.key === 'Waste Management') {
            matches = descLower.includes('odpadami') || descLower.includes('waste') || descLower.includes('gospodarka odpadami');
          }

          if (matches) {
            // Exclude "Manual Heating Calculation" rows from graphs
            if (descLower.includes('manual heating calculation') || descLower.includes('manual calculation')) {
              return;
            }
            valuesByMonth[month] = (valuesByMonth[month] || 0) + (item.quantity ?? 0);
          }
        });
      });
      return allMonths.map((month, index) => ({
        month: month, // Use full month-year as unique key
        value: valuesByMonth[month] || 0,
        fullLabel: month,
        name: month,
        index,
      }));
    });
  }, [invoices, allMonths]);

  // Prepare chart data for each utility subtype (unit prices - average per month)
  const utilityUnitPriceChartsData = useMemo(() => {
    return utilityCategories.map(cat => {
      const valuesByMonth: Record<string, { total: number; count: number }> = {};
      invoices.forEach(inv => {
        const month = getMonthYearFromDate(inv.invoice.issueDate);
        inv.invoice.lineItems.forEach(item => {
          const descLower = item.description.toLowerCase();
          let matches = false;
          
          // Match based on keywords for each category
          if (cat.key === 'Cold Water') {
            matches = descLower === 'cold water' || descLower.includes('zimnej wody') || descLower.includes('cold water');
          } else if (cat.key === 'Hot Water') {
            matches = descLower === 'hot water' || descLower.includes('ciepłej wody') || descLower.includes('hot water');
          } else if (cat.key === 'Electricity') {
            matches = descLower === 'electricity' || descLower.includes('energii elektrycznej') || descLower.includes('electricity');
          } else if (cat.key === 'Central Heating') {
            matches = descLower === 'central heating' || descLower.includes('ciepła') || descLower.includes('heating');
          } else if (cat.key === 'Waste Management') {
            matches = descLower.includes('odpadami') || descLower.includes('waste') || descLower.includes('gospodarka odpadami');
          }
          
          if (matches) {
            // Exclude "Manual Heating Calculation" rows from graphs
            if (descLower.includes('manual heating calculation') || descLower.includes('manual calculation')) {
              return;
            }
            
            if (!valuesByMonth[month]) {
              valuesByMonth[month] = { total: 0, count: 0 };
            }
            // Calculate unit price: grossValue / quantity
            const quantity = item.quantity ?? 0;
            const grossValue = item.grossValue ?? 0;
            if (quantity > 0) {
              const unitPrice = grossValue / quantity;
              valuesByMonth[month].total += unitPrice;
              valuesByMonth[month].count += 1;
            }
          }
        });
      });
      return allMonths.map((month, index) => {
        const data = valuesByMonth[month];
        const avgPrice = data && data.count > 0 ? data.total / data.count : 0;
        return {
          month: month, // Use full month-year as unique key
          value: avgPrice,
          fullLabel: month,
          name: month,
          index,
        };
      });
    });
  }, [invoices, allMonths]);

  // Helper function to parse date string (DD/MM/YYYY) to Date object
  const parseDate = (dateStr: string): Date | null => {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };


  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Type filter
      const typeMatch = filterType === 'all' || inv.invoice.invoiceType === filterType;
      
      // Month filter (legacy - keep for backward compatibility)
      const monthMatch = filterMonth === 'all' || getMonthYearFromDate(inv.invoice.issueDate) === filterMonth;
      
      // Search query filter (invoice number)
      const searchMatch = !searchQuery || 
        inv.invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.filename.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Date range filter (Month/Year format - YYYY-MM)
      let dateRangeMatch = true;
      if (dateRangeStart || dateRangeEnd) {
        const invoiceDate = parseDate(inv.invoice.issueDate);
        if (invoiceDate) {
          const invoiceMonthYear = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (dateRangeStart && dateRangeStart.trim() !== '') {
            if (invoiceMonthYear < dateRangeStart) {
              dateRangeMatch = false;
            }
          }
          if (dateRangeEnd && dateRangeEnd.trim() !== '') {
            if (invoiceMonthYear > dateRangeEnd) {
              dateRangeMatch = false;
            }
          }
        }
        // If date can't be parsed, don't exclude it - let other filters handle it
        // This allows search to work even if date parsing fails
      }
      
      return typeMatch && monthMatch && searchMatch && dateRangeMatch;
    });
  }, [invoices, filterType, filterMonth, searchQuery, dateRangeStart, dateRangeEnd]);

  // Sort filtered invoices
  const sortedFilteredInvoices = useMemo(() => {
    if (!sortField) return filteredInvoices;

    const sorted = [...filteredInvoices].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          const dateA = parseDate(a.invoice.issueDate);
          const dateB = parseDate(b.invoice.issueDate);
          if (!dateA || !dateB) return 0;
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'amount':
          comparison = a.invoice.totals.grossTotal - b.invoice.totals.grossTotal;
          break;
        case 'type':
          comparison = a.invoice.invoiceType.localeCompare(b.invoice.invoiceType);
          break;
        case 'number':
          comparison = a.invoice.invoiceNumber.localeCompare(b.invoice.invoiceNumber);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredInvoices, sortField, sortDirection]);

  const handleSort = (field: 'date' | 'amount' | 'type' | 'number') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Calculate running totals and YTD summaries
  const summaryData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentDate = new Date();
    
    // Sort invoices by date
    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
      const dateA = parseDate(a.invoice.issueDate);
      const dateB = parseDate(b.invoice.issueDate);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate running totals
    let runningTotal = 0;
    const runningTotals = sortedInvoices.map(inv => {
      runningTotal += inv.invoice.totals.grossTotal;
      return {
        invoice: inv,
        runningTotal,
      };
    });

    // Calculate YTD (Year-to-Date) - current year only
    const ytdInvoices = sortedInvoices.filter(inv => {
      const invDate = parseDate(inv.invoice.issueDate);
      return invDate && invDate.getFullYear() === currentYear && invDate <= currentDate;
    });

    const ytdTotal = ytdInvoices.reduce((sum, inv) => sum + inv.invoice.totals.grossTotal, 0);
    
    // Calculate totals by type
    const totalsByType = filteredInvoices.reduce((acc, inv) => {
      const type = inv.invoice.invoiceType;
      if (!acc[type]) {
        acc[type] = { count: 0, total: 0 };
      }
      acc[type].count += 1;
      acc[type].total += inv.invoice.totals.grossTotal;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    // Overall totals
    const overallTotal = filteredInvoices.reduce((sum, inv) => sum + inv.invoice.totals.grossTotal, 0);
    const overallCount = filteredInvoices.length;

    // Calculate monthly sums
    const monthlySums: Record<string, { count: number; total: number }> = {};
    filteredInvoices.forEach(inv => {
      const monthYear = getMonthYearFromDate(inv.invoice.issueDate);
      if (!monthlySums[monthYear]) {
        monthlySums[monthYear] = { count: 0, total: 0 };
      }
      monthlySums[monthYear].count += 1;
      monthlySums[monthYear].total += inv.invoice.totals.grossTotal;
    });

    // Calculate averages by type
    const averagesByType: Record<string, number> = {};
    Object.entries(totalsByType).forEach(([type, data]) => {
      averagesByType[type] = data.count > 0 ? data.total / data.count : 0;
    });

    return {
      runningTotals,
      ytdTotal,
      ytdCount: ytdInvoices.length,
      totalsByType,
      overallTotal,
      overallCount,
      monthlySums,
      averagesByType,
    };
  }, [filteredInvoices]);

  const handleFilesSelected = async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    setParseErrors([]);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse invoices');
      }

      const data = await response.json();
      const results: ParseResult[] = data.results;

      const successful = results.filter((r) => r.invoice !== null);
      const failed = results.filter((r) => r.invoice === null);

      setParseErrors(failed);

      // Duplicate detection - check by invoice number and date
      const existingInvoiceNumbers = new Set(
        invoices.map(inv => `${inv.invoice.invoiceNumber}-${inv.invoice.issueDate}`)
      );

      const newInvoices: StoredInvoice[] = [];
      const duplicates: string[] = [];

      successful.forEach((r) => {
        const key = `${r.invoice!.invoiceNumber}-${r.invoice!.issueDate}`;
        if (existingInvoiceNumbers.has(key)) {
          duplicates.push(r.filename);
        } else {
          newInvoices.push({
            id: generateId(),
            filename: r.filename,
            parsedAt: new Date().toISOString(),
            invoice: r.invoice!,
          });
          existingInvoiceNumbers.add(key);
        }
      });

      if (duplicates.length > 0) {
        showToast(
          `Skipped ${duplicates.length} duplicate invoice(s): ${duplicates.join(', ')}`,
          'warning',
          5000
        );
      }

      if (newInvoices.length > 0) {
        try {
          // Add each invoice to Supabase
          for (const inv of newInvoices) {
            await addInvoice(inv.filename, inv.invoice, inv.id);
          }
          const updated = [...newInvoices, ...invoices];
          setInvoices(updated);
          showToast(`Successfully added ${newInvoices.length} invoice(s)`, 'success');
        } catch (error) {
          console.error('Failed to save invoices:', error);
          showToast('Failed to save some invoices to database', 'error');
        }
      } else if (duplicates.length > 0) {
        showToast('No new invoices added - all were duplicates', 'info');
      }

      if (failed.length > 0) {
        showToast(`Failed to parse ${failed.length} file(s)`, 'error', 5000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      showToast(errorMessage, 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Save current state to undo stack
    setUndoStack((prev) => [[...invoices], ...prev.slice(0, 9)]); // Keep last 10 states
    const deletedInvoice = invoices.find((inv) => inv.id === id);
    const updated = invoices.filter((inv) => inv.id !== id);
    setInvoices(updated);

    try {
      await deleteInvoice(id);
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(null);
      }
      showToast(
        `Invoice ${deletedInvoice?.invoice.invoiceNumber || 'deleted'}. Click "Undo" to restore.`,
        'info',
        5000
      );
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      showToast('Failed to delete invoice', 'error');
      setInvoices(invoices); // Rollback on error
    }
  };

  const handleUndo = async () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[0];
      setInvoices(previousState);
      try {
        await saveInvoices(previousState);
        setUndoStack((prev) => prev.slice(1));
        showToast('Invoice restored', 'success');
      } catch (error) {
        console.error('Failed to restore invoices:', error);
        showToast('Failed to restore invoices', 'error');
      }
    } else {
      showToast('Nothing to undo', 'info');
    }
  };

  const handleStartEdit = (invoice: StoredInvoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingInvoiceId(invoice.id);
    setEditType(invoice.invoice.invoiceType);
    setEditGrossTotal(invoice.invoice.totals.grossTotal.toFixed(2));
    setEditNetTotal(invoice.invoice.totals.netTotal.toFixed(2));
    setEditTaxTotal(invoice.invoice.totals.taxTotal.toFixed(2));
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingInvoiceId) return;

    const gross = parseFloat(editGrossTotal);
    const net = parseFloat(editNetTotal);
    const tax = parseFloat(editTaxTotal);

    if (isNaN(gross) || isNaN(net) || isNaN(tax)) {
      showToast('Please enter valid numbers for all amounts', 'error');
      return;
    }

    // Validate that net + tax = gross (with small tolerance for rounding)
    const calculatedGross = net + tax;
    if (Math.abs(gross - calculatedGross) > 0.01) {
      showToast('Gross total should equal Net + Tax', 'warning');
      return;
    }

    const invoiceToUpdate = invoices.find((inv) => inv.id === editingInvoiceId);
    if (!invoiceToUpdate) return;

    const updatedInvoice = {
      ...invoiceToUpdate,
      invoice: {
        ...invoiceToUpdate.invoice,
        invoiceType: editType,
        totals: {
          netTotal: net,
          taxTotal: tax,
          grossTotal: gross,
        },
      },
    };

    try {
      await addInvoice(updatedInvoice.filename, updatedInvoice.invoice, updatedInvoice.id);
      const updated = invoices.map((inv) => (inv.id === editingInvoiceId ? updatedInvoice : inv));
      setInvoices(updated);
      setEditingInvoiceId(null);
      showToast('Invoice updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update invoice:', error);
      showToast('Failed to update invoice', 'error');
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingInvoiceId(null);
    setEditType('Other');
    setEditGrossTotal('');
    setEditNetTotal('');
    setEditTaxTotal('');
  };

  const handleClearAll = async () => {
    // Use toast instead of confirm - but we'll show a warning first
    const confirmed = window.confirm('Are you sure you want to delete all invoices?');
    if (confirmed) {
      setUndoStack((prev) => [[...invoices], ...prev.slice(0, 9)]);
      setInvoices([]);
      try {
        await clearAllInvoices();
        setParseErrors([]);
        setSelectedInvoice(null);
        setFilterType('all');
        setFilterMonth('all');
        showToast('All invoices deleted. Click "Undo" to restore.', 'warning', 5000);
      } catch (error) {
        console.error('Failed to clear invoices:', error);
        showToast('Failed to clear invoices', 'error');
        setInvoices(invoices); // Rollback on error
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys to navigate invoices
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && filteredInvoices.length > 0) {
        e.preventDefault();
        const currentIndex = selectedInvoice
          ? sortedFilteredInvoices.findIndex((inv) => inv.id === selectedInvoice.id)
          : -1;

        if (e.key === 'ArrowDown') {
          const nextIndex = currentIndex < sortedFilteredInvoices.length - 1 ? currentIndex + 1 : 0;
          setSelectedInvoice(sortedFilteredInvoices[nextIndex]);
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : sortedFilteredInvoices.length - 1;
          setSelectedInvoice(sortedFilteredInvoices[prevIndex]);
        }
      }

      // Escape to close selected invoice
      if (e.key === 'Escape' && selectedInvoice) {
        setSelectedInvoice(null);
      }

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length > 0) {
          const previousState = undoStack[0];
          setInvoices(previousState);
          saveInvoices(previousState);
          setUndoStack((prev) => prev.slice(1));
          showToast('Invoice restored', 'success');
        } else {
          showToast('Nothing to undo', 'info');
        }
      }

      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Invoice number"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredInvoices, sortedFilteredInvoices, selectedInvoice, undoStack, showToast]);

  // Apply manual adjustments to invoices before saving
  const applyManualAdjustments = (invoicesToAdjust: StoredInvoice[]): StoredInvoice[] => {
    return invoicesToAdjust.map(stored => {
      // Only apply to Utility invoices
      if (stored.invoice.invoiceType !== 'Utility') {
        return stored;
      }

      const monthYear = getMonthYearFromDate(stored.invoice.issueDate);
      const manualValue = manualValues[monthYear] || 0;

      // If no manual value, return as-is
      if (manualValue <= 0) {
        return stored;
      }

      const manualAdjustment = manualValue * 76;

      // Find Central Heating line item
      const centralHeatingIndex = stored.invoice.lineItems.findIndex(item =>
        item.description.toLowerCase() === 'central heating' ||
        item.description.toLowerCase().includes('central heating') ||
        item.description.toLowerCase().includes('ciepła')
      );

      // Create a copy of the invoice
      const adjustedInvoice = { ...stored.invoice };
      const adjustedLineItems = [...stored.invoice.lineItems];

      // Adjust Central Heating if found
      if (centralHeatingIndex >= 0) {
        const centralHeating = { ...adjustedLineItems[centralHeatingIndex] };
        centralHeating.grossValue = Math.max(0, centralHeating.grossValue - manualAdjustment);
        centralHeating.netValue = Math.max(0, centralHeating.netValue - manualAdjustment);
        
        // Recalculate netPrice based on adjusted grossValue
        if (centralHeating.quantity > 0) {
          centralHeating.netPrice = centralHeating.grossValue / centralHeating.quantity;
        }
        
        adjustedLineItems[centralHeatingIndex] = centralHeating;
      }

      // Add Manual Heating Calculation line item
      const manualLineItem: LineItem = {
        no: adjustedLineItems.length + 1,
        description: `Manual Heating Calculation (${manualValue} × 76)`,
        netPrice: manualAdjustment,
        quantity: 1,
        unit: 'UNIT',
        netValue: manualAdjustment,
        tax: '0%',
        grossValue: manualAdjustment,
      };
      adjustedLineItems.push(manualLineItem);

      // Update invoice with adjusted line items
      adjustedInvoice.lineItems = adjustedLineItems;

      // Recalculate totals (add and subtract cancel out, so total remains the same)
      const newNetTotal = adjustedLineItems.reduce((sum, item) => sum + item.netValue, 0);
      const newGrossTotal = adjustedLineItems.reduce((sum, item) => sum + item.grossValue, 0);
      const newTaxTotal = newGrossTotal - newNetTotal;

      adjustedInvoice.totals = {
        netTotal: newNetTotal,
        taxTotal: newTaxTotal,
        grossTotal: newGrossTotal,
      };

      return {
        ...stored,
        invoice: adjustedInvoice,
      };
    });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const importedInvoices = importFromJson(jsonString);

          // Add each imported invoice to Supabase
          for (const inv of importedInvoices) {
            await addInvoice(inv.filename, inv.invoice, inv.id);
          }

          // Merge with existing invoices
          const updated = [...importedInvoices, ...invoices];
          setInvoices(updated);

          showToast(`Successfully imported ${importedInvoices.length} invoice(s)`, 'success');
        } catch (err) {
          showToast(`Failed to import: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error', 5000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = () => {
    // Apply manual adjustments before exporting
    const adjustedInvoices = applyManualAdjustments(invoices);
    const json = exportToJson(adjustedInvoices);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    // Apply manual adjustments before exporting
    const adjustedInvoices = applyManualAdjustments(filteredInvoices);
    
    // CSV header
    const headers = ['Invoice Number', 'Date', 'Type', 'Net Total', 'Tax Total', 'Gross Total', 'Currency', 'Filename'];
    const rows = adjustedInvoices.map(inv => [
      inv.invoice.invoiceNumber || '',
      inv.invoice.issueDate || '',
      inv.invoice.invoiceType || '',
      (inv.invoice.totals.netTotal || 0).toFixed(2),
      (inv.invoice.totals.taxTotal || 0).toFixed(2),
      (inv.invoice.totals.grossTotal || 0).toFixed(2),
      inv.invoice.currency || 'PLN',
      inv.filename || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    // For Excel, we'll create a more detailed CSV that Excel can open
    const adjustedInvoices = applyManualAdjustments(filteredInvoices);
    
    // Detailed CSV with line items
    const lines: string[] = [];
    
    // Summary sheet data
    lines.push('INVOICE SUMMARY');
    lines.push('');
    lines.push('Invoice Number,Date,Type,Net Total,Tax Total,Gross Total,Currency,Filename');
    adjustedInvoices.forEach(inv => {
      lines.push([
        inv.invoice.invoiceNumber || '',
        inv.invoice.issueDate || '',
        inv.invoice.invoiceType || '',
        (inv.invoice.totals.netTotal || 0).toFixed(2),
        (inv.invoice.totals.taxTotal || 0).toFixed(2),
        (inv.invoice.totals.grossTotal || 0).toFixed(2),
        inv.invoice.currency || 'PLN',
        inv.filename || ''
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = lines.join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    try {
      // With Supabase, all data is automatically saved to the cloud
      // Just sync manual values to ensure they're up to date
      await saveManualValues(manualValues);
      showToast(`All data is synced to Supabase database`, 'success');
    } catch (err) {
      showToast(`Failed to sync: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error', 5000);
    }
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterMonth('all');
    setSearchQuery('');
    setDateRangeStart('');
    setDateRangeEnd('');
  };

  const handleManualValueChange = (month: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const updated = { ...manualValues, [month]: numValue };
    setManualValues(updated);
    saveManualValues(updated);
  };

  const startEditing = (month: string) => {
    setEditingMonth(month);
    setEditValue(manualValues[month]?.toString() || '');
  };

  const saveEdit = (month: string) => {
    const numValue = parseFloat(editValue) || 0;
    handleManualValueChange(month, numValue.toString());
    setEditingMonth(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingMonth(null);
    setEditValue('');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Main Content */}
      <main className="py-4 px-6">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Invoice Parser
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          {/* Toast Container */}
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {toasts.map((toast) => (
              <ToastComponent key={toast.id} toast={toast} onClose={removeToast} />
            ))}
          </div>

          {/* Upload Area */}
          <div className="mb-4">
            <FileUpload onFilesSelected={handleFilesSelected} isLoading={isLoading} />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                Failed to parse ({parseErrors.length}):
              </h2>
              <div className="space-y-2">
                {parseErrors.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                  >
                    <span className="font-medium">{result.filename}</span>
                    {result.error && (
                      <span className="text-red-600 dark:text-red-400 ml-2">- {result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Invoice Detail */}
          {selectedInvoice && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Invoice Details</h3>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Manual Value Editor - Only for Utility invoices */}
              {selectedInvoice.invoice.invoiceType === 'Utility' && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Manual Value (× 76)
                    </label>
                    <span className="text-xs text-gray-500">
                      Current: {manualValues[getMonthYearFromDate(selectedInvoice.invoice.issueDate)] || 0} × 76 = {((manualValues[getMonthYearFromDate(selectedInvoice.invoice.issueDate)] || 0) * 76).toFixed(2)} {selectedInvoice.invoice.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingMonth === getMonthYearFromDate(selectedInvoice.invoice.issueDate) ? (
                      <>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveEdit(getMonthYearFromDate(selectedInvoice.invoice.issueDate));
                            } else if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter value"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(getMonthYearFromDate(selectedInvoice.invoice.issueDate))}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(getMonthYearFromDate(selectedInvoice.invoice.issueDate))}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          {manualValues[getMonthYearFromDate(selectedInvoice.invoice.issueDate)] ? 'Edit Manual Value' : 'Add Manual Value'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <InvoiceCard
                filename={selectedInvoice.filename}
                invoice={selectedInvoice.invoice}
                manualValue={manualValues[getMonthYearFromDate(selectedInvoice.invoice.issueDate)] || 0}
              />
            </div>
          )}

          {/* Invoice Comparison View */}
          {comparingInvoices[0] && comparingInvoices[1] && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Invoice Comparison</h3>
                <button
                  onClick={() => {
                    setComparingInvoices([null, null]);
                    setSelectedForCompare(new Set());
                    setCompareMode(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="p-4 border-r border-gray-200 dark:border-gray-700">
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {comparingInvoices[0]?.invoice.invoiceNumber}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {comparingInvoices[0] && getMonthYearFromDate(comparingInvoices[0].invoice.issueDate)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {comparingInvoices[0]?.filename}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {comparingInvoices[1]?.invoice.invoiceNumber}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {comparingInvoices[1] && getMonthYearFromDate(comparingInvoices[1].invoice.issueDate)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {comparingInvoices[1]?.filename}
                    </div>
                  </div>
                </div>

                {/* Totals Comparison */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Totals</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(['netTotal', 'taxTotal', 'grossTotal'] as const).map((totalType) => {
                      if (!comparingInvoices[0] || !comparingInvoices[1]) return null;
                      const value1 = comparingInvoices[0].invoice.totals[totalType];
                      const value2 = comparingInvoices[1].invoice.totals[totalType];
                      const diff = value2 - value1;
                      const diffPercent = value1 !== 0 ? ((diff / value1) * 100).toFixed(1) : '0.0';
                      const isIncrease = diff > 0;
                      const isDecrease = diff < 0;

                      return (
                        <div key={totalType} className="space-y-1">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {totalType === 'netTotal' ? 'Net Total' : totalType === 'taxTotal' ? 'Tax' : 'Gross Total'}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {comparingInvoices[0] && new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: comparingInvoices[0].invoice.currency,
                                minimumFractionDigits: 2,
                              }).format(value1)}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {comparingInvoices[1] && new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: comparingInvoices[1].invoice.currency,
                                minimumFractionDigits: 2,
                              }).format(value2)}
                            </div>
                          </div>
                          {diff !== 0 && (
                            <div className={`text-xs font-medium flex items-center gap-1 ${
                              isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            }`}>
                              <span>{isIncrease ? '▲' : '▼'}</span>
                              <span>
                                {isIncrease ? '+' : ''}
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: comparingInvoices[0].invoice.currency,
                                  minimumFractionDigits: 2,
                                }).format(Math.abs(diff))}
                              </span>
                              <span>({isIncrease ? '+' : ''}{diffPercent}%)</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Line Items Comparison */}
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Line Items</h4>
                  <div className="space-y-2">
                    {(() => {
                      if (!comparingInvoices[0] || !comparingInvoices[1]) return null;
                      // Match line items by description
                      const items1 = comparingInvoices[0].invoice.lineItems;
                      const items2 = comparingInvoices[1].invoice.lineItems;
                      const matchedItems: Array<{
                        item1: LineItem | null;
                        item2: LineItem | null;
                        description: string;
                      }> = [];

                      // Create a map of items by normalized description
                      const normalizeDesc = (desc: string) => desc.toLowerCase().trim();
                      const map1 = new Map(items1.map(item => [normalizeDesc(item.description), item]));
                      const map2 = new Map(items2.map(item => [normalizeDesc(item.description), item]));

                      // Get all unique descriptions
                      const allDescriptions = new Set([
                        ...items1.map(item => normalizeDesc(item.description)),
                        ...items2.map(item => normalizeDesc(item.description)),
                      ]);

                      allDescriptions.forEach(desc => {
                        matchedItems.push({
                          item1: map1.get(desc) || null,
                          item2: map2.get(desc) || null,
                          description: map1.get(desc)?.description || map2.get(desc)?.description || desc,
                        });
                      });

                      return matchedItems.map((match, idx) => {
                        const { item1, item2, description } = match;
                        const hasItem1 = item1 !== null;
                        const hasItem2 = item2 !== null;
                        const isMissing = !hasItem1 || !hasItem2;

                        if (hasItem1 && hasItem2) {
                          const grossDiff = item2.grossValue - item1.grossValue;
                          const unitPriceDiff = item2.netPrice - item1.netPrice;
                          const quantityDiff = item2.quantity - item1.quantity;
                          const quantityPercent = item1.quantity !== 0 ? ((quantityDiff / item1.quantity) * 100).toFixed(1) : '0.0';

                          return (
                            <div key={idx} className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                  <div>Gross: {comparingInvoices[0] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[0].invoice.currency, minimumFractionDigits: 2 }).format(item1.grossValue)}</div>
                                  <div>Unit Price: {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item1.netPrice)} {item1.unit}</div>
                                  <div>Quantity: {item1.quantity}</div>
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span>Gross: {comparingInvoices[1] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[1].invoice.currency, minimumFractionDigits: 2 }).format(item2.grossValue)}</span>
                                    {grossDiff !== 0 && comparingInvoices[1] && (
                                      <span className={`text-xs font-medium ${grossDiff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        ({grossDiff > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[1].invoice.currency, minimumFractionDigits: 2 }).format(grossDiff)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span>Unit Price: {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item2.netPrice)} {item2.unit}</span>
                                    {unitPriceDiff !== 0 && (
                                      <span className={`text-xs font-medium ${unitPriceDiff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        ({unitPriceDiff > 0 ? '+' : ''}{unitPriceDiff.toFixed(2)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span>Quantity: {item2.quantity}</span>
                                    {quantityDiff !== 0 && (
                                      <span className={`text-xs font-medium ${quantityDiff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        ({quantityDiff > 0 ? '+' : ''}{quantityDiff} ({quantityDiff > 0 ? '+' : ''}{quantityPercent}%))
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div key={idx} className="grid grid-cols-2 gap-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <div>
                                {hasItem1 && item1 ? (
                                  <>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                      {comparingInvoices[0] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[0].invoice.currency, minimumFractionDigits: 2 }).format(item1.grossValue)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-400 dark:text-gray-500 italic">Not in this invoice</div>
                                )}
                              </div>
                              <div>
                                {hasItem2 && item2 ? (
                                  <>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                      {comparingInvoices[1] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[1].invoice.currency, minimumFractionDigits: 2 }).format(item2.grossValue)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-400 dark:text-gray-500 italic">Not in this invoice</div>
                                )}
                              </div>
                            </div>
                          );
                        }
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          {invoices.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 mb-4">
              <div className="flex items-center justify-between">
                {/* Left side - Primary actions */}
                <div className="flex items-center gap-1">
                  {/* File Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowFileMenu(!showFileMenu);
                        setShowExportMenu(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      File
                      <svg className={`w-3 h-3 transition-transform ${showFileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showFileMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowFileMenu(false)} />
                        <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                          <button
                            onClick={() => { handleImport(); setShowFileMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import JSON
                          </button>
                          <button
                            onClick={() => { handleSave(); setShowFileMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save Session
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Export Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowExportMenu(!showExportMenu);
                        setShowFileMenu(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export
                      <svg className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showExportMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                        <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                          <button
                            onClick={() => { handleExport(); setShowExportMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export as JSON
                          </button>
                          <button
                            onClick={() => { handleExportCSV(); setShowExportMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export as CSV
                          </button>
                          <button
                            onClick={() => { handleExportExcel(); setShowExportMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export as Excel
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                  {/* Print Button */}
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    title="Print invoices"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </button>

                  {/* Compare Button */}
                  <button
                    onClick={() => {
                      setCompareMode(!compareMode);
                      if (compareMode) {
                        setSelectedForCompare(new Set());
                        setComparingInvoices([null, null]);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      compareMode
                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title="Compare two invoices"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {compareMode ? 'Cancel' : 'Compare'}
                  </button>

                  {/* View Comparison Button (shows when 2 selected) */}
                  {compareMode && selectedForCompare.size === 2 && (
                    <button
                      onClick={() => {
                        const selected = Array.from(selectedForCompare);
                        const invoice1 = invoices.find(inv => inv.id === selected[0]);
                        const invoice2 = invoices.find(inv => inv.id === selected[1]);
                        if (invoice1 && invoice2) {
                          setComparingInvoices([invoice1, invoice2]);
                          setSelectedInvoice(null);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-md transition-colors"
                      title="Compare selected invoices"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View ({selectedForCompare.size}/2)
                    </button>
                  )}
                </div>

                {/* Right side - Utility actions */}
                <div className="flex items-center gap-1">
                  {undoStack.length > 0 && (
                    <button
                      onClick={handleUndo}
                      className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-colors"
                      title="Undo last delete (Ctrl/Cmd+Z)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Undo
                    </button>
                  )}
                  <button
                    onClick={handleClearAll}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                    title="Delete all invoices"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filter & View Bar */}
          {invoices.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[200px] max-w-xs relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search invoices..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as InvoiceType | 'all')}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Types ({invoices.length})</option>
                  {Object.entries(typeGroups).map(([type, count]) => (
                    <option key={type} value={type}>{type} ({count})</option>
                  ))}
                </select>

                {/* Month Filter */}
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Months</option>
                  {Object.entries(monthGroups).map(([month, count]) => (
                    <option key={month} value={month}>{month} ({count})</option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(filterType !== 'all' || filterMonth !== 'all' || searchQuery) && (
                  <button
                    onClick={clearFilters}
                    className="px-2 py-1.5 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md"
                  >
                    Clear
                  </button>
                )}

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

                {/* View Toggles */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowDashboard(!showDashboard)}
                    className={`px-2 py-1 text-xs rounded ${showDashboard ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setShowGraphs(!showGraphs)}
                    className={`px-2 py-1 text-xs rounded ${showGraphs ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    Cumulative
                  </button>
                  <button
                    onClick={() => setShowUtilityGross(!showUtilityGross)}
                    className={`px-2 py-1 text-xs rounded ${showUtilityGross ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    Gross
                  </button>
                  <button
                    onClick={() => setShowUtilityQuantity(!showUtilityQuantity)}
                    className={`px-2 py-1 text-xs rounded ${showUtilityQuantity ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    Qty
                  </button>
                  <button
                    onClick={() => setShowUtilityUnitPrice(!showUtilityUnitPrice)}
                    className={`px-2 py-1 text-xs rounded ${showUtilityUnitPrice ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    Unit Price
                  </button>
                  <button
                    onClick={() => setShowYearOverYear(!showYearOverYear)}
                    className={`px-2 py-1 text-xs rounded ${showYearOverYear ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    YoY
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Section */}
          {filteredInvoices.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Total Card */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-5 relative">
                  <div className="absolute top-4 right-4 w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Invoices</div>
                  <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{summaryData.overallCount}</div>
                  <div className="text-base text-gray-600 dark:text-gray-400 mt-1">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'PLN',
                      minimumFractionDigits: 0,
                    }).format(summaryData.overallTotal)}
                  </div>
                </div>
                {/* YTD Card */}
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-5 relative">
                  <div className="absolute top-4 right-4 w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">YTD {new Date().getFullYear()}</div>
                  <div className="text-3xl font-bold text-blue-800 dark:text-blue-300">{summaryData.ytdCount}</div>
                  <div className="text-base text-blue-600 dark:text-blue-400 mt-1">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'PLN',
                      minimumFractionDigits: 0,
                    }).format(summaryData.ytdTotal)}
                  </div>
                </div>
                {/* Type Cards */}
                {Object.entries(summaryData.totalsByType).map(([type, data]) => {
                  const colors = typeColors[type as InvoiceType] || typeColors.Other;
                  const avg = summaryData.averagesByType[type] || 0;
                  const iconBg = type === 'Rent' ? 'bg-blue-100 dark:bg-blue-800' :
                                 type === 'Parking' ? 'bg-purple-100 dark:bg-purple-800' :
                                 type === 'Utility' ? 'bg-green-100 dark:bg-green-800' : 'bg-gray-200 dark:bg-gray-600';
                  const iconColor = type === 'Rent' ? 'text-blue-600 dark:text-blue-300' :
                                    type === 'Parking' ? 'text-purple-600 dark:text-purple-300' :
                                    type === 'Utility' ? 'text-green-600 dark:text-green-300' : 'text-gray-600 dark:text-gray-300';
                  return (
                    <div key={type} className={`${colors.bg} rounded-xl p-5 relative`}>
                      <div className={`absolute top-4 right-4 w-10 h-10 ${iconBg} rounded-full flex items-center justify-center`}>
                        {type === 'Rent' && (
                          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        )}
                        {type === 'Parking' && (
                          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        )}
                        {type === 'Utility' && (
                          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        )}
                        {type === 'Other' && (
                          <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                          </svg>
                        )}
                      </div>
                      <div className={`text-sm font-medium ${colors.text} mb-2`}>{type}</div>
                      <div className={`text-3xl font-bold ${colors.text}`}>{data.count}</div>
                      <div className={`text-base ${colors.text} opacity-80 mt-1`}>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'PLN',
                          minimumFractionDigits: 0,
                        }).format(data.total)}
                      </div>
                      {data.count > 0 && (
                        <div className={`text-sm ${colors.text} opacity-60 mt-1`}>
                          Avg: {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'PLN',
                            minimumFractionDigits: 0,
                          }).format(avg)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Monthly Sums - Collapsible */}
              {Object.keys(summaryData.monthlySums).length > 0 && (
                <details className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <summary className="text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                    Monthly Sum ({Object.keys(summaryData.monthlySums).length} months)
                  </summary>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                    {Object.entries(summaryData.monthlySums)
                      .sort(([a], [b]) => {
                        const [aMonth, aYear] = a.split(' ');
                        const [bMonth, bYear] = b.split(' ');
                        const aIndex = monthNames.indexOf(aMonth);
                        const bIndex = monthNames.indexOf(bMonth);
                        if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
                        return aIndex - bIndex;
                      })
                      .map(([month, data]) => (
                        <div key={month} className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-center">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{month}</div>
                          <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'PLN',
                              minimumFractionDigits: 0,
                            }).format(data.total)}
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Dashboard Table */}
          {showDashboard && (
            <>
              {sortedFilteredInvoices.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 mb-4">
                  {/* Table Header with Collapse */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setIsTableCollapsed(!isTableCollapsed)}
                      className="flex items-center gap-1 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <svg className={`w-5 h-5 transition-transform ${isTableCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <span className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <span className="text-base font-semibold text-gray-800 dark:text-gray-100">
                      Invoices
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({sortedFilteredInvoices.length})
                    </span>
                  </div>
                  {!isTableCollapsed && (
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        {compareMode && (
                          <th className="w-12 px-4 py-3"></th>
                        )}
                        <th 
                          className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleSort('number')}
                        >
                          <div className="flex items-center gap-2">
                            Invoice
                            {sortField === 'number' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-2">
                            Month
                            {sortField === 'date' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleSort('type')}
                        >
                          <div className="flex items-center gap-2">
                            Type
                            {sortField === 'type' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleSort('amount')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Amount
                            {sortField === 'amount' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sortedFilteredInvoices.map((stored) => {
                        const colors = typeColors[stored.invoice.invoiceType];
                        const isSelected = selectedInvoice?.id === stored.id;
                        const isSelectedForCompare = selectedForCompare.has(stored.id);
                        const canSelect = !compareMode || selectedForCompare.size < 2 || isSelectedForCompare;
                        return (
                          <React.Fragment key={stored.id}>
                          <tr
                            onClick={() => {
                              if (!compareMode) {
                                setSelectedInvoice(isSelected ? null : stored);
                              }
                            }}
                            className={`transition-colors ${
                              compareMode ? '' : 'cursor-pointer'
                            } ${
                              isSelected ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            } ${
                              isSelectedForCompare ? 'bg-teal-50 dark:bg-teal-900/30' : ''
                            }`}
                          >
                            {compareMode && (
                              <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelectedForCompare}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const newSet = new Set(selectedForCompare);
                                    if (e.target.checked) {
                                      if (selectedForCompare.size < 2) {
                                        newSet.add(stored.id);
                                        setSelectedForCompare(newSet);
                                      } else {
                                        showToast('You can only compare 2 invoices at a time', 'warning');
                                      }
                                    } else {
                                      newSet.delete(stored.id);
                                      setSelectedForCompare(newSet);
                                    }
                                  }}
                                  disabled={!canSelect && !isSelectedForCompare}
                                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900 dark:text-gray-100 hover:text-orange-600 dark:hover:text-orange-400">
                                {stored.invoice.invoiceNumber}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{stored.filename}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
                                {getMonthFromDate(stored.invoice.issueDate)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge} ${colors.text}`}>
                                {stored.invoice.invoiceType}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(stored.invoice.totals.grossTotal)}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">{stored.invoice.currency}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => handleStartEdit(stored, e)}
                                  className="text-gray-400 hover:text-blue-500 transition-colors"
                                  title="Edit invoice"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDelete(stored.id, e)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  title="Delete invoice"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingInvoiceId === stored.id && (
                            <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-300 dark:border-blue-700">
                              <td colSpan={compareMode ? 6 : 5} className="px-6 py-4">
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-300 dark:border-blue-700 p-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                      Edit Invoice: {stored.invoice.invoiceNumber}
                                    </h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Type Dropdown */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Type
                                      </label>
                                      <select
                                        value={editType}
                                        onChange={(e) => setEditType(e.target.value as InvoiceType)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="Rent">Rent</option>
                                        <option value="Parking">Parking</option>
                                        <option value="Utility">Utility</option>
                                        <option value="Other">Other</option>
                                      </select>
                                    </div>

                                    {/* Net Total */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Net Total ({stored.invoice.currency})
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editNetTotal}
                                        onChange={(e) => {
                                          setEditNetTotal(e.target.value);
                                          const net = parseFloat(e.target.value) || 0;
                                          const tax = parseFloat(editTaxTotal) || 0;
                                          setEditGrossTotal((net + tax).toFixed(2));
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                      />
                                    </div>

                                    {/* Tax Total */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Tax ({stored.invoice.currency})
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editTaxTotal}
                                        onChange={(e) => {
                                          setEditTaxTotal(e.target.value);
                                          const net = parseFloat(editNetTotal) || 0;
                                          const tax = parseFloat(e.target.value) || 0;
                                          setEditGrossTotal((net + tax).toFixed(2));
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                      />
                                    </div>

                                    {/* Gross Total */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Gross Total ({stored.invoice.currency})
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editGrossTotal}
                                        onChange={(e) => {
                                          setEditGrossTotal(e.target.value);
                                          // When gross is manually changed, adjust tax to maintain: gross = net + tax
                                          const gross = parseFloat(e.target.value) || 0;
                                          const net = parseFloat(editNetTotal) || 0;
                                          const newTax = Math.max(0, gross - net);
                                          setEditTaxTotal(newTax.toFixed(2));
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                      />
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Auto-calculated from Net + Tax
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end gap-2 mt-4">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleSaveEdit}
                                      className="px-4 py-2 text-sm text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                                    >
                                      Save Changes
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
              ) : invoices.length > 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400 mb-6">
                  <p>No invoices match the current filters</p>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 mt-2"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* Graphs Section */}
          {showGraphs && allMonths.length > 0 && filterType === 'all' && filterMonth === 'all' && (
            <div className="space-y-6 mb-6">
              {/* Rental Values Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  Rental Values by Month
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rentalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={(value) => {
                          // value is now "Jan 2025" format - show abbreviated
                          const parts = value.split(' ');
                          if (parts.length === 2) {
                            return `${parts[0]} '${parts[1].slice(-2)}`;
                          }
                          return value;
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        width={60}
                        tickFormatter={(value) => {
                          if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                          return value.toString();
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0]?.payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{data?.fullLabel || data?.name}</p>
                                <p className="text-sm text-orange-600 font-semibold">
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'PLN',
                                    minimumFractionDigits: 2,
                                  }).format(data?.value || 0)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Utility Values Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Utility Values by Month</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={utilityChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={(value) => {
                          const parts = value.split(' ');
                          if (parts.length === 2) {
                            return `${parts[0]} '${parts[1].slice(-2)}`;
                          }
                          return value;
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        width={60}
                        tickFormatter={(value) => {
                          if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                          return value.toString();
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0]?.payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{data?.fullLabel}</p>
                                <p className="text-sm text-green-600 font-semibold">
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'PLN',
                                    minimumFractionDigits: 2,
                                  }).format(data?.value || 0)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Parking Values Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Parking Values by Month</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={parkingChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={(value) => {
                          const parts = value.split(' ');
                          if (parts.length === 2) {
                            return `${parts[0]} '${parts[1].slice(-2)}`;
                          }
                          return value;
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        width={60}
                        tickFormatter={(value) => {
                          if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                          return value.toString();
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0]?.payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{data?.fullLabel}</p>
                                <p className="text-sm text-purple-600 font-semibold">
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'PLN',
                                    minimumFractionDigits: 2,
                                  }).format(data?.value || 0)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Utility Gross Section */}
          {showUtilityGross && allMonths.length > 0 && filterType === 'all' && filterMonth === 'all' && (
            <div className="space-y-6 mb-6">
              {/* Utility Subtype Charts */}
              {utilityCategories.map((cat, i) => (
                <div key={cat.key} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                      <svg className="w-4 h-4" style={{ color: cat.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    {cat.label} by Month
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={utilityChartsData[i]} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tickFormatter={(value) => {
                            const parts = value.split(' ');
                            if (parts.length === 2) {
                              return `${parts[0]} '${parts[1].slice(-2)}`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          width={60}
                          tickFormatter={(value) => {
                            if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                            return value.toString();
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0]?.payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{data?.fullLabel}</p>
                                  <p className="text-sm font-semibold" style={{ color: cat.color }}>
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'PLN',
                                      minimumFractionDigits: 2,
                                    }).format(data?.value || 0)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" fill={cat.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Utility Quantity Section */}
          {showUtilityQuantity && allMonths.length > 0 && filterType === 'all' && filterMonth === 'all' && (
            <div className="space-y-6 mb-6">
              {/* Utility Quantity Charts */}
              {utilityCategories.map((cat, i) => (
                <div key={cat.key} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{cat.label} Quantity by Month</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={utilityQuantityChartsData[i]} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tickFormatter={(value) => {
                            const parts = value.split(' ');
                            if (parts.length === 2) {
                              return `${parts[0]} '${parts[1].slice(-2)}`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          width={60}
                          tickFormatter={(value) => {
                            if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                            return value.toString();
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0]?.payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{data?.fullLabel}</p>
                                  <p className="text-sm font-semibold" style={{ color: cat.color }}>
                                    {new Intl.NumberFormat('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }).format(data?.value || 0)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" fill={cat.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Utility Unit Price Section */}
          {showUtilityUnitPrice && allMonths.length > 0 && filterType === 'all' && filterMonth === 'all' && (
            <div className="space-y-6 mb-6">
              {/* Utility Unit Price Charts */}
              {utilityCategories.map((cat, i) => (
                <div key={cat.key} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{cat.label} Unit Price by Month</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={utilityUnitPriceChartsData[i]} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tickFormatter={(value) => {
                            const parts = value.split(' ');
                            if (parts.length === 2) {
                              return `${parts[0]} '${parts[1].slice(-2)}`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          width={60}
                          tickFormatter={(value) => {
                            if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                            return value.toString();
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0]?.payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{data?.fullLabel}</p>
                                  <p className="text-sm font-semibold" style={{ color: cat.color }}>
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'PLN',
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }).format(data?.value || 0)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" fill={cat.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Year-over-Year Comparison */}
          {showYearOverYear && Object.keys(yearOverYearData).length > 0 && (
            <div className="space-y-6 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  Year-over-Year Comparison (Utility)
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthNames.map(month => {
                        const monthData = yearOverYearData[month] || {};
                        const years = Object.keys(monthData).sort();
                        const result: Record<string, string | number> = { month };
                        years.forEach(year => {
                          result[year] = monthData[year]?.Utility || 0;
                        });
                        return result;
                      }).filter(d => Object.keys(d).length > 1)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        width={60}
                        tickFormatter={(value) => {
                          if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                          return value.toString();
                        }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">{label}</p>
                                {payload.map((entry, index) => (
                                  <p key={index} className="text-sm" style={{ color: entry.color }}>
                                    {entry.name}: {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'PLN',
                                      minimumFractionDigits: 2,
                                    }).format(entry.value as number)}
                                  </p>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      {Object.keys(yearOverYearData).length > 0 &&
                        Array.from(new Set(Object.values(yearOverYearData).flatMap(m => Object.keys(m)))).sort().map((year, idx) => {
                          const colors = ['#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
                          return <Bar key={year} dataKey={year} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />;
                        })
                      }
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {invoices.length === 0 && !isLoading && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg
                className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p>No invoices saved yet</p>
              <p className="text-sm mt-1">Upload PDF files to get started</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
