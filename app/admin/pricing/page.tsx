'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

interface PricingTier {
  id: string;
  productCode: string;
  productName: string;
  recipeId: string;
  recipeName: string;
  cost: number;
  basePrice: number;
  wholesale: number;
  retail: number;
  margin: number;
  active: boolean;
}

interface RecipeOption {
  id: string;
  name: string;
  code: string;
  category: string;
  batchCost: number;
}

export default function PricingPage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchTiers = useCallback(async () => {
    const { data } = await supabase.from('pricing_tiers').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setTiers(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        productCode: (r.product_code || '') as string,
        productName: (r.product_name || '') as string,
        recipeId: (r.recipe_id || '') as string,
        recipeName: (r.recipe_name || '') as string,
        cost: (r.cost || 0) as number,
        basePrice: (r.base_price || 0) as number,
        wholesale: (r.wholesale_price || 0) as number,
        retail: (r.retail_price || 0) as number,
        margin: (r.margin || 0) as number,
        active: (r.active !== false) as boolean,
      })));
    } else {
      setTiers([]);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    // Fetch recipes with correct column names (product_type, not category; no batch_cost column)
    const { data: recipeData } = await supabase
      .from('recipes')
      .select('id, name, code, product_type')
      .eq('status', 'active')
      .order('name');

    if (recipeData && recipeData.length > 0) {
      // Fetch all recipe ingredients to compute batch costs
      const recipeIds = recipeData.map((r: Record<string, unknown>) => r.id as string);
      const { data: ingredientData } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, quantity, cost_per_unit')
        .in('recipe_id', recipeIds);

      // Compute batch cost per recipe from ingredients
      const costMap: Record<string, number> = {};
      if (ingredientData) {
        for (const ing of ingredientData) {
          const rid = ing.recipe_id as string;
          const qty = (ing.quantity || 0) as number;
          const cpu = (ing.cost_per_unit || 0) as number;
          costMap[rid] = (costMap[rid] || 0) + qty * cpu;
        }
      }

      setRecipes(recipeData.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        code: (r.code || '') as string,
        category: (r.product_type || '') as string,
        batchCost: costMap[r.id as string] || 0,
      })));
    } else {
      setRecipes([]);
    }
  }, []);

  useEffect(() => { fetchTiers(); fetchRecipes(); }, [fetchTiers, fetchRecipes]);

  // Filtered tiers for display
  const filteredTiers = tiers.filter(t => {
    const matchesSearch = searchTerm === '' ||
      t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.recipeName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && t.active) ||
      (filterStatus === 'inactive' && !t.active);
    return matchesSearch && matchesStatus;
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    recipeId: '',
    productCode: '',
    productName: '',
    cost: '',
    basePrice: '',
    wholesaleDiscount: '25',
  });

  const handleRecipeSelect = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      setFormData(prev => ({
        ...prev,
        recipeId: recipe.id,
        productCode: prev.productCode || recipe.code,
        productName: prev.productName || recipe.name,
        cost: prev.cost || (recipe.batchCost > 0 ? recipe.batchCost.toFixed(2) : ''),
      }));
    } else {
      setFormData(prev => ({ ...prev, recipeId: '' }));
    }
  };

  const calculatePrices = (cost: number, basePrice: number, discount: number) => {
    const wholesale = basePrice * (1 - discount / 100);
    const margin = basePrice > 0 ? ((basePrice - cost) / basePrice) * 100 : 0;
    return { wholesale, margin };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(formData.cost) || 0;
    const basePrice = parseFloat(formData.basePrice) || 0;
    const discount = parseFloat(formData.wholesaleDiscount) || 0;
    const { wholesale, margin } = calculatePrices(cost, basePrice, discount);
    const selectedRecipe = recipes.find(r => r.id === formData.recipeId);
    const row: Record<string, unknown> = {
      product_code: formData.productCode,
      product_name: formData.productName,
      cost,
      base_price: basePrice,
      wholesale_price: wholesale,
      retail_price: basePrice,
      margin,
      active: true,
    };
    // Only include recipe columns if a recipe was selected
    if (formData.recipeId) {
      row.recipe_id = formData.recipeId;
      row.recipe_name = selectedRecipe?.name || null;
    } else if (!editId) {
      row.recipe_id = null;
      row.recipe_name = null;
    }
    try {
      if (editId) {
        // When editing, always update recipe fields
        row.recipe_id = formData.recipeId || null;
        row.recipe_name = selectedRecipe?.name || null;
        await supabase.from('pricing_tiers').update(row).eq('id', editId);
        logAudit({
          action: 'UPDATE',
          module: 'Pricing',
          record_id: editId,
          details: { productName: formData.productName, productCode: formData.productCode, cost, basePrice, wholesale, margin },
        });
      } else {
        await supabase.from('pricing_tiers').insert(row);
        logAudit({
          action: 'CREATE',
          module: 'Pricing',
          record_id: formData.productCode,
          details: { productName: formData.productName, productCode: formData.productCode, cost, basePrice, wholesale, margin },
        });
      }
      await fetchTiers();
    } catch (err) {
      console.error('Pricing save error:', err);
    }
    setEditId(null);
    setFormData({ recipeId: '', productCode: '', productName: '', cost: '', basePrice: '', wholesaleDiscount: '25' });
    setShowForm(false);
  };

  const handleEdit = (tier: PricingTier) => {
    setEditId(tier.id);
    const discountPct = tier.retail > 0 ? ((1 - tier.wholesale / tier.retail) * 100).toFixed(0) : '25';
    setFormData({
      recipeId: tier.recipeId || '',
      productCode: tier.productCode,
      productName: tier.productName,
      cost: tier.cost.toString(),
      basePrice: tier.basePrice.toString(),
      wholesaleDiscount: discountPct,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this pricing tier?')) {
      await supabase.from('pricing_tiers').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Pricing',
        record_id: id,
        details: {},
      });
      setTiers(tiers.filter(t => t.id !== id));
    }
  };

  const toggleActive = async (id: string) => {
    const tier = tiers.find(t => t.id === id);
    if (tier) {
      await supabase.from('pricing_tiers').update({ active: !tier.active }).eq('id', id);
      logAudit({
        action: 'UPDATE',
        module: 'Pricing',
        record_id: id,
        details: { productName: tier.productName, active: !tier.active },
      });
      setTiers(tiers.map(t => t.id === id ? {...t, active: !t.active} : t));
    }
  };

  const avgMargin = tiers.length > 0 ? (tiers.reduce((sum, t) => sum + t.margin, 0) / tiers.length).toFixed(1) : '0';
  const tiersWithRecipe = tiers.filter(t => t.recipeId).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2">Pricing Management</h1>
        <p className="text-muted-foreground">Set and manage product pricing linked to recipes</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold">{tiers.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Active Products</p>
          <p className="text-2xl font-bold">{tiers.filter(t => t.active).length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Avg Margin</p>
          <p className="text-2xl font-bold">{avgMargin}%</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Linked to Recipe</p>
          <p className="text-2xl font-bold">{tiersWithRecipe} / {tiers.length}</p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-1">
          <input
            type="text"
            placeholder="Search by product name, code, or recipe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-full sm:max-w-sm"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button
          onClick={() => {
            setEditId(null);
            setFormData({ recipeId: '', productCode: '', productName: '', cost: '', basePrice: '', wholesaleDiscount: '25' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium whitespace-nowrap"
        >
          + New Price Tier
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditId(null); }}
        title={editId ? 'Edit Pricing' : 'Create Pricing Tier'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipe Selection */}
          <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <label className="block text-sm font-semibold text-amber-800 mb-2">
              Link to Recipe {!editId && <span className="text-xs font-normal text-amber-600">(optional)</span>}
            </label>
            <p className="text-xs text-amber-600 mb-2">Select a recipe to auto-fill product details and cost from ingredients.</p>
            <select
              value={formData.recipeId}
              onChange={(e) => handleRecipeSelect(e.target.value)}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-white"
            >
              <option value="">-- Select a recipe (optional) --</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code}) — {r.category}{r.batchCost > 0 ? ` — Batch Cost: KES ${r.batchCost.toFixed(2)}` : ''}
                </option>
              ))}
            </select>
            {recipes.length === 0 && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                No active recipes found. You can still create a pricing tier manually, or create a recipe first in the Recipes &amp; Products module.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.productCode}
                onChange={(e) => setFormData({...formData, productCode: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
                placeholder="e.g. WB-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Product Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({...formData, productName: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
                placeholder="e.g. White Bread Loaf"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cost (COGS) <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({...formData, cost: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Retail Price <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                value={formData.basePrice}
                onChange={(e) => setFormData({...formData, basePrice: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
                placeholder="0.00"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Wholesale Discount %</label>
              <input
                type="number"
                step="1"
                value={formData.wholesaleDiscount}
                onChange={(e) => setFormData({...formData, wholesaleDiscount: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
          </div>

          {/* Live price preview */}
          {formData.cost && formData.basePrice && (
            <div className="p-3 bg-secondary rounded-lg text-sm">
              <p className="font-medium mb-1">Price Preview</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Wholesale: </span>
                  <span className="font-semibold">
                    KES {(parseFloat(formData.basePrice) * (1 - parseFloat(formData.wholesaleDiscount || '0') / 100)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Margin: </span>
                  <span className="font-semibold text-green-600">
                    {parseFloat(formData.basePrice) > 0
                      ? (((parseFloat(formData.basePrice) - parseFloat(formData.cost)) / parseFloat(formData.basePrice)) * 100).toFixed(1)
                      : '0'}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Profit: </span>
                  <span className="font-semibold">
                    KES {(parseFloat(formData.basePrice) - parseFloat(formData.cost)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

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
              {editId ? 'Update' : 'Create'} Pricing
            </button>
          </div>
        </form>
      </Modal>

      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Product</th>
              <th className="px-4 py-3 text-left font-semibold">Code</th>
              <th className="px-4 py-3 text-left font-semibold">Recipe</th>
              <th className="px-4 py-3 text-right font-semibold">Cost</th>
              <th className="px-4 py-3 text-right font-semibold">Retail</th>
              <th className="px-4 py-3 text-right font-semibold">Wholesale</th>
              <th className="px-4 py-3 text-center font-semibold">Margin</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTiers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {tiers.length === 0 ? 'No pricing tiers found. Click "+ New Price Tier" to create one.' : 'No results match your search.'}
                </td>
              </tr>
            ) : (
              filteredTiers.map((tier) => (
                <tr key={tier.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{tier.productName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{tier.productCode}</td>
                  <td className="px-4 py-3 text-sm">
                    {tier.recipeName ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">{tier.recipeName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No recipe linked</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">KES {tier.cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">KES {tier.retail.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">KES {tier.wholesale.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${tier.margin >= 30 ? 'text-green-600' : tier.margin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                      {tier.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(tier.id)}
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        tier.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tier.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(tier)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tier.id)}
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
      {filteredTiers.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground text-right px-4">
          Showing {filteredTiers.length} of {tiers.length} pricing tier{tiers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
