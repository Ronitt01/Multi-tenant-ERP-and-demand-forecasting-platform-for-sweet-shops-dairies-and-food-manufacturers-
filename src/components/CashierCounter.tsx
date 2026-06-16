import React, { useState, useEffect } from 'react';
import { UserSession, Product } from '../types';
import { 
  ShoppingBag, Trash2, Plus, Minus, CreditCard, 
  Receipt, CheckCircle2, ShoppingCart, RefreshCw, Printer 
} from 'lucide-react';

interface CashierProps {
  session: UserSession;
}

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  rate: number;
}

export default function CashierCounter({ session }: CashierProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('UPI');
  const [salesType, setSalesType] = useState<'Counter' | 'Online' | 'Walk-in'>('Counter');

  // Completed invoice popup state
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
  const [notif, setNotif] = useState('');

  useEffect(() => {
    fetchCatalogAndSales();
  }, [session.shopId]);

  const fetchCatalogAndSales = async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/products?shopId=${session.shopId}`),
        fetch(`/api/retail-sales?shopId=${session.shopId}`)
      ]);

      const pData = await pRes.json();
      const sData = await sRes.json();

      setProducts(pData);
      setRecentSales(sData);
    } catch (e) {
      console.error('POS Catalog error:', e);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (prod: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.productId === prod.id);
      if (exists) {
        return prev.map(item => 
          item.productId === prod.id 
            ? { ...item, quantity: parseFloat((item.quantity + (prod.unit === 'kg' ? 0.25 : 1)).toFixed(2)) } 
            : item
        );
      }
      return [...prev, {
        productId: prod.id,
        name: prod.name,
        quantity: prod.unit === 'kg' ? 0.25 : 1,
        rate: prod.sellingPrice
      }];
    });
  };

  const updateQty = (prodId: string, delta: number, isKg: boolean) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.productId === prodId) {
          const step = isKg ? 0.25 : 1;
          const newQty = Math.max(0.1, parseFloat((item.quantity + (delta * step)).toFixed(2)));
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (prodId: string) => {
    setCart(prev => prev.filter(i => i.productId !== prodId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const res = await fetch('/api/retail-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          salesType,
          paymentMethod,
          items: cart.map(i => ({
            productId: i.productId,
            quantity: i.quantity
          }))
        })
      });

      if (!res.ok) throw new Error('Transaction declined on servers.');
      
      const loggedInvoice = await res.json();
      setActiveInvoice(loggedInvoice);
      setCart([]);
      setNotif('Sale registered successfully! Checkout invoice compiled below.');
      fetchCatalogAndSales();
    } catch (err: any) {
      alert(err.message || 'Payment system sync failure.');
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const gst = Math.round(subtotal * 0.05);
  const cartTotal = subtotal + gst;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <ShoppingBag className="h-5.5 w-5.5 text-amber-655 mr-2.5" /> Retail POS Register Keyboard
          </h2>
          <p className="text-xs text-slate-400 font-medium">Record front-counter sales, split GST records, and cash-out direct invoices.</p>
        </div>
        <div className="flex space-x-2">
          <select 
            value={salesType} 
            onChange={(e) => setSalesType(e.target.value as any)}
            className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
          >
            <option value="Counter">Counter Transaction</option>
            <option value="Walk-in">Walk-in Customer</option>
            <option value="Online">Zomato / Swiggy Web</option>
          </select>
          <button 
            onClick={fetchCatalogAndSales}
            className="p-2 text-slate-500 hover:text-slate-800 transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {notif && (
        <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-805 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{notif}</span>
          <button onClick={() => setNotif('')} className="ml-auto text-emerald-600 font-bold">dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-xs">Loading sales inventory directory...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products Catalogue */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Available ERP Sweet Catalog</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {products.map((p) => {
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="p-4 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-150 rounded-xl text-left transition duration-150 group flex flex-col justify-between h-34 shadow-xs"
                    >
                      <div>
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded uppercase">
                          {p.category}
                        </span>
                        <h4 className="font-bold text-slate-900 text-xs mt-2 group-hover:text-amber-900 transition">{p.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</p>
                      </div>
                      <div className="flex justify-between items-end mt-4 w-full">
                        <span className="text-sm font-extrabold text-slate-850">₹{p.sellingPrice} <span className="text-[10px] text-slate-400 font-normal">/{p.unit}</span></span>
                        <span className="text-[10px] font-bold text-amber-600 group-hover:underline flex items-center">
                          + Add <Plus className="h-3 w-3 ml-0.5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Print Friendly Active Invoice Receipt */}
            {activeInvoice && (
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in text-left border border-amber-500/20">
                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest">RAIL CHECKOUT INVOICE</h3>
                    <h4 className="text-xs font-semibold text-slate-300 mt-1">{session.shopName}</h4>
                    <p className="text-[10px] text-slate-400">GSTIN: {activeInvoice.shopId === 'sham-sweets' ? '07AAAAA1111A1Z1' : 'CUSTOM-REGISTERED'}</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      Paid via {activeInvoice.paymentMethod}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-mono">{activeInvoice.date} • {activeInvoice.id.slice(-6).toUpperCase()}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-4 font-bold text-slate-400 border-b border-slate-800 pb-2">
                    <div className="col-span-2">Item Description</div>
                    <div className="text-center">Qty</div>
                    <div className="text-right">Amount</div>
                  </div>
                  {activeInvoice.items.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-4 font-mono text-[11px] text-slate-300">
                      <div className="col-span-2">{item.productName}</div>
                      <div className="text-center">{item.quantity}</div>
                      <div className="text-right">₹{item.total}</div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between font-mono">
                    <span>Subtotal</span>
                    <span>₹{activeInvoice.totalAmount - activeInvoice.gstAmount}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>GST (5% Flat Food Tax)</span>
                    <span>₹{activeInvoice.gstAmount}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-slate-800/60">
                    <span>Grand Bill Total</span>
                    <span className="text-amber-400">₹{activeInvoice.totalAmount}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-[10px] text-slate-500">
                  <span>Cashier: {session.role} Terminal</span>
                  <button 
                    onClick={() => { window.print(); }} 
                    className="flex items-center space-x-1 hover:text-white text-slate-400 font-semibold transition"
                  >
                    <Printer className="h-3.5 w-3.5" /> <span>Direct Print Receipt</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* POS Cart Sidebar */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between h-[520px]">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <ShoppingCart className="h-4.5 w-4.5 text-slate-500 mr-2" /> Active POS Cart
                </h3>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                  {cart.length} Articles
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="h-64 flex flex-col justify-center items-center text-slate-300">
                  <Receipt className="h-12 w-12 stroke-1 mb-2" />
                  <p className="text-xs font-medium text-slate-400">POS Cart remains empty</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[170px] text-center">Click catalog products on left to construct bills.</p>
                </div>
              ) : (
                <div className="space-y-3.5 overflow-y-auto max-h-[300px] pr-1">
                  {cart.map((item) => {
                    const isKg = products.find(p => p.id === item.productId)?.unit === 'kg';
                    return (
                      <div key={item.productId} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                        <div className="max-w-[130px]">
                          <h4 className="font-bold text-slate-900 text-xs truncate">{item.name}</h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">₹{item.rate} /unit</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={() => updateQty(item.productId, -1, isKg)}
                            className="p-1 text-slate-500 hover:bg-slate-200 rounded"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 font-mono w-10 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQty(item.productId, 1, isKg)}
                            className="p-1 text-slate-500 hover:bg-slate-200 rounded"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => removeFromCart(item.productId)}
                            className="p-1 text-rose-500 hover:bg-rose-100 rounded ml-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Check-out summaries & payment switches */}
            {cart.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-500 font-mono">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-mono">
                    <span>GST (5% Flat tax)</span>
                    <span>₹{gst.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 text-sm font-extrabold pt-2 border-t border-slate-100">
                    <span>Payable Total</span>
                    <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-2">
                  {(['UPI', 'Cash', 'Card'] as const).map((method) => {
                    return (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`py-1.5 text-[10px] font-bold rounded-lg border text-center transition ${
                          paymentMethod === method 
                            ? 'bg-amber-600 border-amber-600 text-white' 
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-650'
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Register Payment Ticket</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
