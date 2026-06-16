import React, { useState, useEffect } from 'react';
import { UserSession, TomorrowPredictionReport } from '../types';
import { 
  Sparkles, Calendar, CloudSun, AlertTriangle, ListChecks, 
  Bot, RefreshCw, BarChart2, ShieldCheck, HelpCircle, Loader2
} from 'lucide-react';

interface ForecastProps {
  session: UserSession;
}

export default function TomorrowForecast({ session }: ForecastProps) {
  const tomorrowDateStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(tomorrowDateStr);
  const [report, setReport] = useState<TomorrowPredictionReport | null>(null);
  const [aiCommentary, setAiCommentary] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchPredictionReport();
  }, [targetDate, session.shopId]);

  const fetchPredictionReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forecast?shopId=${session.shopId}&date=${targetDate}`);
      const data = await res.json();
      setReport(data);

      // Trigger server-side Gemini advisory commentary for this report
      fetchAiCommentary(data);
    } catch (e) {
      console.error('Failed to compute forecast reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiCommentary = async (currReport: TomorrowPredictionReport) => {
    setAiLoading(true);
    setAiCommentary('');
    try {
      const res = await fetch('/api/forecast/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: session.shopId,
          report: currReport
        })
      });
      const data = await res.json();
      setAiCommentary(data.commentary || 'Could not fetch advisor notes.');
    } catch (err: any) {
      setAiCommentary('AI Adviser offline: Procure a valid GEMINI_API_KEY to activate predictions commentary.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and control header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-3 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Sparkles className="h-5.5 w-5.5 text-amber-600 mr-2.5" /> Demand Prediction & Ingredient Forecaster
          </h2>
          <p className="text-xs text-slate-400 font-medium font-sans">Leverage weekend traffic indexes, upcoming regional festivals, and local temperatures to streamline kitchen production.</p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <label className="font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Forecast Date:</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 bg-white font-mono font-bold text-slate-800"
          />
        </div>
      </div>

      {loading || !report ? (
        <div className="h-64 flex flex-col justify-center items-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-amber-650 mb-2" />
          <p className="text-sm font-medium">Computing historical wedding coefficients & recipe requirements...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Weather & Festival proximity alarms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-150 p-4 rounded-xl flex items-start">
                <CloudSun className="h-6 w-6 text-amber-600 mr-3 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-widest">Macro Weather Forecast</h4>
                  <p className="font-bold text-slate-900 text-sm mt-1">{report.weatherAlert?.condition} ({report.weatherAlert?.temperature}°C)</p>
                  <p className="text-[11px] text-slate-650 mt-1 font-sans">{report.weatherAlert?.impact}</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-150 p-4 rounded-xl flex items-start">
                <Calendar className="h-6 w-6 text-purple-600 mr-3 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-extrabold text-purple-850 uppercase tracking-widest">Seasonal / Festival Tracker</h4>
                  <p className="font-bold text-slate-900 text-sm mt-1">
                    {report.detectedFestivals.length > 0 ? report.detectedFestivals.join(' & ') : 'Stable Baseline (No imminent festivals)'}
                  </p>
                  <p className="text-[11px] text-slate-650 mt-1">
                    {report.detectedFestivals.length > 0 
                      ? 'Recommending up to +35% manufacture buffers for sweet products.' 
                      : 'Production margins aligned with normal daily contract coefficients.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tomorrow's Recommended Production list */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center">
                  <BarChart2 className="h-4.5 w-4.5 text-slate-500 mr-2" /> Tomorrow's Production Target Recommendations
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Date: {report.date}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {report.predictedProducts.map((p) => {
                  return (
                    <div key={p.productId} className="p-4 rounded-xl border border-slate-150 hover:border-amber-300 transition duration-150 flex flex-col justify-between h-40 bg-slate-50/50">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-455 bg-white px-2 py-0.5 rounded border border-slate-150 uppercase">
                            {p.category}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                            {p.confidence}% confidence
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-930 text-sm mt-2">{p.productName}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{p.reasoning}</p>
                      </div>
                      <div className="flex justify-between items-end border-t border-slate-100/80 pt-3.5 mt-2">
                        <span className="text-[10px] font-medium text-slate-405">Recommended Output</span>
                        <span className="text-sm font-extrabold text-amber-700">{p.tomorrowPredictedQty} {p.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ingredient forecasting (Raw Materials deficit tracker) */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center">
                <ListChecks className="h-4.5 w-4.5 text-slate-500 mr-2" /> Predicted Ingredient Procurement Requirements
              </h3>
              <p className="text-xs text-slate-400 font-medium">Based on standard sweet shop recipe weights, here are raw material volumes matching target production:</p>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="py-2 px-3 rounded-l-lg">Raw Material Name</th>
                      <th className="py-2 px-3">Total Required Quantity</th>
                      <th className="py-2 px-3">On-Hand Stock Balance</th>
                      <th className="py-2 px-3 rounded-r-lg">Deficit/Shortage Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.ingredientRequirements.map((ing) => {
                      const deficitQuantity = Math.max(0, ing.needed - ing.inStock);
                      const hasDeficit = deficitQuantity > 0;

                      return (
                        <tr key={ing.ingredientId} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-900">{ing.ingredientName}</td>
                          <td className="py-3 px-3 font-bold text-slate-800">{ing.needed} {ing.unit}</td>
                          <td className="py-3 px-3 text-slate-550">{ing.inStock} {ing.unit}</td>
                          <td className="py-3 px-3">
                            {hasDeficit ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-100 text-rose-650 font-mono">
                                Short: {deficitQuantity} {ing.unit}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-800">
                                <ShieldCheck className="h-3 w-3 mr-1" /> Stock Sufficient
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
          </div>

          {/* AI Advisor sidebar */}
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-fit space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">AI Forecasting Advisor</h3>
              </div>
              <button 
                onClick={() => fetchAiCommentary(report)}
                className="p-1 text-slate-400 hover:text-slate-800 transition rounded hover:bg-slate-50"
                title="Regenerate Advice"
                disabled={aiLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-medium">Real-time Gemini narrative analyzing ingredients deficits, wedding seasons, and spoilage prevention.</p>

            {aiLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                <p className="text-[10px] font-bold text-center">Gemini is drafting operational recommendations...</p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line text-left">
                {aiCommentary}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl text-[10px] text-amber-800 leading-normal flex items-start space-x-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Wastage Mitigation Notice:</span> Pure Cow Milk products and Dahi have a 2-5 day shelf-life. On Wednesdays and Mondays, lower raw cream inputs by 15% to buffer weekend surplus leftovers.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
