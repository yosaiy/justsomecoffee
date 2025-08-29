import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Download, Filter } from 'lucide-react';
import { getOrders } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface ReportPageProps {
  formatIDR: (amount: number) => string;
}

interface ReportData {
  revenue: number;
  expenses: number;
  profit: number;
  totalOrders: number;
  averageOrderValue: number;
  paymentBreakdown: {
    cash: number;
    qris: number;
    transfer: number;
  };
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
    profit: number;
  }>;
  dailyData: Array<{
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
    orders: number;
  }>;
}

const ReportPage: React.FC<ReportPageProps> = ({ formatIDR }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date().setDate(1)), // First day of current month
    new Date()
  ]);
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
  }, []);

  const reportData = useMemo((): ReportData => {
    if (!startDate || !endDate) {
      return {
        revenue: 0,
        expenses: 0,
        profit: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        paymentBreakdown: { cash: 0, qris: 0, transfer: 0 },
        topProducts: [],
        dailyData: []
      };
    }

    // Filter orders within date range
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= startDate && orderDate <= endDate && order.status === 'completed';
    });

    // Calculate basic metrics
    const revenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const expenses = filteredOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum: number, item: any) => 
        itemSum + (item.menu_item.cost * item.quantity), 0), 0);
    const profit = revenue - expenses;

    // Payment method breakdown
    const paymentBreakdown = filteredOrders.reduce((acc, order) => {
      if (order.payment) {
        acc[order.payment as keyof typeof acc] += order.total;
      }
      return acc;
    }, { cash: 0, qris: 0, transfer: 0 });

    // Product performance analysis
    const productStats = new Map<string, { 
      quantity: number; 
      revenue: number; 
      profit: number;
      name: string;
    }>();

    filteredOrders.forEach(order => {
      order.items.forEach((item: any) => {
        const stats = productStats.get(item.menu_item.id) || {
          quantity: 0,
          revenue: 0,
          profit: 0,
          name: item.menu_item.name
        };
        stats.quantity += item.quantity;
        stats.revenue += item.price_at_time * item.quantity;
        stats.profit += (item.price_at_time - item.menu_item.cost) * item.quantity;
        productStats.set(item.menu_item.id, stats);
      });
    });

    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Daily data for charts
    const dailyData: ReportData['dailyData'] = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate.toDateString() === currentDate.toDateString();
      });

      const dayRevenue = dayOrders.reduce((sum, order) => sum + order.total, 0);
      const dayExpenses = dayOrders.reduce((sum, order) => 
        sum + order.items.reduce((itemSum: any, item: any) => 
          itemSum + (item.menu_item.cost * item.quantity), 0), 0);

      dailyData.push({
        date: currentDate.toISOString().split('T')[0],
        revenue: dayRevenue,
        expenses: dayExpenses,
        profit: dayRevenue - dayExpenses,
        orders: dayOrders.length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      revenue,
      expenses,
      profit,
      totalOrders: filteredOrders.length,
      averageOrderValue: filteredOrders.length > 0 ? revenue / filteredOrders.length : 0,
      paymentBreakdown,
      topProducts,
      dailyData
    };
  }, [orders, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const downloadReport = () => {
    // Create CSV content
    const csvContent = [
      ['Laporan Keuangan', `${startDate?.toLocaleDateString('id-ID')} - ${endDate?.toLocaleDateString('id-ID')}`],
      [],
      ['Metrik Utama'],
      ['Total Pendapatan', formatIDR(reportData.revenue)],
      ['Total Pengeluaran', formatIDR(reportData.expenses)],
      ['Total Keuntungan', formatIDR(reportData.profit)],
      ['Jumlah Pesanan', reportData.totalOrders],
      ['Rata-rata Nilai Pesanan', formatIDR(reportData.averageOrderValue)],
      [],
      ['Pembayaran'],
      ['Cash', formatIDR(reportData.paymentBreakdown.cash)],
      ['QRIS', formatIDR(reportData.paymentBreakdown.qris)],
      ['Transfer', formatIDR(reportData.paymentBreakdown.transfer)],
      [],
      ['Produk Terlaris'],
      ['Nama Produk', 'Quantity', 'Revenue', 'Profit'],
      ...reportData.topProducts.map(product => [
        product.name,
        product.quantity,
        formatIDR(product.revenue),
        formatIDR(product.profit)
      ]),
      [],
      ['Data Harian'],
      ['Tanggal', 'Revenue', 'Expenses', 'Profit', 'Orders'],
      ...reportData.dailyData.map(day => [
        day.date,
        formatIDR(day.revenue),
        formatIDR(day.expenses),
        formatIDR(day.profit),
        day.orders
      ])
    ].map(row => row.join(',')).join('\\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${startDate?.toISOString().split('T')[0]}_${endDate?.toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
          <p className="text-gray-600 mt-1">Analisis pendapatan dan pengeluaran</p>
        </div>
        <div className="flex items-center space-x-4">
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
          <button
            onClick={downloadReport}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pendapatan</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatIDR(reportData.revenue)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pengeluaran</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatIDR(reportData.expenses)}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Keuntungan</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatIDR(reportData.profit)}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods & Order Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pembayaran</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">💵</span>
                <span className="font-medium">Cash</span>
              </div>
              <span className="font-bold text-gray-900">{formatIDR(reportData.paymentBreakdown.cash)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📱</span>
                <span className="font-medium">QRIS</span>
              </div>
              <span className="font-bold text-gray-900">{formatIDR(reportData.paymentBreakdown.qris)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🏦</span>
                <span className="font-medium">Transfer</span>
              </div>
              <span className="font-bold text-gray-900">{formatIDR(reportData.paymentBreakdown.transfer)}</span>
            </div>
          </div>
        </div>

        {/* Order Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistik Pesanan</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-purple-600">Total Pesanan</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">{reportData.totalOrders}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-sm font-medium text-amber-600">Rata-rata Pesanan</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">{formatIDR(reportData.averageOrderValue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Produk Terlaris</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-600">Produk</th>
                <th className="pb-3 font-medium text-gray-600">Quantity</th>
                <th className="pb-3 font-medium text-gray-600">Revenue</th>
                <th className="pb-3 font-medium text-gray-600">Profit</th>
                <th className="pb-3 font-medium text-gray-600">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.topProducts.map((product, index) => (
                <tr key={index} className="text-sm">
                  <td className="py-3 font-medium">{product.name}</td>
                  <td className="py-3">{product.quantity}</td>
                  <td className="py-3">{formatIDR(product.revenue)}</td>
                  <td className="py-3">{formatIDR(product.profit)}</td>
                  <td className="py-3">
                    {((product.profit / product.revenue) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Harian</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-600">Tanggal</th>
                <th className="pb-3 font-medium text-gray-600">Revenue</th>
                <th className="pb-3 font-medium text-gray-600">Expenses</th>
                <th className="pb-3 font-medium text-gray-600">Profit</th>
                <th className="pb-3 font-medium text-gray-600">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.dailyData.map((day, index) => (
                <tr key={index} className="text-sm">
                  <td className="py-3 font-medium">
                    {new Date(day.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="py-3">{formatIDR(day.revenue)}</td>
                  <td className="py-3">{formatIDR(day.expenses)}</td>
                  <td className="py-3">{formatIDR(day.profit)}</td>
                  <td className="py-3">{day.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
