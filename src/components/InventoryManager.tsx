import React, { useState, useEffect } from 'react';
import { UserSession, Ingredient, BulkCustomer, PurchaseLog } from '../types';
import { 
  Boxes, Plus, ShoppingCart, AlertTriangle, ShieldAlert, 
  Users, CheckCircle2, ChevronRight, RefreshCw, Layers 
} from 'lucide-react';

interface InventoryProps {
  session: UserSession;
}

export default function InventoryManager({ session }: InventoryProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [customers, setCustomers] = useState<BulkCustomer[]>([]);
  const [purchases, setPurchases] = useState<PurchaseLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Material purchase form
  const [selectedIngId, setSelectedIngId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [buyQuantity, setBuyQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyExpiry, setBuyExpiry] = useState('');

  // Bulk customer registration form
  const [custName, setCustName] = useState('');
  const [custContact, setCustContact] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custGst, setCustGst] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('25000');
  const [creditDays, setCreditDays] = useState('15');

  const [notif, setNotif] = useState({ text: '', type: 'success' });

  useEffect(() => {
    fetchInventoryAndCustomers();
  }, [session.shopId]);

  const showNotif = (text: string, type: 'success' | 'error' = 'success') => {
    setNotif({ text, type });
    setTimeout(() => setNotif({ text: '', type: 'success' }), 4000);
  };

  const fetchInventoryAndCustomers = async () => {
    setLoading(true);
    try {
      const [iRes, cRes, pRes] = await Promise.all([
        fetch(`/api/ingredients?shopId=${session.shopId}`),
        fetch(`/api/customers?shopId=${session.shopId}`),
        fetch(`/api/purchases?shopId=${session.shopId}`)
      ]);

      const iData = await iRes.json();
      const cData = await cRes.json();
      const pData = await pRes.json();

      setIngredients(iData);
      setCustomers(cData);
      setPurchases(pData);
      
      if (iData.length > 0) {
        setSelectedIngId(iData[0].id);
      }
    } catch (e) {
      console.error('Error fetching inventory datasets:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngId || !buyQuantity || !buyPrice) {
      showNotif('Please select an ingredient and specify quantity + price.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/ingredients/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          ingredientId: selectedIngId,
          supplierName: supplierName || 'Unregistered Vendor',
          quantity: buyQuantity,
          pricePerUnit: buyPrice,
          expiryDate: buyExpiry || undefined
        })
      });

      if (!res.ok) throw new Error('Purchase transaction failed on server.');
      
      showNotif('Material purchase logged! Ingredient stock balance updated.');
      setSupplierName('');
      setBuyQuantity('');
      setBuyPrice('');
      setBuyExpiry('');
      fetchInventoryAndCustomers();
    } catch (err: any) {
      showNotif(err.message || 'Database transaction error.', 'error');
    }
  };

  const handleCustomerReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      showNotif('Please specify restaurant name and contact phone.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          restaurantName: custName,
          contactPerson: custContact,
          phoneNumber: custPhone,
          address: custAddress,
          gstNumber: custGst,
          creditLimit,
          creditDays
        })
      });

      if (!res.ok) throw new Error('Failed to register retail bulk buyer.');

      showNotif('Commercial customer master logged! Delivery ledger initiated.');
      setCustName('');
      setCustContact('');
      setCustPhone('');
      setCustGst('');
      setCustAddress('');
      fetchInventoryAndCustomers();
    } catch (err: any) {
      showNotif(err.message || 'Database error adding partner.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Boxes className="h-5.5 w-5.5 text-amber-600 mr-2.5" /> Inventory & Partner Masters
          </h2>
          <p className="text-xs text-slate-400 font-medium">Manage raw ingredients stock, expiry batches, and registered restaurant terms.</p>
        </div>
        <button 
          onClick={fetchInventoryAndCustomers}
          className="p-2 text-slate-500 hover:text-slate-800 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {notif.text && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold animate-fade-in ${
          notif.type === 'success' 
            ? 'bg-emerald-50 border-emerald-150 text-emerald-800' 
            : 'bg-rose-50 border-rose-150 text-rose-800'
        }`}>
          <div className="flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            <span>{notif.text}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-xs">Fetching stock ledgers...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Raw Material Inventory Stock level table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                <Layers className="h-4 w-4 text-slate-500 mr-2" /> Raw Ingredients Stock Balance
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Ingredient Name</th>
                      <th className="py-2.5 px-3">Current Balance</th>
                      <th className="py-2.5 px-3">Low-Stock Alert</th>
                      <th className="py-2.5 px-3">Expiry Checklist</th>
                      <th className="py-2.5 px-3 rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ingredients.map((item) => {
                      const isLow = item.currentStock <= item.reorderPoint;
                      // Find if any batch is close to current date
                      const nextExpiry = item.batches && item.batches.length > 0 ? item.batches[0].expiryDate : 'N/A';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-900">{item.name}</td>
                          <td className="py-3 px-3 font-bold text-slate-800">{item.currentStock} {item.unit}</td>
                          <td className="py-3 px-3 font-medium text-slate-500">Below {item.reorderPoint} {item.unit}</td>
                          <td className="py-3 px-3 text-slate-400 font-mono">{nextExpiry}</td>
                          <td className="py-3 px-3">
                            {isLow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 border border-rose-100 text-rose-650">
                                <ShieldAlert className="h-3 w-3 mr-1" /> Reorder Now
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-850">
                                Secure
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Wholesale Customer/Recipient master directories */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                <Users className="h-4 w-4 text-slate-500 mr-2" /> Registered Wholesale Contract Clients
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Restaurant Name</th>
                      <th className="py-2.5 px-3">Primary Contact</th>
                      <th className="py-2.5 px-3">GSTIN</th>
                      <th className="py-2.5 px-3">Credit Terms</th>
                      <th className="py-2.5 px-3 rounded-r-lg">Outstanding Ledger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((cust) => {
                      const isOverLimit = cust.outstandingBalance > cust.creditLimit;

                      return (
                        <tr key={cust.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-900">{cust.restaurantName}</td>
                          <td className="py-3 px-3 text-slate-800">
                            <div>{cust.contactPerson}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{cust.phoneNumber}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-500 uppercase font-mono">{cust.gstNumber}</td>
                          <td className="py-3 px-3 text-slate-650 font-medium">
                            ₹{cust.creditLimit.toLocaleString('en-IN')} ({cust.creditDays} Days)
                          </td>
                          <td className="py-3 px-3">
                            <span className={`font-bold ${isOverLimit ? 'text-rose-650' : 'text-slate-900'}`}>
                              ₹{cust.outstandingBalance.toLocaleString('en-IN')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Purchase Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <ShoppingCart className="h-4 w-4 text-slate-500 mr-2" /> Log Stock Procurement
              </h3>
              <form onSubmit={handlePurchase} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Ingredient</label>
                  <select
                    value={selectedIngId}
                    onChange={(e) => setSelectedIngId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Haryana Dairy Farmers Ltd"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 100"
                      value={buyQuantity}
                      onChange={(e) => setBuyQuantity(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Price / Unit (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 45"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Batch Expiry (Optional)</label>
                  <input
                    type="date"
                    value={buyExpiry}
                    onChange={(e) => setBuyExpiry(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition"
                >
                  Confirm Material Input
                </button>
              </form>
            </div>

            {/* Customer Add Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <Plus className="h-4 w-4 text-slate-500 mr-2" /> Add wholesale Partner
              </h3>
              <form onSubmit={handleCustomerReg} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Restaurant/Dhamma name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Punjabi Tadka Cafe"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">In-Charge Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Gurpreet Singh"
                    value={custContact}
                    onChange={(e) => setCustContact(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 90000 00000"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GSTIN Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 07PUNJA8901C3"
                      value={custGst}
                      onChange={(e) => setCustGst(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Credit Limit (₹)</label>
                    <input
                      type="number"
                      required
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Credit Max Days</label>
                    <input
                      type="number"
                      required
                      value={creditDays}
                      onChange={(e) => setCreditDays(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Delivery Address</label>
                  <input
                    type="text"
                    placeholder="Model Road Bazaar, Sector 1"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2 px-4 rounded-xl text-xs font-bold text-white bg-amber-650 hover:bg-amber-700 transition"
                >
                  Register Wholesale Client
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
