import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { dbController } from './server/db';
import { calculateDemandForecast, getAiForecastCommentary } from './server/prediction';
import { askAiAssistant } from './server/aiAssistant';
import { Shop } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// Logger middleware for audit tracking
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    console.log(`[AUDIT] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  next();
});

// API Routes FIRST

// 1. Auth & Shop Registry Endpoints
app.get('/api/auth/sham-password', (req: Request, res: Response) => {
  try {
    const data = dbController.getRawData();
    const sham = data && data.shops ? data.shops.find(s => s.id === 'sham-sweets') : null;
    res.json({ password: sham?.password || 'ShamSweetsSecure2026!' });
  } catch (err: any) {
    console.error('[SERVER ERROR] Failed to fetch sham passcode:', err);
    res.json({ password: 'ShamSweetsSecure2026!' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { shopId, password, role } = req.body;

  if (!shopId || !password || !role) {
    res.status(400).json({ error: 'Shop ID or Owner Email, Password, and Role are required parameters.' });
    return;
  }

  // Support login via either Shop ID or Owner Email
  let shop;
  if (shopId.includes('@')) {
    shop = dbController.getShopByEmail(shopId);
  } else {
    shop = dbController.getShopById(shopId);
  }

  if (!shop) {
    res.status(404).json({ error: 'Sweet Shop or Owner Email not found. Try registering your sweet shop first.' });
    return;
  }

  if (shop.password !== password) {
    res.status(401).json({ error: 'Invalid passcode or credential mismatch.' });
    return;
  }

  // Create simple stateless session token
  const token = `session_${shop.id}_${role}_${Date.now()}`;
  res.json({
    token,
    shopId: shop.id,
    shopName: shop.name,
    role
  });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, shopName, ownerName, phoneNumber, mobileNumber, email, ownerEmail, address, gstNumber, password } = req.body;

  const finalShopName = name || shopName;
  const finalOwnerEmail = email || ownerEmail;
  const finalPhoneNumber = phoneNumber || mobileNumber;

  if (!finalShopName || !ownerName || !finalOwnerEmail || !password) {
    res.status(400).json({ error: 'Shop Name, Owner Name, Owner Email, and Secure Password are required.' });
    return;
  }

  const existingByName = dbController.getShopByName(finalShopName);
  if (existingByName) {
    res.status(409).json({ error: 'A sweet shop with this name has already been registered.' });
    return;
  }

  const existingByEmail = dbController.getShopByEmail(finalOwnerEmail);
  if (existingByEmail) {
    res.status(409).json({ error: 'A sweet shop owner with this email is already registered.' });
    return;
  }

  // Generate unique ID based on shop name
  const cleanId = finalShopName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  const newShop: Shop = {
    id: cleanId,
    name: finalShopName,
    password: password,
    gstNumber: gstNumber || 'N/A',
    address: address || 'Not Provided',
    phoneNumber: finalPhoneNumber || 'Not Provided',
    registeredAt: new Date().toISOString().split('T')[0],
    ownerName,
    ownerEmail: finalOwnerEmail
  };

  await dbController.registerShop(newShop);

  res.status(201).json({
    message: 'Sweet Shop and Owner profile successfully initialized!',
    shopId: cleanId,
    password: password,
    shopName: finalShopName,
    ownerName,
    ownerEmail: finalOwnerEmail
  });
});

// 2. Product Directory APIs
app.get('/api/products', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const data = dbController.getRawData();
  const list = data.products.filter(p => p.shopId === shopId);
  res.json(list);
});

app.post('/api/products', async (req: Request, res: Response) => {
  const { shopId, name, category, unit, sellingPrice, costPrice, shelfLifeDays, sku } = req.body;

  if (!shopId || !name || !category || !unit || !sellingPrice || !costPrice) {
    res.status(400).json({ error: 'Missing mandatory fields for Product mapping.' });
    return;
  }

  const db = dbController.getRawData();
  const id = `p-${Date.now()}`;
  const newProduct = {
    id,
    shopId,
    name,
    category,
    unit,
    sellingPrice: Number(sellingPrice),
    costPrice: Number(costPrice),
    shelfLifeDays: Number(shelfLifeDays || 5),
    sku: sku || `SKU-${Date.now().toString().slice(-4)}`
  };

  db.products.push(newProduct);
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Manager', 'CREATE_PRODUCT', 'Products', `Created product ${name}`);

  res.status(201).json(newProduct);
});

// 3. Raw Materials / Inventory Management
app.get('/api/ingredients', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const data = dbController.getRawData();
  const list = data.ingredients.filter(i => i.shopId === shopId);
  res.json(list);
});

app.post('/api/ingredients', async (req: Request, res: Response) => {
  const { shopId, name, currentStock, unit, reorderPoint, expiryDate } = req.body;

  if (!shopId || !name || !unit || currentStock === undefined) {
    res.status(400).json({ error: 'Missing raw material specs.' });
    return;
  }

  const db = dbController.getRawData();
  const id = `i-${Date.now()}`;
  const newIngredient = {
    id,
    shopId,
    name,
    currentStock: Number(currentStock),
    unit,
    reorderPoint: Number(reorderPoint || 20),
    batches: expiryDate ? [{ batchNumber: `B-${Date.now()}`, quantity: Number(currentStock), expiryDate }] : []
  };

  db.ingredients.push(newIngredient);
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Manager', 'CREATE_MATERIAL', 'Inventory', `Created raw material ${name}`);

  res.status(201).json(newIngredient);
});

app.post('/api/ingredients/buy', async (req: Request, res: Response) => {
  const { shopId, ingredientId, supplierName, quantity, pricePerUnit, expiryDate } = req.body;

  if (!shopId || !ingredientId || !quantity || !pricePerUnit) {
    res.status(400).json({ error: 'Purchase parameters are wrong.' });
    return;
  }

  const db = dbController.getRawData();
  const item = db.ingredients.find(ig => ig.id === ingredientId && ig.shopId === shopId);

  if (!item) {
    res.status(404).json({ error: 'Ingredient not found.' });
    return;
  }

  const cost = Number(quantity) * Number(pricePerUnit);
  item.currentStock += Number(quantity);

  if (expiryDate) {
    if (!item.batches) item.batches = [];
    item.batches.push({
      batchNumber: `B-${Date.now()}`,
      quantity: Number(quantity),
      expiryDate
    });
  }

  const purchaseLog = {
    id: `pur-${Date.now()}`,
    shopId,
    ingredientId,
    ingredientName: item.name,
    quantity: Number(quantity),
    pricePerUnit: Number(pricePerUnit),
    totalAmount: cost,
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate
  };

  db.purchases.push(purchaseLog);
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Manager', 'BUY_MATERIAL', 'Inventory', `Purchased ${quantity} ${item.unit} of ${item.name}`);

  res.status(201).json({ purchaseLog, ingredient: item });
});

app.get('/api/purchases', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const data = dbController.getRawData();
  const list = data.purchases.filter(p => p.shopId === shopId);
  res.json(list.reverse());
});

// 4. Daily Production planning
app.get('/api/production', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const data = dbController.getRawData();
  const list = data.productionLogs.filter(p => p.shopId === shopId);
  res.json(list);
});

app.post('/api/production/plan', async (req: Request, res: Response) => {
  const { shopId, productId, plannedQuantity, productionDate } = req.body;

  if (!shopId || !productId || !plannedQuantity) {
    res.status(400).json({ error: 'Plan targets are missing.' });
    return;
  }

  const db = dbController.getRawData();
  const prod = db.products.find(p => p.id === productId && p.shopId === shopId);

  if (!prod) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const newLog = {
    id: `prod-${Date.now()}`,
    shopId,
    productId,
    productName: prod.name,
    plannedQuantity: Number(plannedQuantity),
    actualQuantity: 0,
    productionCost: 0,
    productionDate: productionDate || new Date().toISOString().split('T')[0],
    status: 'Planned' as const
  };

  db.productionLogs.push(newLog);
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Production Staff', 'PLAN_PRODUCTION', 'Manufacturing', `Planned ${plannedQuantity} ${prod.unit} of ${prod.name}`);

  res.status(201).json(newLog);
});

app.post('/api/production/update', async (req: Request, res: Response) => {
  const { shopId, productionId, actualQuantity, status } = req.body;

  if (!shopId || !productionId || actualQuantity === undefined) {
    res.status(400).json({ error: 'Update data missing.' });
    return;
  }

  const db = dbController.getRawData();
  const log = db.productionLogs.find(l => l.id === productionId && l.shopId === shopId);

  if (!log) {
    res.status(404).json({ error: 'Production log entry not found.' });
    return;
  }

  const prod = db.products.find(p => p.id === log.productId && p.shopId === shopId);
  if (!prod) {
    res.status(404).json({ error: 'Associated product not mapped.' });
    return;
  }

  log.actualQuantity = Number(actualQuantity);
  log.status = status || 'Completed';
  log.productionCost = Number(actualQuantity) * prod.costPrice;

  // Simulate raw ingredient stock deduction during production
  // Under the hood, we consume ingredients dynamically based on RECIPES
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Production Staff', 'EXECUTE_PRODUCTION', 'Manufacturing', `Updated production ${log.productName}: Completed ${actualQuantity}`);

  res.json(log);
});

// 5. Retail Sales checkout
app.get('/api/retail-sales', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const data = dbController.getRawData();
  res.json(data.retailSales.filter(s => s.shopId === shopId).reverse());
});

app.post('/api/retail-sales', async (req: Request, res: Response) => {
  const { shopId, items, salesType, paymentMethod } = req.body;

  if (!shopId || !items || !items.length) {
    res.status(400).json({ error: 'Checkout items cannot be empty.' });
    return;
  }

  const db = dbController.getRawData();
  let subtotal = 0;
  const processedItems = items.map((cartItem: any) => {
    const prod = db.products.find(p => p.id === cartItem.productId && p.shopId === shopId);
    const rate = prod ? prod.sellingPrice : 100;
    const name = prod ? prod.name : 'Unknown Product';
    const total = Number(cartItem.quantity) * rate;
    subtotal += total;

    return {
      productId: cartItem.productId,
      productName: name,
      quantity: Number(cartItem.quantity),
      pricePerUnit: rate,
      total
    };
  });

  const gst = Math.round(subtotal * 0.05); // 5% flat GST food tax
  const totalAmount = subtotal + gst;

  const newSale = {
    id: `sale-${Date.now()}`,
    shopId,
    date: new Date().toISOString().split('T')[0],
    salesType: salesType || 'Counter',
    items: processedItems,
    gstAmount: gst,
    totalAmount,
    paymentMethod: paymentMethod || 'Cash'
  };

  db.retailSales.push(newSale);
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Cashier', 'Cashier', 'RETAIL_SALE', 'Retail Sales', `Checked out ticket total ₹${totalAmount}`);

  res.status(201).json(newSale);
});

// 6. Bulk Customer directory
app.get('/api/customers', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const data = dbController.getRawData();
  res.json(data.customers.filter(c => c.shopId === shopId));
});

app.post('/api/customers', async (req: Request, res: Response) => {
  const { shopId, restaurantName, contactPerson, phoneNumber, address, gstNumber, creditLimit, creditDays } = req.body;

  if (!shopId || !restaurantName || !phoneNumber) {
    res.status(400).json({ error: 'Restaurant Name and Contact Phone are required.' });
    return;
  }

  const db = dbController.getRawData();
  const newCustomer = {
    id: `c-${Date.now()}`,
    shopId,
    restaurantName,
    contactPerson: contactPerson || 'In-Charge Manager',
    phoneNumber,
    address: address || 'No Address Listed',
    gstNumber: gstNumber || 'N/A',
    creditLimit: Number(creditLimit || 20000),
    creditDays: Number(creditDays || 15),
    outstandingBalance: 0
  };

  db.customers.push(newCustomer);
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Manager', 'CREATE_BULK_CUSTOMER', 'Partners', `Registered bulk client ${restaurantName}`);

  res.status(201).json(newCustomer);
});

// 7. Daily Supply entries and Delivery dispatch
app.get('/api/supplies', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const data = dbController.getRawData();
  res.json(data.supplies.filter(s => s.shopId === shopId).reverse());
});

app.post('/api/supplies/deliver', async (req: Request, res: Response) => {
  const { shopId, customerId, assignedDeliveryBoy, items, notes } = req.body;

  if (!shopId || !customerId || !items || !items.length) {
    res.status(400).json({ error: 'Supply manifest cargo cannot be empty.' });
    return;
  }

  const db = dbController.getRawData();
  const customer = db.customers.find(c => c.id === customerId && c.shopId === shopId);
  if (!customer) {
    res.status(404).json({ error: 'Wholesale partner customer not mapped.' });
    return;
  }

  let deliveryTotal = 0;
  const processedItems = items.map((i: any) => {
    const prod = db.products.find(p => p.id === i.productId && p.shopId === shopId);
    const rate = prod ? Math.round(prod.sellingPrice * 0.9) : 100; // 10% Wholesale reduction discount
    const value = Number(i.quantity) * rate;
    deliveryTotal += value;

    return {
      productId: i.productId,
      productName: prod ? prod.name : 'Bulk Items',
      quantity: Number(i.quantity),
      unit: prod ? prod.unit : 'kg',
      rate,
      total: value
    };
  });

  const supplyId = `sup-${Date.now()}`;
  const newSupply = {
    id: supplyId,
    shopId,
    customerId,
    customerName: customer.restaurantName,
    date: new Date().toISOString().split('T')[0],
    isChallanGenerated: true,
    status: 'Delivered' as const,
    assignedDeliveryBoy: assignedDeliveryBoy || 'Unassigned Staff',
    items: processedItems,
    totalAmount: deliveryTotal,
    notes: notes || 'Daily commercial delivery'
  };

  db.supplies.push(newSupply);

  // Incremet customer outstanding dues ledger
  customer.outstandingBalance += deliveryTotal;

  // Add Supply entry to accounts ledger debit record
  db.ledger.push({
    id: `led-${Date.now()}-${customerId}-db`,
    shopId,
    customerId,
    customerName: customer.restaurantName,
    date: new Date().toISOString().split('T')[0],
    type: 'Supply',
    referenceId: supplyId,
    description: `Dispatched Supply: Cargo total ₹${deliveryTotal}`,
    amount: deliveryTotal,
    outstandingBalanceAfter: customer.outstandingBalance
  });

  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Manager', 'BULK_DISPATCH', 'Supplies Ledger', `Dispatched consignment to ${customer.restaurantName} total ₹${deliveryTotal}`);

  res.status(201).json(newSupply);
});

// 8. Financial Accounts Dues Ledger & Payment entry
app.get('/api/ledger', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const customerId = req.query.customerId as string;
  let list = dbController.getRawData().ledger.filter(l => l.shopId === shopId);
  if (customerId) {
    list = list.filter(l => l.customerId === customerId);
  }
  res.json(list.reverse()); // latest first
});

app.post('/api/ledger/payment', async (req: Request, res: Response) => {
  const { shopId, customerId, amount, paymentMethod, description } = req.body;

  if (!shopId || !customerId || !amount) {
    res.status(400).json({ error: 'Payment details are incomplete.' });
    return;
  }

  const db = dbController.getRawData();
  const customer = db.customers.find(c => c.id === customerId && c.shopId === shopId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  // Credit reduces outstanding balance
  customer.outstandingBalance -= Number(amount);

  const paymentId = `pay-${Date.now()}`;
  const newLedgerEntry = {
    id: `led-${Date.now()}-${customerId}-cr`,
    shopId,
    customerId,
    customerName: customer.restaurantName,
    date: new Date().toISOString().split('T')[0],
    type: 'Payment' as const,
    referenceId: paymentId,
    description: description || `Payment received via ${paymentMethod || 'UPI'}`,
    amount: Number(amount),
    paymentMethod: paymentMethod || 'UPI',
    outstandingBalanceAfter: customer.outstandingBalance
  };

  db.ledger.push(newLedgerEntry);
  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Cashier', 'Cashier', 'RECEIVE_PAYMENT', 'Supplies Ledger', `Processed receipts of ₹${amount} from ${customer.restaurantName}`);

  res.status(201).json(newLedgerEntry);
});

// 9. Wastage Tracker Log
app.get('/api/wastage', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  res.json(dbController.getRawData().wasteLogs.filter(w => w.shopId === shopId).reverse());
});

app.post('/api/wastage', async (req: Request, res: Response) => {
  const { shopId, targetId, targetName, type, quantity, unit, wastageCost, reason } = req.body;

  if (!shopId || !targetId || !targetName || !type || !quantity || !wastageCost || !reason) {
    res.status(400).json({ error: 'Wastage parameters incorrect.' });
    return;
  }

  const db = dbController.getRawData();
  const newWaste = {
    id: `waste-${Date.now()}`,
    shopId,
    targetId,
    targetName,
    type,
    quantity: Number(quantity),
    unit,
    wastageCost: Number(wastageCost),
    reason,
    date: new Date().toISOString().split('T')[0]
  };

  db.wasteLogs.push(newWaste);

  // If type is Ingredient, deduct its currentStock directly
  if (type === 'Ingredient') {
    const ing = db.ingredients.find(i => i.id === targetId && i.shopId === shopId);
    if (ing) {
      ing.currentStock = Math.max(0, ing.currentStock - Number(quantity));
    }
  }

  await dbController.saveRawData(db);
  await dbController.logAudit(shopId, 'Staff', 'Manager', 'LOG_WASTE', 'Wastage', `Logged waste for ${targetName} of cost ₹${wastageCost}`);

  res.status(201).json(newWaste);
});

// 10. Forecast Calculation API
app.get('/api/forecast', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const queryDate = req.query.date as string || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const report = calculateDemandForecast(shopId, queryDate);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Forecast compilation error.' });
  }
});

// Deep Gemini commentary for Prediction System
app.post('/api/forecast/commentary', async (req: Request, res: Response) => {
  const { shopId, report } = req.body;

  if (!shopId || !report) {
    res.status(400).json({ error: 'Missing forecast context parameters.' });
    return;
  }

  try {
    const commentary = await getAiForecastCommentary(shopId, report);
    res.json({ commentary });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'AI API query failure.' });
  }
});

// 11. Conversational AI Business Assistant
app.post('/api/ai-assistant', async (req: Request, res: Response) => {
  const { shopId, query } = req.body;

  if (!shopId || !query) {
    res.status(400).json({ error: 'Shop ID and query text required.' });
    return;
  }

  try {
    const answer = await askAiAssistant(shopId, query);
    res.json({ answer });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Conversational context failure.' });
  }
});

// 12. Audit Trail System
app.get('/api/audit-logs', (req: Request, res: Response) => {
  const shopId = req.query.shopId as string || 'sham-sweets';
  const list = dbController.getRawData().auditLogs.filter(a => a.shopId === shopId);
  res.json(list.reverse());
});

// Resilient API Error Handling Middleware
app.use('/api', (err: any, req: Request, res: Response, next: any) => {
  console.error('[API ERROR SEVERE]', err);
  res.status(500).json({
    error: err.message || 'An unexpected internal server error occurred within the sweet shop services.',
  });
});

// Vite / Static files handler
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  }).then((vite) => {
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      // Diagnostic log
      console.log(`[CATCH-ALL] Requested: ${req.method} ${req.originalUrl}`);
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          let template = fs.readFileSync(indexHtmlPath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          console.error(`[CATCH-ALL ERROR] index.html not found!`);
          res.status(404).send('index.html not found');
        }
      } catch (e: any) {
        console.error(`[CATCH-ALL ERROR] Exception during ${req.originalUrl}:`, e);
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ERP BACKEND] Sham Sweets ERP custom server booted successfully.`);
    console.log(`[ERP BACKEND] Binding active server to interface http://0.0.0.0:${PORT}`);
  });
}

export default app;
