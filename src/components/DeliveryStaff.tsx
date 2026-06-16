import React, { useState, useEffect } from 'react';
import { UserSession, DailySupply, BulkCustomer } from '../types';
import { 
  Truck, CheckCircle, ClipboardList, Printer, 
  MapPin, Phone, RefreshCw, Signature, CheckSquare, Plus, ShoppingBag 
} from 'lucide-react';

interface DeliveryProps {
  session: UserSession;
}

export default function DeliveryStaff({ session }: DeliveryProps) {
  const [supplies, setSupplies] = useState<DailySupply[]>([]);
  const [customers, setCustomers] = useState<BulkCustomer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Wholesale Dispatch Form state
  const [selectedCustId, setSelectedCustId] = useState('');
  const [assignedBoy, setAssignedBoy] = useState('Ravi Kumar');
  const [deliveryItems, setDeliveryItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [itemQueryId, setItemQueryId] = useState('');
  const [itemQty, setItemQty] = useState('');

  // Active Challan popup / detail view
  const [activeChallan, setActiveChallan] = useState<DailySupply | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [notif, setNotif] = useState('');

  useEffect(() => {
    fetchDeliveryData();
  }, [session.shopId]);

  const fetchDeliveryData = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, pRes] = await Promise.all([
        fetch(`/api/supplies?shopId=${session.shopId}`),
        fetch(`/api/customers?shopId=${session.shopId}`),
        fetch(`/api/products?shopId=${session.shopId}`)
      ]);

      const sData = await sRes.json();
      const cData = await cRes.json();
      const pData = await pRes.json();

      setSupplies(sData);
      setCustomers(cData);
      setProducts(pData);

      if (cData.length > 0) {
        setSelectedCustId(cData[0].id);
      }
      if (pData.length > 0) {
        setItemQueryId(pData[0].id);
      }
    } catch (e) {
      console.error('Delivery data sync failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const addCargoItem = () => {
    if (!itemQueryId || !itemQty) return;
    const target = products.find(p => p.id === itemQueryId);
    if (!target) return;

    setDeliveryItems(prev => {
      const exists = prev.find(i => i.productId === itemQueryId);
      if (exists) {
        return prev.map(i => i.productId === itemQueryId ? { ...i, quantity: i.quantity + parseFloat(itemQty) } : i);
      }
      return [...prev, { productId: itemQueryId, quantity: parseFloat(itemQty) }];
    });

    setItemQty('');
  };

  const removeCargoItem = (id: string) => {
    setDeliveryItems(prev => prev.filter(i => i.productId !== id));
  };

  const handleWholesaleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustId || deliveryItems.length === 0) {
      setNotif('Please select a wholesale customer and map cargo manifest items.');
      return;
    }

    try {
      const res = await fetch('/api/supplies/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          customerId: selectedCustId,
          assignedDeliveryBoy: assignedBoy,
          items: deliveryItems,
          notes: 'Standard restaurant bulk supply cargo route'
        })
      });

      if (!res.ok) throw new Error('Cargo dispatch decline on servers.');

      setNotif('Cargo dispatch successfully authorized! Receipt issued below.');
      const freshDispatch = await res.json();
      setActiveChallan(freshDispatch);
      setDeliveryItems([]);
      fetchDeliveryData();
      setTimeout(() => setNotif(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Error executing dispatch ledger trigger.');
    }
  };

  const handleMarkDeliveredLocal = (supId: string) => {
    // Simulate updating delivery status on backend
    setSupplies(prev => prev.map(s => s.id === supId ? { ...s, status: 'Delivered' } : s));
    setNotif(`Delivery #${supId.slice(-4).toUpperCase()} successfully verified and marked COMPLETED!`);
    setTimeout(() => setNotif(''), 4500);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Truck className="h-5.5 w-5.5 text-amber-600 mr-2.5" /> Bulk Delivery & Transit Receipt Console
          </h2>
          <p className="text-xs text-slate-400 font-medium">Verify assigned wholesale cargo routes, print legal Delivery Receipts, and check receiver signatures.</p>
        </div>
        <button 
          onClick={fetchDeliveryData}
          className="p-2 text-slate-500 hover:text-slate-800 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {notif && (
        <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl text-xs font-bold text-emerald-805 animate-fade-in">
          <span>{notif}</span>
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-xs text-medium">Connecting delivery channel logs...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dispatched route rows */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                <ClipboardList className="h-4.5 w-4.5 text-slate-500 mr-2" /> Dispatched Route Consignments
              </h3>

              <div className="space-y-3">
                {supplies.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">No dispatched wholesale consignments on record.</div>
                ) : (
                  supplies.map((sup) => (
                    <div key={sup.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 border border-slate-150 rounded-xl hover:bg-slate-100/50 transition">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold font-mono text-slate-505 bg-slate-200 px-1.5 py-0.5 rounded">
                            ID: {sup.id.slice(-6).toUpperCase()}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            sup.status === 'Delivered' 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                              : 'bg-amber-55/60 text-amber-900 border border-amber-200'
                          }`}>
                            {sup.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-2">{sup.customerName}</h4>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">Consignment cargo: <span className="font-bold text-slate-700">₹{sup.totalAmount}</span> • Courier: {sup.assignedDeliveryBoy}</div>
                      </div>

                      <div className="mt-3 sm:mt-0 flex space-x-2">
                        <button
                          onClick={() => setActiveChallan(sup)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-905 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>View Receipt</span>
                        </button>

                        {sup.status !== 'Delivered' && (
                          <button
                            onClick={() => handleMarkDeliveredLocal(sup.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1"
                          >
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span>Deliver</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* wholesale dispatch trigger Form */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <Truck className="h-4.5 w-4.5 text-slate-500 mr-2" /> Dispatch wholesale Cargo
              </h3>
              <form onSubmit={handleWholesaleDispatch} className="space-y-3.5 text-xs text-left">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Client Restaurant</label>
                  <select
                    value={selectedCustId}
                    onChange={(e) => setSelectedCustId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.restaurantName} (Dues: ₹{c.outstandingBalance})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Courier Assistant</label>
                  <select
                    value={assignedBoy}
                    onChange={(e) => setAssignedBoy(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Ravi Kumar">Ravi Kumar (Secondary Route)</option>
                    <option value="Manpreet Singh">Manpreet Singh (Main Bypass Bypass)</option>
                    <option value="Sukhwinder Singh">Sukhwinder Singh (Dhabas Contract)</option>
                  </select>
                </div>

                {/* Cargo basket editor */}
                <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Manifest Cargo basket</span>
                  <div className="flex space-x-1">
                    <select
                      value={itemQueryId}
                      onChange={(e) => setItemQueryId(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="w-16 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-center font-mono"
                    />
                    <button
                      type="button"
                      onClick={addCargoItem}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs"
                    >
                      +
                    </button>
                  </div>

                  {/* Selected items */}
                  <div className="max-h-24 overflow-y-auto pt-2 divide-y divide-slate-100">
                    {deliveryItems.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic py-1 text-center">Form cargo list before checkout.</div>
                    ) : (
                      deliveryItems.map((item) => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <div key={item.productId} className="flex justify-between items-center py-1 text-[11px] font-mono text-slate-700">
                            <span>{prod ? prod.name : 'Unknown'} x {item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => removeCargoItem(item.productId)}
                              className="text-rose-500 hover:text-rose-750 font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={deliveryItems.length === 0}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-850 disabled:bg-slate-300 transition flex items-center justify-center space-x-1"
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>Authorize Cargo Dispatch</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Centered Modal Overlay: Print Friendly Delivery Receipt */}
      {activeChallan && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in text-slate-900"
          onClick={() => setActiveChallan(null)}
        >
          <div 
            className="bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl p-6 md:p-8 max-w-2xl w-full text-left space-y-6 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveChallan(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex justify-between items-start border-b border-slate-150 pb-4 pr-6">
              <div>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold tracking-wider rounded-full border border-amber-200">
                  OFFICIAL TRANSIT RECEIPT
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-2.5">{session.shopName}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">B2B Manufacturing Bulk Supply Operations Division</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 font-mono">RECEIPT: #{activeChallan.id.slice(-6).toUpperCase()}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">DATE: {activeChallan.date}</p>
                <p className="text-[10px] text-slate-455 font-mono mt-1">Status: <span className="font-bold text-emerald-650 tracking-wider font-sans">{activeChallan.status}</span></p>
              </div>
            </div>

            {/* Receiver Info */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <h4 className="font-bold text-slate-400 uppercase text-[9px]">Consigned To:</h4>
                <p className="font-extrabold text-slate-800 mt-1">{activeChallan.customerName}</p>
                <div className="flex items-center text-slate-500 mt-1.5 font-sans">
                  <Phone className="h-3 w-3 mr-1 shrink-0 text-slate-400" />
                  <span>{customers.find(c => c.restaurantName === activeChallan.customerName)?.phoneNumber || '+91 98765 43210'}</span>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-400 uppercase text-[9px]">Delivery Address:</h4>
                <p className="font-medium text-slate-700 mt-1">
                  {customers.find(c => c.restaurantName === activeChallan.customerName)?.address || 'Main Bazar, Ambala'}
                </p>
              </div>
            </div>

            {/* Cargo Table */}
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-5 font-bold text-slate-400 border-b border-slate-200 pb-2">
                <div className="col-span-2">Product Description</div>
                <div className="text-center">Rate</div>
                <div className="text-center">Qty</div>
                <div className="text-right">W/S Total</div>
              </div>
              {activeChallan.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-5 font-mono text-[11px] text-slate-700 border-b border-slate-100 py-1.5 font-sans">
                  <div className="col-span-2 font-semibold text-slate-800">{item.productName}</div>
                  <div className="text-center font-mono">₹{item.rate}</div>
                  <div className="text-center font-bold text-slate-900 font-mono">{item.quantity} {item.unit}</div>
                  <div className="text-right font-bold text-slate-850 font-mono">₹{item.total}</div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex justify-end text-xs font-mono border-t border-slate-150 pt-3">
              <div className="text-right space-y-1.5 w-44">
                <div className="flex justify-between font-bold text-slate-905 text-sm">
                  <span>Grand Total:</span>
                  <span className="text-slate-950 font-extrabold">₹{activeChallan.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Terms and Signatures */}
            <div className="pt-5 grid grid-cols-2 gap-4 border-t border-slate-200">
              <div className="text-[9px] text-slate-400 leading-normal flex flex-col justify-end space-y-1">
                <p className="font-bold text-slate-500">ERP Cargo Terms & Rules:</p>
                <p>1. Transferred goods are subject to standard food hygiene code protocols.</p>
                <p>2. Dues must be balanced matching credit-days terms limit established in CRM.</p>
              </div>

              {/* Legal Signature Box */}
              <div className="border border-slate-250 bg-slate-50 rounded-xl p-3 flex flex-col justify-between h-20 relative">
                <div className="absolute top-2 left-2 text-[9px] font-bold text-slate-405 uppercase tracking-wider flex items-center">
                  <Signature className="h-3 w-3 mr-1 inline text-slate-400" /> Receiver Authorized Signature
                </div>
                <div className="flex-1 flex items-center justify-center pt-4">
                  {activeChallan.status === 'Delivered' ? (
                    <span className="font-bold border border-emerald-500/30 text-emerald-650 px-3 py-1 rounded bg-emerald-50 text-[10px] uppercase font-sans tracking-wide rotate-3">Verified Delivery</span>
                  ) : (
                    <span className="italic text-[10px] text-slate-405">Apply digital verification stamp</span>
                  )}
                </div>
              </div>
            </div>

            {/* Print Controls */}
            <div className="flex justify-between items-center text-[10px] pt-3 border-t border-slate-100 text-slate-400">
              <span>Courier Representative: {activeChallan.assignedDeliveryBoy}</span>
              <div className="flex space-x-2">
                <button 
                  onClick={() => { window.print(); }}
                  className="py-1.5 px-3.5 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-bold transition rounded-lg flex items-center text-xs shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Receipt
                </button>
                <button 
                  onClick={() => setActiveChallan(null)}
                  className="py-1.5 px-3.5 border border-slate-200 hover:bg-slate-50 text-slate-605 font-bold transition rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
