
import { Product, Sale } from "./types";

const DB_NAME = "SmartShopDB";
const STORE_PRODUCTS = "products";
const STORE_SALES = "sales";
const DB_VERSION = 2;

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

// Kiểm tra xem trình duyệt đã cấp quyền lưu trữ bền vững chưa
export const isStoragePersistent = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted();
  }
  return false;
};

// Yêu cầu quyền lưu trữ bền vững (Không bị xóa khi đầy bộ nhớ)
export const requestPersistence = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
};

export const saveProductsToDB = async (products: Product[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_PRODUCTS, "readwrite");
  const store = tx.objectStore(STORE_PRODUCTS);
  store.clear();
  products.forEach(p => store.put(p));
  return new Promise(resolve => tx.oncomplete = () => resolve(true));
};

export const saveSaleToDB = async (sale: Sale) => {
  const db = await initDB();
  const tx = db.transaction(STORE_SALES, "readwrite");
  const store = tx.objectStore(STORE_SALES);
  store.add(sale);
  return new Promise(resolve => tx.oncomplete = () => resolve(true));
};

export const saveAllSalesToDB = async (sales: Sale[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_SALES, "readwrite");
  const store = tx.objectStore(STORE_SALES);
  store.clear();
  sales.forEach(s => store.put(s));
  return new Promise(resolve => tx.oncomplete = () => resolve(true));
};

export const getProductsFromDB = async (): Promise<Product[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_PRODUCTS, "readonly");
  const store = tx.objectStore(STORE_PRODUCTS);
  const request = store.getAll();
  return new Promise(resolve => request.onsuccess = () => resolve(request.result));
};

export const getSalesFromDB = async (): Promise<Sale[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_SALES, "readonly");
  const store = tx.objectStore(STORE_SALES);
  const request = store.getAll();
  return new Promise(resolve => request.onsuccess = () => resolve(request.result));
};

export const exportBackup = async () => {
  const products = await getProductsFromDB();
  const sales = await getSalesFromDB();
  const data = {
    version: "3.5",
    timestamp: Date.now(),
    deviceName: navigator.userAgent.substring(0, 50),
    products,
    sales
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SmartShop_Data_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const calculateStorageSize = (data: any): { text: string, bytes: number } => {
  const size = new Blob([JSON.stringify(data)]).size;
  let text = "";
  if (size < 1024) text = size + " B";
  else if (size < 1024 * 1024) text = (size / 1024).toFixed(2) + " KB";
  else text = (size / (1024 * 1024)).toFixed(2) + " MB";
  
  return { text, bytes: size };
};
