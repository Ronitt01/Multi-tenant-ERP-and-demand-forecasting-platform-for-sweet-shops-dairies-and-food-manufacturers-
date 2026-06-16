export type ProductCategory = 'Sweets' | 'Dairy' | 'Namkeen' | 'Beverages';
export type UnitType = 'kg' | 'Litre' | 'Piece' | 'Packet';

export interface Shop {
  id: string;
  name: string;
  password?: string;
  gstNumber: string;
  address: string;
  phoneNumber: string;
  registeredAt: string;
  ownerName?: string;
  ownerEmail?: string;
}

export interface UserSession {
  token: string;
  shopId: string;
  shopName: string;
  role: 'Owner' | 'Manager' | 'Cashier' | 'Production Staff' | 'Delivery Staff';
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  category: ProductCategory;
  unit: UnitType;
  sellingPrice: number;
  costPrice: number;
  shelfLifeDays: number;
  sku: string;
}

export interface ExpiryBatch {
  batchNumber: string;
  quantity: number;
  expiryDate: string; // ISO date YYYY-MM-DD
}

export interface Ingredient {
  id: string;
  shopId: string;
  name: string;
  currentStock: number;
  unit: UnitType;
  reorderPoint: number;
  batches: ExpiryBatch[];
}

export interface PurchaseLog {
  id: string;
  shopId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  purchaseDate: string; // YYYY-MM-DD
  expiryDate?: string;
}

export interface ProductionLog {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  plannedQuantity: number;
  actualQuantity: number;
  productionCost: number;
  productionDate: string; // YYYY-MM-DD
  status: 'Planned' | 'In Progress' | 'Completed' | 'Failed';
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
}

export interface RetailSale {
  id: string;
  shopId: string;
  date: string; // YYYY-MM-DD
  salesType: 'Counter' | 'Online' | 'Walk-in';
  items: SaleItem[];
  gstAmount: number;
  totalAmount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card';
}

export interface BulkCustomer {
  id: string;
  shopId: string;
  restaurantName: string;
  contactPerson: string;
  phoneNumber: string;
  address: string;
  gstNumber: string;
  creditLimit: number;
  creditDays: number;
  outstandingBalance: number;
}

export interface SupplyItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}

export interface DailySupply {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  isChallanGenerated: boolean;
  status: 'Pending' | 'Delivered';
  assignedDeliveryBoy: string;
  items: SupplyItem[];
  totalAmount: number;
  notes: string;
}

export interface LedgerEntry {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  type: 'Supply' | 'Payment';
  referenceId: string; // DailySupply ID or Transaction ID
  description: string;
  amount: number;
  paymentMethod?: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  outstandingBalanceAfter: number;
}

export interface WasteLog {
  id: string;
  shopId: string;
  targetId: string; // Product ID or Raw Material name
  targetName: string;
  type: 'Product' | 'Ingredient';
  quantity: number;
  unit: string;
  wastageCost: number;
  reason: 'Expired' | 'Unsold Counter Stock' | 'Spillage' | 'Quality Issue';
  date: string; // YYYY-MM-DD
}

export interface IngredientRequirement {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  inStock: number;
  needed: number;
}

export interface PredictionProductResult {
  productId: string;
  productName: string;
  category: ProductCategory;
  unit: UnitType;
  tomorrowPredictedQty: number;
  confidence: number; // 0-100%
  reasoning: string;
}

export interface TomorrowPredictionReport {
  date: string;
  predictedProducts: PredictionProductResult[];
  ingredientRequirements: IngredientRequirement[];
  detectedFestivals: string[];
  weatherAlert?: {
    condition: string;
    temperature: number;
    impact: string;
  };
}

export interface AuditLog {
  id: string;
  shopId: string;
  timestamp: string;
  userName: string;
  role: string;
  action: string;
  module: string;
  details: string;
}
