
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, ViewState, UserRole, Sale, CustomerInfo } from './types';
import ProductForm from './ProductForm';
import CameraView from './CameraView';
import { searchProductByImage } from './geminiService';
import { 
  saveProductsToDB, 
  getProductsFromDB, 
  saveSaleToDB, 
  getSalesFromDB, 
  saveAllSalesToDB,
  exportBackup
} from './storageService';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [view, setView] = useState<ViewState>('admin_home');
  const [role, setRole] = useState<UserRole>('admin');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'processing'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');

  // Bán hàng modal
  const [isSelling, setIsSelling] = useState(false);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [customer, setCustomer] = useState<CustomerInfo>({ fullName: '', address: '', idCard: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Báo cáo (Mặc định từ đầu tháng đến hiện tại)
  const [reportFrom, setReportFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [reportTo, setReportTo] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [p, s] = await Promise.all([getProductsFromDB(), getSalesFromDB()]);
        setProducts(p || []);
        setSales(s || []);
      } catch (e) { console.error(e); } 
      finally { setTimeout(() => setIsLoading(false), 800); }
    };
    loadData();
  }, []);

  useEffect(() => { 
    if (!isLoading) { 
      saveProductsToDB(products); 
      saveAllSalesToDB(sales); 
    } 
  }, [products, sales, isLoading]);

  const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  // Thống kê Dashboard
  const dashboardStats = useMemo(() => {
    const todayStart = new Date().setHours(0,0,0,0);
    const todaySales = sales.filter(s => s.timestamp >= todayStart);
    return {
      revenueToday: todaySales.reduce((acc, s) => acc + s.totalAmount, 0),
      ordersToday: todaySales.length,
      totalInvestment: products.reduce((acc, p) => acc + (p.purchasePrice * p.stock), 0)
    };
  }, [sales, products]);

  // Dữ liệu Báo cáo
  const reportData = useMemo(() => {
    const start = new Date(reportFrom); start.setHours(0, 0, 0, 0);
    const end = new Date(reportTo); end.setHours(23, 59, 59, 999);
    const filtered = sales.filter(s => s.timestamp >= start.getTime() && s.timestamp <= end.getTime());
    const revenue = filtered.reduce((acc, s) => acc + s.totalAmount, 0);
    const cost = filtered.reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : "0";

    return {
      filteredSales: filtered.sort((a, b) => b.timestamp - a.timestamp),
      revenue,
      profit,
      margin,
      ordersCount: filtered.length
    };
  }, [sales, reportFrom, reportTo]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== 'Tất cả') result = result.filter(p => p.category === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }
    return result;
  }, [products, activeCategory, searchQuery]);

  const handleSale = () => {
    if (!selectedProduct) return;
    if (sellQuantity > selectedProduct.stock) return alert("Số lượng vượt quá tồn kho!");

    const newSale: Sale = {
      id: crypto.randomUUID().split('-')[0].toUpperCase(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: sellQuantity,
      sellingPrice: selectedProduct.sellingPrice,
      purchasePrice: selectedProduct.purchasePrice,
      totalAmount: selectedProduct.sellingPrice * sellQuantity,
      timestamp: Date.now(),
      customer: customer.fullName ? customer : undefined,
      status: 'success'
    };

    setSales(prev => [newSale, ...prev]);
    setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, stock: p.stock - sellQuantity } : p));
    saveSaleToDB(newSale);
    
    setIsSelling(false);
    setSellQuantity(1);
    setCustomer({ fullName: '', address: '', idCard: '' });
    alert("Bán hàng thành công!");
    setView('admin_home');
  };

  if (isLoading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black tracking-widest animate-pulse text-xl">SMARTSHOP</div>;

  return (
    <div className="min-h-screen pb-32 text-slate-200 bg-[#020617]">
      {/* HEADER Profile */}
      {(view === 'admin_home' || view === 'pos' || view === 'inventory') && (
        <header className="p-6 pt-12 flex justify-between items-center bg-[#020617]/80 sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shadow-inner">
                 <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="avatar" />
              </div>
              <div>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Quản trị viên</p>
                 <h2 className="text-sm font-black text-white leading-none">Admin Store</h2>
              </div>
           </div>
           <button className="relative p-2.5 bg-slate-900 border border-slate-800 rounded-2xl active:scale-95 transition-all">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#020617]"></div>
           </button>
        </header>
      )}

      <main className="max-w-xl mx-auto px-6 pt-4">
        {view === 'admin_home' && (
          <div className="space-y-10 animate-slide-up pb-48">
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-2">
                <div className="min-w-[88%] bg-blue-600 rounded-[2.5rem] p-8 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] relative overflow-hidden group">
                   <div className="relative z-10">
                      <div className="flex justify-between items-center mb-6">
                         <div className="p-3 bg-white/20 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"></path></svg></div>
                         <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest">Hôm nay</span>
                      </div>
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Doanh thu bán lẻ</p>
                      <h3 className="text-3xl font-black text-white tracking-tight">{formatCurrency(dashboardStats.revenueToday)}</h3>
                   </div>
                </div>
                <div className="min-w-[88%] bg-[#1e293b] border border-slate-800 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden">
                   <div className="flex justify-between items-center mb-6">
                      <div className="p-3 bg-orange-500/20 text-orange-500 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth="2.5"></path></svg></div>
                   </div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Đơn hàng mới</p>
                   <h3 className="text-3xl font-black text-white tracking-tight">{dashboardStats.ordersToday}</h3>
                </div>
             </div>

             <section className="space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 ml-1">Quản trị nhanh</h3>
                <div className="grid grid-cols-2 gap-4">
                   {[
                     { id: 'inventory', title: 'Kho hàng', desc: 'Tồn kho & SKU', color: 'bg-amber-400/10', iconColor: 'text-amber-400', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                     { id: 'pos', title: 'Thu ngân', desc: 'Bán lẻ POS', color: 'bg-emerald-400/10', iconColor: 'text-emerald-400', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
                     { id: 'reports', title: 'Báo cáo', desc: 'Lợi nhuận ròng', color: 'bg-blue-400/10', iconColor: 'text-blue-400', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                     { id: 'settings', title: 'Dữ liệu', desc: 'Hệ thống', color: 'bg-indigo-400/10', iconColor: 'text-indigo-400', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
                   ].map(item => (
                     <button key={item.id} onClick={() => setView(item.id as any)} className="glass-card p-6 rounded-[2rem] text-left hover:border-blue-500/50 transition-all group active:scale-95 shadow-sm">
                        <div className={`w-12 h-12 ${item.color} ${item.iconColor} rounded-2xl flex items-center justify-center mb-4 shadow-inner`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path></svg></div>
                        <h4 className="font-bold text-white text-[11px] mb-1 uppercase tracking-wider">{item.title}</h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.15em]">{item.desc}</p>
                     </button>
                   ))}
                </div>
             </section>

             <section className="space-y-6">
                <div className="flex justify-between items-center">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 ml-1">Đơn hàng gần đây</h3>
                   <button onClick={() => setView('reports')} className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Tất cả</button>
                </div>
                <div className="space-y-4">
                   {sales.length === 0 ? (
                     <div className="glass-card py-10 rounded-[2rem] text-center border-dashed border-slate-800">
                        <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.3em]">Trống</p>
                     </div>
                   ) : sales.slice(0, 5).map(sale => (
                     <div key={sale.id} className="glass-card p-5 rounded-[1.5rem] flex items-center gap-4 border-none bg-slate-900/40 shadow-lg">
                        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3"></path></svg></div>
                        <div className="flex-1 min-w-0">
                           <h5 className="text-[11px] font-black text-white uppercase mb-0.5 truncate">{sale.productName}</h5>
                           <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-500 font-black tracking-widest">{new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                              <span className="text-[9px] text-blue-500 font-black truncate">{sale.customer?.fullName || "Khách lẻ"}</span>
                           </div>
                        </div>
                        <div className="text-right shrink-0">
                           <p className="text-sm font-black text-white">{formatCurrency(sale.totalAmount)}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </section>

             <div className="pt-10 pb-4 text-center space-y-2 opacity-40">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.5em]">SmartShop Enterprise v1.5</p>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Bản quyền phần mềm thuộc về BINHPHAN</p>
             </div>
          </div>
        )}

        {view === 'pos' && (
          <div className="space-y-8 animate-slide-up pb-48">
             <div className="relative group">
                <input type="text" placeholder="Tìm sản phẩm..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-5 pl-14 bg-slate-900 border border-slate-800 rounded-[1.5rem] focus:ring-2 focus:ring-blue-500 outline-none font-bold text-white" />
                <svg className="w-6 h-6 absolute left-5 top-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
             </div>
             <div className="grid grid-cols-2 gap-4">
                {filteredProducts.map(p => (
                   <div key={p.id} className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col h-full bg-slate-900/60 shadow-xl border-white/5">
                      <div className="relative h-44 overflow-hidden" onClick={() => { setSelectedProduct(p); setView('product_detail'); }}>
                         <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                         <h4 className="text-[11px] font-black text-white uppercase leading-tight mb-3 line-clamp-2">{p.name}</h4>
                         <div className="mt-auto flex justify-between items-end">
                            <p className="text-base font-black text-blue-500">{formatCurrency(p.sellingPrice)}</p>
                            <button onClick={() => { setSelectedProduct(p); setSellQuantity(1); setIsSelling(true); }} disabled={p.stock <= 0} className="p-3 bg-blue-600 text-white rounded-2xl active:scale-90 shadow-lg">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"></path></svg>
                            </button>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {view === 'reports' && (
          <div className="space-y-8 animate-slide-up pb-48">
             <header className="flex justify-between items-center mb-4">
                <button onClick={() => setView('admin_home')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg></button>
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Báo cáo</h2>
                <div className="w-12"></div>
             </header>

             <section className="glass-card p-7 rounded-[2.5rem] space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-widest">Từ ngày</label><input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold outline-none text-white focus:border-blue-500" /></div>
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-widest">Đến ngày</label><input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold outline-none text-white focus:border-blue-500" /></div>
                </div>
             </section>

             <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-7 rounded-[2.5rem] border-none bg-blue-600/10">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Doanh thu</p>
                   <h3 className="text-xl font-black text-white">{formatCurrency(reportData.revenue)}</h3>
                </div>
                <div className="glass-card p-7 rounded-[2.5rem] border-none bg-emerald-600/10">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Lợi nhuận</p>
                   <h3 className="text-xl font-black text-emerald-500">{formatCurrency(reportData.profit)}</h3>
                </div>
             </div>

             <section className="space-y-4">
                {reportData.filteredSales.map(sale => (
                  <div key={sale.id} className="glass-card p-4 rounded-[1.5rem] flex items-center gap-4 bg-slate-900/40 border-none">
                     <div className="flex-1 min-w-0">
                        <h5 className="text-[11px] font-black text-white uppercase truncate">{sale.productName}</h5>
                        <p className="text-[9px] text-slate-500 font-bold">{new Date(sale.timestamp).toLocaleDateString('vi-VN')} • {sale.customer?.fullName || "Khách lẻ"}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-black text-white">{formatCurrency(sale.totalAmount)}</p>
                     </div>
                  </div>
                ))}
             </section>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-10 animate-slide-up pb-48">
             <header className="flex justify-between items-center">
                <button onClick={() => setView('admin_home')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg></button>
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Cài đặt</h2>
                <div className="w-12"></div>
             </header>

             <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-full border-4 border-slate-900 p-1 shadow-2xl overflow-hidden mb-4">
                   <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" className="w-full h-full rounded-full bg-slate-800" alt="avatar" />
                </div>
                <h3 className="text-xl font-black text-white mb-1">Admin Store</h3>
             </div>

             <section className="space-y-4">
                <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800/50 shadow-xl">
                   <button onClick={exportBackup} className="w-full p-7 flex items-center justify-between hover:bg-white/5 transition-all">
                      <div className="flex items-center gap-5">
                         <div className="p-3 bg-blue-600/10 text-blue-500 rounded-2xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" strokeWidth="2.5"></path></svg></div>
                         <h4 className="text-sm font-black text-white">Xuất Backup</h4>
                      </div>
                   </button>
                   <div className="h-[1px] bg-white/5 mx-6"></div>
                   <button onClick={() => fileInputRef.current?.click()} className="w-full p-7 flex items-center justify-between hover:bg-white/5 transition-all">
                      <div className="flex items-center gap-5">
                         <div className="p-3 bg-indigo-600/10 text-indigo-500 rounded-2xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4v12" strokeWidth="2.5"></path></svg></div>
                         <h4 className="text-sm font-black text-white">Khôi phục</h4>
                      </div>
                   </button>
                </div>
             </section>

             <div className="text-center space-y-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest bg-white/5 py-3 rounded-2xl border border-white/5 mx-4">
                   Bản quyền phần mềm thuộc về BINHPHAN
                </p>
             </div>
          </div>
        )}

        {view === 'product_detail' && selectedProduct && (
          <div className="space-y-10 animate-slide-up pb-72">
             <header className="flex justify-between items-center">
                <button onClick={() => setView('pos')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg></button>
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Chi tiết</h2>
                <button onClick={() => { setIsEditing(true); setView('product_form'); }} className="text-xs font-black text-blue-500 uppercase tracking-widest">Sửa</button>
             </header>
             
             <div className="aspect-square rounded-[3.5rem] overflow-hidden border-4 border-slate-900 shadow-2xl bg-slate-900">
                <img src={selectedProduct.imageUrl} className="w-full h-full object-cover" alt="product" />
             </div>
             
             <div className="space-y-6">
                <h2 className="text-3xl font-black text-white leading-tight">{selectedProduct.name}</h2>
                <div className="grid grid-cols-2 gap-4">
                   <div className="glass-card p-6 rounded-[2rem] bg-blue-900/10 border-blue-500/20">
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2">Tồn kho</p>
                      <p className="text-3xl font-black text-white tabular-nums">{selectedProduct.stock}</p>
                   </div>
                   <div className="glass-card p-6 rounded-[2rem] bg-emerald-900/10 border-emerald-500/20">
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">Giá bán</p>
                      <p className="text-xl font-black text-white tabular-nums">{formatCurrency(selectedProduct.sellingPrice)}</p>
                   </div>
                </div>
                
                <div className="glass-card p-6 rounded-[2rem] bg-slate-900/40">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Giá vốn tham khảo</p>
                   <p className="text-sm font-bold text-slate-400">{formatCurrency(selectedProduct.purchasePrice)}</p>
                </div>
             </div>
             
             {/* Nút bấm nổi phía dưới với background mờ để không che hoàn toàn nội dung khi cuộn */}
             <div className="fixed bottom-0 left-0 right-0 p-8 pt-12 pb-12 bg-gradient-to-t from-[#020617] via-[#020617]/90 to-transparent z-50">
                <button 
                  onClick={() => { setSellQuantity(1); setIsSelling(true); }} 
                  disabled={selectedProduct.stock <= 0} 
                  className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-[0_20px_50px_-10px_rgba(37,99,235,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10"
                >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" strokeWidth="2.5"></path></svg>
                   Tiến hành bán ngay
                </button>
             </div>
          </div>
        )}

        {view === 'inventory' && (
          <div className="space-y-8 animate-slide-up pb-48">
             <header className="flex justify-between items-center">
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Kho hàng</h2>
                <button onClick={() => { setIsEditing(false); setView('product_form'); }} className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-2xl active:scale-90"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3.5"></path></svg></button>
             </header>
             <div className="space-y-4">
                {products.map(p => (
                  <div key={p.id} className="glass-card p-4 rounded-[1.5rem] flex items-center gap-4 bg-slate-900/40 border-slate-800/50">
                     <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                        <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                     </div>
                     <div className="flex-1 min-w-0" onClick={() => { setSelectedProduct(p); setView('product_detail'); }}>
                        <h4 className="text-[11px] font-black text-white uppercase truncate">{p.name}</h4>
                        <p className="text-[9px] text-slate-500 font-bold">Tồn: {p.stock} • {formatCurrency(p.sellingPrice)}</p>
                     </div>
                     <button onClick={() => { setSelectedProduct(p); setIsEditing(true); setView('product_form'); }} className="p-3 text-slate-500 hover:text-blue-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5"></path></svg></button>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      {/* Nav Bottom - Chỉ hiện ở các view chính */}
      {!isScanning && (view === 'admin_home' || view === 'pos' || view === 'inventory' || view === 'reports' || view === 'settings') && (
        <nav className="fixed bottom-8 left-8 right-8 glass-card p-4 rounded-[2.5rem] z-[100] flex justify-around items-center border border-white/10 bg-slate-900/95 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)]">
            <button onClick={() => setView('admin_home')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'admin_home' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg><span className="text-[9px] font-black uppercase tracking-tighter">HOME</span></button>
            <button onClick={() => setView('inventory')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'inventory' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg><span className="text-[9px] font-black uppercase tracking-tighter">SẢN PHẨM</span></button>
            
            <div className="w-16 h-16 relative -top-8">
               <button onClick={() => setIsScanning(true)} className="absolute w-full h-full bg-blue-600 text-white rounded-[2.2rem] flex items-center justify-center shadow-[0_20px_45px_-5px_rgba(37,99,235,0.8)] border-[8px] border-[#020617] active:scale-90 transition-all group">
                  <svg className="w-8 h-8 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
               </button>
            </div>

            <button onClick={() => setView('reports')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'reports' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg><span className="text-[9px] font-black uppercase tracking-tighter">BÁO CÁO</span></button>
            <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'settings' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg><span className="text-[9px] font-black uppercase tracking-tighter">HỆ THỐNG</span></button>
        </nav>
      )}

      {/* Sale Modal */}
      {isSelling && selectedProduct && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-[#1e293b] w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Xác nhận đơn</h3>
                 <button onClick={() => setIsSelling(false)} className="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              </div>
              <div className="p-8 space-y-8">
                 <div className="text-center">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-2.5">Thanh toán</p>
                    <h4 className="text-lg font-black text-white uppercase leading-tight">{selectedProduct.name}</h4>
                 </div>
                 <div className="bg-slate-950/50 p-7 rounded-[2.5rem] border border-white/5 flex flex-col items-center shadow-inner">
                    <div className="flex items-center gap-8 mb-6">
                       <button onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))} className="w-14 h-14 rounded-[1.25rem] bg-slate-900 border border-white/5 text-white text-2xl font-black shadow-lg active:scale-90">-</button>
                       <span className="text-4xl font-black text-white tabular-nums tracking-tighter">{sellQuantity}</span>
                       <button onClick={() => setSellQuantity(Math.min(selectedProduct.stock, sellQuantity + 1))} className="w-14 h-14 rounded-[1.25rem] bg-blue-600 text-white text-2xl font-black shadow-lg shadow-blue-500/20 active:scale-90">+</button>
                    </div>
                    <div className="text-center">
                       <p className="text-2xl font-black text-blue-500 tracking-tighter">{formatCurrency(selectedProduct.sellingPrice * sellQuantity)}</p>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <input type="text" placeholder="Tên khách (không bắt buộc)" value={customer.fullName} onChange={e => setCustomer({...customer, fullName: e.target.value})} className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] font-bold outline-none focus:border-blue-500 text-white shadow-inner" />
                 </div>
                 <button onClick={handleSale} className="w-full py-6 bg-blue-600 text-white rounded-[1.75rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/30 active:scale-95 transition-all">Hoàn tất giao dịch</button>
              </div>
           </div>
        </div>
      )}

      {/* Camera & AI Processing Overlays */}
      {isScanning && (
         <CameraView title="AI VISUAL SEARCH" onClose={() => setIsScanning(false)} onCapture={async (base64) => {
            setIsScanning(false); setScanningStatus('processing');
            try {
               const result = await searchProductByImage(base64, products);
               if (result.productId) {
                  const found = products.find(p => p.id === result.productId);
                  if (found) { setSelectedProduct(found); setView('product_detail'); }
               } else if (result.suggestedName) {
                  setSearchQuery(result.suggestedName); setView('pos');
               } else { alert("Không tìm thấy kết quả phù hợp."); }
            } catch (e) { console.error(e); } finally { setScanningStatus('idle'); }
         }} />
      )}

      {scanningStatus === 'processing' && (
         <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center">
            <div className="w-20 h-20 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin mb-10 shadow-[0_0_40px_rgba(37,99,235,0.4)]"></div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] animate-pulse">Smart Scan Processing...</p>
         </div>
      )}
    </div>
  );
};

export default App;
