
import React, { useState } from 'react';
import { Product } from './types';
import CameraView from './CameraView';
import { searchProductByImage } from './geminiService';

interface ProductFormProps {
  onSave: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  initialData?: Product;
  existingProducts: Product[];
}

const ProductForm: React.FC<ProductFormProps> = ({ onSave, onCancel, initialData, existingProducts }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [category, setCategory] = useState(initialData?.category || 'Tất cả');
  const [description, setDescription] = useState(initialData?.description || '');
  const [purchasePrice, setPurchasePrice] = useState(initialData?.purchasePrice?.toString() || '');
  const [sellingPrice, setSellingPrice] = useState(initialData?.sellingPrice?.toString() || '');
  const [stock, setStock] = useState(initialData?.stock || 0);
  const [newStock, setNewStock] = useState('0');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [showCamera, setShowCamera] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !imageUrl) return alert("Vui lòng nhập tên và chụp ảnh sản phẩm");
    
    onSave({ 
      name, 
      brand,
      category,
      description, 
      purchasePrice: Number(purchasePrice) || 0, 
      sellingPrice: Number(sellingPrice) || 0, 
      stock: stock + (Number(newStock) || 0), 
      imageUrl 
    });
  };

  const handleCapture = async (base64: string) => {
    setImageUrl(base64);
    setShowCamera(false);
    if (!name.trim()) {
      setIsAiProcessing(true);
      try {
        const result = await searchProductByImage(base64, existingProducts);
        if (result.suggestedName) setName(result.suggestedName);
      } catch (e) { console.error(e); } finally { setIsAiProcessing(false); }
    }
  };

  return (
    <div className="space-y-8 animate-slide-up pb-20">
      <header className="flex justify-between items-center">
         <button onClick={onCancel} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg></button>
         <h2 className="text-lg font-black uppercase text-white tracking-widest">{initialData ? 'Sửa thông tin' : 'Hàng mới'}</h2>
         <button onClick={handleSubmit} className="text-xs font-black text-blue-500 uppercase tracking-widest">Lưu</button>
      </header>

      <div className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-slate-900 border-2 border-dashed border-slate-800 flex items-center justify-center cursor-pointer group shadow-2xl" onClick={() => setShowCamera(true)}>
         {imageUrl ? (
           <img src={imageUrl} className="w-full h-full object-cover" alt="preview" />
         ) : (
           <div className="flex flex-col items-center gap-4 text-slate-700">
              <div className="p-5 bg-slate-800 rounded-full"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2.5"></path></svg></div>
              <p className="text-[10px] font-black uppercase tracking-widest">Chụp ảnh mặt hàng</p>
           </div>
         )}
         {imageUrl && (
            <div className="absolute bottom-6 right-6 px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg">Thay đổi</div>
         )}
         {isAiProcessing && (
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">AI đang phân tích...</span>
           </div>
         )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
         <section className="space-y-6">
            <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Thông tin</h3>
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Tên mặt hàng</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nhập tên..." className="w-full p-5 bg-slate-900 border border-slate-800 rounded-[1.25rem] font-bold outline-none focus:border-blue-500 text-white" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Danh mục</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-5 bg-slate-900 border border-slate-800 rounded-[1.25rem] font-bold outline-none focus:border-blue-500 text-white appearance-none">
                       {['Tất cả', 'Điện thoại', 'Laptop', 'Phụ kiện'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Thương hiệu</label>
                    <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Nhãn hàng..." className="w-full p-5 bg-slate-900 border border-slate-800 rounded-[1.25rem] font-bold outline-none focus:border-blue-500 text-white" />
                 </div>
               </div>
            </div>
         </section>

         <section className="space-y-6">
            <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Kho & Giá</h3>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Tồn kho hiện có</label>
                  <input type="number" readOnly value={stock} className="w-full p-5 bg-slate-950 border border-slate-800 rounded-[1.25rem] font-black text-slate-600 outline-none" />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-white uppercase mb-2 ml-1">Số lượng +/-</label>
                  <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} className="w-full p-5 bg-blue-600/10 border border-blue-500/30 rounded-[1.25rem] font-black text-blue-500 focus:border-blue-500 outline-none" />
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Giá vốn (VNĐ)</label>
                  <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} className="w-full p-5 bg-slate-900 border border-slate-800 rounded-[1.25rem] font-black text-white outline-none" />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Giá bán (VNĐ)</label>
                  <input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="w-full p-5 bg-slate-900 border border-slate-800 rounded-[1.25rem] font-black text-blue-500 outline-none" />
               </div>
            </div>
         </section>

         <button type="submit" className="w-full py-6 bg-blue-600 text-white font-black rounded-[1.5rem] text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all">Lưu thông tin</button>
      </form>

      {showCamera && <CameraView title="Chụp ảnh mặt hàng" onClose={() => setShowCamera(false)} onCapture={handleCapture} />}
    </div>
  );
};

export default ProductForm;
