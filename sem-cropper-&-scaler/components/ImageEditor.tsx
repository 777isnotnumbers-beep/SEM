import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScaleBarSettings, CalibrationData, AppState, CropRect } from '../types';
import { Download, ScanLine, MousePointer2, Ruler, Type as TypeIcon, Check, ZoomIn, Percent, Hash } from 'lucide-react';

interface ImageEditorProps {
  imageSrc: string;
  suggestedCropY: number;
  initialScaleText?: string;
  onReset: () => void;
}

const MAG_SIZE = 160; // Diameter of magnifier
const MAG_ZOOM = 3;   // Zoom level

const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, suggestedCropY, initialScaleText, onReset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  
  // State
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [mode, setMode] = useState<AppState>(AppState.CALIBRATE);
  const [usePercent, setUsePercent] = useState(false);
  
  // Calibration State
  const [calStart, setCalStart] = useState<{x: number, y: number} | null>(null);
  const [calEnd, setCalEnd] = useState<{x: number, y: number} | null>(null);
  const [calibration, setCalibration] = useState<CalibrationData>({
    pixels: 0,
    knownDistance: 10,
    unit: 'µm'
  });

  // Magnifier State
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);

  // New Scale Bar Settings
  const [settings, setSettings] = useState<ScaleBarSettings>({
    show: true,
    lengthValue: 5,
    lengthUnit: 'µm',
    barHeight: 8,
    fontSize: 24,
    fontColor: '#ffffff',
    barColor: '#ffffff',
    position: 'bottom-right',
    overlayPadding: 40,
  });

  // Initialize Image
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImageObj(img);
      // Default crop: full width, suggested height (bottom crop)
      setCrop({
        x: 0, 
        y: 0, 
        width: img.width, 
        height: suggestedCropY > 0 ? suggestedCropY : img.height
      });
      
      // Parse initial scale text if available
      if (initialScaleText) {
        const parts = initialScaleText.trim().split(/\s+/);
        if (parts.length >= 2) {
            const val = parseFloat(parts[0]);
            const unit = parts[1];
            if (!isNaN(val)) {
                setCalibration(prev => ({ ...prev, knownDistance: val, unit }));
                setSettings(prev => ({ ...prev, lengthUnit: unit, lengthValue: val / 2 }));
            }
        }
      }
    };
  }, [imageSrc, suggestedCropY, initialScaleText]);

  // Canvas Drawing Logic
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match image
    if (canvas.width !== imageObj.width || canvas.height !== imageObj.height) {
        canvas.width = imageObj.width;
        canvas.height = imageObj.height;
    }

    // 1. Draw Original Image
    ctx.drawImage(imageObj, 0, 0);

    // 2. Draw Crop Overlay (Dim the area OUTSIDE the crop rect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    
    // Top rect
    ctx.fillRect(0, 0, canvas.width, crop.y);
    // Bottom rect
    ctx.fillRect(0, crop.y + crop.height, canvas.width, canvas.height - (crop.y + crop.height));
    // Left rect
    ctx.fillRect(0, crop.y, crop.x, crop.height);
    // Right rect
    ctx.fillRect(crop.x + crop.width, crop.y, canvas.width - (crop.x + crop.width), crop.height);

    // Crop Border
    ctx.strokeStyle = '#ef4444'; // Red-500
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    ctx.setLineDash([]);

    // 3. Draw Calibration Lines (if in Calibrate mode)
    if (mode === AppState.CALIBRATE) {
      if (calStart) {
        ctx.fillStyle = '#3b82f6'; // Blue-500
        ctx.beginPath();
        ctx.arc(calStart.x, calStart.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (calEnd) {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(calEnd.x, calEnd.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (calStart && calEnd) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(calStart.x, calStart.y);
        ctx.lineTo(calEnd.x, calEnd.y);
        ctx.stroke();
      }
    }

    // 4. Draw New Scale Bar (if in Edit mode and valid calibration)
    if (mode === AppState.EDIT && settings.show && calibration.pixels > 0) {
      const pixelsPerUnit = calibration.pixels / calibration.knownDistance;
      const barPixelWidth = settings.lengthValue * pixelsPerUnit;
      
      let x = 0;
      let y = 0;
      const p = settings.overlayPadding;
      
      // Position relative to CROP rect, not full image
      switch (settings.position) {
        case 'bottom-right':
            x = crop.x + crop.width - barPixelWidth - p;
            y = crop.y + crop.height - p;
            break;
        case 'bottom-left':
            x = crop.x + p;
            y = crop.y + crop.height - p;
            break;
        case 'top-right':
            x = crop.x + crop.width - barPixelWidth - p;
            y = crop.y + p + settings.fontSize;
            break;
        case 'top-left':
            x = crop.x + p;
            y = crop.y + p + settings.fontSize;
            break;
      }

      // Draw Bar
      ctx.fillStyle = settings.barColor;
      ctx.fillRect(x, y, barPixelWidth, settings.barHeight);

      // Draw Text
      ctx.fillStyle = settings.fontColor;
      ctx.font = `bold ${settings.fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const text = `${settings.lengthValue} ${settings.lengthUnit}`;
      
      ctx.fillText(text, x + barPixelWidth / 2, y - 8);
    }

  }, [imageObj, crop, mode, calStart, calEnd, settings, calibration]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Magnifier Drawing
  useEffect(() => {
    if (mode === AppState.CALIBRATE && cursorPos && imageObj && magCanvasRef.current) {
        const ctx = magCanvasRef.current.getContext('2d');
        if (ctx) {
            // Clear
            ctx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
            
            // Fill background
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, MAG_SIZE, MAG_SIZE);

            // Source coordinates (centered around cursor)
            const sW = MAG_SIZE / MAG_ZOOM;
            const sH = MAG_SIZE / MAG_ZOOM;
            const sX = cursorPos.x - sW / 2;
            const sY = cursorPos.y - sH / 2;

            // Draw magnified image
            // Clamp edges handled by browser drawImage usually, but let's be safe visually
            ctx.drawImage(imageObj, sX, sY, sW, sH, 0, 0, MAG_SIZE, MAG_SIZE);

            // Draw crosshair
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(MAG_SIZE/2, 0);
            ctx.lineTo(MAG_SIZE/2, MAG_SIZE);
            ctx.moveTo(0, MAG_SIZE/2);
            ctx.lineTo(MAG_SIZE, MAG_SIZE/2);
            ctx.stroke();

            // Border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.strokeRect(0,0, MAG_SIZE, MAG_SIZE);
        }
    }
  }, [cursorPos, mode, imageObj]);

  // Handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== AppState.CALIBRATE || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setCursorPos({ x, y });
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== AppState.CALIBRATE) return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (!calStart) {
      setCalStart({ x, y });
    } else if (!calEnd) {
      setCalEnd({ x, y });
      const dist = Math.sqrt(Math.pow(x - calStart.x, 2) + Math.pow(y - calStart.y, 2));
      setCalibration(prev => ({ ...prev, pixels: dist }));
    } else {
      setCalStart({ x, y });
      setCalEnd(null);
    }
  };

  // Crop Input Helpers
  const getDisplayValue = (val: number, max: number) => {
    if (usePercent) return ((val / max) * 100).toFixed(1);
    return Math.round(val).toString();
  };

  const parseInputValue = (val: string, max: number): number => {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    if (usePercent) return Math.round((num / 100) * max);
    return Math.round(num);
  };

  const updateCropInset = (type: 'top'|'bottom'|'left'|'right', valueStr: string) => {
    if (!imageObj) return;
    const w = imageObj.width;
    const h = imageObj.height;
    
    // Calculate new raw value
    // For Top/Left, max is size. For Bottom/Right, max is size.
    let val = 0;
    
    if (type === 'top' || type === 'bottom') {
        val = parseInputValue(valueStr, h);
    } else {
        val = parseInputValue(valueStr, w);
    }

    setCrop(prev => {
        const next = { ...prev };
        if (type === 'top') {
            // Change y, keep bottom edge fixed => adjust height
            const bottomEdge = prev.y + prev.height;
            next.y = Math.max(0, Math.min(val, bottomEdge - 10));
            next.height = bottomEdge - next.y;
        } else if (type === 'bottom') {
            // "Bottom" usually means distance from bottom edge
            // val is distance from bottom
            const newHeight = h - prev.y - val;
            next.height = Math.max(10, newHeight);
        } else if (type === 'left') {
            const rightEdge = prev.x + prev.width;
            next.x = Math.max(0, Math.min(val, rightEdge - 10));
            next.width = rightEdge - next.x;
        } else if (type === 'right') {
             // Distance from right
             const newWidth = w - prev.x - val;
             next.width = Math.max(10, newWidth);
        }
        return next;
    });
  };

  const handleDownload = () => {
    if (!imageObj) return;
    
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Final canvas size matches the CROP size
    tempCanvas.width = crop.width;
    tempCanvas.height = crop.height;

    // Draw portion of original image
    ctx.drawImage(
        imageObj, 
        crop.x, crop.y, crop.width, crop.height, // Source
        0, 0, crop.width, crop.height // Dest
    );

    // Draw Scale Bar
    if (settings.show && calibration.pixels > 0) {
        const pixelsPerUnit = calibration.pixels / calibration.knownDistance;
        const barPixelWidth = settings.lengthValue * pixelsPerUnit;
        
        let x = 0;
        let y = 0;
        const p = settings.overlayPadding;
        
        // Coordinates are relative to the new canvas (0,0 to w,h)
        switch (settings.position) {
          case 'bottom-right': x = tempCanvas.width - barPixelWidth - p; y = tempCanvas.height - p; break;
          case 'bottom-left': x = p; y = tempCanvas.height - p; break;
          case 'top-right': x = tempCanvas.width - barPixelWidth - p; y = p + settings.fontSize; break;
          case 'top-left': x = p; y = p + settings.fontSize; break;
        }
  
        ctx.fillStyle = settings.barColor;
        ctx.fillRect(x, y - settings.barHeight, barPixelWidth, settings.barHeight);
  
        ctx.fillStyle = settings.fontColor;
        ctx.font = `bold ${settings.fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${settings.lengthValue} ${settings.lengthUnit}`, x + barPixelWidth / 2, y - settings.barHeight - 8);
    }

    const link = document.createElement('a');
    link.download = 'sem-processed.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      
      {/* Main Canvas Area */}
      <div className="flex-1 bg-slate-800 rounded-xl p-4 flex items-center justify-center overflow-hidden relative shadow-inner group">
        
        <canvas 
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`max-w-full max-h-[80vh] object-contain rounded shadow-lg ${mode === AppState.CALIBRATE ? 'cursor-crosshair' : 'cursor-default'}`}
        />
        
        {/* Magnifier Portal (Absolute positioned relative to container) */}
        {mode === AppState.CALIBRATE && cursorPos && (
            <div 
                className="absolute pointer-events-none z-20 rounded-full border-2 border-white shadow-2xl overflow-hidden bg-slate-900"
                style={{
                    width: MAG_SIZE,
                    height: MAG_SIZE,
                    // Let's make it float near cursor or in corner. 
                    // Following cursor can block view. 
                    // Let's put it in top-right corner of container for stability.
                    position: 'absolute',
                    right: 20,
                    top: 20,
                    transform: 'none'
                }}
            >
                <canvas 
                    ref={magCanvasRef} 
                    width={MAG_SIZE} 
                    height={MAG_SIZE} 
                    className="block"
                />
                <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/80 font-mono bg-black/50 py-1">
                    {cursorPos.x.toFixed(0)}, {cursorPos.y.toFixed(0)}
                </div>
            </div>
        )}

        {/* Floating Instructions */}
        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur p-3 rounded-lg border border-slate-700 text-sm max-w-xs pointer-events-none z-10">
          {mode === AppState.CALIBRATE && (
            <div>
                <p className="text-blue-400 flex items-center gap-2 font-semibold mb-1">
                <ZoomIn size={16} />
                Calibration Mode
                </p>
                <p className="text-slate-300 text-xs">
                Hover image to inspect. Click two points on the original scale bar.
                </p>
            </div>
          )}
          {mode === AppState.EDIT && (
             <p className="text-emerald-400 flex items-center gap-2">
             <Check size={16} />
             Adjust crop & scale bar settings.
           </p>
          )}
        </div>
      </div>

      {/* Controls Sidebar */}
      <div className="w-full lg:w-96 bg-slate-800 rounded-xl p-6 overflow-y-auto flex flex-col gap-6 shadow-xl border border-slate-700">
        
        {/* Steps Navigation */}
        <div className="flex gap-2 p-1 bg-slate-900 rounded-lg shrink-0">
            <button 
                onClick={() => setMode(AppState.CALIBRATE)}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${mode === AppState.CALIBRATE ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
                1. Crop & Calibrate
            </button>
            <button 
                onClick={() => setMode(AppState.EDIT)}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${mode === AppState.EDIT ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
                2. Finalize
            </button>
        </div>

        <hr className="border-slate-700" />

        {/* Step 1: Crop & Calibrate Controls */}
        {mode === AppState.CALIBRATE && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                
                {/* Precise Crop Controls */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                         <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <ScanLine size={16}/> Crop Boundaries
                        </h3>
                        <div className="flex bg-slate-900 rounded p-0.5">
                            <button 
                                onClick={() => setUsePercent(false)}
                                className={`px-2 py-0.5 text-xs rounded ${!usePercent ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                            >
                                <Hash size={12} />
                            </button>
                            <button 
                                onClick={() => setUsePercent(true)}
                                className={`px-2 py-0.5 text-xs rounded ${usePercent ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                            >
                                <Percent size={12} />
                            </button>
                        </div>
                    </div>
                   
                    <div className="grid grid-cols-2 gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                         <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Top Inset</label>
                            <div className="flex items-center bg-slate-800 rounded border border-slate-600 px-2">
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent py-1 text-sm outline-none"
                                    value={getDisplayValue(crop.y, imageObj?.height || 1)}
                                    onChange={(e) => updateCropInset('top', e.target.value)}
                                />
                                <span className="text-xs text-slate-500 ml-1">{usePercent ? '%' : 'px'}</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Bottom Inset</label>
                             <div className="flex items-center bg-slate-800 rounded border border-slate-600 px-2">
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent py-1 text-sm outline-none"
                                    value={getDisplayValue(imageObj ? imageObj.height - (crop.y + crop.height) : 0, imageObj?.height || 1)}
                                    onChange={(e) => updateCropInset('bottom', e.target.value)}
                                />
                                <span className="text-xs text-slate-500 ml-1">{usePercent ? '%' : 'px'}</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Left Inset</label>
                             <div className="flex items-center bg-slate-800 rounded border border-slate-600 px-2">
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent py-1 text-sm outline-none"
                                    value={getDisplayValue(crop.x, imageObj?.width || 1)}
                                    onChange={(e) => updateCropInset('left', e.target.value)}
                                />
                                <span className="text-xs text-slate-500 ml-1">{usePercent ? '%' : 'px'}</span>
                            </div>
                        </div>
                         <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Right Inset</label>
                             <div className="flex items-center bg-slate-800 rounded border border-slate-600 px-2">
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent py-1 text-sm outline-none"
                                    value={getDisplayValue(imageObj ? imageObj.width - (crop.x + crop.width) : 0, imageObj?.width || 1)}
                                    onChange={(e) => updateCropInset('right', e.target.value)}
                                />
                                <span className="text-xs text-slate-500 ml-1">{usePercent ? '%' : 'px'}</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center">
                        Adjusting "Bottom Inset" is usually enough to hide the info bar.
                    </p>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                        <Ruler size={16}/> Scale Calibration
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400">Measured Distance</label>
                            <div className="text-lg font-mono text-slate-200 flex justify-between items-center">
                                <span>{calibration.pixels.toFixed(1)} px</span>
                                {calibration.pixels > 0 && <Check size={16} className="text-green-500" />}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-400">Real Length</label>
                                <input 
                                    type="number" 
                                    value={calibration.knownDistance}
                                    onChange={(e) => setCalibration(p => ({...p, knownDistance: Number(e.target.value)}))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Unit</label>
                                <input 
                                    type="text" 
                                    value={calibration.unit}
                                    onChange={(e) => setCalibration(p => ({...p, unit: e.target.value}))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={() => {setCalStart(null); setCalEnd(null); setCalibration(p => ({...p, pixels: 0}))}}
                            className="w-full py-1 text-xs text-slate-400 hover:text-white border border-slate-600 rounded hover:bg-slate-700"
                        >
                            Reset Points
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Step 2: New Bar Settings */}
        {mode === AppState.EDIT && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                        <TypeIcon size={16}/> New Scale Bar
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                         <div>
                            <label className="text-xs text-slate-400 block mb-1">Length ({calibration.unit})</label>
                            <input 
                                type="number" 
                                value={settings.lengthValue}
                                onChange={(e) => setSettings(s => ({...s, lengthValue: Number(e.target.value)}))}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Unit Display</label>
                            <input 
                                type="text" 
                                value={settings.lengthUnit}
                                onChange={(e) => setSettings(s => ({...s, lengthUnit: e.target.value}))}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                         <div>
                            <label className="text-xs text-slate-400 block mb-1">Position</label>
                            <select 
                                value={settings.position}
                                onChange={(e) => setSettings(s => ({...s, position: e.target.value as any}))}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500 text-white"
                            >
                                <option value="bottom-right">Bottom Right</option>
                                <option value="bottom-left">Bottom Left</option>
                                <option value="top-right">Top Right</option>
                                <option value="top-left">Top Left</option>
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-xs text-slate-400 block mb-1">Font Size</label>
                                <input 
                                    type="number" 
                                    value={settings.fontSize}
                                    onChange={(e) => setSettings(s => ({...s, fontSize: Number(e.target.value)}))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                                />
                            </div>
                             <div>
                                <label className="text-xs text-slate-400 block mb-1">Bar Height</label>
                                <input 
                                    type="number" 
                                    value={settings.barHeight}
                                    onChange={(e) => setSettings(s => ({...s, barHeight: Number(e.target.value)}))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-xs text-slate-400 block mb-1">Font Color</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        value={settings.fontColor}
                                        onChange={(e) => setSettings(s => ({...s, fontColor: e.target.value}))}
                                        className="h-8 w-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <span className="text-xs self-center text-slate-500">{settings.fontColor}</span>
                                </div>
                            </div>
                             <div>
                                <label className="text-xs text-slate-400 block mb-1">Bar Color</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        value={settings.barColor}
                                        onChange={(e) => setSettings(s => ({...s, barColor: e.target.value}))}
                                        className="h-8 w-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <span className="text-xs self-center text-slate-500">{settings.barColor}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                 <button
                    onClick={handleDownload}
                    disabled={calibration.pixels === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
                >
                    <Download size={20} />
                    Export Processed Image
                </button>
            </div>
        )}

        <div className="mt-auto pt-6 border-t border-slate-700">
            <button onClick={onReset} className="text-xs text-slate-500 hover:text-slate-300 underline w-full text-center">
                Discard and Start Over
            </button>
        </div>

      </div>
    </div>
  );
};

export default ImageEditor;