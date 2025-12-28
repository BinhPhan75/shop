
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraViewProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  title: string;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      setError('Không thể truy cập camera. Vui lòng kiểm tra quyền.');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stream?.getTracks().forEach(track => track.stop());
  }, [startCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        onCapture(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col">
      <header className="p-6 pt-12 flex justify-between items-center text-white bg-black/50 z-10 backdrop-blur-md">
        <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg></button>
        <h3 className="font-black uppercase text-xs tracking-[0.3em]">{title}</h3>
        <button className="p-3 bg-white/10 rounded-2xl active:scale-90"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a1 1 0 00-2 0v14a1 1 0 002 0V4zM11 4a1 1 0 10-2 0v14a1 1 0 102 0V4zM17 4a1 1 0 00-2 0v14a1 1 0 002 0V4z"></path></svg></button>
      </header>

      <div className="flex-1 relative flex items-center justify-center bg-zinc-950 overflow-hidden">
        {error ? (
          <div className="text-white text-center p-6 space-y-4">
             <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2"></path></svg></div>
             <p className="font-bold text-sm">{error}</p>
             <button onClick={startCamera} className="px-8 py-3 bg-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cấp quyền ngay</button>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-60" />
        )}
        
        {/* Scanner UI */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="w-72 h-48 border-2 border-blue-500/50 rounded-[2rem] relative shadow-[0_0_0_100vw_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Laser Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-[scan_2s_infinite]"></div>
                
                {/* Corners */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-blue-500 rounded-tl-[1.5rem]"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-blue-500 rounded-tr-[1.5rem]"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-blue-500 rounded-bl-[1.5rem]"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-blue-500 rounded-br-[1.5rem]"></div>
            </div>
            <div className="mt-8 px-6 py-3 bg-black/60 backdrop-blur rounded-2xl text-[10px] font-black text-white/80 uppercase tracking-[0.2em] border border-white/5">Di chuyển camera đến mã vạch</div>
        </div>
        
        {/* Quick controls */}
        <button className="absolute bottom-32 right-8 p-5 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-full text-white active:scale-90 transition-all"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path></svg></button>
      </div>

      <div className="p-10 pb-16 bg-black flex flex-col items-center gap-6">
        <button onClick={handleCapture} className="w-22 h-22 rounded-full border-[8px] border-white/10 flex items-center justify-center active:scale-90 transition-all">
          <div className="w-16 h-16 rounded-full bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.4)] border-4 border-white"></div>
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(192px); }
          100% { transform: translateY(0); }
        }
      `}</style>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraView;
