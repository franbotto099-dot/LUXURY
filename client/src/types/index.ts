export interface Product {
  id: number;
  name: string;
  category: string;
  sale_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  description: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  total_debt?: number;
  created_at: string;
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Sale {
  id: number;
  customer_id: number | null;
  customer_name?: string;
  total: number;
  payment_method: 'cash' | 'card' | 'transfer' | 'credit';
  notes: string;
  date: string;
  created_at: string;
  items?: SaleItem[];
  items_summary?: string;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export interface DebtPayment {
  id: number;
  sale_id: number;
  customer_id: number;
  amount: number;
  date: string;
  notes: string;
  created_at: string;
}

export interface TodaySummary {
  date: string;
  total_sales: number;
  total_expenses: number;
  balance: number;
  count: number;
  by_method: { cash: number; card: number; transfer: number; credit: number };
  transactions: Array<{
    type: 'sale' | 'expense';
    id: number;
    amount: number;
    payment_method: string;
    notes: string;
    created_at: string;
    customer_name: string | null;
    items_summary: string | null;
  }>;
}

export interface DashboardData {
  today: { sales: number; expenses: number; balance: number; count: number };
  month: { sales: number; expenses: number; balance: number; count: number };
  top_products: Array<{ product_name: string; total_qty: number; total_revenue: number }>;
  top_debtors: Array<{ id: number; name: string; phone: string; debt: number }>;
  low_stock_count: number;
}

export interface ChartPoint {
  date: string;
  sales: number;
  expenses: number;
}
