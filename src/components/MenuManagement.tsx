import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, Search, TrendingUp, Package, Copy } from 'lucide-react';
import { getMenuItems, getMaterials, subscribeToMenuItems, subscribeToMaterials, supabase } from '../lib/supabase';
import type { Unit } from '../types';

interface MenuManagementProps {
  formatIDR: (amount: number) => string;
}

const MenuManagement: React.FC<MenuManagementProps> = ({ formatIDR }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [menuData, materialsData] = await Promise.all([
          getMenuItems(),
          getMaterials()
        ]);
        setMenuItems(menuData || []);
        setMaterials(materialsData || []);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to real-time updates
    const menuSubscription = subscribeToMenuItems(async (payload: { eventType: string; new: any; old: any }) => {
      // Handle immediate updates based on the change type
      if (payload.eventType === 'INSERT') {
        setMenuItems(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'DELETE') {
        setMenuItems(prev => prev.filter(item => item.id !== payload.old.id));
      } else if (payload.eventType === 'UPDATE') {
        setMenuItems(prev => prev.map(item => 
          item.id === payload.new.id ? payload.new : item
        ));
      }
      // Also fetch fresh data to ensure consistency
      const data = await getMenuItems();
      setMenuItems(data || []);
    });

    const materialsSubscription = subscribeToMaterials(async (payload: { eventType: string; new: any; old: any }) => {
      // Handle immediate updates based on the change type
      if (payload.eventType === 'INSERT') {
        setMaterials(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'DELETE') {
        setMaterials(prev => prev.filter(material => material.id !== payload.old.id));
      } else if (payload.eventType === 'UPDATE') {
        setMaterials(prev => prev.map(material => 
          material.id === payload.new.id ? payload.new : material
        ));
      }
      // Also fetch fresh data to ensure consistency
      const data = await getMaterials();
      setMaterials(data || []);
    });

    return () => {
      menuSubscription.unsubscribe();
      materialsSubscription.unsubscribe();
    };
  }, []);

  const categories = [...new Set(menuItems.map(item => item.category))];

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const perUnitCost = (material: any) => {
    if (!material.package_size || material.package_size <= 0) return 0;
    return material.purchase_price / material.package_size;
  };

  const MenuForm = ({ item, onSave, onCancel }: { 
    item?: any; 
    onSave: (item: any) => void; 
    onCancel: () => void; 
  }) => {
    const [formData, setFormData] = useState<any>({
      name: item?.name || '',
      category: item?.category || '',
      price: item?.price || 0,
      status: item?.status || 'active',
      ingredients: item?.ingredients || []
    });

    const [newIngredient, setNewIngredient] = useState<{
      name: string;
      cost: number;
      material_id?: string;
      quantity?: number;
      unit?: Unit;
    }>({ name: '', cost: 0 });

    const selectedMaterial = useMemo(() => materials.find(m => m.id === newIngredient.material_id), [materials, newIngredient.material_id]);
    const computedCost = useMemo(() => {
      if (selectedMaterial && newIngredient.quantity && newIngredient.quantity > 0) {
        return perUnitCost(selectedMaterial) * newIngredient.quantity;
      }
      return newIngredient.cost || 0;
    }, [selectedMaterial, newIngredient.quantity, newIngredient.cost]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const totalCost = formData.ingredients.reduce((sum: number, ing: any) => sum + ing.cost, 0);
        
        // Prepare menu item data without ingredients
        const menuItemData = {
          name: formData.name,
          category: formData.category,
          price: formData.price,
          status: formData.status,
          cost: totalCost
        };

        if (item) {
          // Update existing menu item
          const { error: menuError } = await supabase
            .from('menu_items')
            .update(menuItemData)
            .eq('id', item.id);
          
          if (menuError) throw menuError;

          // Delete existing ingredients
          const { error: deleteError } = await supabase
            .from('ingredients')
            .delete()
            .eq('menu_item_id', item.id);
          
          if (deleteError) throw deleteError;

          // Insert new ingredients
          if (formData.ingredients.length > 0) {
            const { error: ingredientsError } = await supabase
              .from('ingredients')
              .insert(formData.ingredients.map((ing: any) => ({
                menu_item_id: item.id,
                name: ing.name,
                material_id: ing.material_id || null,
                quantity: ing.quantity || null,
                unit: ing.unit || null,
                cost: ing.cost
              })));
            
            if (ingredientsError) throw ingredientsError;
          }
        } else {
          // Create new menu item
          const { data: newMenuItem, error: menuError } = await supabase
            .from('menu_items')
            .insert([menuItemData])
            .select()
            .single();
          
          if (menuError) throw menuError;
          if (!newMenuItem) throw new Error('Failed to create menu item');

          // Insert ingredients for new menu item
          if (formData.ingredients.length > 0) {
            const { error: ingredientsError } = await supabase
              .from('ingredients')
              .insert(formData.ingredients.map((ing: any) => ({
                menu_item_id: newMenuItem.id,
                name: ing.name,
                material_id: ing.material_id || null,
                quantity: ing.quantity || null,
                unit: ing.unit || null,
                cost: ing.cost
              })));
            
            if (ingredientsError) throw ingredientsError;
          }
        }

        onSave(formData);
      } catch (error: any) {
        console.error('Failed to save menu item:', error);
        alert(error.message || 'Failed to save menu item. Please try again.');
      }
    };

    const addIngredient = () => {
      // If using material, derive name, unit and cost
      if (selectedMaterial && newIngredient.quantity && newIngredient.quantity > 0) {
        const ingredient = {
          name: selectedMaterial.name,
          material_id: selectedMaterial.id,
          unit: selectedMaterial.unit,
          quantity: newIngredient.quantity,
          cost: Math.round(perUnitCost(selectedMaterial) * newIngredient.quantity),
        };
                  setFormData((prev: any) => ({
            ...prev,
            ingredients: [...(prev.ingredients || []), ingredient]
          }));
        setNewIngredient({ name: '', cost: 0, material_id: '', quantity: 0 });
        return;
      }

      // Manual entry fallback
      if (newIngredient.name && (newIngredient.cost || 0) > 0) {
        const ingredient = {
          name: newIngredient.name,
          cost: Number(newIngredient.cost),
        };
                  setFormData((prev: any) => ({
            ...prev,
            ingredients: [...(prev.ingredients || []), ingredient]
          }));
        setNewIngredient({ name: '', cost: 0, material_id: '', quantity: 0 });
      }
    };

    const removeIngredient = (index: number) => {
      setFormData((prev: any) => ({
        ...prev,
        ingredients: prev.ingredients.filter((_: any, i: number) => i !== index)
      }));
    };

    const ingredientsHpp = (formData.ingredients?.reduce((sum: number, ing: any) => sum + ing.cost, 0) || 0);
    const profitMargin = formData.price ? ((formData.price - ingredientsHpp) / formData.price * 100) : 0;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h3 className="text-xl font-semibold text-gray-900">
              {item ? 'Edit Menu Item' : 'Tambah Menu Baru'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Produk
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih Kategori</option>
                  <option value="Kopi Panas">Kopi Panas</option>
                  <option value="Kopi Dingin">Kopi Dingin</option>
                  <option value="Non-Kopi">Non-Kopi</option>
                  <option value="Makanan">Makanan</option>
                  <option value="Dessert">Dessert</option>
                </select>
              </div>
            </div>

            {/* Ingredients Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bahan & Biaya
              </label>
              <div className="border border-gray-300 rounded-lg p-4 space-y-3">
                {formData.ingredients?.map((ingredient: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="font-medium">
                      {ingredient.name}
                      {ingredient.quantity ? ` • ${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ''}` : ''}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span>{formatIDR(ingredient.cost)}</span>
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={newIngredient.material_id || ''}
                      onChange={(e) => {
                        const id = e.target.value;
                        const mat = materials.find(m => m.id === id);
                        setNewIngredient((prev: any) => ({
                          ...prev,
                          material_id: id || '',
                          name: mat ? mat.name : prev.name,
                          unit: mat ? mat.unit : prev.unit,
                        }));
                      }}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Pilih bahan (opsional)</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.package_size}{m.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder={newIngredient.unit ? `Qty (${newIngredient.unit})` : 'Qty'}
                      value={newIngredient.quantity || 0}
                      min={0}
                      onChange={(e) => setNewIngredient((prev: any) => ({ ...prev, quantity: Number(e.target.value) }))}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Biaya (otomatis)"
                      value={computedCost}
                      onChange={(e) => setNewIngredient((prev: any) => ({ ...prev, cost: Number(e.target.value) }))}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                      min={0}
                      disabled={!!newIngredient.material_id}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nama bahan (manual)"
                      value={newIngredient.name || ''}
                      onChange={(e) => setNewIngredient((prev: any) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={addIngredient}
                      className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                    >
                      <Plus className="h-4 w-4" /> Tambah Bahan
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Total HPP Display */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-700">Total HPP:</span>
                <span className="text-lg font-bold text-blue-800">
                  {formatIDR(ingredientsHpp)}
                </span>
              </div>
            </div>

            {/* Harga Jual Input */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Jual (IDR)
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, price: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
                min="0"
              />
            </div>

            {/* Kalkulasi Harga Jual */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Kalkulasi Harga Jual</h4>
              <div className="space-y-3">
                {[30, 50, 70].map(margin => {
                  const hpp = ingredientsHpp;
                  const recommendedPrice = hpp / (1 - margin/100);
                  return (
                    <div key={margin} className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-sm text-gray-600">Margin {margin}%</span>
                      <span className="font-medium text-gray-900">{formatIDR(Math.ceil(recommendedPrice/100)*100)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Profit Margin Display */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Profit Margin Saat Ini:</span>
                <span className={`font-semibold ${
                  profitMargin > 50 ? 'text-green-600' : 
                  profitMargin > 30 ? 'text-amber-600' : 
                  'text-red-600'
                }`}>
                  {profitMargin.toFixed(1)}%
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                {item ? 'Update' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handleSave = () => {
    if (editingItem) {
      setEditingItem(null);
    } else {
      setShowAddForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus item ini?')) {
      try {
        const { error } = await supabase
          .from('menu_items')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (error) {
        console.error('Failed to delete menu item:', error);
        alert('Failed to delete menu item. Please try again.');
      }
    }
  };

  const handleDuplicate = async (item: any) => {
    try {
      const { ingredients, id, ...itemData } = item;
      const newItem = {
        ...itemData,
        name: `${item.name} (Duplikat)`,
        ingredients: ingredients.map((ing: any) => ({ ...ing }))
      };
      await createMenuItem(newItem);
    } catch (error) {
      console.error('Failed to duplicate menu item:', error);
      alert('Failed to duplicate menu item. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Menu</h1>
          <p className="text-gray-600 mt-1">Kelola menu kedai kopi Anda</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Menu</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Cari menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">Semua Kategori</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
        {filteredItems.map(item => {
          const profitMargin = ((item.price - item.cost) / item.price * 100);
          
          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{item.name}</h3>
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                      {item.category}
                    </span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    item.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {item.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Harga Jual:</span>
                    <span className="font-semibold text-green-600">{formatIDR(item.price)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">HPP:</span>
                    <span className="font-semibold text-red-600">{formatIDR(item.cost)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Keuntungan:</span>
                    <span className="font-semibold text-gray-900">{formatIDR(item.price - item.cost)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Margin:</span>
                    <span className={`font-semibold flex items-center space-x-1 ${
                      profitMargin > 50 ? 'text-green-600' : profitMargin > 30 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      <TrendingUp className="h-3 w-3" />
                      <span>{profitMargin.toFixed(1)}%</span>
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDuplicate(item)}
                    className="flex-1 bg-amber-50 text-amber-700 px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Duplikat</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 bg-red-50 text-red-700 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada menu</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filterCategory ? 'Tidak ada menu yang sesuai dengan filter' : 'Mulai dengan menambahkan menu pertama Anda'}
          </p>
        </div>
      )}

      {/* Forms */}
      {showAddForm && (
        <MenuForm
          onSave={handleSave}
          onCancel={() => setShowAddForm(false)}
        />
      )}
      
      {editingItem && (
        <MenuForm
          item={editingItem}
          onSave={handleSave}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};

export default MenuManagement;