import fs from 'fs';
import path from 'path';
import { 
  Shop, Product, Ingredient, PurchaseLog, ProductionLog, 
  RetailSale, BulkCustomer, DailySupply, LedgerEntry, WasteLog, AuditLog,
  SaleItem, SupplyItem
} from '../src/types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DB_DIR_DEFAULT = path.join(process.cwd(), 'data');
const DB_FILE_DEFAULT = path.join(DB_DIR_DEFAULT, 'db.json');

let DB_DIR = DB_DIR_DEFAULT;
let DB_FILE = DB_FILE_DEFAULT;

// Under serverless environment (e.g. Vercel), copy seed database to writeable /tmp/db.json
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  const tmpDir = '/tmp';
  const tmpFile = path.join(tmpDir, 'db.json');
  try {
    if (!fs.existsSync(tmpFile)) {
      if (fs.existsSync(DB_FILE_DEFAULT)) {
        // Ensure /tmp directory exists
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        fs.copyFileSync(DB_FILE_DEFAULT, tmpFile);
        console.log(`[DATABASE] Seed database successfully copied to writable path: ${tmpFile}`);
      } else {
        console.warn(`[DATABASE] Default seed file not found at: ${DB_FILE_DEFAULT}`);
      }
    }
    DB_DIR = tmpDir;
    DB_FILE = tmpFile;
    console.log(`[DATABASE] Serverless/Production environment fallback set to: ${DB_FILE}`);
  } catch (err) {
    console.warn(`[DATABASE] Failed to initialize writeable fallback path:`, err);
  }
}

interface ErpDatabase {
  shops: Shop[];
  products: Product[];
  ingredients: Ingredient[];
  purchases: PurchaseLog[];
  productionLogs: ProductionLog[];
  retailSales: RetailSale[];
  customers: BulkCustomer[];
  supplies: DailySupply[];
  ledger: LedgerEntry[];
  wasteLogs: WasteLog[];
  auditLogs: AuditLog[];
}

// In-Memory state cache to ensure instant reads and avoid file I/O delays or serverless file ephemerality losses
let cachedDbState: ErpDatabase | null = null;
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url && key && url !== 'YOUR_SUPABASE_URL' && key !== 'YOUR_SUPABASE_ANON_KEY') {
    if (!supabaseClient) {
      supabaseClient = createClient(url, key);
    }
    return supabaseClient;
  }
  return null;
}

// Global hook to back up database asynchronously to Supabase cloud table
async function syncToSupabase(data: ErpDatabase, shopId: string = 'sham-sweets') {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('erp_database')
      .upsert({
        shop_id: shopId,
        data: data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'shop_id' });
    
    if (error) {
      console.error('[SUPABASE] Cloud Sync failed (Make sure table "erp_database" exists with text "shop_id" pk & jsonb "data" column):', error.message);
    } else {
      console.log('[SUPABASE] Database state successfully backed up to Supabase cloud.');
    }
  } catch (err) {
    console.error('[SUPABASE] Connection failed to propagate upsert:', err);
  }
}

// Global hook to pull database asynchronously from Supabase cloud table
async function syncFromSupabase(shopId: string = 'sham-sweets'): Promise<ErpDatabase | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('erp_database')
      .select('data')
      .eq('shop_id', shopId)
      .single();
    if (error) {
      console.warn('[SUPABASE] No cloud record available (will seed on next write operation):', error.message);
      return null;
    }
    if (data && data.data) {
      console.log('[SUPABASE] Memory cache successfully hydrated from cloud Supabase.');
      return data.data as ErpDatabase;
    }
  } catch (err) {
    console.error('[SUPABASE] Hydration lookup failed:', err);
  }
  return null;
}

// Async hydration trigger on startup
(async () => {
  const sbData = await syncFromSupabase();
  if (sbData) {
    cachedDbState = sbData;
    // Also backup locally to provide high performance local file backup
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(sbData, null, 2), 'utf8');
    } catch (e) {
      console.error('[DATABASE] Failed to write fallback cache file:', e);
    }
  }
})();

// Thread-safe lock mimicking ACID transaction
let isWriting = false;
const queue: (() => Promise<void>)[] = [];

async function processQueue() {
  if (isWriting) return;
  const next = queue.shift();
  if (next) {
    isWriting = true;
    try {
      await next();
    } catch (e) {
      console.error('Error writing to database:', e);
    } finally {
      isWriting = false;
      processQueue();
    }
  }
}

function writeDbSafely(data: ErpDatabase): Promise<void> {
  cachedDbState = data; // update memory cache immediately
  
  return new Promise((resolve, reject) => {
    const task = async () => {
      try {
        if (!fs.existsSync(DB_DIR)) {
          fs.mkdirSync(DB_DIR, { recursive: true });
        }
        const tempPath = DB_FILE + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, DB_FILE);
        
        // Backup to Supabase asynchronously in background so we don't block main request loop
        syncToSupabase(data);

        resolve();
      } catch (err) {
        reject(err);
      }
    };
    queue.push(task);
    processQueue();
  });
}

function readDb(): ErpDatabase {
  if (cachedDbState) {
    return cachedDbState;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      const db: ErpDatabase = JSON.parse(content);
      
      // Auto-heal collections to absolutely prevent 500 TypeError errors
      if (!db.shops) db.shops = [];
      if (!db.products) db.products = [];
      if (!db.ingredients) db.ingredients = [];
      if (!db.purchases) db.purchases = [];
      if (!db.productionLogs) db.productionLogs = [];
      if (!db.retailSales) db.retailSales = [];
      if (!db.customers) db.customers = [];
      if (!db.supplies) db.supplies = [];
      if (!db.ledger) db.ledger = [];
      if (!db.wasteLogs) db.wasteLogs = [];
      if (!db.auditLogs) db.auditLogs = [];

      // Auto-heal legacy db.json file to make sure the sham-sweets owner details exist
      let updated = false;
      if (db.shops) {
        const sham = db.shops.find(s => s.id === 'sham-sweets');
        if (sham) {
          if (!sham.ownerEmail || sham.ownerEmail !== 'admin@shamsweets.com' || sham.password !== 'ShamSweetsSecure2026!' || !sham.ownerName) {
            sham.ownerEmail = 'admin@shamsweets.com';
            sham.ownerName = 'Sham Lal';
            sham.password = 'ShamSweetsSecure2026!';
            updated = true;
          }
        } else {
          db.shops.push({
            id: 'sham-sweets',
            name: 'Sham Sweets',
            password: 'ShamSweetsSecure2026!',
            gstNumber: '07AAAAA1111A1Z1',
            address: 'Main Bazar, near Clock Tower, Ambala, Haryana',
            phoneNumber: '+91 98765 43210',
            registeredAt: '2026-05-20',
            ownerName: 'Sham Lal',
            ownerEmail: 'admin@shamsweets.com'
          });
          updated = true;
        }
      }

      if (updated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
      }

      cachedDbState = db;
      return db;
    }
  } catch (e) {
    console.error('Error reading database file:', e);
  }
  
  const initial = initializeDb();
  cachedDbState = initial;
  return initial;
}

function initializeDb(): ErpDatabase {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Generate a secure password for Sham Sweets
  const shamPassword = 'ShamSweetsSecure2026!';

  const defaultShopId = 'sham-sweets';

  const shops: Shop[] = [
    {
      id: defaultShopId,
      name: 'Sham Sweets',
      password: shamPassword,
      gstNumber: '07AAAAA1111A1Z1',
      address: 'Main Bazar, near Clock Tower, Ambala, Haryana',
      phoneNumber: '+91 98765 43210',
      registeredAt: '2026-05-20',
      ownerName: 'Sham Lal',
      ownerEmail: 'admin@shamsweets.com'
    }
  ];

  const products: Product[] = [
    { id: 'p1', shopId: defaultShopId, name: 'Kaju Katli', category: 'Sweets', unit: 'kg', sellingPrice: 900, costPrice: 600, shelfLifeDays: 30, sku: 'SW-KAJU-001' },
    { id: 'p2', shopId: defaultShopId, name: 'Rasgulla', category: 'Sweets', unit: 'kg', sellingPrice: 350, costPrice: 210, shelfLifeDays: 4, sku: 'SW-RAS-002' },
    { id: 'p3', shopId: defaultShopId, name: 'Pure Cow Milk', category: 'Dairy', unit: 'Litre', sellingPrice: 66, costPrice: 46, shelfLifeDays: 2, sku: 'DY-MILK-003' },
    { id: 'p4', shopId: defaultShopId, name: 'Fresh Paneer', category: 'Dairy', unit: 'kg', sellingPrice: 400, costPrice: 280, shelfLifeDays: 5, sku: 'DY-PAN-004' },
    { id: 'p5', shopId: defaultShopId, name: 'Thick Dahi', category: 'Dairy', unit: 'kg', sellingPrice: 90, costPrice: 60, shelfLifeDays: 7, sku: 'DY-DAHI-005' },
    { id: 'p6', shopId: defaultShopId, name: 'Sweet Lassi', category: 'Beverages', unit: 'Piece', sellingPrice: 50, costPrice: 25, shelfLifeDays: 3, sku: 'BV-LAS-006' },
    { id: 'p7', shopId: defaultShopId, name: 'Aloo Bhujia Namkeen', category: 'Namkeen', unit: 'kg', sellingPrice: 220, costPrice: 130, shelfLifeDays: 90, sku: 'NK-BHU-007' }
  ];

  const ingredients: Ingredient[] = [
    { id: 'i1', shopId: defaultShopId, name: 'Raw Milk', currentStock: 740, unit: 'Litre', reorderPoint: 200, batches: [{ batchNumber: 'B001', quantity: 740, expiryDate: '2026-06-18' }] },
    { id: 'i2', shopId: defaultShopId, name: 'Sugar', currentStock: 450, unit: 'kg', reorderPoint: 80, batches: [{ batchNumber: 'B002', quantity: 450, expiryDate: '2026-12-30' }] },
    { id: 'i3', shopId: defaultShopId, name: 'Khoya (Mawa)', currentStock: 110, unit: 'kg', reorderPoint: 30, batches: [{ batchNumber: 'B003', quantity: 110, expiryDate: '2026-06-21' }] },
    { id: 'i4', shopId: defaultShopId, name: 'Pure Desi Ghee', currentStock: 180, unit: 'kg', reorderPoint: 40, batches: [{ batchNumber: 'B004', quantity: 180, expiryDate: '2026-11-15' }] },
    { id: 'i5', shopId: defaultShopId, name: 'Cashew Nuts (Kaju)', currentStock: 65, unit: 'kg', reorderPoint: 20, batches: [{ batchNumber: 'B005', quantity: 65, expiryDate: '2026-09-10' }] },
    { id: 'i6', shopId: defaultShopId, name: 'Pistachios (Pista)', currentStock: 25, unit: 'kg', reorderPoint: 8, batches: [{ batchNumber: 'B006', quantity: 25, expiryDate: '2026-10-01' }] },
    { id: 'i7', shopId: defaultShopId, name: 'Eco Packaging Boxes', currentStock: 850, unit: 'Piece', reorderPoint: 150, batches: [{ batchNumber: 'B007', quantity: 850, expiryDate: '2027-06-01' }] }
  ];

  const customers: BulkCustomer[] = [
    { id: 'c1', shopId: defaultShopId, restaurantName: 'Royal Restaurant', contactPerson: 'Amit Singh', phoneNumber: '+91 99998 88777', address: '12 G.T. Road, Ambala', gstNumber: '07ROYAL1234A1ZB', creditLimit: 50000, creditDays: 15, outstandingBalance: 16750 },
    { id: 'c2', shopId: defaultShopId, restaurantName: 'Sharma Dhaba', contactPerson: 'Vijay Sharma', phoneNumber: '+91 98123 45678', address: 'Model Town Bypass, Ambala', gstNumber: '07SHARM4321B2ZC', creditLimit: 25000, creditDays: 7, outstandingBalance: 4600 },
    { id: 'c3', shopId: defaultShopId, restaurantName: 'Punjabi Tadka Cafe', contactPerson: 'Gurpreet Singh', phoneNumber: '+91 76543 21098', address: 'Mall Road, Ambala Cantt', gstNumber: '07PUNJA8901C3ZD', creditLimit: 40000, creditDays: 30, outstandingBalance: 8400 }
  ];

  const db: ErpDatabase = {
    shops,
    products,
    ingredients,
    purchases: [],
    productionLogs: [],
    retailSales: [],
    customers,
    supplies: [],
    ledger: [],
    wasteLogs: [],
    auditLogs: []
  };

  // Algorithmically mock historical records representing the previous 21 days
  // From 2026-05-26 to 2026-06-15 (since current local time metadata says 2026-06-16)
  const currentDays = 21;
  const baseDate = new Date('2026-05-26');

  // Let's seed Purchases, Production, Sales, Supplies, Ledger and Waste.
  for (let d = 0; d < currentDays; d++) {
    const loopDateStr = new Date(baseDate.getTime() + d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const loopDate = new Date(loopDateStr);
    const dayOfWeek = loopDate.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 1. Purchaselog seed every 5 days
    if (d % 5 === 0) {
      db.purchases.push({
        id: `pur-${d}-1`,
        shopId: defaultShopId,
        ingredientId: 'i1',
        ingredientName: 'Raw Milk',
        quantity: 500,
        pricePerUnit: 44,
        totalAmount: 22000,
        purchaseDate: loopDateStr
      });
      db.purchases.push({
        id: `pur-${d}-2`,
        shopId: defaultShopId,
        ingredientId: 'i2',
        ingredientName: 'Sugar',
        quantity: 100,
        pricePerUnit: 38,
        totalAmount: 3800,
        purchaseDate: loopDateStr
      });
    }

    // 2. Production Planning & Actual logs
    // Define target production multipliers (higher on weekends, slightly higher on Wednesdays)
    const productionMult = isWeekend ? 1.35 : 1.0;
    
    products.forEach((prod, pIdx) => {
      // Define average base targets
      let baseTarget = 50; // kg
      if (prod.id === 'p1') baseTarget = 60; // Kaju katli
      if (prod.id === 'p3') baseTarget = 300; // Cow milk litres
      if (prod.id === 'p4') baseTarget = 80;  // Paneer kg
      if (prod.id === 'p5') baseTarget = 100; // Dahi kg

      const planned = Math.round(baseTarget * productionMult);
      // Actual can vary slightly, sometimes exactly, sometimes less (wastage or ingredient short)
      const divergence = (Math.random() - 0.6) * 0.1; // average slightly lower than planned
      const actual = Math.max(1, Math.round(planned * (1 + divergence)));
      const cost = Math.round(actual * prod.costPrice);

      db.productionLogs.push({
        id: `prod-${loopDateStr}-${prod.id}`,
        shopId: defaultShopId,
        productId: prod.id,
        productName: prod.name,
        plannedQuantity: planned,
        actualQuantity: actual,
        productionCost: cost,
        productionDate: loopDateStr,
        status: 'Completed'
      });
    });

    // 3. Retail Sales logs
    // Higher sales on weekends (Saturdays & Sundays)
    const salesVolume = isWeekend ? 1.45 : 0.95;
    const paymentMethods: ('Cash' | 'UPI' | 'Card')[] = ['Cash', 'UPI', 'UPI', 'Card'];

    ['Counter', 'Walk-in', 'Online'].forEach((salesType, sIdx) => {
      const items: SaleItem[] = [];
      let saleTotal = 0;

      products.forEach((prod) => {
        // Average purchase frequency
        const purchaseProb = prod.category === 'Dairy' ? 0.8 : 0.5;
        if (Math.random() < purchaseProb) {
          const avgQty = prod.unit === 'Litre' ? 2 : prod.id === 'p1' ? 0.75 : 1.5;
          const qty = Number((avgQty * salesVolume * (0.8 + Math.random() * 0.4)).toFixed(2));
          if (qty > 0) {
            const total = Math.round(qty * prod.sellingPrice);
            items.push({
              productId: prod.id,
              productName: prod.name,
              quantity: qty,
              pricePerUnit: prod.sellingPrice,
              total
            });
            saleTotal += total;
          }
        }
      });

      if (items.length > 0) {
        const gst = Math.round(saleTotal * 0.05); // 5% GST on food
        db.retailSales.push({
          id: `sale-${loopDateStr}-${salesType}-01`,
          shopId: defaultShopId,
          date: loopDateStr,
          salesType: salesType as any,
          items,
          gstAmount: gst,
          totalAmount: saleTotal + gst,
          paymentMethod: paymentMethods[(d + sIdx) % paymentMethods.length]
        });
      }
    });

    // 4. Bulk Supplies (Daily Deliveries to customer master list)
    // Restaurants order daily/alternate days
    customers.forEach((cust, cIdx) => {
      // Rotate active days or deliver every day
      const orderProbability = cust.id === 'c1' ? 0.9 : 0.7; // Royal Restaurant orders almost daily
      if (Math.random() < orderProbability) {
        const supplyItems: SupplyItem[] = [];
        let supplyTotal = 0;

        products.forEach((prod) => {
          // Bulk purchase criteria (mostly milk, paneer, dahi, and some sweets)
          let baseQty = 0;
          if (prod.id === 'p3') baseQty = cust.id === 'c1' ? 40 : 20; // Pure milk
          if (prod.id === 'p4') baseQty = cust.id === 'c1' ? 12 : 6;  // Paneer
          if (prod.id === 'p5') baseQty = cust.id === 'c1' ? 10 : 5;  // Dahi
          if (prod.id === 'p2' && Math.random() > 0.6) baseQty = 5;  // Rasgulla occasionally

          if (baseQty > 0) {
            const qty = Math.round(baseQty * (0.85 + Math.random() * 0.3));
            // Bulk might receive a slight discount of 5-10% from retail
            const rate = Math.round(prod.sellingPrice * 0.9);
            const total = qty * rate;
            supplyItems.push({
              productId: prod.id,
              productName: prod.name,
              quantity: qty,
              unit: prod.unit,
              rate,
              total
            });
            supplyTotal += total;
          }
        });

        if (supplyItems.length > 0) {
          const supplyId = `sup-${loopDateStr}-${cust.id}`;
          db.supplies.push({
            id: supplyId,
            shopId: defaultShopId,
            customerId: cust.id,
            customerName: cust.restaurantName,
            date: loopDateStr,
            isChallanGenerated: true,
            status: 'Delivered',
            assignedDeliveryBoy: cIdx === 0 ? 'Ravi Kumar' : 'Manpreet Singh',
            items: supplyItems,
            totalAmount: supplyTotal,
            notes: 'Standard daily contract order'
          });

          // Post to Customer Ledger Debit (Supply increases outstanding balance)
          // Outstanding increases
          // Calculate outstanding at that point in history
          const description = `Daily order supply (${cust.restaurantName})`;
          
          db.ledger.push({
            id: `led-${loopDateStr}-${cust.id}-db`,
            shopId: defaultShopId,
            customerId: cust.id,
            customerName: cust.restaurantName,
            date: loopDateStr,
            type: 'Supply',
            referenceId: supplyId,
            description,
            amount: supplyTotal,
            outstandingBalanceAfter: 0 // Will adjust relative balances in a full pass later
          });
        }
      }

      // 5. Payments from customers (they pay partially every few days)
      const payProbability = d % 4 === 0;
      if (payProbability) {
        // Average payment between 8k and 15k
        const paymentAmount = Math.round(5000 + Math.random() * 8000 + 400 * d);
        const paymentId = `pay-${loopDateStr}-${cust.id}-cr`;
        
        db.ledger.push({
          id: `led-${loopDateStr}-${cust.id}-cr`,
          shopId: defaultShopId,
          customerId: cust.id,
          customerName: cust.restaurantName,
          date: loopDateStr,
          type: 'Payment',
          referenceId: paymentId,
          description: `Received payment - ${['UPI', 'Bank Transfer', 'Cheque'][cIdx % 3]}`,
          amount: paymentAmount,
          paymentMethod: ['UPI', 'Bank Transfer', 'Cheque'][cIdx % 3] as any,
          outstandingBalanceAfter: 0
        });
      }
    });

    // 6. Wastage Logs
    // Expiry or unsold leftover stock
    if (d % 3 === 0) {
      const type = Math.random() > 0.5 ? 'Product' : 'Ingredient';
      if (type === 'Product') {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = prod.id === 'p3' ? 12 : prod.id === 'p2' ? 5 : 2; // Milk or rasgulla leftovers
        const costVal = qty * prod.costPrice;
        db.wasteLogs.push({
          id: `waste-${loopDateStr}-${prod.id}`,
          shopId: defaultShopId,
          targetId: prod.id,
          targetName: prod.name,
          type: 'Product',
          quantity: qty,
          unit: prod.unit,
          wastageCost: costVal,
          reason: prod.id === 'p3' ? 'Expired' : 'Unsold Counter Stock',
          date: loopDateStr
        });
      } else {
        const item = ingredients[0]; // raw milk spillage
        const qty = 8;
        db.wasteLogs.push({
          id: `waste-${loopDateStr}-milkraw`,
          shopId: defaultShopId,
          targetId: 'i1',
          targetName: item.name,
          type: 'Ingredient',
          quantity: qty,
          unit: item.unit,
          wastageCost: qty * 45,
          reason: 'Spillage',
          date: loopDateStr
        });
      }
    }
  }

  // Compile real outstanding balances correctly in historical sequence
  // And align the current outstanding values in the BulkCustomers list
  customers.forEach((cust) => {
    let balance = 0;
    // Sort ledger entries for this customer chronologically
    const customerEntries = db.ledger.filter((entry) => entry.customerId === cust.id);
    customerEntries.sort((a, b) => a.date.localeCompare(b.date));

    customerEntries.forEach((entry) => {
      if (entry.type === 'Supply') {
        balance += entry.amount;
      } else {
        balance -= entry.amount;
      }
      entry.outstandingBalanceAfter = balance;
    });

    // Make sure it doesn't drop below zero in mockup
    if (balance < 0) {
      balance = Math.max(1000, balance + 12000);
      // Backfill a final outstanding adjustment
      customerEntries.forEach((entry, idx) => {
        // shift balances upwards
        entry.outstandingBalanceAfter += 12000;
      });
    }

    cust.outstandingBalance = balance;
  });

  // Seed default audit logs
  db.auditLogs.push({
    id: 'audit-01',
    shopId: defaultShopId,
    timestamp: '2026-06-15T09:00:00Z',
    userName: 'Sham Sweets Admin',
    role: 'Owner',
    action: 'SHOP_BOOT',
    module: 'System',
    details: 'Sham Sweets ERP system successfully initiated with preloaded historical transaction and demand data.'
  });

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  return db;
}

export const dbController = {
  getRawData: (): ErpDatabase => {
    return readDb();
  },

  saveRawData: async (data: ErpDatabase): Promise<void> => {
    await writeDbSafely(data);
  },

  getShopById: (id: string): Shop | undefined => {
    const db = readDb();
    return db.shops.find(s => s.id === id);
  },

  getShopByEmail: (email: string): Shop | undefined => {
    const db = readDb();
    return db.shops.find(s => s.ownerEmail?.toLowerCase() === email.toLowerCase());
  },

  getShopByName: (name: string): Shop | undefined => {
    const db = readDb();
    return db.shops.find(s => s.name.toLowerCase() === name.toLowerCase());
  },

  registerShop: async (newShop: Shop): Promise<void> => {
    const db = readDb();
    db.shops.push(newShop);

    // Bootstrap default products for this new sweet shop
    const defaultProducts: Product[] = [
      { id: `prod-${newShop.id}-p1`, shopId: newShop.id, name: 'Kaju Katli', category: 'Sweets', unit: 'kg', sellingPrice: 950, costPrice: 620, shelfLifeDays: 30, sku: `${newShop.id.toUpperCase()}-KAJU-001` },
      { id: `prod-${newShop.id}-p2`, shopId: newShop.id, name: 'Rasgulla', category: 'Sweets', unit: 'kg', sellingPrice: 350, costPrice: 220, shelfLifeDays: 4, sku: `${newShop.id.toUpperCase()}-RAS-002` },
      { id: `prod-${newShop.id}-p3`, shopId: newShop.id, name: 'Pure Cow Milk', category: 'Dairy', unit: 'Litre', sellingPrice: 70, costPrice: 48, shelfLifeDays: 2, sku: `${newShop.id.toUpperCase()}-MILK-003` },
      { id: `prod-${newShop.id}-p4`, shopId: newShop.id, name: 'Fresh Paneer', category: 'Dairy', unit: 'kg', sellingPrice: 420, costPrice: 290, shelfLifeDays: 5, sku: `${newShop.id.toUpperCase()}-PAN-004` },
      { id: `prod-${newShop.id}-p5`, shopId: newShop.id, name: 'Thick Dahi', category: 'Dairy', unit: 'kg', sellingPrice: 95, costPrice: 65, shelfLifeDays: 7, sku: `${newShop.id.toUpperCase()}-DAHI-005` }
    ];

    const defaultIngredients: Ingredient[] = [
      { id: `i-${newShop.id}-1`, shopId: newShop.id, name: 'Raw Milk', currentStock: 300, unit: 'Litre', reorderPoint: 100, batches: [{ batchNumber: 'B001', quantity: 300, expiryDate: '2026-06-20' }] },
      { id: `i-${newShop.id}-2`, shopId: newShop.id, name: 'Sugar', currentStock: 200, unit: 'kg', reorderPoint: 50, batches: [{ batchNumber: 'B002', quantity: 200, expiryDate: '2026-12-30' }] },
      { id: `i-${newShop.id}-3`, shopId: newShop.id, name: 'Khoya (Mawa)', currentStock: 50, unit: 'kg', reorderPoint: 15, batches: [{ batchNumber: 'B003', quantity: 50, expiryDate: '2026-06-22' }] }
    ];

    const defaultCustomers: BulkCustomer[] = [
      { id: `cust-${newShop.id}-1`, shopId: newShop.id, restaurantName: 'Elite Cafe', contactPerson: 'John Doe', phoneNumber: '+91 90000 00001', address: 'MG Road, Plaza Market', gstNumber: '07ELITE1234A1ZB', creditLimit: 30000, creditDays: 15, outstandingBalance: 6400 },
      { id: `cust-${newShop.id}-2`, shopId: newShop.id, restaurantName: 'Highway Treat', contactPerson: 'Paramjeet Singh', phoneNumber: '+91 90000 00002', address: 'National Highway 1', gstNumber: '07HWYTR5678B2ZC', creditLimit: 50000, creditDays: 10, outstandingBalance: 9800 }
    ];

    db.products.push(...defaultProducts);
    db.ingredients.push(...defaultIngredients);
    db.customers.push(...defaultCustomers);

    // Bootstrap 3 days of historical starter data (retail sales, supplies, production logs, ledger)
    const seedDates = ['2026-06-13', '2026-06-14', '2026-06-15'];
    seedDates.forEach((dStr, idx) => {
      // Retail sale
      db.retailSales.push({
        id: `sale-${newShop.id}-${dStr}`,
        shopId: newShop.id,
        date: dStr,
        salesType: idx % 2 === 0 ? 'Counter' : 'Walk-in',
        items: [
          { productId: defaultProducts[0].id, productName: defaultProducts[0].name, quantity: 5 + idx, pricePerUnit: defaultProducts[0].sellingPrice, total: (5 + idx) * defaultProducts[0].sellingPrice },
          { productId: defaultProducts[2].id, productName: defaultProducts[2].name, quantity: 20, pricePerUnit: defaultProducts[2].sellingPrice, total: 20 * defaultProducts[2].sellingPrice }
        ],
        gstAmount: Math.round(((5 + idx) * defaultProducts[0].sellingPrice + 20 * defaultProducts[2].sellingPrice) * 0.05),
        totalAmount: Math.round(((5 + idx) * defaultProducts[0].sellingPrice + 20 * defaultProducts[2].sellingPrice) * 1.05),
        paymentMethod: idx % 2 === 0 ? 'UPI' : 'Cash'
      });

      // Production log
      defaultProducts.forEach(prod => {
        db.productionLogs.push({
          id: `prod-${newShop.id}-${dStr}-${prod.id}`,
          shopId: newShop.id,
          productId: prod.id,
          productName: prod.name,
          plannedQuantity: 40,
          actualQuantity: 38 + idx,
          productionCost: (38 + idx) * prod.costPrice,
          productionDate: dStr,
          status: 'Completed'
        });
      });

      // Supplies and ledger
      const cust = defaultCustomers[idx % 2];
      const supplyId = `sup-${newShop.id}-${dStr}`;
      const supplyAmt = 3200 + (idx * 400);
      db.supplies.push({
        id: supplyId,
        shopId: newShop.id,
        customerId: cust.id,
        customerName: cust.restaurantName,
        date: dStr,
        isChallanGenerated: true,
        status: 'Delivered',
        assignedDeliveryBoy: 'Ravi Kumar',
        items: [
          { productId: defaultProducts[3].id, productName: defaultProducts[3].name, quantity: 10, unit: 'kg', rate: defaultProducts[3].sellingPrice, total: 10 * defaultProducts[3].sellingPrice }
        ],
        totalAmount: supplyAmt,
        notes: 'Starter bulk dispatch'
      });

      db.ledger.push({
        id: `led-${newShop.id}-${dStr}-db`,
        shopId: newShop.id,
        customerId: cust.id,
        customerName: cust.restaurantName,
        date: dStr,
        type: 'Supply',
        referenceId: supplyId,
        description: `Starter daily supply dispatched`,
        amount: supplyAmt,
        outstandingBalanceAfter: cust.outstandingBalance + (idx * 500)
      });
    });

    // Add immediate audit log
    db.auditLogs.push({
      id: `audit-${Date.now()}`,
      shopId: newShop.id,
      timestamp: new Date().toISOString(),
      userName: `${newShop.ownerName || 'Admin'}`,
      role: 'Owner',
      action: 'SYSTEM_REGISTER',
      module: 'Administration',
      details: `New Multi-Tenant Sweet Shop registered successfully: ${newShop.name}. Generated default roles with structured demo tables isolated automatically.`
    });

    await writeDbSafely(db);
  },

  logAudit: async (shopId: string, user: string, role: string, action: string, module: string, details: string) => {
    const db = readDb();
    db.auditLogs.push({
      id: `audit-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      shopId,
      timestamp: new Date().toISOString(),
      userName: user,
      role,
      action,
      module,
      details
    });
    await writeDbSafely(db);
  }
};
