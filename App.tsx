
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileUp, 
  Download, 
  CheckCircle2, 
  X, 
  ImageIcon, 
  FileText, 
  Zap, 
  ChevronRight,
  Info,
  Layers,
  Trash2,
  Video,
  Link as LinkIcon,
  Play,
  Loader2,
  Smartphone,
  FolderArchive,
  FileImage,
  Youtube,
  Music,
  Monitor,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { PdfPage, OutputFormat, AppState } from './types';
import { analyzeImageContent } from './services/geminiService';

// Standard declaration for window objects from CDN
declare const pdfjsLib: any;
declare const JSZip: any;

type AppMode = 'pdf' | 'tiktok' | 'youtube';

interface MediaData {
  url?: string;
  images?: string[];
  title?: string;
  author?: string;
  cover?: string;
  id?: string;
  formats?: { quality: string; url: string; type: 'video' | 'audio' }[];
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('pdf');
  const [state, setState] = useState<AppState>({
    isProcessing: false,
    pages: [],
    fileName: '',
    format: OutputFormat.PNG,
    quality: 0.92,
  });
  
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TikTok & YouTube State
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MediaData | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // Initialize PDF.js worker
  useEffect(() => {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }, []);

  const resetResult = () => {
    setResult(null);
    setInputUrl('');
  };

  const processPdf = async (file: File) => {
    setState(prev => ({ ...prev, isProcessing: true, fileName: file.name.replace('.pdf', ''), pages: [] }));
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const pages: PdfPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); 
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context!, viewport }).promise;
        
        const dataUrl = canvas.toDataURL(state.format, state.quality);
        pages.push({
          index: i,
          dataUrl,
          width: viewport.width,
          height: viewport.height,
          selected: true
        });
        
        if (i % 5 === 0 || i === numPages) {
          setState(prev => ({ ...prev, pages: [...pages] }));
        }
      }
      
      setState(prev => ({ ...prev, isProcessing: false, pages }));
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Có lỗi xảy ra khi đọc file PDF.');
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleMediaDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      if (mode === 'tiktok') {
        const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(inputUrl)}`);
        const data = await response.json();
        
        if (data.code === 0) {
          const res = data.data;
          setResult({
            url: res.play,
            images: res.images,
            title: res.title,
            author: res.author.nickname,
            cover: res.cover
          });
        } else {
          alert('Không tìm thấy video TikTok hoặc link không hợp lệ.');
        }
      } else if (mode === 'youtube') {
        const vidIdMatch = inputUrl.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
        const vidId = vidIdMatch?.[1]?.split('&')[0]?.split('?')[0];
        
        if (!vidId) {
          alert('Link YouTube không hợp lệ.');
          setLoading(false);
          return;
        }

        // Logic hiển thị kết quả YouTube
        setResult({
          id: vidId,
          title: "Video YouTube đã sẵn sàng",
          author: "YouTube Creator",
          cover: `https://img.youtube.com/vi/${vidId}/maxresdefault.jpg`,
          formats: [
            { quality: 'Video MP4 (720p)', url: `https://api.vve.pw/api/button/mp4/${vidId}`, type: 'video' },
            { quality: 'Video MP4 (360p)', url: `https://api.vve.pw/api/button/360/${vidId}`, type: 'video' },
            { quality: 'Âm thanh MP3', url: `https://api.vve.pw/api/button/mp3/${vidId}`, type: 'audio' }
          ]
        });
      }
    } catch (error) {
      console.error('Download Error:', error);
      alert('Lỗi kết nối server. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const downloadAllPdf = async () => {
    const selectedPages = state.pages.filter(p => p.selected);
    if (selectedPages.length === 0) return;

    if (selectedPages.length === 1) {
      const link = document.createElement('a');
      link.href = selectedPages[0].dataUrl;
      link.download = `${state.fileName}_trang_${selectedPages[0].index}.${state.format === OutputFormat.PNG ? 'png' : 'jpg'}`;
      link.click();
      return;
    }

    const zip = new JSZip();
    selectedPages.forEach((page) => {
      const imgData = page.dataUrl.split(',')[1];
      const extension = state.format === OutputFormat.PNG ? 'png' : 'jpg';
      zip.file(`${state.fileName}_trang_${page.index}.${extension}`, imgData, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${state.fileName}_images.zip`;
    link.click();
  };

  const downloadTikTokImagesZip = async () => {
    if (!result?.images) return;
    setIsZipping(true);
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("tiktok_photos");
      
      const promises = result.images.map(async (url, index) => {
        const response = await fetch(url);
        const blob = await response.blob();
        folder.file(`photo_${index + 1}.jpg`, blob);
      });
      
      await Promise.all(promises);
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `TikTok_Photos_${Date.now()}.zip`;
      link.click();
    } catch (error) {
      console.error("ZIP Error:", error);
      alert("Lỗi khi nén ảnh.");
    } finally {
      setIsZipping(false);
    }
  };

  const togglePageSelection = (index: number) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.index === index ? { ...p, selected: !p.selected } : p)
    }));
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processPdf(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-auto lg:h-20 flex flex-col lg:flex-row items-center justify-between gap-4 py-4 lg:py-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2.5 rounded-xl text-white shadow-lg">
              <Zap size={24} className="fill-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                Nhutcoder <span className="text-red-600">Toolbox</span>
              </h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">V.5.0 Build</span>
            </div>
          </div>

          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: 'pdf', icon: <FileText size={18} />, label: 'PDF To Image' },
              { id: 'tiktok', icon: <Video size={18} />, label: 'TikTok' },
              { id: 'youtube', icon: <Youtube size={18} />, label: 'YouTube' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setMode(tab.id as AppMode); resetResult(); }}
                className={`whitespace-nowrap flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${mode === tab.id ? 'bg-white text-red-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        {mode === 'pdf' ? (
          state.pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 animate-in fade-in duration-700">
              <div className="text-center mb-10 max-w-2xl">
                <h2 className="text-4xl sm:text-6xl font-black text-slate-900 mb-6 tracking-tight uppercase">
                  PDF Sang <span className="text-red-600 underline decoration-red-100">Ảnh</span>
                </h2>
                <p className="text-lg text-slate-500 font-medium">Chuyển đổi từng trang PDF sang PNG/JPG chất lượng cao 100% offline.</p>
              </div>

              <form 
                onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
                className={`w-full max-w-2xl border-4 border-dashed rounded-[3rem] p-12 sm:p-20 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 group
                  ${dragActive ? 'border-red-500 bg-red-50 scale-[0.98]' : 'border-slate-200 bg-white hover:border-red-300 hover:shadow-2xl shadow-slate-100'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && processPdf(e.target.files[0])} />
                <div className="bg-red-50 p-10 rounded-[2.5rem] text-red-600 mb-8 group-hover:rotate-6 transition-transform duration-300 shadow-inner"><FileUp size={64} /></div>
                <p className="text-2xl font-black text-slate-800 mb-2">Thả file PDF vào đây</p>
                <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Nhấn để chọn file từ thiết bị</p>
                {state.isProcessing && (
                  <div className="mt-10 flex flex-col items-center">
                    <Loader2 className="animate-spin text-red-600 mb-4" size={48} />
                    <span className="font-bold text-slate-700 text-lg">Đang trích xuất dữ liệu...</span>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
               <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight truncate max-w-xs sm:max-w-md">
                      {state.fileName}.pdf
                    </h3>
                    <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">{state.pages.length} trang đã sẵn sàng</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="bg-slate-50 p-1.5 rounded-xl flex items-center gap-1 flex-1 sm:flex-none">
                    <button onClick={() => setState(s => ({ ...s, format: OutputFormat.PNG }))} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-black transition-all ${state.format === OutputFormat.PNG ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>PNG</button>
                    <button onClick={() => setState(s => ({ ...s, format: OutputFormat.JPG }))} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-black transition-all ${state.format === OutputFormat.JPG ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>JPG</button>
                  </div>
                  <button onClick={downloadAllPdf} className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-black shadow-xl hover:bg-red-600 transition-all flex-1 sm:flex-none">
                    <Download size={18} />
                    Tải Tất Cả
                  </button>
                  <button onClick={() => setState(s => ({ ...s, pages: [], fileName: '' }))} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {state.pages.map((page) => (
                  <div key={page.index} className={`group relative bg-white rounded-3xl overflow-hidden border-2 transition-all duration-300 ${page.selected ? 'border-red-500 ring-4 ring-red-50' : 'border-slate-100 hover:border-red-200'}`}>
                    <div className="aspect-[3/4] relative overflow-hidden bg-slate-50">
                      <img src={page.dataUrl} className="w-full h-full object-contain p-2" />
                      <button onClick={() => togglePageSelection(page.index)} className={`absolute top-4 left-4 w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl transition-all ${page.selected ? 'bg-red-600 text-white' : 'bg-white/90 text-slate-400'}`}>
                        {page.selected ? <CheckCircle2 size={24} /> : <div className="w-6 h-6 rounded-lg border-2 border-current" />}
                      </button>
                    </div>
                    <div className="p-6 flex items-center justify-between border-t border-slate-50">
                      <span className="font-black text-slate-800 text-lg">Trang {page.index}</span>
                      <button onClick={() => { const link = document.createElement('a'); link.href = page.dataUrl; link.download = `${state.fileName}_trang_${page.index}.${state.format === OutputFormat.PNG ? 'png' : 'jpg'}`; link.click(); }} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                        <Download size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* TikTok & YouTube Section */
          <div className="flex flex-col items-center py-12 max-w-4xl mx-auto animate-in fade-in duration-700">
             <div className="text-center mb-12">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6 ${mode === 'tiktok' ? 'bg-red-50 text-red-600' : 'bg-red-600 text-white'}`}>
                  {mode === 'tiktok' ? <Zap size={14} className="fill-red-600" /> : <Youtube size={14} className="fill-white" />}
                  {mode === 'tiktok' ? 'Tải TikTok No Watermark' : 'YouTube Downloader'}
                </div>
                <h2 className="text-4xl sm:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-tight uppercase">
                   {mode === 'tiktok' ? 'Tải TikTok' : 'Tải YouTube'} <span className="text-red-600 underline decoration-red-100">Cực Nhanh</span>
                </h2>
                <p className="text-lg text-slate-500 font-medium italic">"Powered by Nhutcoder - Master Tools"</p>
              </div>

              <form onSubmit={handleMediaDownload} className="w-full mb-16 px-4">
                <div className="relative group max-w-3xl mx-auto">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within:text-red-600 transition-colors">
                    <LinkIcon size={24} />
                  </div>
                  <input 
                    type="url" 
                    placeholder={mode === 'tiktok' ? "Dán link video TikTok tại đây..." : "Dán link video YouTube tại đây..."}
                    className="block w-full pl-16 pr-44 py-6 bg-white border-4 border-slate-100 rounded-[2rem] focus:ring-8 focus:ring-red-50 focus:border-red-500 transition-all outline-none text-slate-800 font-bold text-lg shadow-xl shadow-slate-200"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    required
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="absolute right-3 top-3 bottom-3 bg-slate-900 text-white px-10 rounded-2xl hover:bg-red-600 transition-all duration-300 font-black flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} className="fill-white" />}
                    <span className="hidden sm:inline">Phân tích</span>
                  </button>
                </div>
              </form>

              {result && (
                <div className="w-full bg-white rounded-[3rem] border-4 border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 max-w-4xl">
                  <div className="p-8 sm:p-12 flex flex-col md:flex-row gap-12">
                    <div className="w-full md:w-[320px] shrink-0 aspect-video md:aspect-[9/16] bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl group">
                      <img src={result.cover} className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700" alt="Cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-8">
                         <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/30">
                              {mode === 'tiktok' && result.images && result.images.length > 0 ? <ImageIcon size={24} /> : <Video size={24} />}
                            </div>
                            <span className="text-white font-black text-lg">@{result.author}</span>
                         </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="mb-10">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-100">Link Sạch</span>
                          <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border border-blue-100">HD Ready</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4 leading-tight">
                          {result.title || 'Media Content'}
                        </h3>
                      </div>

                      <div className="space-y-4">
                        {/* TikTok Download Options */}
                        {mode === 'tiktok' && (
                          <>
                            {result.images && result.images.length > 0 ? (
                              <button 
                                onClick={downloadTikTokImagesZip}
                                disabled={isZipping}
                                className="w-full flex items-center justify-center gap-4 bg-red-600 text-white py-6 rounded-3xl font-black text-xl hover:bg-red-700 hover:scale-[1.02] transition-all shadow-2xl shadow-red-200 disabled:opacity-50"
                              >
                                {isZipping ? <Loader2 size={24} className="animate-spin" /> : <FolderArchive size={24} />}
                                TẢI TOÀN BỘ ẢNH (.ZIP)
                              </button>
                            ) : result.url && (
                              <a 
                                href={result.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-4 bg-red-600 text-white py-6 rounded-3xl font-black text-xl hover:bg-red-700 hover:scale-[1.02] transition-all shadow-2xl shadow-red-200"
                              >
                                <Download size={24} />
                                TẢI VIDEO (KHÔNG LOGO)
                              </a>
                            )}
                          </>
                        )}

                        {/* YouTube Download Options */}
                        {mode === 'youtube' && result.formats && (
                          <div className="grid grid-cols-1 gap-4">
                            {result.formats.map((f, i) => (
                              <a 
                                key={i}
                                href={f.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex items-center justify-between px-8 py-6 rounded-3xl font-black text-lg transition-all shadow-lg hover:translate-x-3 ${f.type === 'video' ? 'bg-slate-900 text-white hover:bg-red-600' : 'bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100'}`}
                              >
                                <div className="flex items-center gap-4">
                                  {f.type === 'video' ? <Monitor size={24} /> : <Music size={24} />}
                                  <span>{f.quality}</span>
                                </div>
                                <ExternalLink size={20} />
                              </a>
                            ))}
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] text-center mt-4">
                              Nhấn nút để mở trang tải chất lượng cao
                            </p>
                          </div>
                        )}
                        
                        {mode === 'tiktok' && result.images && result.images.length > 0 && (
                          <div className="mt-8">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <FileImage size={14} /> 
                              XEM TRƯỚC {result.images.length} ẢNH
                            </h4>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                              {result.images.map((img, idx) => (
                                <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 hover:border-red-500 transition-all hover:scale-105 shadow-sm group relative">
                                  <img src={img} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                    <Download size={14} className="text-white opacity-0 group-hover:opacity-100" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t-2 border-slate-100 pt-16 pb-12 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex flex-col items-center md:items-start gap-6 max-w-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                  <Zap size={24} className="fill-white" />
                </div>
                <span className="font-black tracking-tighter text-2xl text-slate-800 uppercase">Nhutcoder</span>
              </div>
              <p className="text-slate-500 font-medium text-sm leading-relaxed text-center md:text-left">
                Bộ công cụ đa năng giúp bạn làm việc hiệu quả hơn. Luôn cập nhật và hoàn toàn miễn phí bởi Nhutcoder.
              </p>
            </div>
            
            <div className="flex flex-col items-center gap-4 bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 shadow-inner min-w-[300px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Developer</span>
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-red-200">N</div>
                 <div className="flex flex-col">
                    <p className="text-2xl font-black text-slate-900 leading-tight">Nhutcoder</p>
                    <span className="text-red-500 text-xs font-bold uppercase tracking-widest">Master Engineer</span>
                 </div>
              </div>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
              Powered By <span className="text-red-600 underline">Nhutcoder</span> • 2024 Collection
            </p>
            <div className="flex gap-8">
              <a href="#" className="text-slate-400 hover:text-red-600 transition-colors text-xs font-black uppercase tracking-widest">Bảo mật</a>
              <a href="#" className="text-slate-400 hover:text-red-600 transition-colors text-xs font-black uppercase tracking-widest">Github</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
