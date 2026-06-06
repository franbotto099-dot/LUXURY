import api from './client';
import type { Product, Customer, Sale, Expense, TodaySummary, DashboardData, ChartPoint } from '../types';

// AUTH
export const login = (username: string, password: string) =>
  api.post<{ token: string; username: string }>('/auth/login', { username, password }).then(r => r.data);

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data);

// PRODUCTS
export const getProducts = (params?: Record<string, string>) =>
  api.get<Product[]>('/products', { params }).then(r => r.data);

export const getProduct = (id: number) =>
  api.get<Product>(`/products/${id}`).then(r => r.data);

export const getCategories = () =>
  api.get<string[]>('/products/categories').then(r => r.data);

export const getLowStockProducts = () =>
  api.get<Product[]>('/products/low-stock').then(r => r.data);

export const createProduct = (data: Partial<Product>) =>
  api.post<Product>('/products', data).then(r => r.data);

export const updateProduct = (id: number, data: Partial<Product>) =>
  api.put<Product>(`/products/${id}`, data).then(r => r.data);

export const deleteProduct = (id: number) =>
  api.delete(`/products/${id}`).then(r => r.data);

export const importProducts = (products: Partial<Product>[]) =>
  api.post<{ created: number; errors: string[] }>('/products/import', { products }).then(r => r.data);

// CUSTOMERS
export const getCustomers = (params?: Record<string, string>) =>
  api.get<Customer[]>('/customers', { params }).then(r => r.data);

export const getCustomersWithDebt = () =>
  api.get<Customer[]>('/customers/with-debt').then(r => r.data);

export const getCustomer = (id: number) =>
  api.get<Customer>(`/customers/${id}`).then(r => r.data);

export const getCustomerSales = (id: number) =>
  api.get<Sale[]>(`/customers/${id}/sales`).then(r => r.data);

export const getCustomerDebts = (id: number) =>
  api.get<Array<{ sale_id: number; date: string; total: number; paid: number; remaining: number; notes: string }>>(`/customers/${id}/debts`).then(r => r.data);

export const registerPayment = (customerId: number, data: { sale_id: number; amount: number; date?: string; notes?: string }) =>
  api.post(`/customers/${customerId}/payments`, data).then(r => r.data);

export const createCustomer = (data: Partial<Customer>) =>
  api.post<Customer>('/customers', data).then(r => r.data);

export const updateCustomer = (id: number, data: Partial<Customer>) =>
  api.put<Customer>(`/customers/${id}`, data).then(r => r.data);

export const deleteCustomer = (id: number) =>
  api.delete(`/customers/${id}`).then(r => r.data);

// SALES
export const getSales = (params?: Record<string, string | number>) =>
  api.get<Sale[]>('/sales', { params }).then(r => r.data);

export const getTodaySummary = () =>
  api.get<TodaySummary>('/sales/today').then(r => r.data);

export const getSale = (id: number) =>
  api.get<Sale>(`/sales/${id}`).then(r => r.data);

export const createSale = (data: { items: Array<{ product_id: number | null; product_name: string; quantity: number; price: number }>; payment_method: string; customer_id?: number | null; notes?: string; date?: string }) =>
  api.post<Sale>('/sales', data).then(r => r.data);

export const deleteSale = (id: number) =>
  api.delete(`/sales/${id}`).then(r => r.data);

// EXPENSES
export const getExpenseCategories = () =>
  api.get<string[]>('/expenses/categories').then(r => r.data);

export const getExpenses = (params?: Record<string, string | number>) =>
  api.get<Expense[]>('/expenses', { params }).then(r => r.data);

export const createExpense = (data: Partial<Expense>) =>
  api.post<Expense>('/expenses', data).then(r => r.data);

export const updateExpense = (id: number, data: Partial<Expense>) =>
  api.put<Expense>(`/expenses/${id}`, data).then(r => r.data);

export const deleteExpense = (id: number) =>
  api.delete(`/expenses/${id}`).then(r => r.data);

// REPORTS
export const getDashboard = () =>
  api.get<DashboardData>('/reports/dashboard').then(r => r.data);

export const getIncomeExpensesChart = (period: 'week' | 'month') =>
  api.get<ChartPoint[]>('/reports/income-expenses', { params: { period } }).then(r => r.data);

export const getProductsRanking = (params?: { from?: string; to?: string; limit?: number }) =>
  api.get('/reports/products-ranking', { params }).then(r => r.data);

export const getBalance = (from: string, to: string) =>
  api.get('/reports/balance', { params: { from, to } }).then(r => r.data);
