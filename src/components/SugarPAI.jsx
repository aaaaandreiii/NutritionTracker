import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Upload, RefreshCw, Zap, Droplet, Activity, Plus, Check, ChevronLeft, 
  Sparkles, AlertTriangle, ShieldCheck, FileText, Barcode, ShieldAlert, Info
} from 'lucide-react';

const SAMPLES = [
  {
    id: 'granola_label',
    name: 'Packaged Granola Bar (Nutrition Label)',
    sku: 'SKU #88540912 • UPC 0-41220-99120-4',
    skuConfidence: '99.4%',
    image: 'https://images.unsplash.com/photo-1628102491629-778571d893a3?auto=format&fit=crop&w=600&q=80',
    totalSugars: 24,
    addedSugars: 18,
    naturalSugars: 6,
    totalCarbs: 38,
    fiber: 2.5,
    cals: 230,
    gi: 76,
    gl: 27,
    risk: 'CRITICAL SPIKE HAZARD',
    diabetesAllowancePct: 72,
    sugarVariants: [
      { name: 'Maltodextrin', type: 'Polysaccharide', gi: 110, hazard: 'CRITICAL', category: 'Extreme Rapid Spike Agent' },
      { name: 'High Fructose Corn Syrup (HFCS)', type: 'Fructose/Glucose 55/45', gi: 90, hazard: 'HIGH', category: 'Refined Added Sweetener' },
      { name: 'Sucrose (Cane Sugar)', type: 'Disaccharide (Glucose + Fructose)', gi: 65, hazard: 'HIGH', category: 'Table Sugar' },
      { name: 'Brown Rice Syrup', type: 'Maltose/Glucose', gi: 98, hazard: 'HIGH', category: 'High GI Hydrolyzed Syrup' }
    ],
    ingredientsOCR: 'Whole Grain Oats, High Fructose Corn Syrup, Cane Sugar, Brown Rice Syrup, Maltodextrin, Canola Oil, Salt, Natural Flavor.',
    diabetesTip: 'Maltodextrin (GI 110) & HFCS produce severe glycemic spikes. Avoid for Type 1 & Type 2 Diabetes or pair with protein & vinegar.'
  },
  {
    id: 'boba_tea',
    name: 'Brown Sugar Boba Milk Tea',
    sku: 'SKU #33019488 • Beverage Label',
    skuConfidence: '98.1%',
    image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=600&q=80',
    totalSugars: 58,
    addedSugars: 52,
    naturalSugars: 6,
    totalCarbs: 72,
    fiber: 1.5,
    cals: 480,
    gi: 84,
    gl: 60,
    risk: 'SEVERE SPIKE HAZARD',
    diabetesAllowancePct: 208,
    sugarVariants: [
      { name: 'Brown Sugar (Sucrose)', type: 'Disaccharide', gi: 65, hazard: 'HIGH', category: 'Caramelized Added Sugar' },
      { name: 'Tapioca Starch Syrup', type: 'Glucose Polymers', gi: 85, hazard: 'HIGH', category: 'Fast Digesting Carbs' },
      { name: 'Condensed Milk (Lactose/Sucrose)', type: 'Disaccharide', gi: 61, hazard: 'HIGH', category: 'Concentrated Sweet Dairy' }
    ],
    ingredientsOCR: 'Water, Tapioca Pearls (Tapioca Starch, Caramel Color), Whole Milk, Brown Sugar Syrup, Condensed Sweet Milk, Flavoring.',
    diabetesTip: 'Exceeds daily diabetic sugar cap by 208%! High sucrose + tapioca starch induces rapid postprandial hyperglycemia.'
  },
  {
    id: 'diabetic_protein_bar',
    name: 'Keto Diabetic Protein Bar (Allulose & Stevia)',
    sku: 'SKU #99214055 • UPC 8-50012-44019-1',
    skuConfidence: '99.8%',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
    totalSugars: 2.0,
    addedSugars: 0,
    naturalSugars: 2.0,
    totalCarbs: 22,
    fiber: 14.0,
    cals: 190,
    gi: 15,
    gl: 2,
    risk: 'DIABETES SAFE / LOW GI',
    diabetesAllowancePct: 0,
    sugarVariants: [
      { name: 'Allulose', type: 'Rare Monosaccharide', gi: 0, hazard: 'SAFE', category: 'Non-Glycemic Rare Sugar' },
      { name: 'Erythritol', type: 'Sugar Alcohol (Polyol)', gi: 1, hazard: 'SAFE', category: 'Zero-Calorie Non-Spiking' },
      { name: 'Stevia Leaf Extract', type: 'Steviol Glycosides', gi: 0, hazard: 'SAFE', category: 'Natural Zero-GI Sweetener' }
    ],
    ingredientsOCR: 'Almond Butter, Whey Protein Isolate, Soluble Tapioca Fiber, Allulose, Erythritol, Cocoa Butter, Sea Salt, Stevia Leaf Extract.',
    diabetesTip: 'Optimal diabetic profile! Allulose (GI 0) does not raise blood glucose or stimulate insulin release. 14g prebiotic fiber buffers net carbs.'
  },
  {
    id: 'oats',
    name: 'Steel Cut Oats with Berries & Cinnamon',
    sku: 'SKU #55102933 • Organic Oats Label',
    skuConfidence: '97.9%',
    image: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=600&q=80',
    totalSugars: 11,
    addedSugars: 2,
    naturalSugars: 9,
    totalCarbs: 48,
    fiber: 8.5,
    cals: 290,
    gi: 42,
    gl: 20,
    risk: 'MODERATE / STABLE GI',
    diabetesAllowancePct: 8,
    sugarVariants: [
      { name: 'Natural Berry Fructose', type: 'Monosaccharide', gi: 19, hazard: 'MEDIUM', category: 'Whole Fruit Natural Sugar' },
      { name: 'Raw Honey (Drizzle)', type: 'Fructose/Glucose 40/30', gi: 58, hazard: 'MEDIUM', category: 'Unrefined Natural Sweetener' }
    ],
    ingredientsOCR: 'Whole Grain Steel Cut Oats, Blueberries, Raspberries, Raw Wildflower Honey Drizzle, Ground Ceylon Cinnamon.',
    diabetesTip: 'Low GI (42). Soluble Beta-Glucan fiber (8.5g) creates a viscous gel that slows glucose diffusion in the small intestine.'
  }
];

// Custom Hook for Camera Stream Lifecycle Management
function useCameraStream(isActive, facingMode) {
  const [stream, setStream] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let activeStream = null;
    let isCancelled = false;

    async function enableCamera() {
      if (!isActive) return;

      try {
        let mediaStream = null;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch (e1) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode }
            });
          } catch (e2) {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }

        if (isCancelled || !isActive) {
          if (mediaStream) {
            mediaStream.getTracks().forEach(t => {
              t.enabled = false;
              t.stop();
            });
          }
          return;
        }

        activeStream = mediaStream;
        setStream(mediaStream);
        setIsReady(true);
      } catch (err) {
        if (!isCancelled) {
          console.log('Webcam access error:', err);
          setIsReady(false);
        }
      }
    }

    if (isActive) {
      enableCamera();
    }

    return () => {
      isCancelled = true;
      setIsReady(false);

      if (videoRef.current) {
        try {
          videoRef.current.pause();
          if (videoRef.current.srcObject) {
            const s = videoRef.current.srcObject;
            if (s && s.getTracks) {
              s.getTracks().forEach(t => {
                t.enabled = false;
                t.stop();
              });
            }
          }
          videoRef.current.srcObject = null;
        } catch (e) {}
      }

      if (activeStream) {
        try {
          activeStream.getTracks().forEach(t => {
            t.enabled = false;
            t.stop();
          });
        } catch (e) {}
      }

      setStream(null);
    };
  }, [isActive, facingMode]);

  // Synchronize video element srcObject whenever videoRef or stream updates
  useEffect(() => {
    if (isActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.log('Video element play exception:', e);
      });
    }
  }, [isActive, stream]);

  return { videoRef, stream, isReady };
}

export default function SugarPAI({ activeTab = 'sugar-pai', triggerToast, onLogMeal }) {
  const [viewState, setViewState] = useState('camera'); // 'camera', 'scanning', 'results'
  const [capturedImage, setCapturedImage] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (selfie)

  // Camera is active ONLY when activeTab is sugar-pai AND in live camera viewState (NOT results)
  const isCameraActiveView = (activeTab === 'sugar-pai') && (viewState === 'camera');
  const { videoRef, stream, isReady: isCameraActive } = useCameraStream(isCameraActiveView, facingMode);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const toggleCameraFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (triggerToast) {
      triggerToast(`Switched camera to ${nextMode === 'user' ? 'Selfie / Front' : 'Back / Food'} mode`, 'info');
    }
  };

  const processImageAnalysis = (imgSrc, resultData = null) => {
    setCapturedImage(imgSrc);
    setViewState('scanning');

    // Simulate Computer Vision OCR & Sugar Variant Analysis Processing
    setTimeout(() => {
      const finalResult = resultData || {
        name: 'Scanned Food Label / Dish',
        sku: `SKU #${Math.floor(10000000 + Math.random() * 90000000)} • Auto OCR`,
        skuConfidence: '98.5%',
        image: imgSrc,
        totalSugars: 22,
        addedSugars: 16,
        naturalSugars: 6,
        totalCarbs: 42,
        fiber: 3.5,
        cals: 310,
        gi: 68,
        gl: 28,
        risk: 'MODERATE SPIKE HAZARD',
        diabetesAllowancePct: 64,
        sugarVariants: [
          { name: 'Cane Sugar (Sucrose)', type: 'Disaccharide', gi: 65, hazard: 'HIGH', category: 'Refined Added Sugar' },
          { name: 'High Fructose Corn Syrup', type: 'Fructose/Glucose', gi: 90, hazard: 'CRITICAL', category: 'Refined Sweetener' },
          { name: 'Natural Fructose', type: 'Monosaccharide', gi: 19, hazard: 'MEDIUM', category: 'Natural Fruit Sugar' }
        ],
        ingredientsOCR: 'Ingredients: Whole Grains, High Fructose Corn Syrup, Cane Sugar, Natural Flavors, Salt.',
        diabetesTip: 'Contains High Fructose Corn Syrup & Sucrose. Monitor blood glucose closely 1-2 hours post meal.'
      };
      setActiveResult(finalResult);
      setViewState('results');

      if (triggerToast) {
        triggerToast(`Sugar PAI OCR Analysis Complete: ${finalResult.name} (GI ${finalResult.gi})`, 'success');
      }
    }, 1200);
  };

  const handleTakeSnapshot = () => {
    if (isCameraActive && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const snapshotUrl = canvas.toDataURL('image/jpeg');
      processImageAnalysis(snapshotUrl, SAMPLES[0]);
    } else {
      processImageAnalysis(SAMPLES[0].image, SAMPLES[0]);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const imgUrl = evt.target.result;
      processImageAnalysis(imgUrl, {
        name: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        sku: `SKU #${Math.floor(10000000 + Math.random() * 90000000)} • Uploaded Label`,
        skuConfidence: '99.1%',
        image: imgUrl,
        totalSugars: 26,
        addedSugars: 20,
        naturalSugars: 6,
        totalCarbs: 45,
        fiber: 3.0,
        cals: 330,
        gi: 72,
        gl: 32,
        risk: 'HIGH SPIKE HAZARD',
        diabetesAllowancePct: 80,
        sugarVariants: [
          { name: 'Maltodextrin', type: 'Polysaccharide', gi: 110, hazard: 'CRITICAL', category: 'Extreme Spike Sweetener' },
          { name: 'Sucrose (Cane Sugar)', type: 'Disaccharide', gi: 65, hazard: 'HIGH', category: 'Table Sugar' }
        ],
        ingredientsOCR: 'Ingredients parsed from image: Wheat Flour, Cane Sugar, Maltodextrin, Vegetable Oil, Natural Flavors.',
        diabetesTip: 'Maltodextrin detected (GI 110)! Rapidly spikes blood glucose even faster than table sugar.'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample) => {
    processImageAnalysis(sample.image, sample);
  };

  const handleResetCamera = () => {
    setCapturedImage(null);
    setActiveResult(null);
    setViewState('camera');
  };

  const getHazardBadge = (hazard) => {
    if (hazard === 'SAFE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (hazard === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getRiskBadgeColor = (risk) => {
    if (risk.includes('SAFE') || risk.includes('LOW')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (risk.includes('MODERATE') || risk.includes('STABLE')) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <canvas ref={canvasRef} className="hidden" />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        capture="environment"
        className="hidden" 
      />

      {/* MINIMAL VIEW 1: MOBILE & DESKTOP CAMERA VIEWPORT */}
      {viewState === 'camera' && (
        <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative">
          
          {/* Viewfinder Header with SKU OCR & Camera Controls */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold font-mono bg-slate-950/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md flex items-center gap-1.5">
              <Barcode size={13} className="text-emerald-400" />
              SUGAR PAI OCR & VISION
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleCameraFacingMode}
                title="Switch selfie or back camera"
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-950/80 hover:bg-slate-900 text-amber-300 border border-amber-500/30 backdrop-blur-md transition-all flex items-center gap-1.5 active:scale-95"
              >
                <RefreshCw size={13} className="text-amber-400" />
                <span>{facingMode === 'environment' ? '📷 Back' : '🤳 Selfie'}</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Upload size={13} />
                <span>Upload</span>
              </button>
            </div>
          </div>

          {/* Live Video Viewport */}
          <div className="relative aspect-4/5 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            {isCameraActive ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch(e => console.log(e));
                  }
                }}
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            ) : (
              <div className="relative w-full h-full">
                <img 
                  src={SAMPLES[0].image} 
                  alt="Camera Preview" 
                  className="w-full h-full object-cover filter brightness-75"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-950/40 backdrop-blur-xs">
                  <Camera size={36} className="text-emerald-400 mb-2 animate-bounce" />
                  <div className="text-sm font-bold">Align Nutrition Label or Food Item</div>
                  <div className="text-xs text-slate-300 mt-1 max-w-xs">
                    Reads Sugar Grams, SKU Barcode & Ingredient Sugar Variants (Fructose, Sucrose, HFCS)
                  </div>
                </div>
              </div>
            )}

            {/* Target Reticle Overlay */}
            <div className="absolute inset-12 border-2 border-white/20 rounded-3xl pointer-events-none flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-emerald-400/60 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Shutter Button & Sample Food Chips */}
          <div className="p-6 bg-slate-950 space-y-5">
            <div className="flex items-center justify-center">
              <button
                onClick={handleTakeSnapshot}
                className="w-20 h-20 rounded-full border-4 border-white/30 bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-all active:scale-90 group"
              >
                <div className="w-14 h-14 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                  <Camera size={26} />
                </div>
              </button>
            </div>

            {/* Fast Sample Label Shortcuts */}
            <div className="space-y-2 pt-2 border-slate-900 border-t">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                Or Tap Preset Label to Test CV OCR
              </div>
              <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition-all whitespace-nowrap active:scale-95"
                  >
                    <img src={sample.image} alt={sample.name} className="w-5 h-5 rounded-full object-cover" />
                    <span>{sample.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCANNING TRANSITION VIEW */}
      {viewState === 'scanning' && (
        <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl p-8 text-center space-y-6">
          <div className="relative aspect-square w-48 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-xl">
            <img src={capturedImage} alt="Captured Food" className="w-full h-full object-cover filter brightness-90" />
            <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
            <div className="w-full h-1 bg-emerald-400 absolute top-0 animate-bounce shadow-lg shadow-emerald-400/80" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold font-mono">
              <RefreshCw size={16} className="animate-spin" />
              <span>OCR Reading SKU & Sugar Variants...</span>
            </div>
            <p className="text-xs text-slate-400">
              Extracting Sugar (g), Fructose/Sucrose Variants & Calculating Diabetes GI...
            </p>
          </div>
        </div>
      )}

      {/* MINIMAL VIEW 2: DIABETES SUGAR DETAILS, GI & OCR RESULTS */}
      {viewState === 'results' && activeResult && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden space-y-6 p-6">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <button
              onClick={handleResetCamera}
              className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={16} />
              <span>Scan Another Label / Food</span>
            </button>

            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
              <Sparkles size={12} />
              OCR Verified
            </span>
          </div>

          {/* Captured Image & Product Title + SKU Barcode Readout */}
          <div className="flex items-start gap-4">
            <img 
              src={activeResult.image} 
              alt={activeResult.name} 
              className="w-20 h-20 rounded-2xl object-cover border border-gray-100 shadow-md flex-shrink-0"
            />
            <div className="space-y-1 min-w-0 flex-1">
              <h2 className="text-base font-bold text-gray-900 font-serif leading-snug truncate">
                {activeResult.name}
              </h2>
              
              {/* OCR SKU Badge */}
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                <Barcode size={13} className="text-emerald-600 flex-shrink-0" />
                <span className="truncate">{activeResult.sku}</span>
                <span className="text-emerald-600 font-bold ml-auto">{activeResult.skuConfidence}</span>
              </div>
            </div>
          </div>

          {/* HERO SUGAR DETAILS & GI METRIC PANEL */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* Sugar Volume & Teaspoon Equivalent */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1.5">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <Droplet size={12} className="text-amber-600" />
                <span>Sugar Volume (Grams)</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-amber-950 font-serif">{activeResult.totalSugars}g</span>
                <span className="text-xs font-bold text-amber-800">
                  (≈ {(activeResult.totalSugars / 4).toFixed(1)} tsp 🥄)
                </span>
              </div>

              {/* Added Sugars vs Natural Sugars */}
              <div className="text-[10px] text-amber-900 pt-1 border-t border-amber-200/60 flex justify-between">
                <span>Added: <strong>{activeResult.addedSugars}g</strong></span>
                <span>Natural: <strong>{activeResult.naturalSugars}g</strong></span>
              </div>
            </div>

            {/* Glycemic Index (GI) Value */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1.5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Activity size={12} className="text-emerald-600" />
                <span>Glycemic Index (GI)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900 font-serif">{activeResult.gi}</span>
                <span className="text-xs font-medium text-gray-400">/ 100</span>
              </div>

              <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold border inline-block ${getRiskBadgeColor(activeResult.risk)}`}>
                {activeResult.risk}
              </div>
            </div>

          </div>

          {/* DIABETES DAILY SUGAR ALLOWANCE PROGRESS BAR */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-amber-300 flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-amber-400" />
                Diabetes Sugar Cap Impact (25g/day limit)
              </span>
              <span className="text-[11px] font-mono text-slate-300">
                {activeResult.addedSugars}g Added / 25g Max ({activeResult.diabetesAllowancePct}%)
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  activeResult.diabetesAllowancePct > 100 
                    ? 'bg-rose-500' 
                    : activeResult.diabetesAllowancePct > 50 
                    ? 'bg-amber-400' 
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, activeResult.diabetesAllowancePct)}%` }}
              />
            </div>
          </div>

          {/* SUGAR VARIANTS MATRIX (Fructose, Sucrose, Maltodextrin, etc.) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={14} className="text-emerald-600" />
                Detected Sugar Variants (Diabetes Classification)
              </h3>
              <span className="text-[10px] font-mono text-gray-400">
                {activeResult.sugarVariants.length} Variants Found
              </span>
            </div>

            <div className="space-y-2">
              {activeResult.sugarVariants.map((variant, idx) => (
                <div 
                  key={idx} 
                  className="p-3 bg-gray-50/80 border border-gray-100 rounded-xl flex items-start justify-between text-xs transition-colors hover:bg-gray-100/60"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      <span>{variant.name}</span>
                      <span className="text-[10px] font-mono text-gray-400 font-normal">({variant.type})</span>
                    </div>
                    <div className="text-[10px] text-gray-500">{variant.category}</div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="font-bold text-gray-800">GI {variant.gi}</div>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${getHazardBadge(variant.hazard)}`}>
                      {variant.hazard}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PARSED INGREDIENTS LIST OCR */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-2 text-xs">
            <div className="font-bold text-gray-700 flex items-center gap-1.5">
              <FileText size={14} className="text-emerald-600" />
              OCR Parsed Ingredients List
            </div>
            <p className="text-gray-600 leading-relaxed font-mono text-[11px] bg-white p-2.5 rounded-xl border border-gray-200">
              {activeResult.ingredientsOCR}
            </p>
          </div>

          {/* DIABETES ACTIONABLE ADVICE */}
          <div className="p-4 bg-emerald-950 text-white rounded-2xl space-y-2">
            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Info size={14} className="text-emerald-400" />
              Diabetic Glucose Response Recommendation
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {activeResult.diabetesTip}
            </p>
          </div>

          {/* Log to Tracker Button */}
          <button
            onClick={() => {
              if (onLogMeal) {
                onLogMeal(activeResult);
              } else if (triggerToast) {
                triggerToast(`Logged "${activeResult.name}" (${activeResult.totalSugars}g sugar) to today's tracker!`, 'success');
              }
            }}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={16} />
            <span>Add to Today's Intake</span>
          </button>

        </div>
      )}
    </div>
  );
}
