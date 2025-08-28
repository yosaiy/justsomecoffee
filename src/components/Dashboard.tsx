import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, Users, Calendar, Coffee } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getOrders, supabase } from '../lib/supabase';

// Helper function to calculate percentage change
const calculatePercentageChange = (current: number, previous: number): { value: number; trend: 'up' | 'down' | 'neutral' } => {
  if (previous === 0) {
    return { value: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'neutral' };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  };
};

// Helper function to calculate profit from orders
const calculateProfit = (orders: any[]): number => {
  return orders.reduce((total, order) => {
    return total + order.items.reduce((orderTotal: number, item: any) => {
      const profit = (item.menu_item.price - item.menu_item.cost) * item.quantity;
      return orderTotal + profit;
    }, 0);
  }, 0);
};

interface DashboardProps {
  formatIDR: (amount: number) => string;
}

const Dashboard: React.FC<DashboardProps> = ({ formatIDR }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(new Date().setDate(new Date().getDate() - 30)), new Date()]);
  const [startDate, endDate] = dateRange;

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

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          // Reload orders when any change occurs
          const data = await getOrders();
          setOrders(data || []);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const dashboardData = useMemo(() => {
    if (!startDate || !endDate) return {
      revenueToday: 0,
      revenueWeek: 0,
      revenueMonth: 0,
      ordersToday: 0,
      ordersWeek: 0,
      ordersMonth: 0,
      itemsSoldToday: 0,
      itemsSoldYesterday: 0,
      popularItems: [],
      totalProfit: 0,
      averageOrder: 0,
      revenueTrend: { value: 0, trend: 'neutral' as const },
      ordersTrend: { value: 0, trend: 'neutral' as const },
      itemsSoldTrend: { value: 0, trend: 'neutral' as const },
      avgOrderTrend: { value: 0, trend: 'neutral' as const },
      profitTrend: { value: 0, trend: 'neutral' as const },
      graphData: [],
      rangeStats: {
        totalRevenue: 0,
        totalOrders: 0,
        totalProfit: 0,
        averageOrderValue: 0
      }
    };

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    // Filter orders within the selected date range
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= startDate && orderDate <= endDate;
    });

    // Group orders by date for the graph
    const ordersByDate = filteredOrders.reduce((acc: { [key: string]: any }, order) => {
      const date = new Date(order.date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          sales: 0,
          profit: 0,
          orders: 0
        };
      }
      acc[date].sales += order.total;
      acc[date].profit += calculateProfit([order]);
      acc[date].orders += 1;
      return acc;
    }, {});

    // Fill in missing dates in the range
    const allDates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!ordersByDate[dateStr]) {
        ordersByDate[dateStr] = {
          date: dateStr,
          sales: 0,
          profit: 0,
          orders: 0
        };
      }
      allDates.push(dateStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Convert to array and sort by date
    const graphData = Object.values(ordersByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const todayOrders = orders.filter(order => new Date(order.date) >= startOfDay);
    const yesterdayOrders = orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= startOfYesterday && orderDate < startOfDay;
    });

    // Calculate total items sold today and yesterday
    const itemsSoldToday = todayOrders.reduce((total, order) => {
      return total + order.items.reduce((orderTotal: number, item: any) => {
        return orderTotal + item.quantity;
      }, 0);
    }, 0);

    const itemsSoldYesterday = yesterdayOrders.reduce((total, order) => {
      return total + order.items.reduce((orderTotal: number, item: any) => {
        return orderTotal + item.quantity;
      }, 0);
    }, 0);
    const weekOrders = orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    });
    const monthOrders = orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= new Date(today.getFullYear(), today.getMonth(), 1);
    });

    const revenueToday = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const revenueYesterday = yesterdayOrders.reduce((sum, order) => sum + order.total, 0);
    const revenueWeek = weekOrders.reduce((sum, order) => sum + order.total, 0);
    const revenueMonth = monthOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate popular items
    const itemCounts: { [key: string]: number } = {};
    orders.forEach(order => {
      order.items.forEach((item: any) => {
        itemCounts[item.menu_item.name] = (itemCounts[item.menu_item.name] || 0) + item.quantity;
      });
    });

    const popularItems = Object.entries(itemCounts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalProfit = calculateProfit(orders);

    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = filteredOrders.length;
    const totalProfitInRange = calculateProfit(filteredOrders);

    return {
      revenueToday,
      revenueWeek,
      revenueMonth,
      ordersToday: todayOrders.length,
      ordersWeek: weekOrders.length,
      ordersMonth: monthOrders.length,
      itemsSoldToday,
      itemsSoldYesterday,
      popularItems,
      totalProfit,
      averageOrder: todayOrders.length > 0 ? revenueToday / todayOrders.length : 0,
      // Add trend calculations
      revenueTrend: calculatePercentageChange(revenueToday, revenueYesterday),
      ordersTrend: calculatePercentageChange(todayOrders.length, yesterdayOrders.length),
      itemsSoldTrend: calculatePercentageChange(itemsSoldToday, itemsSoldYesterday),
      avgOrderTrend: calculatePercentageChange(
        todayOrders.length > 0 ? revenueToday / todayOrders.length : 0,
        yesterdayOrders.length > 0 ? revenueYesterday / yesterdayOrders.length : 0
      ),
      profitTrend: calculatePercentageChange(
        calculateProfit(todayOrders),
        calculateProfit(yesterdayOrders)
      ),
      // Add graph data
      graphData,
      rangeStats: {
        totalRevenue,
        totalOrders,
        totalProfit: totalProfitInRange,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
      }
    };
  }, [orders, startDate, endDate]);

  interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<any>;
    trend?: { value: number; trend: 'up' | 'down' | 'neutral' };
    color?: string;
  }

  const StatCard = ({ title, value, icon: Icon, trend, color = 'amber' }: StatCardProps) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && trend.trend !== 'neutral' && (
            <div className={`flex items-center mt-2 text-sm ${
              trend.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`h-3 w-3 mr-1 ${trend.trend === 'down' ? 'rotate-180' : ''}`} />
              <span>{trend.value.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={`bg-${color}-100 p-3 rounded-lg`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
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
      {/* Header with Date Range */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h1>
          <p className="text-gray-600 mt-1">Ringkasan performa bisnis kedai kopi Anda</p>
        </div>
        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200">
          <Calendar className="h-5 w-5 text-gray-500" />
          <DatePicker
            selectsRange={true}
            startDate={startDate}
            endDate={endDate}
            onChange={(update: [Date | null, Date | null]) => setDateRange(update)}
            dateFormat="dd/MM/yyyy"
            className="text-sm border-0 focus:ring-0"
            placeholderText="Pilih rentang tanggal"
          />
        </div>
      </div>

      {/* Date Range Stats */}
      {dashboardData?.rangeStats && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Statistik {startDate?.toLocaleDateString('id-ID')} - {endDate?.toLocaleDateString('id-ID')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-600">Total Penjualan</p>
              <p className="text-2xl font-bold text-green-900">{formatIDR(dashboardData.rangeStats.totalRevenue)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-600">Total Pesanan</p>
              <p className="text-2xl font-bold text-blue-900">{dashboardData.rangeStats.totalOrders}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-600">Total Keuntungan</p>
              <p className="text-2xl font-bold text-amber-900">{formatIDR(dashboardData.rangeStats.totalProfit)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-600">Rata-rata Pesanan</p>
              <p className="text-2xl font-bold text-purple-900">{formatIDR(dashboardData.rangeStats.averageOrderValue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <StatCard
          title="Penjualan Hari Ini"
          value={formatIDR(dashboardData.revenueToday)}
          icon={DollarSign}
          trend={dashboardData.revenueTrend}
          color="green"
        />
        <StatCard
          title="Pesanan Hari Ini"
          value={dashboardData.ordersToday}
          icon={ShoppingCart}
          trend={dashboardData.ordersTrend}
          color="blue"
        />
        <StatCard
          title="Kopi Terjual Hari Ini"
          value={dashboardData.itemsSoldToday}
          icon={Coffee}
          trend={dashboardData.itemsSoldTrend}
          color="amber"
        />
        <StatCard
          title="Rata-rata Pesanan"
          value={formatIDR(dashboardData.averageOrder)}
          icon={Users}
          trend={dashboardData.avgOrderTrend}
          color="purple"
        />
        <StatCard
          title="Total Keuntungan"
          value={formatIDR(dashboardData.totalProfit)}
          icon={TrendingUp}
          trend={dashboardData.profitTrend}
          color="amber"
        />
      </div>

      {/* Graphs */}
      {dashboardData?.graphData && dashboardData.graphData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                      {/* Sales and Profit Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Penjualan & Keuntungan</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>
                    <span className="text-sm text-gray-600">Penjualan</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                    <span className="text-sm text-gray-600">Keuntungan</span>
                  </div>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={dashboardData.graphData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })}
                      stroke="#6b7280"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis 
                      yAxisId="left"
                      tickFormatter={(value) => formatIDR(value)}
                      stroke="#6b7280"
                      fontSize={12}
                      width={100}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => formatIDR(value)}
                      stroke="#6b7280"
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                      }}
                      formatter={(value: any) => formatIDR(value)}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      labelStyle={{ color: '#111827', fontWeight: 600 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sales"
                      stroke="#10b981"
                      name="Penjualan"
                      strokeWidth={2.5}
                      dot={{ stroke: '#059669', strokeWidth: 2, r: 4, fill: 'white' }}
                      activeDot={{ stroke: '#059669', strokeWidth: 2, r: 6, fill: '#059669' }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="profit"
                      stroke="#f59e0b"
                      name="Keuntungan"
                      strokeWidth={2.5}
                      dot={{ stroke: '#d97706', strokeWidth: 2, r: 4, fill: 'white' }}
                      activeDot={{ stroke: '#d97706', strokeWidth: 2, r: 6, fill: '#d97706' }}
                    />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

                      {/* Orders Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Jumlah Pesanan</h3>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-sm bg-blue-500 mr-2"></div>
                  <span className="text-sm text-gray-600">Pesanan per Hari</span>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={dashboardData.graphData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })}
                      stroke="#6b7280"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={12}
                      tickFormatter={(value) => Math.round(value).toString()}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                      }}
                      formatter={(value: any) => [`${value} pesanan`, 'Jumlah Pesanan']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      labelStyle={{ color: '#111827', fontWeight: 600 }}
                    />
                    <Bar 
                      dataKey="orders" 
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      name="Jumlah Pesanan"
                    >
                      {/* Add hover effect */}
                      <defs>
                        <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

        {/* Popular Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Produk Terpopuler</h3>
          <div className="space-y-3">
            {dashboardData.popularItems.map((item: { item: string; count: number }, index: number) => (
              <div key={item.item} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900">{item.item}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">{item.count}</span>
                  <p className="text-sm text-gray-500">terjual</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Pesanan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-900">{dashboardData.ordersMonth}</p>
              <p className="text-sm text-blue-700">Pesanan Bulan Ini</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-900">{dashboardData.ordersWeek}</p>
              <p className="text-sm text-purple-700">Pesanan Minggu Ini</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-900">{dashboardData.ordersToday}</p>
              <p className="text-sm text-green-700">Pesanan Hari Ini</p>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Dashboard;