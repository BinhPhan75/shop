
export interface Product {
  id: string;
  sku?: string;
  name: string;
  brand?: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  unit?: string;
  imageUrl: string;
  createdAt: number;
  category?: string;
}

export interface CustomerInfo {
  fullName: string;
  address: string;
  idCard: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  purchasePrice: number;
  totalAmount: number;
  timestamp: number;
  customer?: CustomerInfo;
  status?: 'success' | 'pending' | 'shipping';
}

export type ViewState = 
  | 'admin_home' 
  | 'pos' 
  | 'inventory' 
  | 'reports' 
  | 'settings' 
  | 'product_detail' 
  | 'product_form';

export type UserRole = 'admin' | 'user';

export interface ScanResult {
  productId: string | null;
  confidence: number;
  suggestedName?: string;
  description?: string;
}
