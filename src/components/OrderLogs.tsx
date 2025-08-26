import React, { useEffect, useState } from 'react';
import { Search, Calendar, User } from 'lucide-react';
import { getOrders, subscribeToOrders } from '../lib/supabase';

interface OrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  price_at_time: number;
  menu_item: {
    id: string;
    name: string;
    category: string;
    price: number;
    cost: number;
    status: string;
  };
}

interface Order {
  id: string;
  customer_name: string | null;
  phone: string | null;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  additional: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  kds_tickets: any[];
}

interface OrderLogsProps {
  formatIDR: (amount: number) => string;
}

const OrderLogs: React.FC<OrderLogsProps> = ({ formatIDR }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await getOrders();
        console.log('Loaded orders:', data);
        setOrders((data || []) as Order[]);
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();

    // Subscribe to real-time updates
    const ordersSubscription = subscribeToOrders(async (payload: { eventType: string; new: any; old: any }) => {
      console.log('Order subscription payload:', payload);
      // Handle immediate updates based on the change type
      if (payload.eventType === 'INSERT') {
        const newOrder = payload.new as Order;
        setOrders(prev => [newOrder, ...prev]);
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
      ordersSubscription.unsubscribe();
    };
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === '' || 
      (order.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (order.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesDate = selectedDate === '' || 
      new Date(order.date).toISOString().split('T')[0] === selectedDate;

    return matchesSearch && matchesDate;
  });

  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const customerName = order.customer_name || 'Anonymous';
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

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
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Pesanan</h1>
        <p className="text-gray-600 mt-1">Lihat riwayat pesanan berdasarkan pelanggan</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Cari nama atau nomor telepon pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Order History */}
      <div className="space-y-6">
        {Object.entries(groupedOrders).map(([customerName, customerOrders]) => (
          <div key={customerName} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center space-x-2">
              <User className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">{customerName}</h3>

              <span className="text-sm text-gray-500">({customerOrders.length} pesanan)</span>
              <span className="ml-auto text-amber-600 font-medium">
                Total Spending: {formatIDR(customerOrders.reduce((sum, order) => sum + order.total, 0))}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {customerOrders.map((order) => (
                <div key={order.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.date).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="font-medium text-gray-900">Total: {formatIDR(order.total)}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {item.quantity}x {item.menu_item.name}
                        </span>
                        <span className="font-medium">{formatIDR(item.price_at_time * item.quantity)}</span>
                      </div>
                    ))}
                    {order.additional && (
                      <div className="mt-2 text-amber-600 italic text-sm">
                        Catatan: {order.additional}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderLogs;
