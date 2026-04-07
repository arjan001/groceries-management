'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

interface ProductionRun {
  id: string;
  recipeCode: string;
  recipeName: string;
  batchSize: number;
  startTime: string;
  endTime: string;
  yield: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'paused';
  notes: string;
  operator: string;
}

interface RecipeOption {
  id: string;
  name: string;
  code: string;
  batchSize: number;
  expectedOutput: number;
  outputUnit: string;
  category: string;
}

export default function ProductionPage() {
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);

  const fetchRuns = useCallback(async () => {
    const { data } = await supabase.from('production_runs').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) setRuns(data.map((r: Record<string, unknown>) => ({ id: r.id as string, recipeCode: (r.recipe_code || '') as string, recipeName: (r.recipe_name || r.recipe_code || '') as string, batchSize: (r.batch_size || 0) as number, startTime: (r.start_time || '') as string, endTime: (r.end_time || '') as string, yield: (r.yield_qty || 0) as number, status: (r.status || 'scheduled') as ProductionRun['status'], notes: (r.notes || '') as string, operator: (r.operator || '') as string })));
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      const { data } = await supabase.from('recipes').select('id, name, code, batch_size, expected_output, output_unit, category').eq('status', 'active').order('name');
      if (data && data.length > 0) {
        setRecipes(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.name || '') as string,
          code: (r.code || '') as string,
          batchSize: (r.batch_size || 0) as number,
          expectedOutput: (r.expected_output || 0) as number,
          outputUnit: (r.output_unit || 'pieces') as string,
          category: (r.category || '') as string,
        })));
      }
    } catch { /* recipes table may not exist */ }
  }, []);

  useEffect(() => { fetchRuns(); fetchRecipes(); }, [fetchRuns, fetchRecipes]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    recipeCode: '',
    recipeName: '',
    recipeId: '',
    batchSize: '',
    startTime: '',
    endTime: '',
    yield: '',
    status: 'scheduled' as const,
    notes: '',
    operator: '',
  });

  // Recipe search/autocomplete state
  const [recipeSearch, setRecipeSearch] = useState('');
  const [showRecipeDropdown, setShowRecipeDropdown] = useState(false);
  const recipeInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter recipes based on search input
  const filteredRecipes = recipes.filter(r => {
    const search = recipeSearch.toLowerCase();
    return r.name.toLowerCase().includes(search) ||
           r.code.toLowerCase().includes(search) ||
           r.category.toLowerCase().includes(search);
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          recipeInputRef.current && !recipeInputRef.current.contains(event.target as Node)) {
        setShowRecipeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectRecipe = (recipe: RecipeOption) => {
    setFormData(prev => ({
      ...prev,
      recipeCode: recipe.code || recipe.name,
      recipeName: recipe.name,
      recipeId: recipe.id,
      batchSize: recipe.batchSize > 0 ? recipe.batchSize.toString() : prev.batchSize,
      yield: recipe.expectedOutput > 0 ? recipe.expectedOutput.toString() : prev.yield,
    }));
    setRecipeSearch(recipe.name + (recipe.code ? ` (${recipe.code})` : ''));
    setShowRecipeDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      recipe_code: formData.recipeCode,
      recipe_name: formData.recipeName || formData.recipeCode,
      recipe_id: formData.recipeId || null,
      batch_size: parseFloat(formData.batchSize) || 0,
      start_time: formData.startTime || null,
      end_time: formData.endTime || null,
      yield_qty: parseFloat(formData.yield) || 0,
      status: formData.status,
      notes: formData.notes,
      operator: formData.operator,
    };
    try {
      if (editId) {
        const oldRun = runs.find(r => r.id === editId);
        await supabase.from('production_runs').update(row).eq('id', editId);
        logAudit({
          action: 'UPDATE',
          module: 'Production',
          record_id: editId,
          details: { recipe: formData.recipeCode, recipeName: formData.recipeName, operator: formData.operator, status: formData.status, previousStatus: oldRun?.status },
        });
      } else {
        const { data: inserted } = await supabase.from('production_runs').insert(row).select('id').single();
        logAudit({
          action: 'CREATE',
          module: 'Production',
          record_id: inserted?.id ?? '',
          details: { recipe: formData.recipeCode, recipeName: formData.recipeName, operator: formData.operator, status: formData.status },
        });
      }
      await fetchRuns();
    } catch { /* fallback */ }
    setEditId(null);
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setFormData({
      recipeCode: '',
      recipeName: '',
      recipeId: '',
      batchSize: '',
      startTime: '',
      endTime: '',
      yield: '',
      status: 'scheduled',
      notes: '',
      operator: '',
    });
    setRecipeSearch('');
  };

  const handleEdit = (run: ProductionRun) => {
    setEditId(run.id);
    setFormData({
      recipeCode: run.recipeCode,
      recipeName: run.recipeName || run.recipeCode,
      recipeId: '',
      batchSize: run.batchSize.toString(),
      startTime: run.startTime,
      endTime: run.endTime,
      yield: run.yield.toString(),
      status: run.status,
      notes: run.notes,
      operator: run.operator,
    });
    setRecipeSearch(run.recipeName || run.recipeCode);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this production run?')) {
      const deletedRun = runs.find(r => r.id === id);
      await supabase.from('production_runs').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Production',
        record_id: id,
        details: { recipe: deletedRun?.recipeCode, operator: deletedRun?.operator, status: deletedRun?.status },
      });
      setRuns(runs.filter(r => r.id !== id));
    }
  };

  const getStatusColor = (status: ProductionRun['status']) => {
    switch (status) {
      case 'scheduled': return 'bg-gray-100 text-gray-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
    }
  };

  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const totalYield = runs.reduce((sum, r) => sum + r.yield, 0);
  const avgYield = completedRuns > 0 ? (totalYield / completedRuns).toFixed(1) : '0';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="mb-2">Production Runs</h1>
        <p className="text-muted-foreground">Schedule, track, and record daily baking batches from start to finish</p>
      </div>

      {/* What is a Production Run? */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex gap-4">
        <span className="text-2xl mt-0.5">🏭</span>
        <div>
          <p className="font-semibold text-amber-900 mb-1">What is a Production Run?</p>
          <p className="text-sm text-amber-800 leading-relaxed">
            A <strong>Production Run</strong> (also called a <strong>batch</strong>) is a single baking session for a specific recipe.
            For example: <em>&quot;Batch of 200 White Bread Loaves — started 5:00 AM, finished 8:00 AM, yielded 195 loaves.&quot;</em>
          </p>
          <ul className="mt-2 text-sm text-amber-800 space-y-1 list-disc list-inside">
            <li><strong>Batch Size</strong> — how many units you planned to make (e.g. 200 loaves)</li>
            <li><strong>Yield</strong> — how many units actually came out good (e.g. 195 loaves)</li>
            <li><strong>Loss</strong> — the difference (e.g. 5 loaves wasted/burned)</li>
            <li><strong>Efficiency</strong> — yield ÷ batch size as a percentage (e.g. 97.5%)</li>
          </ul>
          <p className="mt-2 text-xs text-amber-700">Track every run to monitor waste, efficiency, and production output over time.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Runs</p>
          <p className="text-2xl font-bold">{runs.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold">{completedRuns}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Yield</p>
          <p className="text-2xl font-bold">{totalYield}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Avg Yield</p>
          <p className="text-2xl font-bold">{avgYield}</p>
        </div>
      </div>

      <div className="mb-6 flex justify-end">
        <button
          onClick={() => {
            setEditId(null);
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
        >
          + New Production Run
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditId(null); }}
        title={editId ? 'Edit Production Run' : 'Create Production Run'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Recipe Search / Autocomplete */}
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Recipe</label>
              <p className="text-xs text-muted-foreground mb-2">Type to search recipes by name, code, or category. Select a recipe to auto-fill batch size and yield.</p>
              <div className="relative">
                <input
                  ref={recipeInputRef}
                  type="text"
                  value={recipeSearch}
                  onChange={(e) => {
                    setRecipeSearch(e.target.value);
                    setShowRecipeDropdown(true);
                    // If user clears or changes text, reset selection
                    if (!e.target.value) {
                      setFormData(prev => ({ ...prev, recipeCode: '', recipeName: '', recipeId: '' }));
                    }
                  }}
                  onFocus={() => setShowRecipeDropdown(true)}
                  placeholder="Search recipes by name or code..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  required
                />
                {formData.recipeCode && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{formData.recipeCode}</span>
                    <button type="button" onClick={() => { setFormData(prev => ({ ...prev, recipeCode: '', recipeName: '', recipeId: '' })); setRecipeSearch(''); }} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                  </div>
                )}
                {/* Dropdown */}
                {showRecipeDropdown && (
                  <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredRecipes.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        {recipes.length === 0 ? (
                          <div>
                            <p className="font-medium">No recipes found in database</p>
                            <p className="text-xs mt-1">Add recipes in the Recipes module first, or type a recipe code manually below.</p>
                          </div>
                        ) : (
                          <p>No recipes match &quot;{recipeSearch}&quot;</p>
                        )}
                      </div>
                    ) : (
                      filteredRecipes.map(recipe => (
                        <button
                          key={recipe.id}
                          type="button"
                          onClick={() => selectRecipe(recipe)}
                          className="w-full text-left px-3 py-2.5 hover:bg-secondary/70 transition-colors border-b border-border last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium">{recipe.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {recipe.code && <span className="mr-2">Code: {recipe.code}</span>}
                              {recipe.category && <span className="mr-2">• {recipe.category}</span>}
                              {recipe.batchSize > 0 && <span>• Batch: {recipe.batchSize}</span>}
                            </p>
                          </div>
                          {recipe.expectedOutput > 0 && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                              Yield: {recipe.expectedOutput} {recipe.outputUnit}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                    {/* Allow manual entry */}
                    {recipeSearch && !formData.recipeCode && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, recipeCode: recipeSearch, recipeName: recipeSearch }));
                          setShowRecipeDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-secondary/70 transition-colors text-sm text-primary font-medium border-t border-border"
                      >
                        Use &quot;{recipeSearch}&quot; as custom recipe code
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Operator</label>
              <input
                type="text"
                value={formData.operator}
                onChange={(e) => setFormData({...formData, operator: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Batch Size</label>
              <input
                type="number"
                value={formData.batchSize}
                onChange={(e) => setFormData({...formData, batchSize: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expected Yield</label>
              <input
                type="number"
                value={formData.yield}
                onChange={(e) => setFormData({...formData, yield: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Time</label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as ProductionRun['status']})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              {editId ? 'Update' : 'Create'} Run
            </button>
          </div>
        </form>
      </Modal>

      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Recipe</th>
              <th className="px-4 py-3 text-left font-semibold">Operator</th>
              <th className="px-4 py-3 text-left font-semibold">Batch</th>
              <th className="px-4 py-3 text-left font-semibold">Yield</th>
              <th className="px-4 py-3 text-left font-semibold">Loss</th>
              <th className="px-4 py-3 text-left font-semibold">Efficiency</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No production runs found
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{run.recipeName || run.recipeCode}</p>
                      {run.recipeCode && run.recipeName && run.recipeCode !== run.recipeName && (
                        <p className="text-xs text-muted-foreground">{run.recipeCode}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{run.operator}</td>
                  <td className="px-4 py-3">{run.batchSize}</td>
                  <td className="px-4 py-3 font-medium">{run.yield}</td>
                  <td className="px-4 py-3 text-red-600">{run.batchSize - run.yield}</td>
                  <td className="px-4 py-3 font-semibold">{run.batchSize > 0 ? ((run.yield / run.batchSize) * 100).toFixed(1) : '0.0'}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(run.status)}`}>
                      {run.status === 'in-progress' ? 'In Progress' : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{run.startTime ? run.startTime.split('T')[0] : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(run)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(run.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
