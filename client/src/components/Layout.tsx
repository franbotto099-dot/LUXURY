import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, BarChart2, LogOut, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useQuery } from '@tanstack/react-query';
import { getLowStockProducts } from '../api';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/ventas', icon: ShoppingCart, label: 'Ventas' },
  { to: '/inventario', icon: Package, label: 'Inventario' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/reportes', icon: BarChart2, label: 'Reportes' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const logout = useAuthStore(s => s.logout);
  const username = useAuthStore(s => s.username);
  const { data: lowStock } = useQuery({ queryKey: ['low-stock'], queryFn: getLowStockProducts, refetchInterval: 60000 });

  const isActive = (to: string) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-1 bg-white border-r border-gray-200">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">LX</span>
              </div>
              <span className="font-bold text-gray-900 text-lg">LUXURY</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate">{username}</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(to)
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {label}
                {to === '/inventario' && (lowStock?.length ?? 0) > 0 && (
                  <span className="ml-auto bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle size={10} />
                    {lowStock!.length}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="p-3 border-t">
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg w-full transition-colors"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-56 flex flex-col flex-1">
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors ${
                isActive(to) ? 'text-green-600' : 'text-gray-500'
              }`}
            >
              <div className="relative">
                <Icon size={20} />
                {to === '/inventario' && (lowStock?.length ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-2 h-2" />
                )}
              </div>
              <span className="mt-0.5 leading-none">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
