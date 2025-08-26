import React, { useEffect, useState } from 'react';
import { Plus, Minus, ShoppingCart, Clock, Calendar } from 'lucide-react';
import { createOrder, getMenuItems, getOrders, updateOrderStatus, subscribeToOrders, subscribeToMenuItems, supabase } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface OrderEntryProps {
  formatIDR: (amount: number) => string;
}

interface OrderItem {
  menu_item: any;
  quantity: number;
}

const OrderEntry: React.FC<OrderEntryProps> = ({ formatIDR }) => {
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [additional, setAdditional] = useState('');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState('');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [menuData, ordersData] = await Promise.all([
          getMenuItems(),
          getOrders()
        ]);
        console.log('Orders data:', ordersData);
        setMenuItems(menuData || []);
        setOrders(ordersData || []);
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
        setOrders(prev => [payload.new, ...prev]); // Add new orders at the beginning
      } else if (payload.eventType === 'DELETE') {
        setOrders(prev => prev.filter(order => order.id !== payload.old.id));
      } else if (payload.eventType === 'UPDATE') {
        setOrders(prev => prev.map(order => 
          order.id === payload.new.id ? payload.new : order
        ));
      }
      // Also fetch fresh data to ensure consistency
      const data = await getOrders();
      console.log('Fresh orders data:', data);
      setOrders(data || []);
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

  const addToOrder = (menuItem: any) => {
    setCurrentOrder((prev) => {
      const existingItem = prev.find(item => item.menu_item.id === menuItem.id);
      if (existingItem) {
        return prev.map(item =>
          item.menu_item.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { menu_item: menuItem, quantity: 1 }];
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

  const completeOrder = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'completed');
    } catch (error) {
      console.error('Failed to complete order:', error);
      alert('Failed to complete order. Please try again.');
    }
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

  const recentOrders = orders.slice(0, 10);

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Pesanan Terbaru</span>
        </h3>

        {recentOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Belum ada pesanan</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentOrders.map(order => (
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
                  {order.items.map((item: any) => (
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
                  <div className="flex justify-between items-center pt-2 text-sm">
                    <span className="font-semibold text-gray-900">
                      Total: {formatIDR(order.total)}
                    </span>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => completeOrder(order.id)}
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