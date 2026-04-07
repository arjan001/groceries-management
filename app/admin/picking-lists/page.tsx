'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

// ── Interfaces ──

interface PickingListItem {
  id: string;
  ingredient: string;
  quantity: number;
  unit: string;
  picked: boolean;
}

interface PickingList {
  id: string;
  recipeCode: string;
  recipeName: string;
  batchSize: number;
  createdDate: string;
  dueDate: string;
  completedDate: string;
  assignedTo: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'pending' | 'in-progress' | 'completed';
  items: PickingListItem[];
  notes: string;
}

interface Recipe {
  id: string;
  name: string;
  code: string;
  ingredients: { id: string; name: string; quantity: number; unit: string }[];
}

type TabKey = 'overview' | 'pending' | 'in-progress' | 'completed';

const UNITS = ['kg', 'g', 'L', 'ml', 'units', 'tsp', 'tbsp', 'cups', 'pieces', 'dozen'];
const PRIORITIES: PickingList['priority'][] = ['High', 'Medium', 'Low'];

// ── Main Component ──

export default function PickingListsPage() {
  const [pickingLists, setPickingLists] = useState<PickingList[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<PickingList | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const emptyForm = {
    recipeCode: '',
    recipeName: '',
    batchSize: '1',
    status: 'pending' as PickingList['status'],
    priority: 'Medium' as PickingList['priority'],
    assignedTo: '',
    dueDate: '',
    completedDate: '',
    notes: '',
    items: [] as PickingListItem[],
  };
  const [formData, setFormData] = useState(emptyForm);
  const [newItem, setNewItem] = useState({ ingredient: '', quantity: '', unit: 'kg' });
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  // ── Data Fetching ──

  const fetchLists = useCallback(async () => {
    const { data } = await supabase
      .from('picking_lists')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const mapped = await Promise.all(
        data.map(async (r: Record<string, unknown>) => {
          const { data: items } = await supabase
            .from('picking_list_items')
            .select('*')
            .eq('picking_list_id', r.id);
          return {
            id: r.id as string,
            recipeCode: (r.recipe_code || '') as string,
            recipeName: (r.recipe_name || '') as string,
            batchSize: (r.batch_size || 1) as number,
            createdDate: (r.created_date || r.created_at || '') as string,
            dueDate: (r.due_date || '') as string,
            completedDate: (r.completed_date || '') as string,
            assignedTo: (r.assigned_to || '') as string,
            priority: (r.priority || 'Medium') as PickingList['priority'],
            status: (r.status || 'pending') as PickingList['status'],
            notes: (r.notes || '') as string,
            items: (items || []).map((i: Record<string, unknown>) => ({
              id: i.id as string,
              ingredient: (i.ingredient || '') as string,
              quantity: (i.quantity || 0) as number,
              unit: (i.unit || 'kg') as string,
              picked: (i.picked || false) as boolean,
            })),
          };
        })
      );
      setPickingLists(mapped);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (data && data.length > 0) {
      const mapped = await Promise.all(
        data.map(async (r: Record<string, unknown>) => {
          const { data: ings } = await supabase
            .from('recipe_ingredients')
            .select('*')
            .eq('recipe_id', r.id);
          return {
            id: r.id as string,
            name: (r.name || '') as string,
            code: (r.code || '') as string,
            ingredients: (ings || []).map((i: Record<string, unknown>) => ({
              id: i.id as string,
              name: (i.name || '') as string,
              quantity: (i.quantity || 0) as number,
              unit: (i.unit || 'g') as string,
            })),
          };
        })
      );
      setRecipes(mapped);
    }
  }, []);

  useEffect(() => {
    fetchLists();
    fetchRecipes();
  }, [fetchLists, fetchRecipes]);

  // ── Stats ──

  const totalLists = pickingLists.length;
  const pendingCount = pickingLists.filter((pl) => pl.status === 'pending').length;
  const inProgressCount = pickingLists.filter((pl) => pl.status === 'in-progress').length;
  const completedCount = pickingLists.filter((pl) => pl.status === 'completed').length;

  // ── Filtering & Pagination ──

  const getFilteredLists = (statusFilter?: PickingList['status']) => {
    let filtered = pickingLists;
    if (statusFilter) {
      filtered = filtered.filter((pl) => pl.status === statusFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (pl) =>
          pl.recipeCode.toLowerCase().includes(term) ||
          pl.recipeName.toLowerCase().includes(term) ||
          pl.assignedTo.toLowerCase().includes(term)
      );
    }
    return filtered;
  };

  const getPagedLists = (statusFilter?: PickingList['status']) => {
    const filtered = getFilteredLists(statusFilter);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return {
      items: filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE),
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE),
    };
  };

  // ── Recipe Linking ──

  const handleRecipeSelect = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe) {
      const batchMultiplier = parseFloat(formData.batchSize) || 1;
      setFormData({
        ...formData,
        recipeCode: recipe.code,
        recipeName: recipe.name,
        items: recipe.ingredients.map((ing) => ({
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          ingredient: ing.name,
          quantity: ing.quantity * batchMultiplier,
          unit: ing.unit,
          picked: false,
        })),
      });
    }
  };

  const handleBatchSizeChange = (newBatchSize: string) => {
    const newSize = parseFloat(newBatchSize) || 1;
    const oldSize = parseFloat(formData.batchSize) || 1;
    const ratio = newSize / oldSize;

    setFormData({
      ...formData,
      batchSize: newBatchSize,
      items: formData.items.map((item) => ({
        ...item,
        quantity: parseFloat((item.quantity * ratio).toFixed(2)),
      })),
    });
  };

  // ── Item Management ──

  const handleAddItem = () => {
    if (newItem.ingredient && newItem.quantity) {
      setFormData({
        ...formData,
        items: [
          ...formData.items,
          {
            id: Date.now().toString() + Math.random().toString(36).substring(2),
            ingredient: newItem.ingredient,
            quantity: parseFloat(newItem.quantity),
            unit: newItem.unit,
            picked: false,
          },
        ],
      });
      setNewItem({ ingredient: '', quantity: '', unit: 'kg' });
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((item) => item.id !== itemId),
    });
  };

  // ── CRUD ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      recipe_code: formData.recipeCode,
      recipe_name: formData.recipeName,
      batch_size: parseFloat(formData.batchSize) || 1,
      status: formData.status,
      priority: formData.priority,
      assigned_to: formData.assignedTo,
      due_date: formData.dueDate || null,
      completed_date: formData.status === 'completed' ? formData.completedDate || new Date().toISOString().split('T')[0] : null,
      notes: formData.notes,
    };
    try {
      if (editId) {
        await supabase.from('picking_lists').update(row).eq('id', editId);
        await supabase.from('picking_list_items').delete().eq('picking_list_id', editId);
        if (formData.items.length > 0) {
          await supabase.from('picking_list_items').insert(
            formData.items.map((i) => ({
              picking_list_id: editId,
              ingredient: i.ingredient,
              quantity: i.quantity,
              unit: i.unit,
              picked: i.picked,
            }))
          );
        }
        logAudit({
          action: 'UPDATE',
          module: 'Picking Lists',
          record_id: editId,
          details: { ...row, items_count: formData.items.length },
        });
      } else {
        const { data: created } = await supabase.from('picking_lists').insert(row).select().single();
        if (created && formData.items.length > 0) {
          await supabase.from('picking_list_items').insert(
            formData.items.map((i) => ({
              picking_list_id: created.id,
              ingredient: i.ingredient,
              quantity: i.quantity,
              unit: i.unit,
              picked: i.picked,
            }))
          );
        }
        logAudit({
          action: 'CREATE',
          module: 'Picking Lists',
          record_id: created?.id || '',
          details: { ...row, items_count: formData.items.length },
        });
      }
      await fetchLists();
    } catch {
      /* fallback */
    }
    setEditId(null);
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setNewItem({ ingredient: '', quantity: '', unit: 'kg' });
    setSelectedRecipeId('');
  };

  const handleEdit = (pl: PickingList) => {
    setEditId(pl.id);
    setSelectedRecipeId('');
    setFormData({
      recipeCode: pl.recipeCode,
      recipeName: pl.recipeName,
      batchSize: pl.batchSize.toString(),
      status: pl.status,
      priority: pl.priority,
      assignedTo: pl.assignedTo,
      dueDate: pl.dueDate,
      completedDate: pl.completedDate,
      notes: pl.notes,
      items: pl.items,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this picking list?')) {
      await supabase.from('picking_list_items').delete().eq('picking_list_id', id);
      await supabase.from('picking_lists').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Picking Lists',
        record_id: id,
        details: { deleted_picking_list_id: id },
      });
      setPickingLists(pickingLists.filter((pl) => pl.id !== id));
    }
  };

  const handleToggleItemPicked = async (listId: string, itemId: string) => {
    const list = pickingLists.find((pl) => pl.id === listId);
    if (!list) return;

    const updatedItems = list.items.map((item) =>
      item.id === itemId ? { ...item, picked: !item.picked } : item
    );

    await supabase.from('picking_list_items').update({ picked: !list.items.find((i) => i.id === itemId)?.picked }).eq('id', itemId);

    const allPicked = updatedItems.every((item) => item.picked);
    if (allPicked && list.status === 'in-progress') {
      await supabase
        .from('picking_lists')
        .update({ status: 'completed', completed_date: new Date().toISOString().split('T')[0] })
        .eq('id', listId);
    }

    await fetchLists();

    if (selectedList && selectedList.id === listId) {
      setSelectedList({
        ...list,
        items: updatedItems,
        status: allPicked && list.status === 'in-progress' ? 'completed' : list.status,
        completedDate: allPicked && list.status === 'in-progress' ? new Date().toISOString().split('T')[0] : list.completedDate,
      });
    }
  };

  const handleStartPicking = async (pl: PickingList) => {
    await supabase.from('picking_lists').update({ status: 'in-progress' }).eq('id', pl.id);
    await fetchLists();
  };

  // ── Style Helpers ──

  const getStatusColor = (status: PickingList['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusLabel = (status: PickingList['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
    }
  };

  const getPriorityColor = (priority: PickingList['priority']) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getCompletionPercent = (items: PickingListItem[]) => {
    if (items.length === 0) return 0;
    return Math.round((items.filter((i) => i.picked).length / items.length) * 100);
  };

  // ── Tabs Configuration ──

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'pending', label: 'Pending Lists', count: pendingCount },
    { key: 'in-progress', label: 'In Progress', count: inProgressCount },
    { key: 'completed', label: 'Completed', count: completedCount },
  ];

  // Reset page when tab changes
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm('');
  };

  // ── Render: Picking List Table ──

  const renderTable = (statusFilter?: PickingList['status']) => {
    const { items: pagedItems, totalItems, totalPages } = getPagedLists(statusFilter);

    return (
      <div>
        {/* Search Bar */}
        <div className="mb-4 flex justify-between items-center">
          <input
            type="text"
            placeholder="Search by recipe, code, or assigned person..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-80"
          />
          <span className="text-sm text-muted-foreground">
            {totalItems} list{totalItems !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Recipe</th>
                <th className="px-4 py-3 text-left font-semibold">Batch</th>
                <th className="px-4 py-3 text-left font-semibold">Assigned To</th>
                <th className="px-4 py-3 text-center font-semibold">Priority</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                <th className="px-4 py-3 text-center font-semibold">Progress</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No picking lists found
                    {statusFilter ? ` with status "${getStatusLabel(statusFilter)}"` : ''}.
                  </td>
                </tr>
              ) : (
                pagedItems.map((pl) => {
                  const completion = getCompletionPercent(pl.items);
                  return (
                    <tr
                      key={pl.id}
                      className="border-b border-border hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{pl.recipeName || pl.recipeCode}</p>
                          <p className="text-xs text-muted-foreground">{pl.recipeCode}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">x{pl.batchSize}</td>
                      <td className="px-4 py-3">{pl.assignedTo || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(pl.priority)}`}
                        >
                          {pl.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(pl.status)}`}
                        >
                          {getStatusLabel(pl.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(pl.dueDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                completion === 100
                                  ? 'bg-green-500'
                                  : completion > 0
                                  ? 'bg-blue-500'
                                  : 'bg-gray-300'
                              }`}
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{completion}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedList(pl);
                              setShowDetail(true);
                            }}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors font-medium"
                          >
                            View
                          </button>
                          {pl.status === 'pending' && (
                            <button
                              onClick={() => handleStartPicking(pl)}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                            >
                              Start
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(pl)}
                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200 transition-colors font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(pl.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} lists
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'border border-border hover:bg-secondary'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Overview Tab ──

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border rounded-lg p-5 bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Lists</p>
          <p className="text-3xl font-bold">{totalLists}</p>
        </div>
        <div className="border border-border rounded-lg p-5 bg-card">
          <p className="text-sm text-muted-foreground mb-1">Pending</p>
          <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="border border-border rounded-lg p-5 bg-card">
          <p className="text-sm text-muted-foreground mb-1">In Progress</p>
          <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
        </div>
        <div className="border border-border rounded-lg p-5 bg-card">
          <p className="text-sm text-muted-foreground mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-600">{completedCount}</p>
        </div>
      </div>

      {/* Module Explanation */}
      <div className="border border-border rounded-lg bg-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-3">What are Picking Lists?</h2>
          <p className="text-muted-foreground mb-4">
            Picking lists are essential documents in bakery production that specify exactly which
            ingredients and quantities need to be gathered from inventory before a production batch
            can begin. They serve as the bridge between recipe planning and actual production,
            ensuring that every ingredient is measured, prepared, and ready before mixing starts.
          </p>

          <h3 className="font-semibold mb-2">How They Work in the Bakery Production Flow</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2 font-bold text-primary">1</div>
              <h4 className="font-semibold text-sm mb-1">Recipe Selection</h4>
              <p className="text-xs text-muted-foreground">
                Choose a recipe from your recipe library. All ingredients are automatically
                populated based on the recipe definition, scaled to your batch size.
              </p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2 font-bold text-primary">2</div>
              <h4 className="font-semibold text-sm mb-1">Assign &amp; Prioritize</h4>
              <p className="text-xs text-muted-foreground">
                Assign the picking list to a team member, set a priority level (High, Medium, Low),
                and specify a due date to ensure timely ingredient preparation.
              </p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2 font-bold text-primary">3</div>
              <h4 className="font-semibold text-sm mb-1">Pick Ingredients</h4>
              <p className="text-xs text-muted-foreground">
                The assigned person gathers each ingredient from inventory, checking off each item
                as it is collected. Progress is tracked in real time.
              </p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2 font-bold text-primary">4</div>
              <h4 className="font-semibold text-sm mb-1">Production Ready</h4>
              <p className="text-xs text-muted-foreground">
                Once all items are picked, the list is marked as completed. The production team can
                now proceed with mixing and baking, knowing everything is prepared.
              </p>
            </div>
          </div>

          <h3 className="font-semibold mb-2">Key Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                R
              </div>
              <div>
                <p className="font-medium text-sm">Recipe Linking</p>
                <p className="text-xs text-muted-foreground">
                  Select a recipe and all ingredients are auto-populated with correct quantities
                  scaled to your batch size.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-800 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                T
              </div>
              <div>
                <p className="font-medium text-sm">Real-Time Tracking</p>
                <p className="text-xs text-muted-foreground">
                  Each ingredient can be individually checked off, with a visual progress bar
                  showing overall completion.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                P
              </div>
              <div>
                <p className="font-medium text-sm">Priority Management</p>
                <p className="text-xs text-muted-foreground">
                  Color-coded priority badges (High, Medium, Low) help your team focus on the most
                  urgent production needs first.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                A
              </div>
              <div>
                <p className="font-medium text-sm">Team Assignment</p>
                <p className="text-xs text-muted-foreground">
                  Assign specific team members to each picking list for clear accountability and
                  workload distribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {pickingLists.length > 0 && (
        <div className="border border-border rounded-lg bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold">Recent Picking Lists</h2>
          </div>
          <div className="divide-y divide-border">
            {pickingLists.slice(0, 5).map((pl) => {
              const completion = getCompletionPercent(pl.items);
              return (
                <div
                  key={pl.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedList(pl);
                    setShowDetail(true);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{pl.recipeName || pl.recipeCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {pl.recipeCode} &middot; Batch x{pl.batchSize}
                        {pl.assignedTo ? ` &middot; ${pl.assignedTo}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(pl.priority)}`}
                    >
                      {pl.priority}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            completion === 100
                              ? 'bg-green-500'
                              : completion > 0
                              ? 'bg-blue-500'
                              : 'bg-gray-300'
                          }`}
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{completion}%</span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(pl.status)}`}
                    >
                      {getStatusLabel(pl.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── Main Render ──

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="mb-2">Picking Lists</h1>
          <p className="text-muted-foreground">
            Generate and manage ingredient picking lists for bakery production batches
          </p>
        </div>
        <button
          onClick={() => {
            setEditId(null);
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold"
        >
          + New Picking List
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'pending' && renderTable('pending')}
      {activeTab === 'in-progress' && renderTable('in-progress')}
      {activeTab === 'completed' && renderTable('completed')}

      {/* ── Create/Edit Modal (2xl) ── */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditId(null);
        }}
        title={editId ? 'Edit Picking List' : 'Create Picking List'}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
          {/* Recipe Selection */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <label className="block text-sm font-semibold mb-2">
              Link to Recipe (auto-populate ingredients)
            </label>
            <select
              value={selectedRecipeId}
              onChange={(e) => handleRecipeSelect(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
            >
              <option value="">-- Select a recipe (optional) --</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code}) - {r.ingredients.length} ingredients
                </option>
              ))}
            </select>
            {recipes.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No active recipes found. Create recipes first, or add ingredients manually below.
              </p>
            )}
          </div>

          {/* Core Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Recipe Code *</label>
              <input
                type="text"
                value={formData.recipeCode}
                onChange={(e) => setFormData({ ...formData, recipeCode: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
                placeholder="e.g. WB-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Recipe Name</label>
              <input
                type="text"
                value={formData.recipeName}
                onChange={(e) => setFormData({ ...formData, recipeName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="e.g. White Bread"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Batch Size *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.batchSize}
                onChange={(e) => handleBatchSizeChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as PickingList['priority'] })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as PickingList['status'] })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Assigned To</label>
              <input
                type="text"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="Person name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Completed Date</label>
              <input
                type="date"
                value={formData.completedDate}
                onChange={(e) => setFormData({ ...formData, completedDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                disabled={formData.status !== 'completed'}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              rows={2}
              placeholder="Any special instructions or notes for this picking list..."
            />
          </div>

          {/* Ingredients Section */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Ingredients / Items to Pick</h3>
              <span className="text-xs text-muted-foreground">
                {formData.items.length} item{formData.items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Add item row */}
            <div className="grid grid-cols-12 gap-2 mb-3">
              <div className="col-span-5">
                <input
                  type="text"
                  placeholder="Ingredient name"
                  value={newItem.ingredient}
                  onChange={(e) => setNewItem({ ...newItem, ingredient: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Quantity"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div className="col-span-2">
                <select
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Items List */}
            {formData.items.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {formData.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-card border border-border p-3 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                      <span className="font-medium">{item.ingredient}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {item.quantity} {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No ingredients added yet. Select a recipe above to auto-populate, or add items
                manually.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formData.items.length === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editId ? 'Update' : 'Create'} Picking List
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Detail View Modal (2xl) ── */}
      <Modal
        isOpen={showDetail && !!selectedList}
        onClose={() => {
          setShowDetail(false);
          setSelectedList(null);
        }}
        title="Picking List Details"
        size="2xl"
      >
        {selectedList && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
            {/* Header Info */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {selectedList.recipeName || selectedList.recipeCode}
                </h3>
                <p className="text-sm text-muted-foreground">{selectedList.recipeCode}</p>
              </div>
              <div className="flex gap-2">
                <span
                  className={`px-3 py-1 rounded text-xs font-semibold ${getPriorityColor(selectedList.priority)}`}
                >
                  {selectedList.priority} Priority
                </span>
                <span
                  className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(selectedList.status)}`}
                >
                  {getStatusLabel(selectedList.status)}
                </span>
              </div>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Batch Size</p>
                <p className="font-semibold">x{selectedList.batchSize}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="font-semibold">{selectedList.assignedTo || 'Unassigned'}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="font-semibold">{formatDate(selectedList.dueDate)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-semibold">{formatDate(selectedList.createdDate)}</p>
              </div>
            </div>

            {selectedList.completedDate && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-600">Completed on</p>
                <p className="font-semibold text-green-800">
                  {formatDate(selectedList.completedDate)}
                </p>
              </div>
            )}

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold">
                  Picking Progress
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedList.items.filter((i) => i.picked).length} of {selectedList.items.length}{' '}
                  items picked ({getCompletionPercent(selectedList.items)}%)
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    getCompletionPercent(selectedList.items) === 100
                      ? 'bg-green-500'
                      : getCompletionPercent(selectedList.items) > 0
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                  style={{ width: `${getCompletionPercent(selectedList.items)}%` }}
                />
              </div>
            </div>

            {/* Ingredients Checklist */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-secondary px-4 py-3 font-semibold text-sm flex justify-between items-center">
                <span>Ingredients to Pick</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Click items to toggle picked status
                </span>
              </div>
              <div className="divide-y divide-border">
                {selectedList.items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No ingredients in this picking list.
                  </div>
                ) : (
                  selectedList.items.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItemPicked(selectedList.id, item.id)}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                        item.picked
                          ? 'bg-green-50 hover:bg-green-100'
                          : 'hover:bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            item.picked
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {item.picked && (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                        <span
                          className={`font-medium ${
                            item.picked ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {item.ingredient}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm ${
                            item.picked ? 'text-muted-foreground line-through' : 'font-medium'
                          }`}
                        >
                          {item.quantity} {item.unit}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            item.picked
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.picked ? 'Picked' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            {selectedList.notes && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {selectedList.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {selectedList.status === 'pending' && (
                <button
                  onClick={async () => {
                    await handleStartPicking(selectedList);
                    setSelectedList({ ...selectedList, status: 'in-progress' });
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Start Picking
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetail(false);
                  setSelectedList(null);
                  handleEdit(selectedList);
                }}
                className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
              >
                Edit List
              </button>
              <button
                onClick={() => {
                  setShowDetail(false);
                  setSelectedList(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
