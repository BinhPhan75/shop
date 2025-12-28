
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

  // Báo cáo
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

  // Thống kê Dashboard (Chỉ hôm nay)
  const dashboardStats = useMemo(() => {
    const todayStart = new Date().setHours(0,0,0,0);
    const todaySales = sales.filter(s => s.timestamp >= todayStart);
    return {
      revenueToday: todaySales.reduce((acc, s) => acc + s.totalAmount, 0),
      ordersToday: todaySales.length,
      totalInvestment: products.reduce((acc, p) => acc + (p.purchasePrice * p.stock), 0)
    };
  }, [sales, products]);

  // Dữ liệu Báo cáo (Theo bộ lọc thời gian)
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
      purchasePrice: selectedProduct.purchasePrice, // Lưu giá vốn tại thời điểm bán để tính lợi nhuận chính xác
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

  if (isLoading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black tracking-widest animate-pulse">SMARTSHOP</div>;

  return (
    <div className="min-h-screen pb-24 text-slate-200 bg-[#020617]">
      {/* HEADER Profile */}
      {(view === 'admin_home' || view === 'pos' || view === 'inventory') && (
        <header className="p-6 pt-12 flex justify-between items-center bg-[#020617] sticky top-0 z-40 border-b border-white/5 backdrop-blur-md">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shadow-lg">
                 <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="avatar" />
              </div>
              <div>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Quản trị viên</p>
                 <h2 className="text-sm font-black text-white leading-none">Admin Store</h2>
              </div>
           </div>
           <button className="relative p-2.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#020617]"></div>
           </button>
        </header>
      )}

      <main className="max-w-xl mx-auto px-6 pt-4">
        {view === 'admin_home' && (
          <div className="space-y-8 animate-slide-up">
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                <div className="min-w-[85%] bg-blue-600 rounded-[2.5rem] p-8 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] relative overflow-hidden group">
                   <div className="relative z-10">
                      <div className="flex justify-between items-center mb-6">
                         <div className="p-3 bg-white/20 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"></path></svg></div>
                         <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full">+10%</span>
                      </div>
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Doanh thu hôm nay</p>
                      <h3 className="text-3xl font-black text-white tracking-tight">{formatCurrency(dashboardStats.revenueToday)}</h3>
                   </div>
                   <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
                </div>
                <div className="min-w-[85%] bg-[#1e293b] border border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
                   <div className="flex justify-between items-center mb-6">
                      <div className="p-3 bg-orange-500/20 text-orange-500 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth="2.5"></path></svg></div>
                   </div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Đơn hàng mới</p>
                   <h3 className="text-3xl font-black text-white tracking-tight">{dashboardStats.ordersToday}</h3>
                </div>
             </div>

             <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Chức năng chính</h3>
                <div className="grid grid-cols-2 gap-4">
                   {[
                     { id: 'inventory', title: 'Sản phẩm', desc: 'Quản lý kho hàng', color: 'bg-amber-400/10', iconColor: 'text-amber-400', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                     { id: 'pos', title: 'Bán hàng', desc: 'POS & Thu ngân', color: 'bg-emerald-400/10', iconColor: 'text-emerald-400', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
                     { id: 'reports', title: 'Báo cáo', desc: 'Thống kê chi tiết', color: 'bg-blue-400/10', iconColor: 'text-blue-400', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                     { id: 'settings', title: 'Cài đặt', desc: 'Hệ thống & Dữ liệu', color: 'bg-slate-400/10', iconColor: 'text-slate-400', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
                   ].map(item => (
                     <button key={item.id} onClick={() => setView(item.id as any)} className="glass-card p-6 rounded-[2rem] text-left hover:border-blue-500/50 transition-all group active:scale-95">
                        <div className={`w-12 h-12 ${item.color} ${item.iconColor} rounded-2xl flex items-center justify-center mb-4 shadow-inner`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path></svg></div>
                        <h4 className="font-bold text-white mb-1">{item.title}</h4>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{item.desc}</p>
                     </button>
                   ))}
                </div>
             </section>

             <section className="space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Hoạt động gần đây</h3>
                   <button onClick={() => setView('reports')} className="text-xs font-bold text-blue-500 uppercase tracking-widest">Xem tất cả</button>
                </div>
                <div className="space-y-3 pb-4">
                   {sales.length === 0 ? (
                     <p className="text-center py-10 text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">Chưa có giao dịch</p>
                   ) : sales.slice(0, 3).map(sale => (
                     <div key={sale.id} className="glass-card p-4 rounded-3xl flex items-center gap-4 border-none bg-slate-900/40">
                        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="2.5"></path></svg></div>
                        <div className="flex-1 min-w-0">
                           <h5 className="text-[11px] font-black text-white uppercase mb-0.5 truncate">{sale.productName}</h5>
                           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{new Date(sale.timestamp).toLocaleTimeString()} • {sale.customer?.fullName || "Khách lẻ"}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-black text-white">{formatCurrency(sale.totalAmount)}</p>
                           <p className="text-[8px] font-black text-emerald-500 uppercase">Thành công</p>
                        </div>
                     </div>
                   ))}
                </div>
             </section>
          </div>
        )}

        {view === 'pos' && (
          <div className="space-y-8 animate-slide-up">
             <div className="relative group">
                <input type="text" placeholder="Tìm sản phẩm, SKU..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-5 pl-14 bg-slate-900 border border-slate-800 rounded-[1.5rem] focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all text-white" />
                <svg className="w-6 h-6 absolute left-5 top-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
             </div>

             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
                {['Tất cả', 'Điện thoại', 'Laptop', 'Phụ kiện'].map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all shrink-0 ${activeCategory === cat ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{cat}</button>
                ))}
             </div>

             <div className="grid grid-cols-2 gap-4 pb-10">
                {filteredProducts.map(p => (
                   <div key={p.id} className="glass-card rounded-[2rem] overflow-hidden group hover:border-blue-500/50 transition-all active:scale-95 flex flex-col h-full bg-slate-900/60">
                      <div className="relative h-40 overflow-hidden cursor-pointer" onClick={() => { setSelectedProduct(p); setView('product_detail'); }}>
                         <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.name} />
                         <div className="absolute top-3 left-3">
                            <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase border backdrop-blur-md ${p.stock > 10 ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : p.stock > 0 ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'}`}>
                               {p.stock > 10 ? 'Còn hàng' : p.stock > 0 ? 'Sắp hết' : 'Hết hàng'}
                            </span>
                         </div>
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                         <h4 className="text-[11px] font-black text-white uppercase leading-tight mb-2 line-clamp-2">{p.name}</h4>
                         <div className="mt-auto">
                            <div className="flex justify-between items-end">
                               <div>
                                  <p className="text-[10px] text-slate-500 font-bold line-through mb-0.5 opacity-50">{formatCurrency(p.sellingPrice * 1.1)}</p>
                                  <p className="text-sm font-black text-blue-500">{formatCurrency(p.sellingPrice)}</p>
                               </div>
                               <button onClick={() => { setSelectedProduct(p); setSellQuantity(1); setIsSelling(true); }} disabled={p.stock <= 0} className={`p-2.5 rounded-xl shadow-lg active:scale-90 transition-transform ${p.stock > 0 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"></path></svg>
                               </button>
                            </div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {view === 'inventory' && (
          <div className="space-y-8 animate-slide-up">
             <header className="flex justify-between items-center">
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Kho hàng</h2>
                <button onClick={() => { setIsEditing(false); setView('product_form'); }} className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 active:scale-90">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"></path></svg>
                </button>
             </header>
             <div className="space-y-4 pb-10">
                {products.length === 0 ? (
                  <p className="text-center py-20 text-[10px] text-slate-600 font-black uppercase tracking-widest">Kho trống</p>
                ) : products.map(p => (
                  <div key={p.id} className="glass-card p-4 rounded-[1.5rem] flex items-center gap-4 bg-slate-900/40 border-slate-800/50 hover:border-blue-500/30 transition-all">
                     <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                        <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                     </div>
                     <div className="flex-1 min-w-0" onClick={() => { setSelectedProduct(p); setView('product_detail'); }}>
                        <h4 className="text-[11px] font-black text-white uppercase truncate">{p.name}</h4>
                        <div className="flex gap-4 mt-1">
                           <p className="text-[9px] font-bold text-slate-500 uppercase">Tồn: <span className="text-white">{p.stock}</span></p>
                           <p className="text-[9px] font-bold text-slate-500 uppercase">Bán: <span className="text-blue-500">{formatCurrency(p.sellingPrice)}</span></p>
                        </div>
                     </div>
                     <button onClick={() => { setSelectedProduct(p); setIsEditing(true); setView('product_form'); }} className="p-3 text-slate-400 hover:text-blue-500 active:scale-90">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5"></path></svg>
                     </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {view === 'reports' && (
          <div className="space-y-8 animate-slide-up">
             <header className="flex justify-between items-center mb-4">
                <button onClick={() => setView('admin_home')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg></button>
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Báo cáo doanh thu</h2>
                <div className="w-12"></div>
             </header>

             <section className="glass-card p-6 rounded-[2rem] space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Bộ lọc thời gian</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Từ ngày</label><input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold outline-none text-white" /></div>
                   <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Đến ngày</label><input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold outline-none text-white" /></div>
                </div>
             </section>

             <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-6 rounded-[2rem] border-none bg-[#1e293b]">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Tổng doanh số</p>
                   <h3 className="text-xl font-black text-white mb-2">{formatCurrency(reportData.revenue)}</h3>
                   <p className="text-[9px] font-black text-blue-500 uppercase">Kỳ báo cáo</p>
                </div>
                <div className="glass-card p-6 rounded-[2rem] border-none bg-[#1e293b]">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Lợi nhuận gộp</p>
                   <h3 className="text-xl font-black text-emerald-500 mb-2">{formatCurrency(reportData.profit)}</h3>
                   <div className="flex items-center gap-2"><span className="text-[8px] font-black bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-lg">{reportData.margin}%</span><span className="text-[8px] font-bold text-slate-500 uppercase">Biên lợi nhuận</span></div>
                </div>
             </div>

             <section className="space-y-4 pb-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Lịch sử bán lẻ ({reportData.ordersCount} đơn)</h3>
                <div className="space-y-3">
                   {reportData.filteredSales.length === 0 ? (
                     <p className="text-center py-20 text-[10px] text-slate-600 font-black uppercase tracking-widest opacity-30">Chưa có giao dịch trong kỳ này</p>
                   ) : reportData.filteredSales.map(sale => (
                     <div key={sale.id} className="glass-card p-4 rounded-3xl flex items-center gap-4 bg-slate-900/40 border-none">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl overflow-hidden flex items-center justify-center">
                           <img src={products.find(p => p.id === sale.productId)?.imageUrl || "https://images.unsplash.com/photo-1556656793-062ff98782ee?auto=format&fit=crop&q=80&w=150"} className="w-full h-full object-cover" alt="item" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <h5 className="text-[11px] font-black text-white uppercase truncate">{sale.productName}</h5>
                           <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{new Date(sale.timestamp).toLocaleDateString()} • {sale.customer?.fullName || "Khách lẻ"}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[11px] font-black text-white">{formatCurrency(sale.totalAmount)}</p>
                           <span className="text-[9px] font-black text-blue-500 bg-blue-600/10 px-2 py-0.5 rounded-lg">x{sale.quantity}</span>
                        </div>
                     </div>
                   ))}
                </div>
             </section>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-10 animate-slide-up pb-10">
             <header className="flex justify-between items-center">
                <button onClick={() => setView('admin_home')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg></button>
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Hệ thống</h2>
                <div className="w-12"></div>
             </header>

             <div className="flex flex-col items-center">
                <div className="relative mb-6">
                   <div className="w-32 h-32 rounded-full border-4 border-slate-900 p-1 shadow-2xl">
                      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" className="w-full h-full rounded-full bg-slate-800" alt="avatar" />
                   </div>
                   <button className="absolute bottom-0 right-0 p-3 bg-blue-600 rounded-full border-4 border-[#020617] shadow-lg active:scale-90"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="3"></path></svg></button>
                </div>
                <h3 className="text-xl font-black text-white mb-1 tracking-tight">Admin Name</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Quản trị tối cao</p>
             </div>

             <section className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Dữ liệu & Sao lưu</h3>
                <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800/50">
                   <button onClick={exportBackup} className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-blue-600/10 text-blue-500 rounded-2xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" strokeWidth="2.5"></path></svg></div>
                         <div className="text-left">
                            <h4 className="text-sm font-black text-white">Sao lưu (.JSON)</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tải về máy cục bộ</p>
                         </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                   </button>
                   <div className="h-[1px] bg-white/5 mx-6"></div>
                   <button onClick={() => fileInputRef.current?.click()} className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-indigo-600/10 text-indigo-500 rounded-2xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4v12" strokeWidth="2.5"></path></svg></div>
                         <div className="text-left">
                            <h4 className="text-sm font-black text-white">Khôi phục dữ liệu</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nhập từ tệp tin cũ</p>
                         </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                   </button>
                   <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (!file) return;
                       const reader = new FileReader();
                       reader.onload = (ev) => {
                         try {
                           const data = JSON.parse(ev.target?.result as string);
                           if (data.products && data.sales) {
                             setProducts(data.products);
                             setSales(data.sales);
                             alert("Dữ liệu đã được khôi phục!");
                           }
                         } catch (err) { alert("File không hợp lệ!"); }
                       };
                       reader.readAsText(file);
                    }} />
                </div>
             </section>

             <button className="w-full p-6 glass-card rounded-[2rem] border-red-500/20 text-red-500 flex items-center justify-center gap-3 active:scale-95 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="3"></path></svg>
                <span className="font-black text-xs uppercase tracking-widest">Đăng xuất tài khoản</span>
             </button>
          </div>
        )}

        {view === 'product_detail' && selectedProduct && (
          <div className="space-y-8 animate-slide-up pb-20">
             <header className="flex justify-between items-center">
                <button onClick={() => setView('pos')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg></button>
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Chi tiết hàng</h2>
                <button onClick={() => { setIsEditing(true); setView('product_form'); }} className="text-xs font-black text-blue-500 uppercase tracking-widest">Sửa</button>
             </header>

             <div className="relative">
                <div className="aspect-square rounded-[3.5rem] overflow-hidden border-4 border-slate-900 shadow-2xl">
                   <img src={selectedProduct.imageUrl} className="w-full h-full object-cover" alt="product" />
                </div>
                <div className="absolute top-8 right-8">
                   <span className="bg-blue-600/30 text-blue-400 border border-blue-500/30 px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest backdrop-blur-xl">ACTIVE</span>
                </div>
             </div>

             <div className="space-y-2">
                <h2 className="text-3xl font-black text-white leading-tight tracking-tight">{selectedProduct.name}</h2>
                <div className="flex gap-4">
                   <span className="bg-white/5 text-slate-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">#{selectedProduct.id.slice(0,8)}</span>
                   <span className="bg-white/5 text-slate-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{selectedProduct.category || 'Điện tử'}</span>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-5 rounded-3xl bg-blue-900/10 border-blue-500/20">
                   <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-2">Tồn kho</p>
                   <p className="text-2xl font-black text-white">{selectedProduct.stock}</p>
                </div>
                <div className="glass-card p-5 rounded-3xl bg-orange-900/10 border-orange-500/20">
                   <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-2">Giá vốn</p>
                   <p className="text-lg font-black text-white">{(selectedProduct.purchasePrice / 1000).toFixed(0)}k</p>
                </div>
                <div className="glass-card p-5 rounded-3xl bg-emerald-900/10 border-emerald-500/20">
                   <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2">Giá bán</p>
                   <p className="text-lg font-black text-emerald-500">{(selectedProduct.sellingPrice / 1000).toFixed(0)}k</p>
                </div>
             </div>

             <div className="fixed bottom-24 left-6 right-6 flex gap-4 z-50">
                <button onClick={() => { setSellQuantity(1); setIsSelling(true); }} disabled={selectedProduct.stock <= 0} className={`flex-1 py-6 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${selectedProduct.stock > 0 ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-slate-800 text-slate-600'}`}>
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 11-8 0v4M5 9h14l1 12H4L5 9z" strokeWidth="2.5"></path></svg>
                   Bán hàng ngay
                </button>
             </div>
          </div>
        )}

        {view === 'product_form' && (
           <ProductForm initialData={isEditing ? selectedProduct || undefined : undefined} existingProducts={products} onSave={(data) => {
              if (isEditing && selectedProduct) { setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, ...data } : p)); setIsEditing(false); }
              else { setProducts(prev => [...prev, { ...data, id: crypto.randomUUID().split('-')[0].toUpperCase(), createdAt: Date.now() }]); }
              setView('inventory');
           }} onCancel={() => setView('inventory')} />
        )}
      </main>

      {/* Nav Bottom */}
      {!isScanning && (view !== 'product_form' && view !== 'product_detail') && (
        <nav className="fixed bottom-6 left-6 right-6 glass-card p-4 rounded-[2.5rem] z-[100] flex justify-around items-center border border-white/5 bg-slate-900/90 shadow-2xl">
            <button onClick={() => setView('admin_home')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'admin_home' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg><span className="text-[8px] font-black uppercase tracking-tighter">Bảng tin</span></button>
            <button onClick={() => setView('inventory')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'inventory' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg><span className="text-[8px] font-black uppercase tracking-tighter">Sản phẩm</span></button>
            
            <div className="w-16 h-16 relative -top-8">
               <button onClick={() => setIsScanning(true)} className="absolute w-full h-full bg-blue-600 text-white rounded-[2.2rem] flex items-center justify-center shadow-[0_15px_35px_-5px_rgba(37,99,235,0.8)] border-[8px] border-[#020617] active:scale-90 transition-all group">
                  <svg className="w-8 h-8 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
               </button>
            </div>

            <button onClick={() => setView('reports')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'reports' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg><span className="text-[8px] font-black uppercase tracking-tighter">Báo cáo</span></button>
            <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'settings' ? 'active-tab' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg><span className="text-[8px] font-black uppercase tracking-tighter">Hệ thống</span></button>
        </nav>
      )}

      {/* Sale Modal */}
      {isSelling && selectedProduct && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-[#1e293b] w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Xác nhận đơn hàng</h3>
                 <button onClick={() => setIsSelling(false)} className="text-slate-500 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              </div>
              <div className="p-8 space-y-8">
                 <div className="text-center">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Đang bán</p>
                    <h4 className="text-lg font-black text-white uppercase">{selectedProduct.name}</h4>
                 </div>

                 <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 flex flex-col items-center">
                    <div className="flex items-center gap-8 mb-4">
                       <button onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))} className="w-12 h-12 rounded-2xl bg-slate-800 text-white text-xl font-black">-</button>
                       <span className="text-4xl font-black text-white tabular-nums">{sellQuantity}</span>
                       <button onClick={() => setSellQuantity(Math.min(selectedProduct.stock, sellQuantity + 1))} className="w-12 h-12 rounded-2xl bg-blue-600 text-white text-xl font-black">+</button>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tổng thanh toán:</p>
                    <p className="text-2xl font-black text-blue-500 mt-1">{formatCurrency(selectedProduct.sellingPrice * sellQuantity)}</p>
                 </div>

                 <div className="space-y-4">
                    <input type="text" placeholder="Tên khách hàng (không bắt buộc)" value={customer.fullName} onChange={e => setCustomer({...customer, fullName: e.target.value})} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 text-white" />
                 </div>

                 <button onClick={handleSale} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Hoàn tất giao dịch</button>
              </div>
           </div>
        </div>
      )}

      {/* Camera & AI Overlays */}
      {isScanning && (
         <CameraView title="Quét sản phẩm thông minh" onClose={() => setIsScanning(false)} onCapture={async (base64) => {
            setIsScanning(false); setScanningStatus('processing');
            try {
               const result = await searchProductByImage(base64, products);
               if (result.productId) {
                  const found = products.find(p => p.id === result.productId);
                  if (found) { setSelectedProduct(found); setView('product_detail'); }
               } else if (result.suggestedName) {
                  setSearchQuery(result.suggestedName); setView('pos');
               } else { alert("AI chưa nhận diện được. Thử lại góc khác."); }
            } catch (e) { console.error(e); } finally { setScanningStatus('idle'); }
         }} />
      )}

      {scanningStatus === 'processing' && (
         <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
            <p className="text-xs font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Hệ thống AI đang phân tích...</p>
         </div>
      )}
    </div>
  );
};

export default App;
