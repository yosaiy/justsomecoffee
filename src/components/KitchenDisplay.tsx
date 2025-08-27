import React, { useEffect, useMemo, useState } from 'react';
import { Clock, CheckCircle, ArrowRight, UtensilsCrossed, Trash2 } from 'lucide-react';
import { getOrders, updateKdsTicketStatus, updateOrderStatus, subscribeToOrders, supabase } from '../lib/supabase';

interface KitchenDisplayProps {
  formatIDR: (amount: number) => string;
}

type TicketStatus = 'new' | 'preparing' | 'ready';

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ formatIDR }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await getOrders();
        setOrders(data || []);
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();

    // Subscribe to real-time updates for both orders and kds_tickets
    const ordersSubscription = subscribeToOrders(async (payload: { eventType: string; new: any; old: any }) => {
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
      setOrders(data || []);
    });

    const kdsSubscription = supabase
      .channel('kds-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kds_tickets' },
        async () => {
          // For KDS tickets, we need to refresh orders since they're linked
          const data = await getOrders();
          setOrders(data || []);
        }
      )
      .subscribe();

    return () => {
      ordersSubscription.unsubscribe();
      kdsSubscription.unsubscribe();
    };
  }, []);

  const grouped = useMemo(() => {
    const pendingOrders = orders.filter((o) => o.status === 'pending');
    const result: Record<TicketStatus, typeof orders> = { new: [], preparing: [], ready: [] };

    pendingOrders.forEach(order => {
      // Find the KDS ticket for this order
      const kdsTickets = order.kds_tickets || [];
      const kdsTicket = kdsTickets.length > 0 ? kdsTickets[kdsTickets.length - 1] : null;
      const status: TicketStatus = kdsTicket?.status === 'preparing' ? 'preparing' :
                                 kdsTicket?.status === 'ready' ? 'ready' : 'new';
      result[status].push(order);
    });

    // Sort by time (oldest first)
    Object.keys(result).forEach((k) => {
      result[k as TicketStatus].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });

    return result;
  }, [orders]);

  const setTicketStatus = async (orderId: string, status: TicketStatus) => {
    try {
      await updateKdsTicketStatus(orderId, status);
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      alert('Failed to update ticket status. Please try again.');
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
    if (!confirm('Batalkan pesanan ini di KDS?')) return;
    try {
      await updateOrderStatus(orderId, 'cancelled');
    } catch (error) {
      console.error('Failed to cancel order:', error);
      alert('Failed to cancel order. Please try again.');
    }
  };

  const Column = ({ title, orders, nextAction }: { title: string; orders: any[]; nextAction?: (orderId: string) => void }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 min-h-[200px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{orders.length}</span>
      </div>
      {orders.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-6">Tidak ada</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {orders.map((order) => (
            <div key={order.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{order.customer_name || 'Pelanggan'}</div>
                  <div className="text-xs text-gray-500 flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(order.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="text-right text-xs font-medium text-gray-900">{formatIDR(order.total)}</div>
              </div>
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.menu_item.name}</span>
                    <span>x{item.quantity}</span>
                  </div>
                ))}
                {order.additional && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="bg-amber-50 p-2 rounded-md border border-amber-100">
                      <span className="text-amber-700 font-medium">Catatan:</span>
                      <p className="text-gray-700 mt-1">{order.additional}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => cancelOrder(order.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center space-x-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Batal</span>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  {nextAction ? (
                    <button
                      onClick={() => nextAction(order.id)}
                      className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center space-x-1"
                    >
                      <ArrowRight className="h-3 w-3" />
                      <span>Lanjut</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => completeOrder(order.id)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1"
                    >
                      <CheckCircle className="h-3 w-3" />
                      <span>Selesai</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <UtensilsCrossed className="h-6 w-6 text-amber-600" />
            <span>Kitchen Display</span>
          </h1>
          <p className="text-gray-600 mt-1">Monitor pesanan masuk dan proses di dapur</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Column
          title="Baru"
          orders={grouped.new}
          nextAction={(orderId) => setTicketStatus(orderId, 'preparing')}
        />
        <Column
          title="Diproses"
          orders={grouped.preparing}
          nextAction={(orderId) => setTicketStatus(orderId, 'ready')}
        />
        <Column
          title="Siap Diambil"
          orders={grouped.ready}
        />
      </div>
    </div>
  );
};

export default KitchenDisplay;