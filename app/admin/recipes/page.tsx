'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

// ── Interfaces ──

interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  sourcingNote?: string;
}

interface Recipe {
  id: string;
  name: string;
  code: string;
  category: string;
  productType: string;
  batchSize: number;
  expectedOutput: number;
  outputUnit: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  prepTime: number;
  bakeTime: number;
  bakeTemp: number;
  status: 'active' | 'inactive';
}

interface FilePreviewRow {
  name: string;
  quantity: string;
  unit: string;
  costPerUnit: string;
}

// ── Constants ──

const CATEGORIES = ['Bread', 'Pastry', 'Cake', 'Buns', 'Cookies', 'Other'];
const PRODUCT_TYPES = ['White Bread', 'Brown Bread', 'Sourdough', 'Croissant', 'Buns', 'Muffin', 'Cake', 'Cookies', 'Donut', 'Bagel', 'Other'];
const UNITS = ['g', 'kg', 'ml', 'L', 'tsp', 'tbsp', 'cups', 'pieces', 'dozen'];
const ROWS_PER_PAGE = 10;

// ── Page Component ──

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Search & Filter
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // File Upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreviewRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Generation
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [inventoryItems, setInventoryItems] = useState<{ name: string; unit: string; unitCost: number; quantity: number }[]>([]);

  // AI Recipe Detail View
  const [showRecipeWebView, setShowRecipeWebView] = useState(false);
  const [aiRecipeDetail, setAiRecipeDetail] = useState('');
  const [aiRecipeDetailLoading, setAiRecipeDetailLoading] = useState(false);
  const [aiRecipeDetailError, setAiRecipeDetailError] = useState('');

  // ── Form State ──

  const emptyForm: Recipe = {
    id: '',
    name: '',
    code: '',
    category: 'Bread',
    productType: 'White Bread',
    batchSize: 1,
    expectedOutput: 0,
    outputUnit: 'pieces',
    ingredients: [],
    instructions: '',
    prepTime: 0,
    bakeTime: 0,
    bakeTemp: 180,
    status: 'active',
  };

  const [formData, setFormData] = useState<Recipe>(emptyForm);

  // ── Data Fetching ──

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const mapped = await Promise.all(data.map(async (r: Record<string, unknown>) => {
        const { data: ings } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', r.id);
        return {
          id: r.id as string,
          name: (r.name || '') as string,
          code: (r.code || '') as string,
          category: (r.product_type || 'Bread') as string,
          productType: (r.product_type || '') as string,
          batchSize: (r.batch_size || 1) as number,
          expectedOutput: (r.expected_output || 0) as number,
          outputUnit: (r.output_unit || 'pieces') as string,
          ingredients: (ings || []).map((i: Record<string, unknown>) => ({
            id: i.id as string,
            name: (i.name || '') as string,
            quantity: (i.quantity || 0) as number,
            unit: (i.unit || 'g') as string,
            costPerUnit: (i.cost_per_unit || 0) as number,
            sourcingNote: (i.sourcing_note || '') as string,
          })),
          instructions: (r.instructions || '') as string,
          prepTime: (r.prep_time || 0) as number,
          bakeTime: (r.bake_time || 0) as number,
          bakeTemp: (r.bake_temp || 180) as number,
          status: (r.status || 'active') as Recipe['status'],
        };
      }));
      setRecipes(mapped);
    } else {
      setRecipes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  // ── Cost Calculations ──

  const calcBatchCost = (recipe: Recipe) => {
    return recipe.ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.costPerUnit), 0);
  };

  const calcCostPerUnit = (recipe: Recipe) => {
    if (recipe.expectedOutput === 0) return 0;
    return calcBatchCost(recipe) / recipe.expectedOutput;
  };

  // ── Filtering & Pagination ──

  const filtered = recipes.filter(r => {
    const matchCategory = filterCategory === 'All' || r.category === filterCategory;
    const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginatedRecipes = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory]);

  // ── Stats ──

  const totalRecipes = recipes.length;
  const activeRecipes = recipes.filter(r => r.status === 'active').length;
  const avgBatchCost = totalRecipes > 0 ? recipes.reduce((s, r) => s + calcBatchCost(r), 0) / totalRecipes : 0;
  const uniqueCategories = new Set(recipes.map(r => r.category)).size;

  // ── CRUD Operations ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      name: formData.name,
      code: formData.code,
      product_type: formData.productType,
      batch_size: formData.batchSize,
      expected_output: formData.expectedOutput,
      output_unit: formData.outputUnit,
      instructions: formData.instructions,
      prep_time: formData.prepTime,
      bake_time: formData.bakeTime,
      bake_temp: formData.bakeTemp,
      status: formData.status,
    };
    try {
      if (editId) {
        await supabase.from('recipes').update(row).eq('id', editId);
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', editId);
        if (formData.ingredients.length > 0) {
          await supabase.from('recipe_ingredients').insert(
            formData.ingredients.map(i => ({
              recipe_id: editId,
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
              cost_per_unit: i.costPerUnit,
              sourcing_note: i.sourcingNote || '',
            }))
          );
        }
        logAudit({
          action: 'UPDATE',
          module: 'Recipes',
          record_id: editId,
          details: { name: formData.name, code: formData.code, category: formData.category, status: formData.status },
        });
      } else {
        const { data: created } = await supabase.from('recipes').insert(row).select().single();
        if (created && formData.ingredients.length > 0) {
          await supabase.from('recipe_ingredients').insert(
            formData.ingredients.map(i => ({
              recipe_id: created.id,
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
              cost_per_unit: i.costPerUnit,
              sourcing_note: i.sourcingNote || '',
            }))
          );
        }
        if (created) {
          logAudit({
            action: 'CREATE',
            module: 'Recipes',
            record_id: created.id,
            details: { name: formData.name, code: formData.code, category: formData.category, status: formData.status },
          });
        }
      }
      await fetchRecipes();
    } catch (err) {
      console.error('Recipe save error:', err);
    }
    resetForm();
  };

  const resetForm = () => {
    setEditId(null);
    setFormData(emptyForm);
    setShowForm(false);
    setUploadedFile(null);
    setFilePreview([]);
  };

  const handleEdit = (recipe: Recipe) => {
    setFormData(recipe);
    setEditId(recipe.id);
    setUploadedFile(null);
    setFilePreview([]);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this recipe? Production runs using this recipe will not be affected.')) {
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
      await supabase.from('recipes').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Recipes',
        record_id: id,
        details: {},
      });
      setRecipes(recipes.filter(r => r.id !== id));
    }
  };

  const handleDuplicate = async (recipe: Recipe) => {
    const row = {
      name: recipe.name + ' (Copy)',
      code: recipe.code + '-COPY',
      product_type: recipe.productType,
      batch_size: recipe.batchSize,
      expected_output: recipe.expectedOutput,
      output_unit: recipe.outputUnit,
      instructions: recipe.instructions,
      prep_time: recipe.prepTime,
      bake_time: recipe.bakeTime,
      bake_temp: recipe.bakeTemp,
      status: recipe.status,
    };
    try {
      const { data: created } = await supabase.from('recipes').insert(row).select().single();
      if (created && recipe.ingredients.length > 0) {
        await supabase.from('recipe_ingredients').insert(
          recipe.ingredients.map(i => ({
            recipe_id: created.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            cost_per_unit: i.costPerUnit,
            sourcing_note: i.sourcingNote || '',
          }))
        );
      }
      if (created) {
        logAudit({
          action: 'CREATE',
          module: 'Recipes',
          record_id: created.id,
          details: { name: recipe.name + ' (Copy)', code: recipe.code + '-COPY', duplicatedFrom: recipe.id },
        });
      }
      await fetchRecipes();
    } catch (err) {
      console.error('Duplicate error:', err);
    }
  };

  const toggleStatus = async (recipe: Recipe) => {
    const newStatus = recipe.status === 'active' ? 'inactive' : 'active';
    await supabase.from('recipes').update({ status: newStatus }).eq('id', recipe.id);
    logAudit({
      action: 'UPDATE',
      module: 'Recipes',
      record_id: recipe.id,
      details: { name: recipe.name, status: newStatus },
    });
    setRecipes(recipes.map(r => r.id === recipe.id ? { ...r, status: newStatus } : r));
  };

  // ── Ingredient Management ──

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [
        ...formData.ingredients,
        { id: Date.now().toString(), name: '', quantity: 0, unit: 'g', costPerUnit: 0, sourcingNote: '' },
      ],
    });
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    const newIngs = [...formData.ingredients];
    newIngs[index] = { ...newIngs[index], [field]: value };
    setFormData({ ...formData, ingredients: newIngs });
  };

  const removeIngredient = (index: number) => {
    setFormData({ ...formData, ingredients: formData.ingredients.filter((_, i) => i !== index) });
  };

  // ── File Upload Handlers (UI Only) ──

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.pdf'))) {
      setUploadedFile(file);
      setFilePreview([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setFilePreview([]);
    }
  };

  const handleParseFile = () => {
    // UI-only: simulate parsed data preview
    if (uploadedFile) {
      setFilePreview([
        { name: 'Wheat Flour', quantity: '5000', unit: 'g', costPerUnit: '0.12' },
        { name: 'Sugar', quantity: '500', unit: 'g', costPerUnit: '0.15' },
        { name: 'Butter', quantity: '250', unit: 'g', costPerUnit: '0.80' },
        { name: 'Eggs', quantity: '6', unit: 'pieces', costPerUnit: '15.00' },
        { name: 'Yeast', quantity: '15', unit: 'g', costPerUnit: '2.50' },
      ]);
    }
  };

  const importParsedIngredients = () => {
    const newIngredients: RecipeIngredient[] = filePreview.map((row, idx) => ({
      id: `parsed-${Date.now()}-${idx}`,
      name: row.name,
      quantity: parseFloat(row.quantity) || 0,
      unit: row.unit,
      costPerUnit: parseFloat(row.costPerUnit) || 0,
      sourcingNote: '',
    }));
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, ...newIngredients],
    });
    setUploadedFile(null);
    setFilePreview([]);
  };

  // ── AI Recipe Generation ──

  const fetchInventoryItems = useCallback(async () => {
    const { data } = await supabase.from('inventory_items').select('name, unit, unit_cost, quantity').order('name');
    if (data) {
      setInventoryItems(data.map((r: Record<string, unknown>) => ({
        name: (r.name || '') as string,
        unit: (r.unit || '') as string,
        unitCost: (r.unit_cost || 0) as number,
        quantity: (r.quantity || 0) as number,
      })));
    }
  }, []);

  useEffect(() => { fetchInventoryItems(); }, [fetchInventoryItems]);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError('');

    try {
      const inventoryList = inventoryItems.map(i => `${i.name} (${i.unit}, KES ${i.unitCost}/unit, stock: ${i.quantity})`).join('\n');

      const prompt = `You are a professional bakery recipe formulator. Generate a complete bakery recipe for: "${aiPrompt}"

Available inventory items:
${inventoryList || 'No inventory items available.'}

IMPORTANT: Prefer ingredients from the inventory list above. If an ingredient is NOT in inventory, prefix its name with "[NOT IN STOCK] ".

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{
  "name": "Recipe Name",
  "code": "XX-001",
  "category": "Bread",
  "productType": "White Bread",
  "batchSize": 1,
  "expectedOutput": 10,
  "outputUnit": "pieces",
  "prepTime": 30,
  "bakeTime": 25,
  "bakeTemp": 180,
  "instructions": "Step 1...\\nStep 2...",
  "ingredients": [
    { "name": "Wheat Flour", "quantity": 1000, "unit": "g", "costPerUnit": 0.12, "sourcingNote": "" }
  ]
}

For category use one of: Bread, Pastry, Cake, Buns, Cookies, Other
For productType use one of: White Bread, Brown Bread, Sourdough, Croissant, Danish, Muffin, Scone, Cookie, Cake, Pie, Bun, Other
For units use: g, kg, ml, l, pieces, tbsp, tsp, cups
Use realistic quantities and costs in KES.`;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ prompt, maxOutputTokens: 2048, temperature: 0.7 }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.message || `API error: ${res.status}`);
      }

      const text = result.text || '';

      // Extract JSON from response (handle possible markdown code blocks)
      let jsonStr = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      const recipe = JSON.parse(jsonStr);

      // Map AI response to form data
      setFormData({
        ...emptyForm,
        name: recipe.name || aiPrompt,
        code: recipe.code || `AI-${Date.now().toString().slice(-4)}`,
        category: recipe.category || 'Bread',
        productType: recipe.productType || 'Other',
        batchSize: recipe.batchSize || 1,
        expectedOutput: recipe.expectedOutput || 10,
        outputUnit: recipe.outputUnit || 'pieces',
        prepTime: recipe.prepTime || 0,
        bakeTime: recipe.bakeTime || 0,
        bakeTemp: recipe.bakeTemp || 180,
        instructions: recipe.instructions || '',
        status: 'active' as const,
        ingredients: (recipe.ingredients || []).map((ing: Record<string, unknown>, idx: number) => {
          const name = (ing.name || '') as string;
          // Check if ingredient exists in inventory and match cost
          const invMatch = inventoryItems.find(i => i.name.toLowerCase() === name.replace('[NOT IN STOCK] ', '').toLowerCase());
          return {
            id: `ai-${Date.now()}-${idx}`,
            name: name,
            quantity: (ing.quantity || 0) as number,
            unit: (ing.unit || 'g') as string,
            costPerUnit: invMatch ? invMatch.unitCost : ((ing.costPerUnit || 0) as number),
            sourcingNote: invMatch ? 'In Stock' : (name.includes('[NOT IN STOCK]') ? 'Not in inventory' : ((ing.sourcingNote || '') as string)),
          };
        }),
      });

      setShowAiModal(false);
      setAiPrompt('');
      setShowForm(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate recipe. Please try again.');
    }

    setAiGenerating(false);
  };

  const downloadCsvTemplate = () => {
    const headers = ['name,quantity,unit,costPerUnit'];
    const sampleRows = [
      'Wheat Flour,1000,g,0.12',
      'Sugar,200,g,0.15',
      'Butter,250,g,0.80',
      'Eggs,6,pieces,15.00',
      'Yeast,10,g,2.50',
    ];
    const csvContent = [...headers, ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'recipe_ingredients_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ── AI Recipe Detail Generator (Web View) ──
  const generateRecipeDetail = async (recipe: Recipe) => {
    setAiRecipeDetailLoading(true);
    setAiRecipeDetailError('');
    setAiRecipeDetail('');
    setShowRecipeWebView(true);

    try {
      const ingredientList = recipe.ingredients.map(i => `- ${i.name}: ${i.quantity} ${i.unit}`).join('\n');

      const prompt = `You are a professional bakery chef. Generate a comprehensive, detailed recipe card for: "${recipe.name}"

Recipe details:
- Category: ${recipe.category}
- Product Type: ${recipe.productType}
- Batch Size: ${recipe.batchSize}
- Expected Output: ${recipe.expectedOutput} ${recipe.outputUnit}
- Prep Time: ${recipe.prepTime} minutes
- Bake Time: ${recipe.bakeTime} minutes
- Bake Temperature: ${recipe.bakeTemp}°C

Ingredients:
${ingredientList}

${recipe.instructions ? `Existing instructions: ${recipe.instructions}` : ''}

Please provide a COMPLETE, PROFESSIONAL recipe card in HTML format (no markdown, just raw HTML) with:

1. <h2> Recipe title
2. A brief description/introduction of the product
3. <h3> Ingredients section - formatted as a clean list with quantities
4. <h3> Equipment Needed - list of equipment/tools
5. <h3> Step-by-Step Preparation Method - numbered detailed steps including:
   - Dough/batter preparation
   - Mixing technique
   - Proofing/resting time if applicable
   - Shaping instructions
   - Baking instructions
   - Cooling instructions
6. <h3> Quality Tips - professional tips for best results
7. <h3> Storage Instructions - how to store the finished product
8. <h3> Common Mistakes to Avoid

Style the HTML with inline CSS for a clean, professional look. Use these colors:
- Headers: #1a1a2e
- Body text: #333
- Tips/notes: #ea580c (orange)
- Background for tips: #fff7ed
- Borders: #e5e7eb
Use font-family: system-ui, -apple-system, sans-serif.
Make it printer-friendly.`;

      const { data: { session: printSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${printSession?.access_token || ''}` },
        body: JSON.stringify({ prompt, maxOutputTokens: 4096, temperature: 0.7 }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.message || `API error: ${res.status}`);
      }

      let html = result.text || '';

      // Strip markdown code block wrappers if present
      html = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

      setAiRecipeDetail(html);
    } catch (err) {
      setAiRecipeDetailError(err instanceof Error ? err.message : 'Failed to generate recipe details. Please try again.');
    }

    setAiRecipeDetailLoading(false);
  };

  // ── Render ──

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Recipe & Product Management</h1>
        <p className="text-muted-foreground">Define recipes with full ingredient tracking, costs, production flow, and expected output per batch</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Recipes</p>
              <p className="text-2xl font-bold">{totalRecipes}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{activeRecipes}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Batch Cost</p>
              <p className="text-2xl font-bold">KES {avgBatchCost.toFixed(0)}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold">{uniqueCategories}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filter & Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAiModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:opacity-90 font-semibold flex items-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            AI Generate Recipe
          </button>
          <button
            onClick={() => { setEditId(null); setFormData(emptyForm); setUploadedFile(null); setFilePreview([]); setShowForm(true); }}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold flex items-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Recipe
          </button>
        </div>
      </div>

      {/* DataTable */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/70 border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Output</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Ingredients</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Batch Cost</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Cost/Unit</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      Loading recipes...
                    </div>
                  </td>
                </tr>
              ) : paginatedRecipes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    {searchTerm || filterCategory !== 'All'
                      ? 'No recipes match your search or filter criteria.'
                      : 'No recipes found. Create your first recipe to get started.'}
                  </td>
                </tr>
              ) : (
                paginatedRecipes.map((recipe, idx) => (
                  <tr
                    key={recipe.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer ${idx % 2 === 0 ? '' : 'bg-secondary/10'}`}
                    onClick={() => { setSelectedRecipe(recipe); setShowDetail(true); }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{recipe.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{recipe.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{recipe.category}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{recipe.productType}</td>
                    <td className="px-4 py-3 text-right font-medium">{recipe.expectedOutput} <span className="text-muted-foreground text-xs">{recipe.outputUnit}</span></td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-xs font-bold">{recipe.ingredients.length}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">KES {calcBatchCost(recipe).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-right font-medium text-primary">KES {calcCostPerUnit(recipe).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleStatus(recipe)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          recipe.status === 'active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {recipe.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setSelectedRecipe(recipe); setShowDetail(true); }}
                          className="p-1.5 rounded hover:bg-secondary transition-colors"
                          title="View Details"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button
                          onClick={() => handleEdit(recipe)}
                          className="p-1.5 rounded hover:bg-blue-50 transition-colors"
                          title="Edit Recipe"
                        >
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDuplicate(recipe)}
                          className="p-1.5 rounded hover:bg-purple-50 transition-colors"
                          title="Duplicate Recipe"
                        >
                          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id)}
                          className="p-1.5 rounded hover:bg-red-50 transition-colors"
                          title="Delete Recipe"
                        >
                          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{(currentPage - 1) * ROWS_PER_PAGE + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * ROWS_PER_PAGE, filtered.length)}</span> of{' '}
              <span className="font-medium">{filtered.length}</span> recipes
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  typeof p === 'string' ? (
                    <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-muted-foreground">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1 text-sm rounded border ${
                        currentPage === p
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-secondary'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-sm rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CREATE / EDIT RECIPE MODAL                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editId ? 'Edit Recipe' : 'Create New Recipe'}
        size="3xl"
      >
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto pr-2 space-y-6">

          {/* ── Section 1: Basic Information (Blue) ── */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center text-sm font-bold">1</div>
              <h3 className="font-bold text-blue-900 text-lg">Basic Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-blue-800">Recipe Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  required
                  placeholder="e.g. Classic White Loaf"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-blue-800">Recipe Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white font-mono"
                  required
                  placeholder="e.g. WB-001"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-blue-800">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-blue-800">Product Type</label>
                <select
                  value={formData.productType}
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                >
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-blue-800">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Production Output (Green) ── */}
          <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center text-sm font-bold">2</div>
              <h3 className="font-bold text-green-900 text-lg">Production Output</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-green-800">Batch Multiplier</label>
                <input
                  type="number"
                  min="1"
                  value={formData.batchSize}
                  onChange={(e) => setFormData({ ...formData, batchSize: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-green-800">Expected Output *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.expectedOutput}
                  onChange={(e) => setFormData({ ...formData, expectedOutput: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none bg-white"
                  required
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-green-800">Output Unit</label>
                <input
                  type="text"
                  value={formData.outputUnit}
                  onChange={(e) => setFormData({ ...formData, outputUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none bg-white"
                  placeholder="loaves, pieces, etc"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-green-800">Prep Time (min)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.prepTime}
                  onChange={(e) => setFormData({ ...formData, prepTime: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-green-800">Bake Time (min)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.bakeTime}
                  onChange={(e) => setFormData({ ...formData, bakeTime: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-green-800">Bake Temp (degC)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.bakeTemp}
                  onChange={(e) => setFormData({ ...formData, bakeTemp: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none bg-white"
                />
              </div>
            </div>
            {/* Production Flow Summary */}
            {formData.prepTime > 0 || formData.bakeTime > 0 ? (
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <p className="text-sm font-medium text-green-800">Production Flow Summary</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-green-700">
                  <span className="px-2 py-1 bg-white rounded">Prep: {formData.prepTime} min</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <span className="px-2 py-1 bg-white rounded">Bake: {formData.bakeTime} min @ {formData.bakeTemp}C</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <span className="px-2 py-1 bg-white rounded font-semibold">Output: {formData.expectedOutput} {formData.outputUnit}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <span className="px-2 py-1 bg-white rounded">Total: {formData.prepTime + formData.bakeTime} min</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* ── Section 3: Ingredients (Amber/Orange) ── */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                <h3 className="font-bold text-amber-900 text-lg">Ingredients & Costing</h3>
              </div>
              <button
                type="button"
                onClick={addIngredient}
                className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Ingredient
              </button>
            </div>

            {formData.ingredients.length === 0 ? (
              <div className="text-center py-8 text-amber-700/60">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                <p className="text-sm font-medium">No ingredients added yet</p>
                <p className="text-xs mt-1">Click &quot;Add Ingredient&quot; or upload a CSV/PDF below</p>
              </div>
            ) : (
              <>
                {/* Ingredients Table Header */}
                <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                  <div className="col-span-3 text-xs font-semibold text-amber-800 uppercase">Ingredient</div>
                  <div className="col-span-2 text-xs font-semibold text-amber-800 uppercase">Qty</div>
                  <div className="col-span-1 text-xs font-semibold text-amber-800 uppercase">Unit</div>
                  <div className="col-span-2 text-xs font-semibold text-amber-800 uppercase">Cost/Unit (KES)</div>
                  <div className="col-span-2 text-xs font-semibold text-amber-800 uppercase">Sourcing</div>
                  <div className="col-span-1 text-xs font-semibold text-amber-800 uppercase text-right">Subtotal</div>
                  <div className="col-span-1"></div>
                </div>

                {formData.ingredients.map((ing, idx) => (
                  <div key={ing.id} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="e.g. Wheat Flour"
                        value={ing.name}
                        onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                        className="w-full px-2 py-1.5 border border-amber-200 rounded text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={ing.quantity || ''}
                        onChange={(e) => updateIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-amber-200 rounded text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-1">
                      <select
                        value={ing.unit}
                        onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                        className="w-full px-1 py-1.5 border border-amber-200 rounded text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={ing.costPerUnit || ''}
                        onChange={(e) => updateIngredient(idx, 'costPerUnit', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-amber-200 rounded text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Supplier / note"
                        value={ing.sourcingNote || ''}
                        onChange={(e) => updateIngredient(idx, 'sourcingNote', e.target.value)}
                        className="w-full px-2 py-1.5 border border-amber-200 rounded text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none text-xs"
                      />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium text-amber-900">
                      {(ing.quantity * ing.costPerUnit).toFixed(1)}
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeIngredient(idx)}
                        className="p-1 rounded hover:bg-red-100 transition-colors"
                        title="Remove ingredient"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Cost Summary */}
                <div className="mt-4 p-4 bg-amber-100 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-amber-900">Total Batch Cost:</span>
                    <span className="text-lg font-bold text-amber-900">KES {calcBatchCost(formData).toFixed(2)}</span>
                  </div>
                  {formData.expectedOutput > 0 && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-semibold text-amber-900">Cost Per {formData.outputUnit || 'unit'}:</span>
                      <span className="text-lg font-bold text-primary">KES {calcCostPerUnit(formData).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-amber-700">Ingredients count: {formData.ingredients.length}</span>
                    <span className="text-xs text-amber-700">{formData.ingredients.filter(i => i.sourcingNote).length} with sourcing info</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Section 4: File Upload (Violet/Purple) ── */}
          <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-500 text-white flex items-center justify-center text-sm font-bold">4</div>
              <h3 className="font-bold text-violet-900 text-lg">Import Ingredients from File</h3>
              <span className="text-xs px-2 py-0.5 bg-violet-200 text-violet-700 rounded-full font-medium ml-2">Optional</span>
              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="ml-auto px-3 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600 font-medium flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Download CSV Template
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging
                  ? 'border-violet-500 bg-violet-100'
                  : 'border-violet-300 bg-white hover:border-violet-400'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <svg className="w-10 h-10 mx-auto mb-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              {uploadedFile ? (
                <div>
                  <p className="text-sm font-medium text-violet-800">
                    Selected: <span className="font-bold">{uploadedFile.name}</span>
                  </p>
                  <p className="text-xs text-violet-600 mt-1">
                    {(uploadedFile.size / 1024).toFixed(1)} KB - {uploadedFile.type || 'unknown type'}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleParseFile}
                      className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 text-sm font-medium"
                    >
                      Parse File
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUploadedFile(null); setFilePreview([]); }}
                      className="px-4 py-2 border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-100 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-violet-700 font-medium">Drag and drop a CSV or PDF file here</p>
                  <p className="text-xs text-violet-500 mt-1">Supported formats: .csv, .pdf</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 text-sm font-medium"
                  >
                    Browse Files
                  </button>
                </div>
              )}
            </div>

            {/* Preview Table */}
            {filePreview.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-violet-900">Extracted Data Preview ({filePreview.length} ingredients)</p>
                  <button
                    type="button"
                    onClick={importParsedIngredients}
                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Import All to Recipe
                  </button>
                </div>
                <div className="border border-violet-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-violet-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-violet-800">Ingredient</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-violet-800">Quantity</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-violet-800">Unit</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-violet-800">Cost/Unit (KES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.map((row, idx) => (
                        <tr key={idx} className={`border-t border-violet-100 ${idx % 2 === 0 ? '' : 'bg-violet-50/50'}`}>
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2 text-right">{row.quantity}</td>
                          <td className="px-3 py-2">{row.unit}</td>
                          <td className="px-3 py-2 text-right">{row.costPerUnit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 5: Instructions (Teal) ── */}
          <div className="rounded-xl border-2 border-teal-200 bg-teal-50/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center text-sm font-bold">5</div>
              <h3 className="font-bold text-teal-900 text-lg">Instructions</h3>
            </div>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-400 outline-none bg-white"
              rows={5}
              placeholder="Step-by-step preparation and baking instructions...&#10;&#10;1. Mix dry ingredients&#10;2. Add wet ingredients&#10;3. Knead dough for 10 minutes&#10;..."
            />
          </div>

          {/* ── Form Actions ── */}
          <div className="flex items-center gap-3 justify-end pt-4 border-t border-border sticky bottom-0 bg-card py-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {editId ? 'Update Recipe' : 'Create Recipe'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* RECIPE DETAIL MODAL                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showDetail && !!selectedRecipe}
        onClose={() => { setShowDetail(false); setSelectedRecipe(null); }}
        title={selectedRecipe?.name || 'Recipe Details'}
        size="3xl"
      >
        {selectedRecipe && (
          <div className="max-h-[80vh] overflow-y-auto pr-2 space-y-6">

            {/* Top Info Bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm bg-secondary px-3 py-1 rounded">{selectedRecipe.code}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                selectedRecipe.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedRecipe.status === 'active' ? 'Active' : 'Inactive'}
              </span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">{selectedRecipe.category}</span>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">{selectedRecipe.productType}</span>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-xs text-green-700 font-medium">Expected Output</p>
                <p className="text-xl font-bold text-green-900">{selectedRecipe.expectedOutput} <span className="text-sm font-normal">{selectedRecipe.outputUnit}</span></p>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700 font-medium">Prep + Bake Time</p>
                <p className="text-xl font-bold text-blue-900">{selectedRecipe.prepTime + selectedRecipe.bakeTime} <span className="text-sm font-normal">min</span></p>
                <p className="text-xs text-blue-600 mt-0.5">{selectedRecipe.prepTime}m prep + {selectedRecipe.bakeTime}m bake</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700 font-medium">Batch Cost</p>
                <p className="text-xl font-bold text-amber-900">KES {calcBatchCost(selectedRecipe).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-4 rounded-xl bg-violet-50 border border-violet-200">
                <p className="text-xs text-violet-700 font-medium">Cost per {selectedRecipe.outputUnit}</p>
                <p className="text-xl font-bold text-violet-900">KES {calcCostPerUnit(selectedRecipe).toFixed(2)}</p>
              </div>
            </div>

            {/* Production Flow */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border">
              <p className="text-sm font-semibold mb-3">Production Flow</p>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg font-medium">
                  Prep: {selectedRecipe.prepTime} min
                </span>
                <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                <span className="px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg font-medium">
                  Bake: {selectedRecipe.bakeTime} min @ {selectedRecipe.bakeTemp}C
                </span>
                <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg font-medium">
                  Output: {selectedRecipe.expectedOutput} {selectedRecipe.outputUnit}
                </span>
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center justify-between">
                <span className="font-semibold text-amber-900">Ingredients ({selectedRecipe.ingredients.length})</span>
                <span className="text-xs text-amber-700">Per single batch (x{selectedRecipe.batchSize})</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-amber-50/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Ingredient</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Quantity</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Unit</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Cost/Unit (KES)</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Sourcing</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Subtotal (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecipe.ingredients.map((ing, idx) => (
                    <tr key={ing.id} className={`border-t border-border ${idx % 2 === 0 ? '' : 'bg-secondary/20'}`}>
                      <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-medium">{ing.name}</td>
                      <td className="px-4 py-2.5 text-right">{ing.quantity}</td>
                      <td className="px-4 py-2.5">{ing.unit}</td>
                      <td className="px-4 py-2.5 text-right">{ing.costPerUnit.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{ing.sourcingNote || '-'}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{(ing.quantity * ing.costPerUnit).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-amber-50 font-semibold border-t-2 border-amber-200">
                  <tr>
                    <td colSpan={6} className="px-4 py-2.5 text-right text-amber-900">Total Batch Cost:</td>
                    <td className="px-4 py-2.5 text-right text-amber-900">KES {calcBatchCost(selectedRecipe).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-4 py-2.5 text-right text-primary">Cost per {selectedRecipe.outputUnit}:</td>
                    <td className="px-4 py-2.5 text-right text-primary font-bold">KES {calcCostPerUnit(selectedRecipe).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Instructions */}
            {selectedRecipe.instructions && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-5">
                <p className="font-semibold mb-2 text-teal-900">Preparation Instructions</p>
                <p className="text-sm text-teal-800 whitespace-pre-line leading-relaxed">{selectedRecipe.instructions}</p>
              </div>
            )}

            {/* AI Full Recipe View Button */}
            <div className="rounded-xl border-2 border-dashed border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-purple-900">Full Recipe & Preparation Method</p>
                  <p className="text-xs text-purple-600 mt-0.5">Generate a comprehensive recipe card with detailed preparation steps, tips, and storage instructions using AI</p>
                </div>
                <button
                  onClick={() => generateRecipeDetail(selectedRecipe)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:opacity-90 font-semibold flex items-center gap-2 shadow-sm shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  View Full Recipe
                </button>
              </div>
            </div>

            {/* Detail Modal Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-border">
              <button
                onClick={() => { setShowDetail(false); handleEdit(selectedRecipe); }}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit
              </button>
              <button
                onClick={() => { setShowDetail(false); handleDuplicate(selectedRecipe); }}
                className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 font-medium text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Duplicate
              </button>
              <button
                onClick={() => { setShowDetail(false); handleDelete(selectedRecipe.id); }}
                className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete
              </button>
              <div className="flex-1" />
              <button
                onClick={() => { setShowDetail(false); setSelectedRecipe(null); }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AI RECIPE GENERATION MODAL                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showAiModal}
        onClose={() => { setShowAiModal(false); setAiPrompt(''); setAiError(''); }}
        title="AI Recipe Generator"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <h3 className="font-semibold text-purple-900">ChatGPT AI Recipe Formulation</h3>
            </div>
            <p className="text-sm text-purple-700">Describe what you want to bake and AI will generate a complete recipe with ingredients from your inventory.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">What would you like to bake?</label>
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Chocolate Croissant, Banana Bread, Cinnamon Rolls..."
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-purple-400 outline-none text-lg"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate(); }}
            />
          </div>

          {inventoryItems.length > 0 && (
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Available Inventory Items ({inventoryItems.length})</p>
              <div className="flex flex-wrap gap-1">
                {inventoryItems.slice(0, 20).map((item) => (
                  <span key={item.name} className="px-2 py-0.5 bg-white border border-border rounded text-xs">{item.name}</span>
                ))}
                {inventoryItems.length > 20 && <span className="px-2 py-0.5 text-xs text-muted-foreground">+{inventoryItems.length - 20} more</span>}
              </div>
            </div>
          )}

          {aiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{aiError}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button
              onClick={() => { setShowAiModal(false); setAiPrompt(''); setAiError(''); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:opacity-90 font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {aiGenerating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Generate Recipe
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AI RECIPE WEB VIEW MODAL                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showRecipeWebView}
        onClose={() => { setShowRecipeWebView(false); setAiRecipeDetail(''); setAiRecipeDetailError(''); }}
        title={selectedRecipe ? `${selectedRecipe.name} — Full Recipe` : 'Recipe Detail'}
        size="3xl"
      >
        <div className="max-h-[80vh] overflow-y-auto">
          {aiRecipeDetailLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-medium text-purple-800">Generating detailed recipe...</p>
              <p className="text-xs text-muted-foreground mt-1">AI is creating a comprehensive recipe card with full preparation method</p>
            </div>
          )}

          {aiRecipeDetailError && (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <p className="text-sm text-red-700 font-medium">{aiRecipeDetailError}</p>
              <button
                onClick={() => selectedRecipe && generateRecipeDetail(selectedRecipe)}
                className="mt-4 px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {aiRecipeDetail && !aiRecipeDetailLoading && (
            <div className="space-y-4">
              {/* Web View iframe-like container */}
              <div
                className="rounded-xl border border-border bg-white p-6 shadow-inner recipe-web-view"
                dangerouslySetInnerHTML={{ __html: aiRecipeDetail }}
              />

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    const win = window.open('', '_blank', 'width=800,height=900');
                    if (!win) return;
                    win.document.write(`<!DOCTYPE html><html><head><title>${selectedRecipe?.name || 'Recipe'} — Full Recipe</title><style>body{padding:40px;max-width:800px;margin:0 auto}@media print{body{padding:20px}}</style></head><body>`);
                    win.document.write(aiRecipeDetail);
                    win.document.write('</body></html>');
                    win.document.close();
                  }}
                  className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Open in New Window
                </button>
                <button
                  onClick={() => {
                    const win = window.open('', '_blank', 'width=800,height=900');
                    if (!win) return;
                    win.document.write(`<!DOCTYPE html><html><head><title>${selectedRecipe?.name || 'Recipe'}</title><style>body{padding:40px;max-width:800px;margin:0 auto}@media print{body{padding:20px}}</style></head><body>`);
                    win.document.write(aiRecipeDetail);
                    win.document.write('</body></html>');
                    win.document.close();
                    setTimeout(() => win.print(), 500);
                  }}
                  className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 font-medium text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print Recipe
                </button>
                <button
                  onClick={() => selectedRecipe && generateRecipeDetail(selectedRecipe)}
                  className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 font-medium text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Regenerate
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => { setShowRecipeWebView(false); setAiRecipeDetail(''); }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
