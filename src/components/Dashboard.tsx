import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import { 
  TrendingUp, Users, DollarSign, AlertCircle, Bot, Send, 
  Sparkles, ClipboardList, ShoppingBag, Loader, CheckCircle
} from 'lucide-react';

interface DashboardProps {
  session: UserSession;
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  time: string;
}

export default function Dashboard({ session }: DashboardProps) {
  const [stats, setStats] = useState({
    retailRevenue: 0,
    wholesaleRevenue: 0,
    outstandingDue: 0,
    collectionRate: 85,
    totalWastage: 0,
    clientCount: 0
  });

  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Conversational AI Assistant state
  const [aiQuery, setAiQuery] = useState('');
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Preset prompts for AI Assistant
  const presets = [
    { label: "💰 Most profitable?", text: "Which sweet shop product is most profitable, and what is its net margin percentage?" },
    { label: "📉 Sales drop trigger?", text: "Why did sales drop, and how is the weather or week coefficient impacting recent sweet shop counter sales?" },
    { label: "⚠️ Highest unpaid debtor?", text: "Which restaurant/dhaba customer has the highest outstanding ledger amount? List contact details." },
    { label: "🔮 Tomorrow's production?", text: "What sweet and dairy items are recommended for tomorrow's production based on your forecast? Highlight ingredient requirements." }
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [session.shopId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get products, customers, and sales to compute stats locally
      const [pRes, cRes, sRes, supRes, wRes] = await Promise.all([
        fetch(`/api/products?shopId=${session.shopId}`),
        fetch(`/api/customers?shopId=${session.shopId}`),
        fetch(`/api/retail-sales?shopId=${session.shopId}`),
        fetch(`/api/supplies?shopId=${session.shopId}`),
        fetch(`/api/wastage?shopId=${session.shopId}`)
      ]);

      const products = await pRes.json();
      const customers = await cRes.json();
      const sales = await sRes.json();
      const supplies = await supRes.json();
      const wastage = await wRes.json();

      const retailSum = sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
      const wholesaleSum = supplies.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
      const duesSum = customers.reduce((sum: number, c: any) => sum + c.outstandingBalance, 0);
      const wastageLoss = wastage.reduce((sum: number, w: any) => sum + w.wastageCost, 0);

      setStats({
        retailRevenue: retailSum,
        wholesaleRevenue: wholesaleSum,
        outstandingDue: duesSum,
        collectionRate: wholesaleSum > 0 ? Math.round((wholesaleSum / (wholesaleSum + duesSum)) * 100) : 85,
        totalWastage: wastageLoss,
        clientCount: customers.length
      });

      // Group last 7 days sales for simple SVG graph
      const dateMap: Record<string, number> = {};
      sales.slice(0, 15).forEach((s: any) => {
        dateMap[s.date] = (dateMap[s.date] || 0) + s.totalAmount;
      });
      supplies.slice(0, 15).forEach((s: any) => {
        dateMap[s.date] = (dateMap[s.date] || 0) + s.totalAmount;
      });

      const processedHistory = Object.entries(dateMap)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-8);

      setSalesHistory(processedHistory);

      // Preload initial welcoming custom message from AI
      setChats([
        {
          sender: 'assistant',
          text: `Namaste! I am your AI Business Assistant for **${session.shopName}**. I can query our active ERP databases, analyze customer ledger sheets, detect waste patterns, and cross-reference recipe ingredients. Try clicking one of the preset alerts above or ask me any question!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (e) {
      console.error('Failed to load owner financials dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAiMessage = async (textToSend?: string) => {
    const rawMsg = textToSend || aiQuery;
    if (!rawMsg.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: rawMsg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChats(prev => [...prev, userMsg]);
    setAiQuery('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          query: rawMsg
        })
      });
      const data = await res.json();
      
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        text: data.answer || "I could not analyze this sector of the ledger. Please retry.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChats(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setChats(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `Failed to talk to AI backend: ${err.message || 'Connection lost'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Simple SVG charting
  const maxSale = salesHistory.length > 0 ? Math.max(...salesHistory.map(h => h.amount)) : 10000;
  const graphWidth = 500;
  const graphHeight = 160;

  return (
    <div className="space-y-6">
      {/* Dynamic welcome and description banner */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="h-40 w-40 text-amber-500" />
        </div>
        <div className="relative">
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full tracking-wider uppercase border border-amber-500/30">
            {session.role} Portal
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-3">
            {session.shopName} Accounts
          </h1>
          <p className="mt-2 text-slate-300 text-sm max-w-xl">
            Real-time financial collection rates, outstanding credits, asset reports, and AI-driven predictive insights.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col justify-center items-center text-slate-400">
          <Loader className="h-8 w-8 animate-spin text-amber-600 mb-2" />
          <p className="text-sm font-medium">Crunching ledger totals...</p>
        </div>
      ) : (
        <>
          {/* Main Financial KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center">
              <div className="p-3.5 bg-emerald-50 rounded-xl text-emerald-600 mr-4">
                <DollarSign className="h-6 w-6" id="kpi-earnings-icon" />
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retail Earnings</dt>
                <dd className="text-2xl font-extrabold text-slate-900 mt-1">₹{stats.retailRevenue.toLocaleString('en-IN')}</dd>
                <span className="text-xs text-slate-400">Total Counter Checkout</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center">
              <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600 mr-4">
                <ClipboardList className="h-6 w-6" id="kpi-supplies-icon" />
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bulk Supplies Dispatched</dt>
                <dd className="text-2xl font-extrabold text-slate-900 mt-1">₹{stats.wholesaleRevenue.toLocaleString('en-IN')}</dd>
                <span className="text-xs text-slate-400">Hotels & Restaurants</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center">
              <div className="p-3.5 bg-amber-50 rounded-xl text-amber-600 mr-4">
                <AlertCircle className="h-6 w-6" id="kpi-receivables-icon" />
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding Dues</dt>
                <dd className="text-2xl font-extrabold text-rose-650 mt-1">₹{stats.outstandingDue.toLocaleString('en-IN')}</dd>
                <span className="text-xs text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">Credit Aging Active</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center">
              <div className="p-3.5 bg-rose-50 rounded-xl text-rose-600 mr-4">
                <TrendingUp className="h-6 w-6" id="kpi-wastage-icon" />
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expired & Wastage Loss</dt>
                <dd className="text-2xl font-extrabold text-slate-900 mt-1">₹{stats.totalWastage.toLocaleString('en-IN')}</dd>
                <span className="text-xs text-slate-400">Wastage Valuation</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG Visual Revenue trends graph */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Revenue & Supply Trend</h3>
                  <p className="text-xs text-slate-400 font-medium">Daily aggregated billing totals for the previous 8 workdays</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    Collection Efficiency: {stats.collectionRate}%
                  </span>
                </div>
              </div>

              {salesHistory.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-slate-400 text-xs">No transaction history found yet.</div>
              ) : (
                <div className="relative">
                  <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="w-full h-auto overflow-visible">
                    {/* Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                      const y = 20 + p * 110;
                      const val = Math.round(maxSale * (1 - p));
                      return (
                        <g key={i}>
                          <line x1="45" y1={y} x2={graphWidth - 10} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                          <text x="5" y={y + 4} className="text-[10px] fill-slate-400 font-mono" textAnchor="start">₹{val.toLocaleString('en', { notation: 'compact' })}</text>
                        </g>
                      );
                    })}

                    {/* Bars or points */}
                    {salesHistory.map((h, idx) => {
                      const x = 60 + idx * ((graphWidth - 80) / (salesHistory.length - 1 || 1));
                      const ratio = h.amount / (maxSale || 1);
                      const barHt = ratio * 110;
                      const y = 130 - barHt;

                      return (
                        <g key={idx} className="group">
                          <rect 
                            x={x - 10} 
                            y={y} 
                            width="20" 
                            height={barHt} 
                            fill="url(#barGradient)" 
                            rx="4" 
                            className="hover:opacity-85 transition cursor-pointer"
                          />
                          <text 
                            x={x} 
                            y={y - 6} 
                            className="text-[9px] font-bold fill-slate-700 opacity-0 group-hover:opacity-100 transition duration-150" 
                            textAnchor="middle"
                          >
                            ₹{Math.round(h.amount)}
                          </text>
                          <text 
                            x={x} 
                            y="150" 
                            className="text-[9px] fill-slate-400 font-medium" 
                            textAnchor="middle"
                          >
                            {h.date.slice(5)}
                          </text>
                        </g>
                      );
                    })}
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              )}
            </div>

            {/* Collection efficiency and stats recap card */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Wholesale Client Status</h3>
              <p className="text-xs text-slate-400">Total active commercial accounts ledger parameters</p>

              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">Commercial Clients Registered</div>
                  <div className="text-sm font-bold text-slate-900">{stats.clientCount} Businesses</div>
                </div>

                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">Total Ledger Receivables</div>
                  <div className="text-sm font-bold text-rose-650">₹{stats.outstandingDue.toLocaleString('en-IN')}</div>
                </div>

                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">Average Credit Limit</div>
                  <div className="text-sm font-bold text-slate-900">₹35,000 / Client</div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                    <span>Payment Capture Velocity</span>
                    <span>{stats.collectionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${stats.collectionRate}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    * Payment capture velocity is calculated based on total dispatched supplies versus actual collected UPI/Cash receipts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Conversational AI Business Assistant UI */}
          <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-md flex flex-col md:max-h-[500px]">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500 rounded-xl text-slate-950">
                  <Bot className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center">
                    Conversational Business Assistant <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-[10px] text-amber-400 font-bold tracking-wider rounded uppercase">Gemini Powered</span>
                  </h3>
                  <p className="text-[10px] text-slate-300">Live analytics auditor • Ingredient consumption analyzer</p>
                </div>
              </div>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>

            {/* Quick Presets */}
            <div className="bg-slate-50 border-b border-slate-100 p-3 flex flex-wrap gap-2 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center mr-1">Quick analysis:</span>
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendAiMessage(preset.text)}
                  disabled={aiLoading}
                  className="px-3 py-1.5 bg-white hover:bg-amber-50 hover:border-amber-200 border border-slate-200 rounded-full font-medium text-slate-650 transition shadow-sm disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Chat conversation area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[350px] min-h-[220px]">
              {chats.map((chat, idx) => (
                <div 
                  key={idx}
                  className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                    chat.sender === 'user' 
                      ? 'bg-amber-600 text-white rounded-tr-none' 
                      : 'bg-slate-100 text-slate-850 rounded-tl-none whitespace-pre-line'
                  }`}>
                    <div className="font-semibold text-[10px] opacity-70 mb-1 flex justify-between items-center">
                      <span>{chat.sender === 'user' ? 'You' : 'Advisory Bot'}</span>
                      <span className="ml-4 font-mono">{chat.time}</span>
                    </div>
                    {chat.text}
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-500 shadow-sm flex items-center space-x-2">
                    <Loader className="h-3.5 w-3.5 animate-spin text-amber-600" />
                    <span>Gemini is scanning ledger logs and calculating business margins...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Question entry bar */}
            <div className="border-t border-slate-200 p-3 bg-slate-50 flex space-x-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                placeholder="Ask me: What should we produce tomorrow? Or, which client has the highest outstanding limit?"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={() => handleSendAiMessage()}
                disabled={aiLoading || !aiQuery.trim()}
                className="p-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-xl transition duration-150 flex items-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
