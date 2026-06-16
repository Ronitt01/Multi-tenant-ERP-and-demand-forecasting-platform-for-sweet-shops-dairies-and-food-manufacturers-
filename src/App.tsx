import { useState } from 'react';
import { UserSession } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InventoryManager from './components/InventoryManager';
import CashierCounter from './components/CashierCounter';
import ProductionStaff from './components/ProductionStaff';
import DeliveryStaff from './components/DeliveryStaff';
import TomorrowForecast from './components/TomorrowForecast';
import { 
  Store, User, LogOut, TrendingUp, Sparkles, Boxes, 
  ShoppingCart, Flame, Truck
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<UserSession | null>({
    token: 'sham-token-bypass',
    shopId: 'sham-sweets',
    shopName: 'Sham Sweets',
    role: 'Owner'
  });
  
  // Active Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'forecast' | 'inventory' | 'production' | 'pos' | 'delivery'>('dashboard');

  const handleLoginSuccess = (usrSession: UserSession) => {
    setSession(usrSession);
    // Auto-route based on role parameters to save cashier / courier extra taps
    if (usrSession.role === 'Production Staff') {
      setActiveTab('production');
    } else if (usrSession.role === 'Delivery Staff') {
      setActiveTab('delivery');
    } else if (usrSession.role === 'Cashier') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    setSession(null);
  };

  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Restrict access depending on Roles
  // Owner: Full access
  // Manager: Inventory, production, bulk orders, forecasting, reports
  // Cashier: Record sales, generate invoices, dispatches
  // Production Staff: plans, recipe lists
  // Delivery Staff: assigned deliveries, challans
  const canAccessDashboard = session.role === 'Owner';
  const canAccessForecast = session.role === 'Owner' || session.role === 'Manager';
  const canAccessInventory = session.role === 'Owner' || session.role === 'Manager';
  const canAccessProduction = session.role === 'Owner' || session.role === 'Manager' || session.role === 'Production Staff';
  const canAccessPos = session.role === 'Owner' || session.role === 'Manager' || session.role === 'Cashier';
  const canAccessDelivery = session.role === 'Owner' || session.role === 'Manager' || session.role === 'Cashier' || session.role === 'Delivery Staff';

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-850 flex flex-col">
      {/* Top Bar Branded Header - Geometric Balance Styling */}
      <header className="bg-white text-slate-900 border-b border-gray-200 shrink-0 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-900 rounded-lg text-white shadow-xs">
              <Store className="h-5 my-0.5 mx-0.5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">ERP System</span>
              <h1 className="text-base font-bold text-slate-900 font-display leading-tight mt-0.5">
                {session.shopName} <span className="text-slate-400 font-normal text-xs">({session.shopId})</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            {/* Active user tag */}
            <div className="flex items-center space-x-2.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-gray-200">
              <User className="h-3.5 w-3.5 text-slate-600" />
              <div>
                <div className="font-semibold text-slate-600">Terminal Ready</div>
                <div className="font-bold text-slate-800 text-[10px] tracking-wide uppercase">{session.role}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition duration-150 border border-gray-200 flex items-center shadow-xs"
              title="Logout Session"
              id="logout-button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container - Standard Production ERP Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Responsive Side Navigation Menu */}
        <nav className="md:w-60 lg:w-64 shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1.5 text-slate-600 text-left">
          
          {canAccessDashboard && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center space-x-2.5 whitespace-nowrap md:whitespace-normal cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-slate-900 text-white font-semibold shadow-xs border border-slate-900' 
                  : 'bg-white hover:bg-slate-50 text-slate-650 border border-gray-200 shadow-2xs'
              }`}
            >
              <TrendingUp className={`h-4 w-4 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
              <span>Accounts Dashboard</span>
            </button>
          )}

          {canAccessForecast && (
            <button
              onClick={() => setActiveTab('forecast')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center space-x-2.5 whitespace-nowrap md:whitespace-normal cursor-pointer ${
                activeTab === 'forecast' 
                  ? 'bg-slate-900 text-white font-semibold shadow-xs border border-slate-900' 
                  : 'bg-white hover:bg-slate-50 text-slate-650 border border-gray-200 shadow-2xs'
              }`}
            >
              <Sparkles className={`h-4 w-4 shrink-0 ${activeTab === 'forecast' ? 'text-white' : 'text-slate-400'}`} />
              <span>Demand Forecast</span>
            </button>
          )}

          {canAccessInventory && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center space-x-2.5 whitespace-nowrap md:whitespace-normal cursor-pointer ${
                activeTab === 'inventory' 
                  ? 'bg-slate-900 text-white font-semibold shadow-xs border border-slate-900' 
                  : 'bg-white hover:bg-slate-50 text-slate-650 border border-gray-200 shadow-2xs'
              }`}
            >
              <Boxes className={`h-4 w-4 shrink-0 ${activeTab === 'inventory' ? 'text-white' : 'text-slate-400'}`} />
              <span>Inventory & CRM</span>
            </button>
          )}

          {canAccessPos && (
            <button
              onClick={() => setActiveTab('pos')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center space-x-2.5 whitespace-nowrap md:whitespace-normal cursor-pointer ${
                activeTab === 'pos' 
                  ? 'bg-slate-900 text-white font-semibold shadow-xs border border-slate-900' 
                  : 'bg-white hover:bg-slate-50 text-slate-650 border border-gray-200 shadow-2xs'
              }`}
            >
              <ShoppingCart className={`h-4 w-4 shrink-0 ${activeTab === 'pos' ? 'text-white' : 'text-slate-400'}`} />
              <span>POS Billing Counter</span>
            </button>
          )}

          {canAccessProduction && (
            <button
              onClick={() => setActiveTab('production')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center space-x-2.5 whitespace-nowrap md:whitespace-normal cursor-pointer ${
                activeTab === 'production' 
                  ? 'bg-slate-900 text-white font-semibold shadow-xs border border-slate-900' 
                  : 'bg-white hover:bg-slate-50 text-slate-650 border border-gray-200 shadow-2xs'
              }`}
            >
              <Flame className={`h-4 w-4 shrink-0 ${activeTab === 'production' ? 'text-white' : 'text-slate-400'}`} />
              <span>Kitchen Production</span>
            </button>
          )}

          {canAccessDelivery && (
            <button
              onClick={() => setActiveTab('delivery')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center space-x-2.5 whitespace-nowrap md:whitespace-normal cursor-pointer ${
                activeTab === 'delivery' 
                  ? 'bg-slate-900 text-white font-semibold shadow-xs border border-slate-900' 
                  : 'bg-white hover:bg-slate-50 text-slate-650 border border-gray-200 shadow-2xs'
              }`}
            >
              <Truck className={`h-4 w-4 shrink-0 ${activeTab === 'delivery' ? 'text-white' : 'text-slate-400'}`} />
              <span>Wholesale Dispatches</span>
            </button>
          )}
        </nav>

        {/* Dynamic Panel Content Stage */}
        <main className="flex-1 min-w-0 font-sans text-left" id="main-content-stage">
          {activeTab === 'dashboard' && canAccessDashboard && <Dashboard session={session} />}
          {activeTab === 'forecast' && canAccessForecast && <TomorrowForecast session={session} />}
          {activeTab === 'inventory' && canAccessInventory && <InventoryManager session={session} />}
          {activeTab === 'pos' && canAccessPos && <CashierCounter session={session} />}
          {activeTab === 'production' && canAccessProduction && <ProductionStaff session={session} />}
          {activeTab === 'delivery' && canAccessDelivery && <DeliveryStaff session={session} />}
        </main>
      </div>

      <footer className="bg-white border-t border-slate-150 py-4 shrink-0 mt-auto text-slate-450 text-[10px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 font-sans">
          <p>© 2026 Sham Sweets ERP Systems Ltd. Active Tenant: <strong>{session.shopName}</strong>. All system logs, transaction trails, and ledger balances are fully synchronized with our cloud ERP backend.</p>
        </div>
      </footer>
    </div>
  );
}
