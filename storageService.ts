
import { createClient } from '@supabase/supabase-js';
import { Product, Sale } from "./types";

// Thông tin kết nối Supabase
const SUPABASE_URL = 'https://vwyultlxbpbgxonymfur.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MwmsVX5A_W_-8CayIzfYZw_0VCOp0e8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DB_NAME = "SmartShopDB_V4";
const STORE_PRODUCTS = "products";
const STORE_SALES = "sales";
const DB_VERSION = 1;

// --- CẤU HÌNH INDEXEDDB (LƯU TRỮ CỤC BỘ) ---
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) db.createObjectStore(STORE_PRODUCTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_SALES)) db.createObjectStore(STORE_SALES, { keyPath: "id" });
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

// --- LOGIC ĐỒNG BỘ ĐÁM MÂY ---
const tryCloudSync = async (table: string, data: any[]) => {
  try {
    if (data.length === 0) return;
    // Sử dụng upsert để cập nhật nếu trùng ID, thêm mới nếu chưa có
    const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
    if (error) {
      console.warn(`Cloud Sync Warning (${table}):`, error.message);
    }
  } catch (e) {
    console.error(`Critical Sync Error:`, e);
  }
};

// --- QUẢN LÝ SẢN PHẨM ---
export const saveProductsToDB = async (products: Product[]) => {
  // 1. Lưu cục bộ trước để phản hồi nhanh
  const db = await initDB();
  const tx = db.transaction(STORE_PRODUCTS, "readwrite");
  const store = tx.objectStore(STORE_PRODUCTS);
  await new Promise((resolve) => {
    store.clear();
    products.forEach(p => store.put(p));
    tx.oncomplete = resolve;
  });

  // 2. Đồng bộ lên đám mây (background)
  tryCloudSync('products', products);
};

export const getProductsFromDB = async (): Promise<Product[]> => {
  try {
    // Luôn ưu tiên lấy dữ liệu mới nhất từ Supabase
    const { data, error } = await supabase.from('products').select('*').order('createdAt', { ascending: false });
    if (!error && data) {
       // Nếu có dữ liệu từ Cloud, cập nhật lại vào Local để sử dụng offline
       const db = await initDB();
       const tx = db.transaction(STORE_PRODUCTS, "readwrite");
       const store = tx.objectStore(STORE_PRODUCTS);
       store.clear();
       data.forEach(p => store.put(p));
       return data;
    }
  } catch (e) {
    console.warn("Cloud pull failed, falling back to local storage");
  }

  // Fallback: Lấy từ Local nếu Cloud lỗi hoặc không có mạng
  const db = await initDB();
  const tx = db.transaction(STORE_PRODUCTS, "readonly");
  const request = tx.objectStore(STORE_PRODUCTS).getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
  });
};

// --- QUẢN LÝ ĐƠN HÀNG ---
export const saveSaleToDB = async (sale: Sale) => {
  const db = await initDB();
  const tx = db.transaction(STORE_SALES, "readwrite");
  tx.objectStore(STORE_SALES).put(sale);
  tryCloudSync('sales', [sale]);
};

export const saveAllSalesToDB = async (sales: Sale[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_SALES, "readwrite");
  const store = tx.objectStore(STORE_SALES);
  store.clear();
  sales.forEach(s => store.put(s));
  tryCloudSync('sales', sales);
};

export const getSalesFromDB = async (): Promise<Sale[]> => {
  try {
    const { data, error } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });
    if (!error && data) {
       const db = await initDB();
       const tx = db.transaction(STORE_SALES, "readwrite");
       const store = tx.objectStore(STORE_SALES);
       store.clear();
       data.forEach(s => store.put(s));
       return data;
    }
  } catch (e) {}

  const db = await initDB();
  const tx = db.transaction(STORE_SALES, "readonly");
  const request = tx.objectStore(STORE_SALES).getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
  });
};

// --- TIỆN ÍCH HỆ THỐNG ---
export const exportBackup = async () => {
  const products = await getProductsFromDB();
  const sales = await getSalesFromDB();
  const data = { version: "4.5-cloud-ready", timestamp: Date.now(), products, sales };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SmartShop_CloudBackup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const manualSyncAll = async () => {
  // Ép buộc làm mới dữ liệu từ cloud
  const products = await getProductsFromDB();
  const sales = await getSalesFromDB();
  return { products, sales };
};
