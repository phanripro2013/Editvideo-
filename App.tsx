
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaFile, VideoState, TRANSITIONS } from './types';
import FileSelector from './components/FileSelector';
import { analyzeVideoContent } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<VideoState>({
    images: [],
    audio: null,
    duration: 0,
    status: 'idle',
    progress: 0,
  });

  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedTransition, setSelectedTransition] = useState('fade');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef<number>();

  // Handle image selection
  const onImagesSelected = (files: File[]) => {
    const newImages: MediaFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name
    }));
    setState(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
  };

  // Handle audio selection
  const onAudioSelected = (file: File) => {
    const audioUrl = URL.createObjectURL(file);
    const audioObj = new Audio(audioUrl);
    
    audioObj.onloadedmetadata = () => {
      setState(prev => ({
        ...prev,
        audio: {
          id: 'audio-main',
          file,
          previewUrl: audioUrl,
          name: file.name
        },
        duration: audioObj.duration
      }));
    };
  };

  // Trigger Gemini Analysis
  useEffect(() => {
    if (state.images.length > 0 && state.audio && !aiSuggestion) {
      const fetchSuggestions = async () => {
        const result = await analyzeVideoContent(
          state.images.map(i => i.name),
          state.audio!.name
        );
        if (result) {
          setAiSuggestion(result);
          setSelectedTransition(result.recommendedTransition.toLowerCase() || 'fade');
        }
      };
      fetchSuggestions();
    }
  }, [state.images, state.audio, aiSuggestion]);

  // Main Preview Renderer
  const drawFrame = useCallback((time: number) => {
    if (!canvasRef.current || state.images.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalImages = state.images.length;
    const timePerImage = state.duration / totalImages;
    const currentIndex = Math.floor(time / timePerImage);
    const nextIndex = (currentIndex + 1) % totalImages;
    const progressInCurrent = (time % timePerImage) / timePerImage;

    const imgCurrent = new Image();
    imgCurrent.src = state.images[currentIndex].previewUrl;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate aspect ratio fit
      const scale = Math.max(canvas.width / imgCurrent.width, canvas.height / imgCurrent.height);
      const x = (canvas.width / 2) - (imgCurrent.width / 2) * scale;
      const y = (canvas.height / 2) - (imgCurrent.height / 2) * scale;

      ctx.globalAlpha = 1;

      // Handle Transitions
      if (progressInCurrent > 0.8 && selectedTransition === 'fade') {
        const fadeAlpha = (progressInCurrent - 0.8) / 0.2;
        ctx.globalAlpha = 1 - fadeAlpha;
        ctx.drawImage(imgCurrent, x, y, imgCurrent.width * scale, imgCurrent.height * scale);
        
        const imgNext = new Image();
        imgNext.src = state.images[nextIndex].previewUrl;
        ctx.globalAlpha = fadeAlpha;
        const nextScale = Math.max(canvas.width / imgNext.width, canvas.height / imgNext.height);
        const nx = (canvas.width / 2) - (imgNext.width / 2) * nextScale;
        const ny = (canvas.height / 2) - (imgNext.height / 2) * nextScale;
        ctx.drawImage(imgNext, nx, ny, imgNext.width * nextScale, imgNext.height * nextScale);
      } else {
        ctx.drawImage(imgCurrent, x, y, imgCurrent.width * scale, imgCurrent.height * scale);
      }
    };

    if (imgCurrent.complete) {
      render();
    } else {
      imgCurrent.onload = render;
    }
  }, [state.images, state.duration, selectedTransition]);

  // Animation Loop
  const animate = useCallback(() => {
    if (audioRef.current && isPlaying) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      drawFrame(time);
      
      if (time >= state.duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        audioRef.current.currentTime = 0;
      }
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying, state.duration, drawFrame]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animate]);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const exportVideo = async () => {
    if (!canvasRef.current || !state.audio) return;
    setState(prev => ({ ...prev, status: 'exporting', progress: 0 }));

    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30); // 30 FPS
    
    // Add audio track
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audioRef.current!);
    const destination = audioCtx.createMediaStreamDestination();
    source.connect(destination);
    source.connect(audioCtx.destination);
    
    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...destination.stream.getAudioTracks()
    ]);

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VividEdit_${Date.now()}.webm`;
      a.click();
      setState(prev => ({ ...prev, status: 'completed', progress: 100 }));
      setTimeout(() => setState(prev => ({ ...prev, status: 'idle' })), 3000);
    };

    // Recording logic
    audioRef.current!.currentTime = 0;
    audioRef.current!.play();
    setIsPlaying(true);
    recorder.start();

    const checkEnd = setInterval(() => {
      const prog = (audioRef.current!.currentTime / state.duration) * 100;
      setState(prev => ({ ...prev, progress: Math.min(prog, 99) }));
      
      if (audioRef.current!.currentTime >= state.duration) {
        recorder.stop();
        audioRef.current!.pause();
        setIsPlaying(false);
        clearInterval(checkEnd);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">VividEdit Pro</h1>
          <p className="text-slate-400 text-sm mt-1">High-Performance Browser-Based Video Creator</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            disabled={state.images.length === 0 || !state.audio || state.status === 'exporting'}
            onClick={exportVideo}
            className={`px-6 py-2.5 rounded-full font-semibold transition-all flex items-center gap-2 ${
              state.images.length > 0 && state.audio && state.status !== 'exporting'
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {state.status === 'exporting' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting {Math.round(state.progress)}%
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 10l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export MP4
              </>
            )}
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: File Inputs & AI Suggestion */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </span>
              Assets
            </h2>
            <FileSelector onImagesSelected={onImagesSelected} onAudioSelected={onAudioSelected} />
            
            <div className="mt-4 space-y-3">
              <label className="text-sm font-medium text-slate-400">Transition Style</label>
              <div className="flex flex-wrap gap-2">
                {TRANSITIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTransition(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${
                      selectedTransition === t.id 
                        ? 'bg-blue-600 border-blue-500 text-white' 
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {aiSuggestion && (
            <section className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-emerald-500 text-[10px] font-bold uppercase rounded text-emerald-950">Gemini AI</span>
                <h2 className="text-sm font-semibold text-emerald-400">Creative Recommendation</h2>
              </div>
              <p className="text-xs text-emerald-100/70 mb-2 italic">"{aiSuggestion.vibe}"</p>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Suggested Title</label>
                  <p className="text-sm font-medium text-emerald-100">{aiSuggestion.title}</p>
                </div>
                <div>
                  <label className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Caption/Description</label>
                  <p className="text-xs text-emerald-100/70 leading-relaxed">{aiSuggestion.description}</p>
                </div>
              </div>
            </section>
          )}

          <div className="bg-slate-800/20 rounded-2xl p-6 border border-slate-700/30">
             <h2 className="text-sm font-semibold text-slate-400 mb-4">Timeline List ({state.images.length})</h2>
             <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
               {state.images.map((img, idx) => (
                 <div key={img.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/50 border border-slate-800">
                    <img src={img.previewUrl} className="w-12 h-12 object-cover rounded shadow" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{img.name}</p>
                      <p className="text-[10px] text-slate-500">Duration: {(state.duration / state.images.length).toFixed(1)}s</p>
                    </div>
                    <button 
                      onClick={() => setState(p => ({ ...p, images: p.images.filter(i => i.id !== img.id) }))}
                      className="p-1 hover:text-red-400 text-slate-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                 </div>
               ))}
               {state.images.length === 0 && <p className="text-xs text-slate-600 italic text-center py-4">No images added yet</p>}
             </div>
          </div>
        </div>

        {/* Right Column: Preview Player */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 group">
            <canvas 
              ref={canvasRef} 
              width={1920} 
              height={1080} 
              className="w-full h-full object-contain"
            />
            
            {state.images.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <p className="text-lg font-medium">Video Preview Area</p>
                <p className="text-sm">Add assets to start creating</p>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
               <div className="flex items-center gap-4">
                  <button 
                    onClick={togglePlayback}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 transition-transform active:scale-95"
                  >
                    {isPlaying ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                      <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>
                  <div className="flex-1 space-y-2">
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-blue-500" 
                         style={{ width: `${(currentTime / (state.duration || 1)) * 100}%` }}
                       />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{currentTime.toFixed(1)}s</span>
                      <span>{(state.duration || 0).toFixed(1)}s</span>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-3xl p-6 border border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${state.audio ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
              <div>
                <p className="text-xs font-semibold text-slate-300">Background Audio</p>
                <p className="text-sm text-slate-500 truncate max-w-[200px]">{state.audio ? state.audio.name : 'No music selected'}</p>
              </div>
            </div>
            {state.audio && (
              <audio 
                ref={audioRef} 
                src={state.audio.previewUrl} 
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
            )}
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-300">Total Frames</p>
              <p className="text-lg font-bold text-blue-400">{state.images.length * 30} <span className="text-xs font-normal text-slate-500">@ 30fps</span></p>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-16 text-center text-slate-600 text-xs border-t border-slate-800 pt-8 pb-12">
        <p>Built with React & Canvas MediaStream API • Powered by Google Gemini</p>
        <p className="mt-2">Offline-first client-side rendering • No servers required</p>
      </footer>
    </div>
  );
};

export default App;
