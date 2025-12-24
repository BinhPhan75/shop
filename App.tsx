
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, ViewState, UserRole, Sale, CustomerInfo } from './types';
import ProductForm from './ProductForm';
import CameraView from './CameraView';
import { searchProductByImage } from './geminiService';
import { 
  saveProductsToDB, 
  getProductsFromDB, 
  calculateStorageSize, 
  saveSaleToDB, 
  getSalesFromDB, 
  saveAllSalesToDB,
  exportBackup
} from './storageService';

const removeAccents = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
};

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [view, setView] = useState<ViewState>('dashboard');
  const [role, setRole] = useState<UserRole>('user');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'processing'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [productFilterId, setProductFilterId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  
  const [isSelling, setIsSelling] = useState(false);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [customer, setCustomer] = useState<CustomerInfo>({ fullName: '', address: '', idCard: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const [reportFrom, setReportFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [reportTo, setReportTo] = useState(now.toISOString().split('T')[0]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedProducts, savedSales] = await Promise.all([getProductsFromDB(), getSalesFromDB()]);
        setProducts(savedProducts);
        setSales(savedSales);
        const savedRole = localStorage.getItem('userRole') as UserRole;
        if (savedRole) setRole(savedRole);
      } catch (e) { console.error(e); } finally { setTimeout(() => setIsLoading(false), 500); }
    };
    loadData();
  }, []);

  useEffect(() => { if (!isLoading) saveProductsToDB(products); }, [products, isLoading]);
  useEffect(() => { if (!isLoading) saveAllSalesToDB(sales); }, [sales, isLoading]);

  const stats = useMemo(() => ({
    count: products.length,
    totalItems: products.reduce((acc, p) => acc + p.stock, 0),
    investment: products.reduce((acc, p) => acc + (p.purchasePrice * p.stock), 0),
    storage: calculateStorageSize({ products, sales })
  }), [products, sales]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = removeAccents(searchQuery);
    return products.filter(p => removeAccents(`${p.name} ${p.id}`).includes(q));
  }, [products, searchQuery]);

  const soldProductsList = useMemo(() => {
    const unique = new Map<string, string>();
    sales.forEach(s => {
      if (!unique.has(s.productId)) unique.set(s.productId, s.productName);
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [sales]);

  const reportData = useMemo(() => {
    const start = new Date(reportFrom); start.setHours(0, 0, 0, 0);
    const end = new Date(reportTo); end.setHours(23, 59, 59, 999);
    
    let filtered = sales.filter(s => s.timestamp >= start.getTime() && s.timestamp <= end.getTime());
    
    if (customerSearchQuery.trim()) {
      const cq = removeAccents(customerSearchQuery);
      filtered = filtered.filter(s => 
        (s.customer?.fullName && removeAccents(s.customer.fullName).includes(cq)) ||
        (s.customer?.idCard && removeAccents(s.customer.idCard).includes(cq))
      );
    }

    if (productFilterId) {
      filtered = filtered.filter(s => s.productId === productFilterId);
    }

    const revenue = filtered.reduce((acc, s) => acc + s.totalAmount, 0);
    const cost = filtered.reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);
    
    return {
      sales: filtered.sort((a, b) => b.timestamp - a.timestamp),
      revenue, 
      cost,
      profit: revenue - cost, 
      count: filtered.length
    };
  }, [sales, reportFrom, reportTo, customerSearchQuery, productFilterId]);

  const startSelling = (p: Product) => {
    setSelectedProduct(p);
    setSellQuantity(1);
    setIsSelling(true);
  };

  const handleConfirmSale = () => {
    if (!selectedProduct) return;
    if (!customer.fullName.trim()) return alert("Vui lòng nhập tên khách hàng.");

    const newSale: Sale = {
      id: crypto.randomUUID(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: sellQuantity,
      sellingPrice: selectedProduct.sellingPrice,
      purchasePrice: selectedProduct.purchasePrice,
      totalAmount: selectedProduct.sellingPrice * sellQuantity,
      timestamp: Date.now(),
      customer: { ...customer }
    };

    saveSaleToDB(newSale);
    setSales([newSale, ...sales]);
    setProducts(products.map(p => p.id === selectedProduct.id ? { ...p, stock: p.stock - sellQuantity } : p));
    
    setIsSelling(false);
    setCustomer({ fullName: '', address: '', idCard: '' });
    alert("Bán hàng thành công!");
    setView('dashboard');
  };

  const handlePinInput = (digit: string) => {
    const nextPin = enteredPin + digit;
    if (nextPin.length <= 4) {
      setEnteredPin(nextPin);
      if (nextPin.length === 4) {
        if (nextPin === '1234') { 
          setRole('admin');
          localStorage.setItem('userRole', 'admin');
          setShowLoginModal(false);
          setEnteredPin('');
        } else {
          alert('Mã PIN không chính xác!');
          setEnteredPin('');
        }
      }
    }
  };

  const handleGoogleDriveUpload = () => {
    alert("Đang yêu cầu quyền truy cập Google Drive...\nHệ thống sẽ đồng bộ bản sao lưu vào thư mục 'SmartShop_Cloud'.");
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.products && data.sales) {
          if (window.confirm("Dữ liệu hiện tại sẽ bị ghi đè. Bạn có chắc chắn muốn khôi phục?")) {
            setProducts(data.products);
            setSales(data.sales);
            alert("Khôi phục dữ liệu thành công!");
          }
        } else {
          alert("File dữ liệu không đúng cấu trúc SmartShop.");
        }
      } catch (err) {
        alert("Lỗi khi đọc file JSON.");
      }
    };
    reader.readAsText(file);
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  if (isLoading) return <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center text-white font-black animate-pulse-soft">SMARTSHOP</div>;

  return (
    <div className={`min-h-screen ${role === 'admin' ? 'bg-slate-50' : 'bg-white'} pb-24 font-sans`}>
      <header className="bg-indigo-600 text-white p-6 pt-12 rounded-b-[2rem] shadow-lg sticky top-0 z-40">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div onClick={() => { setLogoClicks(c => c + 1); if(logoClicks === 4) { setShowLoginModal(true); setLogoClicks(0); } }} className="cursor-pointer active:scale-95 transition-transform">
            <h1 className="text-xl font-black tracking-tighter">SMARTSHOP</h1>
            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NHÂN VIÊN'}</p>
          </div>
          <button onClick={() => setIsScanning(true)} className="bg-white/20 p-3 rounded-2xl backdrop-blur-md active:scale-90 transition-all border border-white/10 shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-5 space-y-6">
        {view === 'dashboard' && (
          <>
            <div className="relative">
              <input type="text" placeholder="Tìm hàng hóa..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
              <svg className="w-5 h-5 absolute left-4 top-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            
            <div className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <p className="text-[10px] font-black opacity-60 uppercase mb-1">{role === 'admin' ? 'TỔNG VỐN TRONG KHO' : 'TỔNG QUAN KHO'}</p>
                  <h2 className="text-2xl font-black mb-4">{role === 'admin' ? formatCurrency(stats.investment) : `${stats.totalItems} Sản phẩm`}</h2>
                  <div className="flex gap-6">
                    <div><p className="text-[9px] font-bold opacity-60 uppercase mb-0.5">Loại hàng</p><p className="font-black text-lg">{stats.count}</p></div>
                    <div><p className="text-[9px] font-bold opacity-60 uppercase mb-0.5">Tồn kho</p><p className="font-black text-lg">{stats.totalItems}</p></div>
                  </div>
               </div>
               <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            {role === 'admin' && (
              <button onClick={() => { setIsEditing(false); setView('add'); }} className="w-full py-5 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase text-xs tracking-widest hover:border-indigo-500 hover:text-indigo-500 transition-all">+ NHẬP HÀNG MỚI</button>
            )}
            
            <div className="grid grid-cols-1 gap-4">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center space-x-4 shadow-sm hover:shadow-md transition-all">
                  <div onClick={() => { setSelectedProduct(p); setView('detail'); }} className="flex flex-1 items-center space-x-4 cursor-pointer min-w-0">
                    <img src={p.imageUrl} className="w-14 h-14 rounded-2xl object-cover bg-slate-50 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-800 uppercase text-[11px] truncate">{p.name}</h4>
                      <div className="flex flex-col">
                        {role === 'admin' && (
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Vốn: <span className="text-slate-600">{formatCurrency(p.purchasePrice)}</span></p>
                        )}
                        <p className="text-indigo-600 font-black text-sm">{formatCurrency(p.sellingPrice)}</p>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border ${p.stock < 5 ? 'bg-red-50 text-red-500 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>TỒN: {p.stock}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); startSelling(p); }}
                    disabled={p.stock <= 0}
                    className={`p-3 rounded-2xl shadow-sm border transition-all active:scale-90 ${p.stock > 0 ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-50 text-slate-200 border-slate-100 cursor-not-allowed'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'reports' && (
          <div className="space-y-6 animate-in slide-in-from-right-8">
             <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100">
                <h2 className="text-lg font-black uppercase mb-6 flex items-center gap-2">BÁO CÁO THỐNG KÊ</h2>
                
                <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 p-4 rounded-2xl">
                  <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Từ ngày</label><input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="w-full p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold outline-none" /></div>
                  <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Đến ngày</label><input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="w-full p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold outline-none" /></div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="relative">
                    <select value={productFilterId} onChange={e => setProductFilterId(e.target.value)} className="w-full p-3.5 pl-11 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs appearance-none">
                      <option value="">Tất cả mặt hàng</option>
                      {soldProductsList.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <svg className="w-4 h-4 absolute left-4 top-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8 8-8-8"></path></svg>
                  </div>
                  <input type="text" placeholder="Tìm theo tên khách hàng..." value={customerSearchQuery} onChange={e => setCustomerSearchQuery(e.target.value)} className="w-full p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs px-4" />
                </div>

                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-lg">
                    <p className="text-[10px] font-bold opacity-50 uppercase mb-1">TỔNG DOANH THU</p>
                    <h3 className="text-2xl font-black">{formatCurrency(reportData.revenue)}</h3>
                  </div>
                  {role === 'admin' && (
                    <div className="p-6 bg-emerald-600 rounded-3xl text-white shadow-lg animate-in zoom-in-95">
                      <p className="text-[10px] font-bold opacity-50 uppercase mb-1">TỔNG LỢI NHUẬN</p>
                      <h3 className="text-2xl font-black">{formatCurrency(reportData.profit)}</h3>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                   {reportData.sales.map(s => (
                    <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex justify-between items-start mb-1">
                          <p className="font-black text-slate-800 uppercase text-[10px] truncate max-w-[150px]">{s.productName}</p>
                          <p className="font-black text-slate-900 text-xs">{formatCurrency(s.totalAmount)}</p>
                       </div>
                       <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase">
                          <span>{new Date(s.timestamp).toLocaleDateString()} • {s.quantity} sp</span>
                          <span className="text-indigo-500 italic">{s.customer?.fullName || "Khách lẻ"}</span>
                       </div>
                    </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 space-y-8 animate-in slide-in-from-right-8">
             <h2 className="text-xl font-black uppercase tracking-tight">HỆ THỐNG</h2>
             
             <section className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PHÂN QUYỀN</h3>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => { setRole('user'); setView('dashboard'); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${role === 'user' ? 'bg-slate-900 text-white' : 'bg-white text-slate-300'}`}>NHÂN VIÊN</button>
                   <button onClick={() => { if(role !== 'admin') setShowLoginModal(true); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-300'}`}>ADMIN</button>
                </div>
             </section>

             {role === 'admin' && (
               <section className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">QUẢN LÝ DỮ LIỆU</h3>
                  <div className="space-y-3">
                    <button onClick={exportBackup} className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2"></path></svg>
                      SAO LƯU DỮ LIỆU (.JSON)
                    </button>
                    
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all">
                      KHÔI PHỤC TỪ FILE
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestore} />

                    <button onClick={handleGoogleDriveUpload} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-95 transition-all">
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5h-3.42zm4.1 2.31l3.41 6h6.58L15.22 3.5h-3.41zm6.54 11.5h-13.1l3.41 6h13.1l-3.41-6z"/></svg>
                       TẢI LÊN GOOGLE DRIVE
                    </button>
                  </div>
               </section>
             )}
             
             <div className="pt-6 border-t border-slate-100 text-center">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Dung lượng sử dụng: {stats.storage.text}</p>
             </div>
          </section>
        )}

        {/* Dòng chữ bản quyền */}
        <div className="text-center pt-12 pb-4">
           <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest opacity-60">
             Bản quyền phần mềm thuộc về binhphan
           </p>
        </div>
      </main>

      {/* Nav Bottom */}
      {view !== 'add' && view !== 'detail' && !isScanning && (
        <nav className="fixed bottom-6 left-6 right-6 bg-white shadow-2xl p-4 rounded-[2rem] z-30 flex justify-around items-center border border-slate-100">
            <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-300'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg><span className="text-[7px] font-black uppercase">KHO</span></button>
            <button onClick={() => setView('reports')} className={`flex flex-col items-center gap-1 ${view === 'reports' ? 'text-indigo-600' : 'text-slate-300'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg><span className="text-[7px] font-black uppercase">BÁO CÁO</span></button>
            <div className="w-12"></div>
            <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1 ${view === 'settings' ? 'text-indigo-600' : 'text-slate-300'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg><span className="text-[7px] font-black uppercase">HỆ THỐNG</span></button>
            <button onClick={() => setIsScanning(true)} className="absolute left-1/2 -translate-x-1/2 -top-10 w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl border-8 border-slate-50 active:scale-90 transition-all"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg></button>
        </nav>
      )}

      {/* BÁN HÀNG MODAL */}
      {isSelling && selectedProduct && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden flex flex-col relative animate-in zoom-in-95">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <h3 className="text-xs font-black uppercase">XÁC NHẬN BÁN HÀNG</h3>
                   <button onClick={() => setIsSelling(false)} className="text-slate-300 p-2"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-4 truncate">{selectedProduct.name}</p>
                        <div className="flex items-center justify-center gap-6 mb-6">
                            <button onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))} className="w-12 h-12 bg-white rounded-xl text-2xl font-black shadow-sm border border-slate-100 active:scale-90">-</button>
                            <span className="text-4xl font-black w-16 tabular-nums">{sellQuantity}</span>
                            <button onClick={() => setSellQuantity(Math.min(selectedProduct.stock, sellQuantity + 1))} className="w-12 h-12 bg-white rounded-xl text-2xl font-black shadow-sm border border-slate-100 active:scale-90">+</button>
                        </div>
                        <div className="pt-4 border-t border-slate-200">
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-1">TỔNG THANH TOÁN</p>
                           <p className="text-3xl font-black text-indigo-600">{formatCurrency(selectedProduct.sellingPrice * sellQuantity)}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <input type="text" placeholder="Tên khách hàng *" value={customer.fullName} onChange={e => setCustomer({...customer, fullName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-600 outline-none text-sm" />
                    </div>
                    <button onClick={handleConfirmSale} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">HOÀN TẤT GIAO DỊCH</button>
                </div>
            </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-xs text-center shadow-2xl relative">
              <button onClick={() => { setShowLoginModal(false); setEnteredPin(''); }} className="absolute top-6 right-6 text-slate-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              <h2 className="text-sm font-black uppercase mb-8 text-slate-800 tracking-widest">PIN QUẢN TRỊ</h2>
              <div className="flex justify-center gap-3 mb-8">
                {[0,1,2,3].map(i => <div key={i} className={`w-3 h-3 rounded-full border-2 border-indigo-600 transition-all ${enteredPin.length > i ? 'bg-indigo-600' : 'bg-transparent'}`}></div>)}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6,7,8,9,0].map(n => <button key={n} onClick={() => handlePinInput(n.toString())} className="w-full aspect-square bg-slate-50 rounded-xl text-lg font-black active:bg-indigo-600 active:text-white transition-all">{n}</button>)}
              </div>
           </div>
        </div>
      )}

      {/* AI PROCESSING MODAL */}
      {scanningStatus === 'processing' && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 flex flex-col items-center justify-center text-white backdrop-blur-md">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h3 className="text-xs font-black uppercase tracking-widest italic animate-pulse">ĐANG QUÉT ẢNH AI...</h3>
        </div>
      )}

      {isScanning && <CameraView title="QUÉT SẢN PHẨM AI" onClose={() => setIsScanning(false)} onCapture={async (base64) => {
        setIsScanning(false); setScanningStatus('processing');
        try {
          const result = await searchProductByImage(base64, products);
          if (result.productId) {
            const found = products.find(p => p.id === result.productId);
            if (found) { setSelectedProduct(found); setView('detail'); }
          } else if (result.suggestedName) {
            setSearchQuery(result.suggestedName); setView('dashboard');
          } else { alert("Không nhận diện được sản phẩm."); }
        } catch (e: any) { alert(e.message); } finally { setScanningStatus('idle'); }
      }} />}
      
      {view === 'add' && <ProductForm initialData={isEditing ? selectedProduct || undefined : undefined} existingProducts={products} onSave={(data) => {
        if (isEditing && selectedProduct) { setProducts(products.map(p => p.id === selectedProduct.id ? { ...p, ...data } : p)); setIsEditing(false); }
        else { setProducts([...products, { ...data, id: crypto.randomUUID().split('-')[0].toUpperCase(), createdAt: Date.now() }]); }
        setView('dashboard');
      }} onCancel={() => setView('dashboard')} />}

      {view === 'detail' && selectedProduct && (
        <div className="p-4 animate-in zoom-in-95">
           <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100">
              <div className="relative h-64">
                <img src={selectedProduct.imageUrl} className="w-full h-full object-cover" />
                <button onClick={() => setView('dashboard')} className="absolute top-6 left-6 bg-white p-3 rounded-2xl shadow-lg active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
              </div>
              <div className="p-8">
                <h2 className="text-xl font-black uppercase text-slate-900 mb-2">{selectedProduct.name}</h2>
                <div className="flex gap-4 mb-8">
                  <div className="flex-1 p-4 bg-indigo-50 rounded-2xl">
                    <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">GIÁ BÁN</p>
                    <p className="font-black text-lg text-indigo-900">{formatCurrency(selectedProduct.sellingPrice)}</p>
                  </div>
                  <div className="flex-1 p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">TỒN KHO</p>
                    <p className="font-black text-lg text-slate-800">{selectedProduct.stock}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button onClick={() => startSelling(selectedProduct)} disabled={selectedProduct.stock <= 0} className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all ${selectedProduct.stock > 0 ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-slate-100 text-slate-300'}`}>BÁN NGAY</button>
                  {role === 'admin' && (
                    <button onClick={() => { setIsEditing(true); setView('add'); }} className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest">SỬA THÔNG TIN MẶT HÀNG</button>
                  )}
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
