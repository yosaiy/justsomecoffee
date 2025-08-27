import { useState, useEffect } from 'react';
import { Coffee, BarChart3, ShoppingCart, DollarSign, TrendingUp, Users, UtensilsCrossed, History, Webhook, LogOut, AlignJustify } from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MenuManagement from './components/MenuManagement';
import OrderEntry from './components/OrderEntry';
import HPPCalculator from './components/HPPCalculator';
import KitchenDisplay from './components/KitchenDisplay';
import OrderLogs from './components/OrderLogs';
import WebhookSettings from './components/WebhookSettings';
import { MenuItem, Order, Material } from './types';
import { getMenuItems, getMaterials, getOrders, subscribeToMenuItems, subscribeToOrders, subscribeToMaterials } from './lib/supabase';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => 
    localStorage.getItem('isAuthenticated') === 'true'
  );
  const [activeTab, setActiveTab] = useState('dashboard');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setMaterials] = useState<Material[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize data and real-time subscriptions
  useEffect(() => {
    const loadData = async () => {
      try {
        const [items, ords, mats] = await Promise.all([
          getMenuItems(),
          getOrders(),
          getMaterials()
        ]);
        setMenuItems(items || []);
        setOrders(ords || []);
        setMaterials(mats || []);
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
      // Handle immediate updates based on the change type
      if (payload.eventType === 'INSERT') {
        setOrders(prev => [payload.new, ...prev]);
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
      ordersSubscription.unsubscribe();
      materialsSubscription.unsubscribe();
    };
  }, []);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const tabs = [
          { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
      { id: 'menu', name: 'Menu', icon: Coffee },
      { id: 'orders', name: 'Pesanan', icon: ShoppingCart },
      { id: 'kds', name: 'Kitchen', icon: UtensilsCrossed },
      { id: 'hpp', name: 'HPP', icon: DollarSign },
      { id: 'logs', name: 'Riwayat', icon: History },
      { id: 'webhook', name: 'Webhook', icon: Webhook }
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={setIsAuthenticated} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-16 py-3 sm:py-0">
            <div className="flex items-center space-x-3 mb-3 sm:mb-0">
              <div className="bg-amber-600 p-2 rounded-lg">
                <Coffee className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Just Some Coffee</h1>
                <p className="text-sm text-gray-500">Sistem Manajemen Bisnis</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4" />
                <span className="whitespace-nowrap">Hari Ini: {formatIDR(orders.reduce((sum, order) => 
                  new Date(order.date).toDateString() === new Date().toDateString() ? sum + order.total : sum, 0
                ))}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span className="whitespace-nowrap">{orders.filter(order => 
                  new Date(order.date).toDateString() === new Date().toDateString()
                ).length} Pesanan</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile menu button */}
          <div className="sm:hidden py-2 flex justify-end">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-600 hover:text-amber-600 focus:outline-none"
            >
              <AlignJustify className="h-6 w-6" />
            </button>
          </div>

          {/* Mobile menu */}
          <div className={`sm:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
            <div className="flex flex-col space-y-1 pb-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop menu */}
          <div className="hidden sm:flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-amber-600 text-amber-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <Dashboard formatIDR={formatIDR} />
        )}
        {activeTab === 'menu' && (
          <MenuManagement formatIDR={formatIDR} />
        )}
        {activeTab === 'orders' && (
          <OrderEntry formatIDR={formatIDR} />
        )}
        {activeTab === 'kds' && (
          <KitchenDisplay formatIDR={formatIDR} />
        )}
        {activeTab === 'hpp' && (
          <HPPCalculator formatIDR={formatIDR} menuItems={menuItems} setMenuItems={setMenuItems} />
        )}
        {activeTab === 'logs' && (
          <OrderLogs formatIDR={formatIDR} />
        )}
        {activeTab === 'webhook' && (
          <WebhookSettings />
        )}
      </main>
    </div>
  );
}

export default App;
