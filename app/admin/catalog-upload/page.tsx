'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit, type AuditAction } from '@/lib/audit-logger';
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2, Download, Trash2 } from 'lucide-react';

interface CatalogRow {
  product_name: string;
  code: string;
  category: string;
  description: string;
  selling_price: number;
  cost_price: number;
  gross_margin: number;
  stock_unit: string;
  shelf_life_days: number;
  allergens: string[];
  dietary_labels: string;
  reorder_level: number;
  notes: string;
  availability: string;
  key_ingredients: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; name: string; error: string }[];
}

const EXPECTED_HEADERS = [
  'Product Name', 'Code', 'Category', 'Description',
  'Selling', 'Bulk Cost', 'Gross', 'Stock Unit',
  'Shelf Life', 'Allergens', 'Dietary', 'Reorder',
  'Notes', 'Availability', 'Key Ingredients',
];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parsePrice(val: string): number {
  const cleaned = val.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseMargin(val: string): number {
  const cleaned = val.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseAllergens(val: string): string[] {
  if (!val || val.toLowerCase() === 'none') return [];
  return val.split(/[,;]+/).map(a => a.trim()).filter(Boolean);
}

function parseShelfLife(val: string): number {
  if (!val || val.toLowerCase().includes('made on order') || val.toLowerCase().includes('made to order')) return 0;
  const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

function parseCatalogCSV(content: string): { rows: CatalogRow[]; errors: string[] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const errors: string[] = [];
  const rows: CatalogRow[] = [];

  if (lines.length < 2) {
    errors.push('CSV file must have a header row and at least one data row.');
    return { rows, errors };
  }

  // Find the header row (first row containing "Product Name" or "Code")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('product name') || (lower.includes('code') && lower.includes('category'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    errors.push('Could not find header row. Expected columns: Product Name, Code, Category, etc.');
    return { rows, errors };
  }

  const headers = parseCSVLine(lines[headerIdx]);

  // Map headers to indices
  const colMap: Record<string, number> = {};
  const headerKeywords: Record<string, string[]> = {
    product_name: ['product name'],
    code: ['code'],
    category: ['category'],
    description: ['description', 'website'],
    selling_price: ['selling', 'price'],
    cost_price: ['bulk cost', 'cost of prod'],
    gross_margin: ['gross', 'margin'],
    stock_unit: ['stock unit', 'unit'],
    shelf_life: ['shelf life', 'shelf'],
    allergens: ['allergen'],
    dietary_labels: ['dietary', 'label'],
    reorder_level: ['reorder'],
    notes: ['notes', 'made on order'],
    availability: ['availability'],
    key_ingredients: ['key ingredient', 'bulk sourcing'],
  };

  for (const [key, keywords] of Object.entries(headerKeywords)) {
    const idx = headers.findIndex(h => keywords.some(kw => h.toLowerCase().includes(kw)));
    if (idx !== -1) colMap[key] = idx;
  }

  if (!colMap.product_name && colMap.product_name !== 0) {
    errors.push('Missing required column: Product Name');
    return { rows, errors };
  }

  // Parse data rows
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const name = cols[colMap.product_name] || '';
    if (!name || name.toLowerCase().includes('product name')) continue; // Skip empty or repeated headers

    const row: CatalogRow = {
      product_name: name,
      code: cols[colMap.code] || '',
      category: cols[colMap.category] || '',
      description: cols[colMap.description] || '',
      selling_price: parsePrice(cols[colMap.selling_price] || '0'),
      cost_price: parsePrice(cols[colMap.cost_price] || '0'),
      gross_margin: parseMargin(cols[colMap.gross_margin] || '0'),
      stock_unit: cols[colMap.stock_unit] || 'pcs',
      shelf_life_days: parseShelfLife(cols[colMap.shelf_life] || '0'),
      allergens: parseAllergens(cols[colMap.allergens] || ''),
      dietary_labels: cols[colMap.dietary_labels] || '',
      reorder_level: parseInt(cols[colMap.reorder_level] || '0', 10) || 0,
      notes: cols[colMap.notes] || '',
      availability: cols[colMap.availability] || 'All day',
      key_ingredients: cols[colMap.key_ingredients] || '',
    };

    rows.push(row);
  }

  return { rows, errors };
}

function generateSampleCSV(): string {
  const header = 'Product Name,Code,Category,Description (Website),Selling Price (KES),Bulk Cost of Prod (KES),Gross Margin %,Stock Unit,Shelf Life (days),Allergens,Dietary Labels,Reorder Level,Notes / Made On Order,Availability,Key Ingredients (Bulk Sourcing)';
  const sample1 = 'White Tea,BEV-01,Breakfast,"Freshly brewed Kenya tea served with milk",KES 80,KES 18,77.5%,cup,Made on order,Dairy,Halal,100,Made on order; high-turnover,All day,"Tea leaves, fresh milk, sugar"';
  const sample2 = 'Mandazi,BRK-01,Breakfast,"Pillowy Kenyan doughnuts with cardamom",KES 30,KES 8,73.3%,pcs,2,"Gluten, Dairy","Halal, Vegetarian",200,Batch-cook daily,Breakfast / Snack,"Wheat flour, coconut milk, sugar"';
  return [header, sample1, sample2].join('\n');
}

export default function CatalogUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CatalogRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewMode, setPreviewMode] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [writePricing, setWritePricing] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setImportResult(null);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setParseErrors(['Failed to read file content']);
        return;
      }
      const { rows, errors } = parseCatalogCSV(content);
      setParsedRows(rows);
      setParseErrors(errors);
      if (rows.length > 0) {
        showToast(`Parsed ${rows.length} products from CSV`, 'success');
      }
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv')) {
      handleFileSelect(droppedFile);
    } else {
      showToast('Please upload a CSV file', 'error');
    }
  }, [handleFileSelect]);

  const handleImport = async () => {
    if (parsedRows.length === 0) return;

    setImporting(true);
    const result: ImportResult = { total: parsedRows.length, success: 0, failed: 0, errors: [] };

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const dbRow = {
          product_name: row.product_name,
          code: row.code || null,
          category: row.category,
          description: row.description,
          selling_price: row.selling_price,
          cost_price: row.cost_price,
          retail_price: row.selling_price,
          gross_margin: row.gross_margin,
          stock_unit: row.stock_unit,
          shelf_life_days: row.shelf_life_days,
          allergens: row.allergens,
          dietary_labels: row.dietary_labels,
          reorder_level: row.reorder_level,
          notes: row.notes,
          availability: row.availability,
          key_ingredients: row.key_ingredients,
          certification: row.dietary_labels,
        };

        // Try upsert by code if code exists, otherwise insert
        if (row.code) {
          // Check if product with this code exists
          const { data: existing } = await supabase
            .from('food_info')
            .select('id')
            .eq('code', row.code)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase.from('food_info').update(dbRow).eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('food_info').insert(dbRow);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from('food_info').insert(dbRow);
          if (error) throw error;
        }

        // Also write pricing tier if enabled
        if (writePricing && row.selling_price > 0) {
          const wholesalePrice = Math.round(row.selling_price * 0.77);
          const pricingRow = {
            product_code: row.code || null,
            product_name: row.product_name,
            cost: row.cost_price,
            base_price: row.selling_price,
            wholesale_price: wholesalePrice,
            retail_price: row.selling_price,
            margin: row.gross_margin,
            active: true,
          };

          if (row.code) {
            const { data: existingPricing } = await supabase
              .from('pricing_tiers')
              .select('id')
              .eq('product_code', row.code)
              .maybeSingle();

            if (existingPricing) {
              await supabase.from('pricing_tiers').update(pricingRow).eq('id', existingPricing.id);
            } else {
              await supabase.from('pricing_tiers').insert(pricingRow);
            }
          } else {
            await supabase.from('pricing_tiers').insert(pricingRow);
          }
        }

        result.success++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          name: row.product_name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    logAudit({
      action: 'BULK_IMPORT' as AuditAction,
      module: 'Catalog Upload',
      record_id: 'catalog-csv',
      details: { total: result.total, success: result.success, failed: result.failed, filename: file?.name },
      trackChangelog: true,
      changelogTitle: `Bulk Catalog Import — ${result.success} Products`,
      changelogDescription: `Imported ${result.success} of ${result.total} products from CSV file "${file?.name || 'catalog'}"${result.failed > 0 ? ` (${result.failed} failed)` : ''}.`,
      changelogCategory: 'feature',
    });

    setImportResult(result);
    setImporting(false);

    if (result.failed === 0) {
      showToast(`Successfully imported ${result.success} products!`, 'success');
    } else {
      showToast(`Imported ${result.success}/${result.total} products. ${result.failed} failed.`, 'error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setPreviewMode(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalog_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catalog Upload</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV file to bulk-import products into the catalogue, pricing tiers, and more.
          </p>
        </div>
        <button
          onClick={downloadSample}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
        >
          <Download size={16} />
          Download Template
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          file ? 'border-green-400 bg-green-50/50' : 'border-border hover:border-primary/40 hover:bg-secondary/30'
        }`}
      >
        {!file ? (
          <div className="space-y-4">
            <Upload size={48} className="mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium text-foreground">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse. Supports the Snackoh catalogue format.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Browse Files
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-green-600" />
              <div className="text-left">
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB &bull; {parsedRows.length} products parsed
                </p>
              </div>
            </div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-red-600 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Parse Errors */}
      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={18} className="text-red-600" />
            <span className="font-medium text-red-800">Parse Errors</span>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {parseErrors.map((err, i) => (
              <li key={i}>&bull; {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Format Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">Expected CSV Format</span>
        </div>
        <p className="text-xs text-blue-700">
          Columns: {EXPECTED_HEADERS.join(' | ')}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          The system auto-detects column positions by header keywords. Prices can include &quot;KES&quot; prefix and &quot;%&quot; suffix for margins.
        </p>
      </div>

      {/* Import Options */}
      {parsedRows.length > 0 && !importResult && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-foreground">Import Options</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={writePricing}
              onChange={(e) => setWritePricing(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-foreground">Also write pricing tiers (cost, wholesale, retail)</span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              {previewMode ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importing ? `Importing... (${parsedRows.length} items)` : `Import ${parsedRows.length} Products`}
            </button>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className={`border rounded-lg p-4 ${importResult.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            {importResult.failed === 0 ? (
              <CheckCircle2 size={20} className="text-green-600" />
            ) : (
              <AlertTriangle size={20} className="text-amber-600" />
            )}
            <span className="font-medium text-foreground">
              Import Complete: {importResult.success}/{importResult.total} succeeded
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-2xl font-bold text-foreground">{importResult.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
              <p className="text-xs text-muted-foreground">Success</p>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-700 mb-1">Failed Rows:</p>
              <div className="max-h-40 overflow-auto text-xs space-y-1">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-red-600">Row {err.row}: {err.name} — {err.error}</p>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-3 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
          >
            Upload Another File
          </button>
        </div>
      )}

      {/* Preview Table */}
      {previewMode && parsedRows.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-secondary/50 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Preview ({parsedRows.length} products)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sell Price</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Margin</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Unit</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Allergens</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Availability</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">{row.product_name}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{row.code}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">{row.category}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">KES {row.selling_price}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">KES {row.cost_price}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-600">{row.gross_margin}%</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.stock_unit}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px] truncate">
                      {row.allergens.length > 0 ? row.allergens.join(', ') : 'None'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.availability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
