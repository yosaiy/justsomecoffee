import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Plus, Trash2, Package, Edit2, X } from 'lucide-react';
import { createMaterial, deleteMaterial, getMaterials, getMenuItems, subscribeToMaterials, subscribeToMenuItems, updateMaterial } from '../lib/supabase';
import type { Unit } from '../types';

interface HPPCalculatorProps {
  menuItems: any[];
  setMenuItems: (items: any[]) => void;
  formatIDR: (amount: number) => string;
}

const HPPCalculator: React.FC<HPPCalculatorProps> = ({ menuItems, setMenuItems, formatIDR }) => {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [laborCostPerHour, setLaborCostPerHour] = useState(25000);
  const [overheadPercentage, setOverheadPercentage] = useState(15);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [newMaterial, setNewMaterial] = useState<{
    name: string;
    unit: Unit;
    package_size: number;
    purchase_price: number;
  }>({ name: '', unit: 'ml', package_size: 0, purchase_price: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [materialsData, menuData] = await Promise.all([
          getMaterials(),
          getMenuItems()
        ]);
        setMaterials(materialsData || []);
        setMenuItems(menuData || []);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to real-time updates for materials
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

    // Subscribe to real-time updates for menu items
    const menuSubscription = subscribeToMenuItems(async (payload: { eventType: string; new: any; old: any }) => {
      // Handle immediate updates based on the change type
      if (payload.eventType === 'INSERT') {
        const data = await getMenuItems();
        setMenuItems(data || []);
      } else if (payload.eventType === 'DELETE') {
        const data = await getMenuItems();
        setMenuItems(data || []);
      } else if (payload.eventType === 'UPDATE') {
        const data = await getMenuItems();
        setMenuItems(data || []);
      }
    });

    return () => {
      materialsSubscription.unsubscribe();
      menuSubscription.unsubscribe();
    };
  }, []);

  const perUnitCost = (material: any) => {
    if (!material.package_size || material.package_size <= 0) return 0;
    return material.purchase_price / material.package_size;
  };

  const addMaterial = async () => {
    if (!newMaterial.name || newMaterial.package_size <= 0 || newMaterial.purchase_price <= 0) return;
    
    try {
      await createMaterial({
        name: newMaterial.name,
        unit: newMaterial.unit,
        package_size: newMaterial.package_size,
        purchase_price: newMaterial.purchase_price,
      });

      setNewMaterial({ name: '', unit: newMaterial.unit, package_size: 0, purchase_price: 0 });
    } catch (error) {
      console.error('Failed to create material:', error);
      alert('Failed to create material. Please try again.');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      await deleteMaterial(id);
    } catch (error) {
      console.error('Failed to delete material:', error);
      alert('Failed to delete material. Please try again.');
    }
  };

  const analytics = useMemo(() => {
    const totalRevenue = menuItems.reduce((sum, item) => sum + item.price, 0);
    const totalCost = menuItems.reduce((sum, item) => sum + item.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const averageMargin = menuItems.length > 0 ? 
      menuItems.reduce((sum, item) => sum + ((item.price - item.cost) / item.price * 100), 0) / menuItems.length : 0;

    const highMarginItems = menuItems.filter(item => ((item.price - item.cost) / item.price * 100) > 50);
    const lowMarginItems = menuItems.filter(item => ((item.price - item.cost) / item.price * 100) < 30);

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      averageMargin,
      highMarginItems,
      lowMarginItems
    };
  }, [menuItems]);

  const calculateDetailedHPP = (item: any) => {
    const ingredientsCost = item.ingredients.reduce((sum: number, ing: any) => sum + ing.cost, 0);
    const laborCost = laborCostPerHour * 0.1; // Assume 6 minutes preparation time
    const overheadCost = ingredientsCost * (overheadPercentage / 100);
    const totalHPP = ingredientsCost + laborCost + overheadCost;
    const profitMargin = ((item.price - totalHPP) / item.price * 100);
    const recommendedPrice = totalHPP * 1.5; // 50% margin target

    return {
      ingredientsCost,
      laborCost,
      overheadCost,
      totalHPP,
      profitMargin,
      recommendedPrice
    };
  };

  const handleEditMaterial = async () => {
    if (!selectedMaterial) return;
    
    try {
      await updateMaterial(selectedMaterial.id, {
        name: selectedMaterial.name,
        unit: selectedMaterial.unit,
        package_size: selectedMaterial.package_size,
        purchase_price: selectedMaterial.purchase_price,
      });
      setIsEditModalOpen(false);
      setSelectedMaterial(null);
    } catch (error) {
      console.error('Failed to update material:', error);
      alert('Failed to update material. Please try again.');
    }
  };

  const openEditModal = (material: any) => {
    setSelectedMaterial(material);
    setIsEditModalOpen(true);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analisis HPP (Harga Pokok Penjualan)</h1>
        <p className="text-gray-600 mt-1">Analisis mendalam biaya produksi dan margin keuntungan</p>
      </div>

      {/* Materials Catalog */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bahan Baku (Katalog)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2 max-h-56 overflow-y-auto">
            {materials.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm">Belum ada bahan baku. Tambahkan di samping.</p>
              </div>
            ) : (
              materials.map((m) => (
                <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                    <div className="font-medium text-gray-900">{m.name}</div>
                    <div className="text-xs text-gray-600">
                      {m.package_size} {m.unit} • {formatIDR(m.purchase_price)} • Biaya per {m.unit}: <span className="font-medium">{formatIDR(perUnitCost(m))}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => openEditModal(m)} className="text-blue-600 hover:text-blue-800">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteMaterial(m.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bahan</label>
                <input
                  type="text"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Susu evaporasi"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ukuran Kemasan</label>
                  <input
                    type="number"
                    min={0}
                    value={newMaterial.package_size}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, package_size: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <select
                    value={newMaterial.unit}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, unit: e.target.value as Unit }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="number"
                    min={0}
                    value={newMaterial.purchase_price}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, purchase_price: Number(e.target.value) }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="15000"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={addMaterial}
                className="w-full bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Bahan</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pengaturan Kalkulasi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Biaya Tenaga Kerja per Jam
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="number"
                value={laborCostPerHour}
                onChange={(e) => setLaborCostPerHour(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overhead Percentage (%)
            </label>
            <input
              type="number"
              value={overheadPercentage}
              onChange={(e) => setOverheadPercentage(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              min="0"
              max="100"
            />
          </div>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pendapatan</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatIDR(analytics.totalRevenue)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total HPP</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatIDR(analytics.totalCost)}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Keuntungan Kotor</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatIDR(analytics.totalProfit)}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rata-rata Margin</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{analytics.averageMargin.toFixed(1)}%</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analisis per Item</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {menuItems.map((item) => {
              const margin = ((item.price - item.cost) / item.price * 100);
              const detailed = calculateDetailedHPP(item);
              
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedItem?.id === item.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <span className="text-xs text-gray-500">{item.category}</span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      margin > 50 ? 'bg-green-100 text-green-800' :
                      margin > 30 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Harga: </span>
                      <span className="font-medium text-green-600">{formatIDR(item.price)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">HPP: </span>
                      <span className="font-medium text-red-600">{formatIDR(detailed.totalHPP)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Analisis Detail</span>
          </h3>
          
          {selectedItem ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 text-lg">{selectedItem.name}</h4>
              </div>

              {(() => {
                const detailed = calculateDetailedHPP(selectedItem);
                return (
                  <>
                    <div className="space-y-3">
                      <h5 className="font-medium text-gray-900">Breakdown Biaya:</h5>
                      
                      <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bahan Baku:</span>
                          <span className="font-medium">{formatIDR(detailed.ingredientsCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tenaga Kerja:</span>
                          <span className="font-medium">{formatIDR(detailed.laborCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Overhead ({overheadPercentage}%):</span>
                          <span className="font-medium">{formatIDR(detailed.overheadCost)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold text-gray-900">Total HPP:</span>
                          <span className="font-bold text-red-600">{formatIDR(detailed.totalHPP)}</span>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Harga Jual:</span>
                          <span className="font-bold text-blue-900">{formatIDR(selectedItem.price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Keuntungan:</span>
                          <span className="font-bold text-green-600">{formatIDR(selectedItem.price - detailed.totalHPP)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Margin:</span>
                          <span className={`font-bold ${
                            detailed.profitMargin > 50 ? 'text-green-600' :
                            detailed.profitMargin > 30 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {detailed.profitMargin.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-amber-700">Recommended Price (50% margin):</span>
                          <span className="font-bold text-amber-900">{formatIDR(detailed.recommendedPrice)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Ingredients:</h5>
                      <div className="space-y-1">
                        {selectedItem.ingredients.map((ingredient: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-600">{ingredient.name}</span>
                            <span className="font-medium">{formatIDR(ingredient.cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-12">
              <PieChart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Pilih Item Menu</h3>
              <p className="mt-1 text-sm text-gray-500">
                Klik pada item menu di sebelah kiri untuk melihat analisis detail
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Margin Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-green-700">
            {'Item dengan Margin Tinggi (>50%)'}
          </h3>
          {analytics.highMarginItems.length === 0 ? (
            <p className="text-gray-500">Tidak ada item dengan margin tinggi</p>
          ) : (
            <div className="space-y-2">
              {analytics.highMarginItems.map(item => {
                const margin = ((item.price - item.cost) / item.price * 100);
                return (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="font-bold text-green-600">{margin.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-red-700">
            Item dengan Margin Rendah ({'<30%'})
          </h3>
          {analytics.lowMarginItems.length === 0 ? (
            <p className="text-gray-500">Tidak ada item dengan margin rendah</p>
          ) : (
            <div className="space-y-2">
              {analytics.lowMarginItems.map(item => {
                const margin = ((item.price - item.cost) / item.price * 100);
                return (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="font-bold text-red-600">{margin.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Bahan Baku</h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedMaterial(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bahan</label>
                <input
                  type="text"
                  value={selectedMaterial.name}
                  onChange={(e) => setSelectedMaterial((prev: typeof selectedMaterial) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ukuran Kemasan</label>
                  <input
                    type="number"
                    min={0}
                    value={selectedMaterial.package_size}
                    onChange={(e) => setSelectedMaterial((prev: typeof selectedMaterial) => ({ ...prev, package_size: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <select
                    value={selectedMaterial.unit}
                    onChange={(e) => setSelectedMaterial((prev: typeof selectedMaterial) => ({ ...prev, unit: e.target.value as Unit }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="number"
                    min={0}
                    value={selectedMaterial.purchase_price}
                    onChange={(e) => setSelectedMaterial((prev: typeof selectedMaterial) => ({ ...prev, purchase_price: Number(e.target.value) }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={handleEditMaterial}
                className="w-full bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HPPCalculator;