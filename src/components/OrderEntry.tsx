import React, { useEffect, useState, useMemo } from 'react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  status: string;
  description?: string;
}

interface OrderItem {
  id: string;
  menu_item: MenuItem;
  quantity: number;
  price_at_time: number;
}

interface Order {
  id: string;
  customer_name: string | null;
  phone: string | null;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  payment?: 'qris' | 'cash' | 'transfer' | null;
  additional: string | null;
  date: string;
  items: OrderItem[];
}
import { Plus, Minus, ShoppingCart, Clock, Calendar } from 'lucide-react';
import { createOrder, getMenuItems, getOrders, updateOrderStatus, subscribeToOrders, subscribeToMenuItems, supabase } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface OrderEntryProps {
  formatIDR: (amount: number) => string;
}



const OrderEntry: React.FC<OrderEntryProps> = ({ formatIDR }) => {
  const [currentOrder, setCurrentOrder] = useState<Array<OrderItem>>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [additional, setAdditional] = useState('');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortStatus, setSortStatus] = useState<'completed' | 'pending' | null>(null);
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [menuData, ordersData] = await Promise.all([
          getMenuItems(),
          getOrders()
        ]);
        console.log('Orders data:', ordersData);
        setMenuItems(menuData || []);
        setOrders((ordersData || []) as Order[]);
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

    const ordersSubscription = subscribeToOrders(async (payload: { eventType: string; new: any; old: any }) => {
      console.log('Subscription payload:', payload);
      // Handle immediate updates based on the change type
      if (payload.eventType === 'INSERT') {
        setOrders(prev => [payload.new as Order, ...prev]); // Add new orders at the beginning
      } else if (payload.eventType === 'DELETE') {
        setOrders(prev => prev.filter(order => order.id !== payload.old.id));
      } else if (payload.eventType === 'UPDATE') {
        const updatedOrder = payload.new as Order;
        setOrders(prev => prev.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        ));
      }
      // Also fetch fresh data to ensure consistency
      const data = await getOrders();
      console.log('Fresh orders data:', data);
      setOrders((data || []) as Order[]);
    });

    return () => {
      menuSubscription.unsubscribe();
      ordersSubscription.unsubscribe();
    };
  }, []);

  const categories = [...new Set(menuItems.map(item => item.category))];
  const activeMenuItems = menuItems.filter(item => item.status === 'active');
  const filteredMenuItems = selectedCategory 
    ? activeMenuItems.filter(item => item.category === selectedCategory)
    : activeMenuItems;

  const addToOrder = (menuItem: MenuItem) => {
    setCurrentOrder((prev) => {
      const existingItem = prev.find(item => item.menu_item.id === menuItem.id);
      if (existingItem) {
        return prev.map(item =>
          item.menu_item.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        const newItem: OrderItem = {
          id: `temp_${Date.now()}`, // Temporary ID until saved
          menu_item: menuItem,
          quantity: 1,
          price_at_time: menuItem.price
        };
        return [...prev, newItem];
      }
    });
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCurrentOrder(prev => prev.filter(item => item.menu_item.id !== menuItemId));
    } else {
      setCurrentOrder(prev =>
        prev.map(item =>
          item.menu_item.id === menuItemId
            ? { ...item, quantity }
            : item
        )
      );
    }
  };

  const getTotalAmount = () => {
    return currentOrder.reduce((total, item) => total + (item.menu_item.price * item.quantity), 0);
  };

  const submitOrder = async () => {
    if (currentOrder.length === 0) {
      alert('Tambahkan item ke pesanan terlebih dahulu');
      return;
    }

    try {
      await createOrder({
        customer_name: customerName || undefined,
        phone: customerPhone || null,
        additional: additional || null,
        date: orderDate.toISOString(),
        items: currentOrder.map(item => ({
          menu_item_id: item.menu_item.id,
          quantity: item.quantity,
          price_at_time: item.menu_item.price
        }))
      });

      setCurrentOrder([]);
      setCustomerName('');
      setCustomerPhone('');
      setAdditional('');
      alert('Pesanan berhasil dibuat!');
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Please try again.');
    }
  };

  const completeOrder = async (orderId: string, paymentMethod: 'qris' | 'cash' | 'transfer') => {
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          payment: paymentMethod
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) throw updateError;
      setShowPaymentModal(false);
      setSelectedOrderId(null);
    } catch (error) {
      console.error('Failed to complete order:', error);
      alert('Failed to complete order. Please try again.');
    }
  };

  const handleCompleteClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowPaymentModal(true);
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    try {
      await updateOrderStatus(orderId, 'cancelled');
    } catch (error) {
      console.error('Failed to cancel order:', error);
      alert('Failed to cancel order. Please try again.');
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pesanan ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete order:', error);
      alert('Failed to delete order. Please try again.');
    }
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (sortStatus && order.status !== sortStatus) return false;
      
      // Date filter
      if (filterDate) {
        const orderDate = new Date(order.date);
        const filterDateStart = new Date(filterDate);
        filterDateStart.setHours(0, 0, 0, 0);
        const filterDateEnd = new Date(filterDate);
        filterDateEnd.setHours(23, 59, 59, 999);
        
        if (orderDate < filterDateStart || orderDate > filterDateEnd) return false;
      }
      
      // Search query filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesName = order.customer_name?.toLowerCase().includes(searchLower);
        const matchesPhone = order.phone?.toLowerCase().includes(searchLower);
        const matchesNote = order.additional?.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesPhone && !matchesNote) return false;
      }
      
      return true;
    });
  }, [orders, sortStatus, filterDate, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 transform transition-all">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Metode Pembayaran
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => completeOrder(selectedOrderId!, 'qris')}
                className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mb-2">📱</span>
                <span className="text-sm font-medium">QRIS</span>
              </button>
              <button
                onClick={() => completeOrder(selectedOrderId!, 'cash')}
                className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mb-2">💵</span>
                <span className="text-sm font-medium">Cash</span>
              </button>
              <button
                onClick={() => completeOrder(selectedOrderId!, 'transfer')}
                className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl mb-2">🏦</span>
                <span className="text-sm font-medium">Transfer</span>
              </button>
            </div>
            <button
              onClick={() => {
                setShowPaymentModal(false);
                setSelectedOrderId(null);
              }}
              className="w-full mt-4 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Entry Pesanan</h1>
        <p className="text-gray-600 mt-1">Pilih menu untuk membuat pesanan baru</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Selection - Left Side */}
        <div className="lg:col-span-2 space-y-6">

        {/* Category Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex space-x-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === ''
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semua Menu
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filteredMenuItems.map(item => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">{item.name}</h3>
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full mt-1">
                    {item.category}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{formatIDR(item.price)}</p>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-4">{item.description}</p>
              
              <button
                onClick={() => addToOrder(item)}
                className="w-full bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah ke Pesanan</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Current Order */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5" />
              <span>Pesanan Saat Ini</span>
            </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Pelanggan
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama pelanggan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor Telepon
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Masukkan nomor telepon"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tambahan/Catatan (Opsional)
              </label>
              <textarea
                value={additional}
                onChange={(e) => setAdditional(e.target.value)}
                placeholder="Contoh: No Sugar, Extra Sugar, dll"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {currentOrder.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Belum ada item dalam pesanan</p>
          ) : (
            <div className="space-y-3">
              {currentOrder.map(item => (
                <div key={item.menu_item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.menu_item.name}</h4>
                    <p className="text-sm text-gray-600">{formatIDR(item.menu_item.price)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.menu_item.id, item.quantity - 1)}
                      className="p-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.menu_item.id, item.quantity + 1)}
                      className="p-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentOrder.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="space-y-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-green-600">{formatIDR(getTotalAmount())}</span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Pesanan
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <DatePicker
                      selected={orderDate}
                      onChange={(date: Date | null) => date && setOrderDate(date)}
                      dateFormat="dd/MM/yyyy"
                      minDate={new Date()}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholderText="Pilih tanggal pesanan"
                    />
                  </div>
                  {orderDate && orderDate > new Date() && (
                    <p className="mt-1 text-sm text-amber-600">
                      ⚠️ Ini adalah pre-order untuk tanggal {orderDate.toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={submitOrder}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Buat Pesanan
              </button>
            </div>
          )}
        </div>

      </div>
      </div>

      {/* Recent Orders Section - Full Width */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2 mb-4 sm:mb-0">
            <Clock className="h-5 w-5" />
            <span>Semua Pesanan</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama pelanggan, telepon, atau catatan..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Date Filter */}
            <div className="relative">
              <DatePicker
                selected={filterDate}
                onChange={(date: Date | null) => setFilterDate(date)}
                dateFormat="dd/MM/yyyy"
                isClearable
                placeholderText="Filter by date"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSortStatus('completed')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  sortStatus === 'completed'
                    ? 'bg-green-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Selesai
              </button>
              <button
                onClick={() => setSortStatus('pending')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  sortStatus === 'pending'
                    ? 'bg-amber-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => {
                  setSortStatus(null);
                  setFilterDate(null);
                  setSearchQuery('');
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  !sortStatus && !filterDate && !searchQuery
                    ? 'bg-blue-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Reset All
              </button>
            </div>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Belum ada pesanan</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order: Order) => (
              <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {order.customer_name || 'Pelanggan'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.date).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {order.status === 'completed' ? 'Selesai' :
                     order.status === 'pending' ? 'Pending' : 'Dibatalkan'}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-3">
                  {order.items.map((item: OrderItem) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.menu_item.name} x{item.quantity}</span>
                      <span>{formatIDR(item.price_at_time * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-2">
                  {order.additional && (
                    <div className="text-amber-600 italic text-sm">
                      Catatan: {order.additional}
                    </div>
                  )}
                  {order.phone && (
                    <div className="text-gray-600 flex items-center text-sm">
                      <span className="mr-1">📞</span>
                      <span>{order.phone}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-900">
                        Total: {formatIDR(order.total)}
                      </span>
                    </div>
                    {order.status === 'completed' && order.payment && (
                      <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="mr-2">Payment:</span>
                        <span className="flex items-center font-medium">
                          {order.payment === 'qris' && '📱 '}
                          {order.payment === 'cash' && '💵 '}
                          {order.payment === 'transfer' && '🏦 '}
                          {order.payment.charAt(0).toUpperCase() + order.payment.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 pt-2">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleCompleteClick(order.id)}
                          className="flex-1 px-3 py-1.5 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200 transition-colors"
                        >
                          Selesai
                        </button>
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="flex-1 px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          Batal
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderEntry;