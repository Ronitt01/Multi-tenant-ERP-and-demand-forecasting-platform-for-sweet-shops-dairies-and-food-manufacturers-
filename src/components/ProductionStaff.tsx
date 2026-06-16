import React, { useState, useEffect } from 'react';
import { UserSession, ProductionLog, Product } from '../types';
import { 
  Flame, ClipboardList, CheckCircle2, ChevronRight, 
  Settings, Loader, Plus, Layers, BookOpen, AlertCircle 
} from 'lucide-react';

interface ProductionProps {
  session: UserSession;
}

export default function ProductionStaff({ session }: ProductionProps) {
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New plan form
  const [selectedProdId, setSelectedProdId] = useState('');
  const [planQty, setPlanQty] = useState('');
  const [planDate, setPlanDate] = useState('');

  // Update popup state
  const [activeUpdateLog, setActiveUpdateLog] = useState<ProductionLog | null>(null);
  const [actualQty, setActualQty] = useState('');
  const [updatedStatus, setUpdatedStatus] = useState<'Completed' | 'Failed'>('Completed');

  const [notif, setNotif] = useState('');

  const recipesInfo = [
    { name: 'Kaju Katli (1 kg)', ingredients: '0.75 kg Cashew Nuts (Kaju) + 0.45 kg Sugar + Eco Box' },
    { name: 'Rasgulla (1 kg)', ingredients: '4.00 Litres Cow Milk (extract Chena) + 0.60 kg Sugar + Eco Box' },
    { name: 'Cow Milk (Packaged 1 Litre)', ingredients: '1.02 Litres Raw Milk pasteurized + 1 Packaging Packet wrapper' },
    { name: 'Fresh Paneer (1 kg)', ingredients: '6.00 Litres Raw Milk pressed + Eco Box' },
    { name: 'Thick Dahi (1 kg)', ingredients: '1.15 Litres Raw Milk cultured + Eco Box' },
    { name: 'Sweet Lassi (1 Cup)', ingredients: '0.80 Litres Milk starter curd + 0.05 kg Sugar + Cup Wrapper' }
  ];

  useEffect(() => {
    fetchLogsAndCatalog();
  }, [session.shopId]);

  const fetchLogsAndCatalog = async () => {
    setLoading(true);
    try {
      const [lRes, pRes] = await Promise.all([
        fetch(`/api/production?shopId=${session.shopId}`),
        fetch(`/api/products?shopId=${session.shopId}`)
      ]);

      const lData = await lRes.json();
      const pData = await pRes.json();

      setLogs(lData);
      setProducts(pData);
      if (pData.length > 0) {
        setSelectedProdId(pData[0].id);
      }
    } catch (e) {
      console.error('Kitchen logs error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdId || !planQty) return;

    try {
      const res = await fetch('/api/production/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          productId: selectedProdId,
          plannedQuantity: planQty,
          productionDate: planDate || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to cache production targets.');

      setNotif('New kitchen target scheduled on daily calendar!');
      setPlanQty('');
      fetchLogsAndCatalog();
      setTimeout(() => setNotif(''), 4000);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenUpdate = (log: ProductionLog) => {
    setActiveUpdateLog(log);
    setActualQty(log.plannedQuantity.toString());
  };

  const handleUpdateExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUpdateLog || !actualQty) return;

    try {
      const res = await fetch('/api/production/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          productionId: activeUpdateLog.id,
          actualQuantity: actualQty,
          status: updatedStatus
        })
      });

      if (!res.ok) throw new Error('Transaction updating actuals failed.');

      setNotif(`Logged close-of-day production for ${activeUpdateLog.productName}!`);
      setActiveUpdateLog(null);
      fetchLogsAndCatalog();
      setTimeout(() => setNotif(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Error updating kitchen logs.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Flame className="h-5.5 w-5.5 text-amber-600 mr-2.5" /> Kitchen Production Board
          </h2>
          <p className="text-xs text-slate-400 font-medium">Coordinate manufacturing quotas, register batch outputs, and check standard recipe conversions.</p>
        </div>
        <button 
          onClick={fetchLogsAndCatalog}
          className="p-2 text-slate-500 hover:text-slate-800 transition"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {notif && (
        <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl text-xs font-bold text-emerald-805 animate-fade-in">
          <span>{notif}</span>
        </div>
      )}

      {loading ? (
        <div className="h-44 flex items-center justify-center text-slate-400 text-xs text-medium">Connecting kitchen channels...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily manufacturing log entries */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                <ClipboardList className="h-4 w-4 text-slate-500 mr-2" /> Active Manufacturing Workorders
              </h3>

              <div className="space-y-3">
                {logs.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">No kitchen goals scheduled. Use tomorrow forecast suggestions.</div>
                ) : (
                  logs.filter(l => l.status === 'Planned' || l.status === 'In Progress').map((log) => (
                    <div key={log.id} className="flex justify-between items-center p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                      <div>
                        <div className="text-xs text-slate-400 font-mono tracking-wider font-bold">DATE: {log.productionDate}</div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">{log.productName}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Scheduled target: <span className="font-bold text-slate-800">{log.plannedQuantity} Units</span></p>
                      </div>
                      <button
                        onClick={() => handleOpenUpdate(log)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
                      >
                        Register Finished Output
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Completed historical runs */}
              <h3 className="text-sm font-bold text-slate-900 mt-8 mb-4">Completed Runs Log</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="py-2 px-3 rounded-l-lg">Product Name</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Planned</th>
                      <th className="py-2 px-3">Actual Manufactured</th>
                      <th className="py-2 px-3 rounded-r-lg">Production Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {logs.filter(l => l.status === 'Completed' || l.status === 'Failed').slice(-8).reverse().map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{log.productName}</td>
                        <td className="py-2.5 px-3 font-mono">{log.productionDate}</td>
                        <td className="py-2.5 px-3">{log.plannedQuantity} Units</td>
                        <td className="py-2.5 px-3 font-bold text-slate-850">{log.actualQuantity} Units</td>
                        <td className="py-2.5 px-3 font-mono font-medium">₹{log.productionCost?.toLocaleString('en-IN') || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Quick Actual update overlay container */}
            {activeUpdateLog && (
              <div className="bg-slate-900 text-white rounded-2xl border border-amber-500/20 p-6 shadow-xl space-y-4">
                <div className="flex items-center text-amber-400 space-x-2">
                  <AlertCircle className="h-4.5 w-4.5" />
                  <h3 className="text-xs font-bold tracking-wider uppercase">SUBMIT DAILY MANUFACTURE QUANTITY</h3>
                </div>
                <p className="text-xs text-slate-300">
                  Update close-of-day quantities for <span className="font-bold text-white">{activeUpdateLog.productName}</span>. Recipe write-offs will calculate automatically.
                </p>

                <form onSubmit={handleUpdateExecution} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Actual Finished Output (kg / Litres)</label>
                    <input
                      type="number"
                      required
                      value={actualQty}
                      onChange={(e) => setActualQty(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Manufacture Status</label>
                    <select
                      value={updatedStatus}
                      onChange={(e) => setUpdatedStatus(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                    >
                      <option value="Completed">Completed Run (Success)</option>
                      <option value="Failed">Failed Batch Match (Discard / Spoiled)</option>
                    </select>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveUpdateLog(null)}
                      className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                      Submit Log
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Production Schedule Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <Plus className="h-4 w-4 text-slate-500 mr-2" /> Schedule manufacturing
              </h3>
              <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Finished product</label>
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Quantity</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 100"
                    value={planQty}
                    onChange={(e) => setPlanQty(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Production Date</label>
                  <input
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-1.5 py-2 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition"
                >
                  Schedule Target Run
                </button>
              </form>
            </div>

            {/* Formula Ingredient ratios */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <BookOpen className="h-4 w-4 text-slate-500 mr-2" /> Recipe Formulation Formulas
              </h3>
              <div className="space-y-2.5 pt-1.5 text-left">
                {recipesInfo.map((recipe, idx) => (
                  <div key={idx} className="pb-2 border-b border-slate-50 text-xs">
                    <div className="font-bold text-slate-800">{recipe.name}</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{recipe.ingredients}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
