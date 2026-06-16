import { GoogleGenAI } from '@google/genai';
import { dbController } from './db';
import { calculateDemandForecast } from './prediction';

export async function askAiAssistant(shopId: string, query: string): Promise<string> {
  const apikey = process.env.GEMINI_API_KEY;
  const data = dbController.getRawData();
  const shopProducts = data.products.filter(p => p.shopId === shopId);
  const shopCustomers = data.customers.filter(c => c.shopId === shopId);
  const shopSales = data.retailSales.filter(s => s.shopId === shopId);
  const shopSupplies = data.supplies.filter(s => s.shopId === shopId);
  const shopWaste = data.wasteLogs.filter(w => w.shopId === shopId);

  // Compute basic analytics from real database entries to inject as solid fact grounding
  const totalRetailRevenue = shopSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalBulkRevenue = shopSupplies.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalOutstandingAmt = shopCustomers.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const totalWastageCost = shopWaste.reduce((sum, w) => sum + w.wastageCost, 0);

  // Find custom margins
  const profitMargins = shopProducts.map(p => ({
    name: p.name,
    revenuePerUnit: p.sellingPrice,
    costPerUnit: p.costPrice,
    marginPercent: Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100),
    rawMargin: p.sellingPrice - p.costPrice
  }));
  profitMargins.sort((a, b) => b.rawMargin - a.rawMargin);

  // Find highest outstanding customer
  const sortedCustomers = [...shopCustomers].sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  const highestOutstandingCust = sortedCustomers[0];

  // Compute tomorrow's prediction baseline
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const predictionReport = calculateDemandForecast(shopId, tomorrowStr);

  // Consolidate these facts into a grounding payload for the Gemini system instructions
  const knowledgeBase = {
    shopName: dbController.getShopById(shopId)?.name || 'This Sweet Shop',
    currentTime: new Date().toISOString(),
    summaryStats: {
      totalRetailRevenue,
      totalBulkWholesaleRevenue: totalBulkRevenue,
      currentOutstandingReceivables: totalOutstandingAmt,
      totalWastageLossCost: totalWastageCost,
      activeCustomersCount: shopCustomers.length,
      activeProductsCatalogCount: shopProducts.length
    },
    mostProfitableProductsRanked: profitMargins.slice(0, 3),
    highestCustomerOutstanding: highestOutstandingCust ? {
      name: highestOutstandingCust.restaurantName,
      person: highestOutstandingCust.contactPerson,
      outstanding: highestOutstandingCust.outstandingBalance,
      limit: highestOutstandingCust.creditLimit,
      days: highestOutstandingCust.creditDays
    } : null,
    tomorrowDraftProductionPrediction: predictionReport.predictedProducts.map(p => ({
      name: p.productName,
      quantity: `${p.tomorrowPredictedQty} ${p.unit}`,
      reason: p.reasoning
    }))
  };

  if (!apikey || apikey === 'MY_GEMINI_API_KEY') {
    return generateFallbackAssistantResponse(query, knowledgeBase, "No Gemini API Key found in settings. Running local analytical model.");
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apikey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const systemInstruction = `You are a world-class financial auditor, operations advisor, and expert business assistant representing the Sweet Shop ERP.
You have native access to live database metrics for the shop, represented below. 
Answer questions using exact numbers and direct, hard evidence found in the data. Avoid flowery preambles. Keep answers professional, crisp and highly advisory.

SHOP LIVE METRICS GROUNDING KNOWLEDGE:
${JSON.stringify(knowledgeBase, null, 2)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: query,
      config: {
        systemInstruction,
        temperature: 0.1, // low temperature for highly grounded, factual responses
      }
    });

    return response.text || "Assistant compiled response successfully.";
  } catch (err: any) {
    console.error('AI assistant pipeline failed:', err);
    let errorMessage = err.message || String(err);
    let reason = "The AI Assistant is currently offline";
    if (errorMessage.includes("429") || errorMessage.includes("Quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      reason = "Live Gemini quota limits were temporarily exceeded";
    }
    return generateFallbackAssistantResponse(query, knowledgeBase, reason);
  }
}

// Generates extremely factual, custom answers based on live database metrics when Gemini is rate-limited or offline
function generateFallbackAssistantResponse(query: string, kb: any, reason: string): string {
  const q = query.toLowerCase();

  const header = `✨ [Business Intelligence System - Local Insights Enabled. Reason: ${reason}]

`;

  if (q.includes("revenue") || q.includes("profit") || q.includes("sale") || q.includes("earn") || q.includes("collection") || q.includes("retail") || q.includes("wholesale") || q.includes("amount") || q.includes("₹") || q.includes("rupee") || q.includes("money")) {
    const totalRev = kb.summaryStats.totalRetailRevenue + kb.summaryStats.totalBulkWholesaleRevenue;
    const topProd = kb.mostProfitableProductsRanked.map((p: any, i: number) => `${i + 1}. ${p.name} (Selling: ₹${p.revenuePerUnit}/unit, Margin: ${p.marginPercent}%)`).join("\n");
    return `${header}Here is your financial revenue & profitability report:

- **Retail Sales Revenue**: ₹${kb.summaryStats.totalRetailRevenue.toLocaleString('en-IN')}
- **Wholesale Bulk Revenue**: ₹${kb.summaryStats.totalBulkWholesaleRevenue.toLocaleString('en-IN')}
- **Cumulative Shop Revenue**: ₹${totalRev.toLocaleString('en-IN')}

**Top Profitable Products Rank:**
${topProd}

*Recommendation*: To improve capital efficiency, prioritize manufacturing larger batches of items with high raw margins (e.g. ${kb.mostProfitableProductsRanked[0]?.name || "sweets"}).`;
  }

  if (q.includes("outstanding") || q.includes("customer") || q.includes("debt") || q.includes("credit") || q.includes("balance") || q.includes("khata") || q.includes("ledger") || q.includes("due") || q.includes("pay")) {
    const custInfo = kb.highestCustomerOutstanding;
    const custSection = custInfo 
      ? `The highest outstanding credit balances belong to **${custInfo.name}** (contact: ${custInfo.person}). 
- **Outstanding Balance**: ₹${custInfo.outstanding.toLocaleString('en-IN')}
- **Allocated Credit Limit**: ₹${custInfo.limit.toLocaleString('en-IN')}
- **Assigned Credit Term**: ${custInfo.days} Days`
      : "No outstanding balances are currently logged for wholesale customers.";

    return `${header}Here is your audit statement on B2B outstanding receivables:

- **Total Outstanding Receivables**: ₹${kb.summaryStats.currentOutstandingReceivables.toLocaleString('en-IN')}
- **Active Commercial Customers**: ${kb.summaryStats.activeCustomersCount} accounts

**Top Risk Portfolio:**
${custSection}

*Action Advisory*: Place automated wholesale delivery pauses on any restaurant that exceeds its credit limit or terms to preserve liquidity.`;
  }

  if (q.includes("waste") || q.includes("spoiled") || q.includes("expire") || q.includes("perish") || q.includes("loss")) {
    return `${header}Here is your waste reduction and spoilage audit:

- **Cumulative Spoilage Loss (Logged Cost)**: ₹${kb.summaryStats.totalWastageLossCost.toLocaleString('en-IN')}

*Mitigation Strategy*: The highest loss factors typically center around pure liquid milk inventory carrying surpluses. Implement rigorous shelf-life countdown labels on kitchen refrigeration units. Reduce starter milk volume targets by 10-15% during early weekdays when walk-in traffic typically dips.`;
  }

  if (q.includes("predict") || q.includes("forecast") || q.includes("tomorrow") || q.includes("production") || q.includes("target") || q.includes("schedule")) {
    const list = kb.tomorrowDraftProductionPrediction.map((p: any) => `- **${p.name}**: ${p.quantity} target output (${p.reason})`).join("\n");
    return `${header}Here is tomorrow's automated production priority forecast:

${list}

*Operational Tip*: Ensure starting raw materials are checked by 6:00 AM. Crosscheck current paneer stock to avoid dual-boiling energy costs.`;
  }

  // General executive audit report
  const totalRev = kb.summaryStats.totalRetailRevenue + kb.summaryStats.totalBulkWholesaleRevenue;
  return `${header}Welcome to your Executive Sweet Shop Advisory Terminal. Here is a high-level command digest of **${kb.shopName}** as of today:

📊 **Financial Summary:**
- **Cumulative Gross Revenue**: ₹${totalRev.toLocaleString('en-IN')} (Retail: ₹${kb.summaryStats.totalRetailRevenue.toLocaleString('en-IN')}, B2B Wholesale: ₹${kb.summaryStats.totalBulkWholesaleRevenue.toLocaleString('en-IN')})
- **Outstanding Credit Receivables**: ₹${kb.summaryStats.currentOutstandingReceivables.toLocaleString('en-IN')}
- **Wastage Sunk Cost Loss**: ₹${kb.summaryStats.totalWastageLossCost.toLocaleString('en-IN')}

📈 **Catalog & Base Stats:**
- **Product Counter Products**: ${kb.summaryStats.activeProductsCatalogCount} varieties
- **Wholesale Customers Registered**: ${kb.summaryStats.activeCustomersCount} commercial accounts

💡 **Recommended Action Items:**
1. **Outstanding Accounts**: Monitor ${kb.highestCustomerOutstanding?.name || 'wholesale clients'} for payments (Current balance: ₹${kb.highestCustomerOutstanding?.outstanding.toLocaleString('en-IN') || 0}).
2. **Perishables Mitigation**: Review waste logs to reduce the ₹${kb.summaryStats.totalWastageLossCost.toLocaleString('en-IN')} raw material shrinkage.
3. **Smart Batching**: Prioritize high-margin products like **${kb.mostProfitableProductsRanked[0]?.name || "Sweets"}** during heavy footfall windows.

*Ask me questions regarding revenue, outstanding balances, waste loss logs or tomorrow's production forecast targets at any time.*`;
}
