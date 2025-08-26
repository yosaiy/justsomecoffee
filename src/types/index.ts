export type Unit = 'ml' | 'g' | 'kg' | 'pcs';

export interface Material {
  id: string;
  name: string;
  unit: Unit;
  packageSize: number; // e.g., 500 ml, 1000 g, 1 pcs
  purchasePrice: number; // total purchase price for the package
}

export interface Ingredient {
  name: string;
  cost: number;
  // Optional link to material catalog for auto-costing
  materialId?: string;
  quantity?: number; // amount used per serving
  unit?: Unit; // should match material unit if materialId provided
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description?: string;

  price: number;
  cost: number;
  status: 'active' | 'inactive';
  ingredients: Ingredient[];
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface Order {
  id: string;
  customerName?: string;
  items: OrderItem[];
  total: number;
  date: Date;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface DashboardData {
  totalSales: number;
  orderCount: number;
  popularItems: { item: string; count: number }[];
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
}