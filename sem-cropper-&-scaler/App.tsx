import React, { useState } from 'react';
import { Upload, Loader2, Microscope } from 'lucide-react';
import ImageEditor from './components/ImageEditor';
import { analyzeSemImage } from './services/geminiService';
import { SemAnalysisResult } from './types';

function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<SemAnalysisResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImageSrc(base64);

      // Call Gemini AI to detect crop line
      const result = await analyzeSemImage(base64);
      setAnalysisData(result);
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setImageSrc(null);
    setAnalysisData(null);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
                <Microscope className="text-white" size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white tracking-tight">SEM Tool</h1>
                <p className="text-xs text-slate-400">Crop footer & add scientific scale bars</p>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 h-[calc(100vh-80px)]">
        
        {!imageSrc && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-full max-w-md bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl p-12 text-center hover:border-blue-500/50 transition-colors group">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    {isAnalyzing ? (
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                    ) : (
                        <Upload className="text-slate-400 group-hover:text-blue-400" size={40} />
                    )}
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">Upload SEM Image</h2>
                <p className="text-slate-400 mb-8">Drag and drop or click to select a file</p>
                
                <label className="relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-200 bg-blue-600 font-lg rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 cursor-pointer shadow-lg shadow-blue-900/20">
                    {isAnalyzing ? 'Analyzing Structure...' : 'Choose File'}
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        disabled={isAnalyzing}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                    />
                </label>
                
                {isAnalyzing && (
                   <p className="mt-4 text-xs text-blue-400 animate-pulse">Gemini Vision AI is detecting footer information...</p>
                )}
            </div>
          </div>
        )}

        {imageSrc && analysisData && (
          <ImageEditor 
            imageSrc={imageSrc}
            suggestedCropY={analysisData.suggestedCropY}
            initialScaleText={analysisData.detectedScaleText}
            onReset={handleReset}
          />
        )}

      </main>
    </div>
  );
}

export default App;