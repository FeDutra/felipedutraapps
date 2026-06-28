'use client';

import React from 'react';
import { PulsoContextNode } from '../types/pulso.types';
import { BaseProperties as SemioticBaseProperties, semioticGrammarEnabled, getInitialProps as getInitialSemioticProps, SemioticInfluence } from '../semiotic/semioticGrammar';
import { computeSemioticRelations } from '../semiotic/computeSemioticRelations';

// ==================== IndexedDB Image Store ====================
const IDB_DB_NAME = 'pulso-atelie-v2';
const IDB_STORE_IMAGES = 'imagens';
const IDB_STORE_AUDIOS = 'audios';

function openAtelieDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error("IndexedDB is not available on server-side"));
        return;
      }
      const req = window.indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE_IMAGES)) {
          db.createObjectStore(IDB_STORE_IMAGES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IDB_STORE_AUDIOS)) {
          db.createObjectStore(IDB_STORE_AUDIOS, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        console.warn("IndexedDB upgrade blocked. Close other tabs.");
      };
    } catch (err) {
      reject(err);
    }
  });
}

async function openImageDB() { return openAtelieDB(); }

async function saveImageIDB(id: string, dataUrl: string): Promise<void> {
  try {
    const db = await openAtelieDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_IMAGES, 'readwrite');
      tx.objectStore(IDB_STORE_IMAGES).put({ id, dataUrl });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('[IDB] saveImageIDB error:', e); }
}

async function loadImageIDB(id: string): Promise<string | null> {
  try {
    const db = await openAtelieDB();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_IMAGES, 'readonly');
      const req = tx.objectStore(IDB_STORE_IMAGES).get(id);
      req.onsuccess = () => resolve(req.result?.dataUrl ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}

async function deleteImageIDB(id: string): Promise<void> {
  try {
    const db = await openAtelieDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_IMAGES, 'readwrite');
      tx.objectStore(IDB_STORE_IMAGES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('[IDB] deleteImageIDB error:', e); }
}

interface AudioDataRecord {
  id: string;
  name: string;
  dataUrl: string;
  duration: number;
  peaks: number[];
}

async function saveAudioIDB(record: AudioDataRecord): Promise<void> {
  try {
    const db = await openAtelieDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_AUDIOS, 'readwrite');
      tx.objectStore(IDB_STORE_AUDIOS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('[IDB] saveAudioIDB error:', e); }
}

async function loadAudioIDB(id: string): Promise<AudioDataRecord | null> {
  try {
    const db = await openAtelieDB();
    return await new Promise<AudioDataRecord | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_AUDIOS, 'readonly');
      const req = tx.objectStore(IDB_STORE_AUDIOS).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}

function dataURItoArrayBuffer(dataURI: string): ArrayBuffer {
  const byteString = atob(dataURI.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return ab;
}

async function deleteAudioIDB(id: string): Promise<void> {
  try {
    const db = await openAtelieDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_AUDIOS, 'readwrite');
      tx.objectStore(IDB_STORE_AUDIOS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('[IDB] deleteAudioIDB error:', e); }
}

async function processUploadedAudio(file: File): Promise<AudioDataRecord> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        reject(new Error("ArrayBuffer is null"));
        return;
      }
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const tempCtx = new AudioContextClass();
        const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
        
        const rawData = decodedBuffer.getChannelData(0);
        const step = Math.ceil(rawData.length / 60);
        const peaks: number[] = [];
        for (let i = 0; i < 60; i++) {
          let max = 0;
          for (let j = 0; j < step; j++) {
            const val = Math.abs(rawData[i * step + j] || 0);
            if (val > max) max = val;
          }
          peaks.push(max);
        }
        
        const base64Reader = new FileReader();
        base64Reader.onload = () => {
          const dataUrl = base64Reader.result as string;
          resolve({
            id: `aud-${Date.now()}`,
            name: file.name.split('.')[0] || 'áudio',
            dataUrl,
            duration: decodedBuffer.duration,
            peaks
          });
        };
        base64Reader.readAsDataURL(file);
        tempCtx.close();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

interface V2Modulations {
  quente: boolean;
  frio: boolean;
  aspero: boolean;
  liso: boolean;
  denso: boolean;
  etéreo: boolean;
  sagrado: boolean;
  erotico: boolean;
  infantil: boolean;
  translucido: boolean;
  eco: boolean;
  friccao: boolean;
  elevacao: boolean;
  descida: boolean;
  expansao: boolean;
  contracao: boolean;
  colorRed: boolean;
  colorBlue: boolean;
  colorGold: boolean;
  ressonancia: boolean;
  afinidade: boolean;
  contraste: boolean;
  continuidade: boolean;
  atravessamento: boolean;
  jardim: boolean;
  paisagem: boolean;
  ambiencia: boolean;
  joia: boolean;
  objeto: boolean;
  espaco: boolean;
  ritual: boolean;
  criativa: boolean;
  sanguine: boolean;
  choleric: boolean;
  melancholic: boolean;
  phlegmatic: boolean;
}

interface ImageNodeCanvasProps {
  nodeId: string;
  imageDataId?: string;
  imageDataUrl?: string;
  props: SemioticBaseProperties;
  intensity: number;
  label: string;
  influences?: SemioticInfluence[];
}

const ImageNodeCanvas: React.FC<ImageNodeCanvasProps> = ({
  nodeId,
  imageDataId,
  imageDataUrl,
  props,
  intensity,
  label,
  influences = []
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [loadedUrl, setLoadedUrl] = React.useState<string | null>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const [aspectRatio, setAspectRatio] = React.useState(4 / 3);

  // Load from IndexedDB if we only have ID
  React.useEffect(() => {
    if (imageDataUrl) {
      setLoadedUrl(imageDataUrl);
    } else if (imageDataId) {
      loadImageIDB(imageDataId).then(url => {
        if (url) setLoadedUrl(url);
      });
    }
  }, [imageDataId, imageDataUrl]);

  // Load Image Element
  React.useEffect(() => {
    if (!loadedUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = loadedUrl;
    img.onload = () => {
      imageRef.current = img;
      setAspectRatio(img.width / img.height);
    };
  }, [loadedUrl]);

  // Cap the maximum dimension at 160px
  const maxDim = 160;
  const renderW = aspectRatio >= 1 ? maxDim : maxDim * aspectRatio;
  const renderH = aspectRatio >= 1 ? maxDim / aspectRatio : maxDim;

  // Mutable refs for smooth transitions (lerp)
  const currentPropsRef = React.useRef<SemioticBaseProperties | null>(null);
  const currentInfluencesRef = React.useRef<SemioticInfluence[]>([]);

  // Continual requestAnimationFrame loop to smoothly interpolate and render 60fps transitions
  React.useEffect(() => {
    let animFrameId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img) {
        animFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Lerp properties over time
      if (!currentPropsRef.current) {
        currentPropsRef.current = { ...props };
      } else {
        const cur = currentPropsRef.current;
        Object.keys(props).forEach(k => {
          const key = k as keyof SemioticBaseProperties;
          const targetVal = props[key] ?? 0;
          cur[key] = cur[key] + (targetVal - cur[key]) * 0.12;
        });
      }

      // 2. Lerp spatial influences (positions and weights)
      const targetInfs = influences || [];
      const curInfs = currentInfluencesRef.current;

      targetInfs.forEach(tInf => {
        let matched = curInfs.find(c => c.label === tInf.label);
        if (!matched) {
          matched = { ...tInf, dx: 0, dy: 0, dist: 200, weight: 0 };
          curInfs.push(matched);
        }
        matched.dx += (tInf.dx - matched.dx) * 0.12;
        matched.dy += (tInf.dy - matched.dy) * 0.12;
        matched.dist += (tInf.dist - matched.dist) * 0.12;
        matched.weight += (tInf.weight - matched.weight) * 0.12;
      });

      curInfs.forEach(cInf => {
        const stillActive = targetInfs.some(t => t.label === cInf.label);
        if (!stillActive) {
          cInf.weight += (0 - cInf.weight) * 0.12;
        }
      });

      currentInfluencesRef.current = curInfs.filter(c => c.weight > 0.01);

      // --- RENDER SHADERS ---
      ctx.clearRect(0, 0, renderW, renderH);

      const activeProps = currentPropsRef.current;
      const activeInfs = currentInfluencesRef.current;

      const warmth = activeProps.warmth ?? 0.0;
      const coldness = activeProps.coldness ?? 0.0;
      const roughness = activeProps.roughness ?? 0.0;
      const density = activeProps.density ?? 0.0;
      const etereo = activeProps.etéreo ?? 0.0;
      const transparency = activeProps.transparency ?? 0.0;
      const joy = activeProps.joy ?? 0.0;
      const sadness = activeProps.sadness ?? 0.0;
      const anger = activeProps.anger ?? 0.0;
      const fear = activeProps.fear ?? 0.0;
      const ecoVal = Math.max(activeProps.eco ?? 0.0, activeProps.ghostTrails ?? 0.0);
      const crossing = activeProps.atravessamento ?? 0.0;
      const friction = activeProps.friction ?? 0.0;
      const ritualVal = activeProps.ritual ?? 0.0;
      const colorRed = activeProps.colorRed ?? 0.0;
      const colorBlue = activeProps.colorBlue ?? 0.0;
      const colorGold = activeProps.colorGold ?? 0.0;

      const amp = intensity;

      let shakeX = 0;
      let shakeY = 0;
      if (fear > 0.1) {
        shakeX = (Math.random() - 0.5) * fear * 8 * amp;
        shakeY = (Math.random() - 0.5) * fear * 8 * amp;
      }

      const blurAmount = (etereo + transparency + sadness * 0.4) * 8 * amp;
      if (blurAmount > 0.5) {
        ctx.filter = `blur(${blurAmount}px)`;
      } else {
        ctx.filter = 'none';
      }

      const baseOpacity = 1.0 - Math.min(0.9, (transparency * 0.8 + etereo * 0.5) * amp);
      ctx.globalAlpha = baseOpacity;

      const drawImg = (ox = 0, oy = 0) => {
        ctx.drawImage(img, ox + shakeX, oy + shakeY, renderW, renderH);
      };

      if (ecoVal > 0.1) {
        ctx.globalAlpha = baseOpacity * 0.3;
        drawImg(-12 * amp, -4 * amp);
        drawImg(12 * amp, 4 * amp);
        ctx.globalAlpha = baseOpacity;
      }

      drawImg();

      ctx.filter = 'none';
      ctx.globalAlpha = 1.0;

      if (warmth > 0.1 || coldness > 0.1 || colorRed > 0.1 || colorBlue > 0.1 || colorGold > 0.1) {
        ctx.globalCompositeOperation = 'color';
        let r = 0, g = 0, b = 0, wVal = 0;
        if (colorRed > 0.1 || warmth > 0.1) {
          r = 239; g = 68; b = 68; wVal = Math.min(0.7, (colorRed * 0.8 + warmth * 0.5) * amp);
        } else if (colorBlue > 0.1 || coldness > 0.1) {
          r = 59; g = 130; b = 246; wVal = Math.min(0.7, (colorBlue * 0.8 + coldness * 0.5) * amp);
        } else if (colorGold > 0.1) {
          r = 251; g = 191; b = 36; wVal = Math.min(0.7, colorGold * 0.7 * amp);
        }
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${wVal})`;
        ctx.fillRect(0, 0, renderW, renderH);
        ctx.globalCompositeOperation = 'source-over';
      }

      const campoVal = (etereo + transparency) * amp;
      if (campoVal > 0.1) {
        ctx.globalCompositeOperation = 'destination-in';
        const cx = renderW / 2;
        const cy = renderH / 2;
        const innerR = Math.max(5, (renderW / 2) * (1.0 - campoVal * 0.6));
        const outerR = renderW / 2;
        const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, renderW, renderH);
        ctx.globalCompositeOperation = 'source-over';
      }

      const imgData = ctx.getImageData(0, 0, renderW, renderH);
      const data = imgData.data;
      const temp = new Uint8ClampedArray(data);

      const getNoise2D = (nx: number, ny: number) => {
        const s = Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453;
        return s - Math.floor(s);
      };

      const grayData = new Uint8ClampedArray(renderW * renderH);
      for (let i = 0; i < data.length; i += 4) {
        grayData[i / 4] = Math.round(0.299 * temp[i] + 0.587 * temp[i + 1] + 0.114 * temp[i + 2]);
      }

      const getPixelGray = (px: number, py: number) => {
        const cx = Math.max(0, Math.min(renderW - 1, px));
        const cy = Math.max(0, Math.min(renderH - 1, py));
        return grayData[cy * renderW + cx];
      };

      const getSobelMag = (px: number, py: number) => {
        const gx = 
          -1 * getPixelGray(px - 1, py - 1) + 1 * getPixelGray(px + 1, py - 1) +
          -2 * getPixelGray(px - 1, py)     + 2 * getPixelGray(px + 1, py) +
          -1 * getPixelGray(px - 1, py + 1) + 1 * getPixelGray(px + 1, py + 1);
        const gy = 
          -1 * getPixelGray(px - 1, py - 1) - 2 * getPixelGray(px, py - 1) - 1 * getPixelGray(px + 1, py - 1) +
           1 * getPixelGray(px - 1, py + 1) + 2 * getPixelGray(px, py + 1) + 1 * getPixelGray(px + 1, py + 1);
        return Math.sqrt(gx * gx + gy * gy);
      };

      const mappedInfluences = activeInfs.map(inf => {
        const projX = renderW / 2 + (inf.dx / 200) * (renderW / 2);
        const projY = renderH / 2 + (inf.dy / 200) * (renderH / 2);
        return { ...inf, projX, projY };
      });

      for (let y = 0; y < renderH; y++) {
        for (let x = 0; x < renderW; x++) {
          let pWarmth = 0;
          let pColdness = 0;
          let pRoughness = 0;
          let pJoy = 0;
          let pSadness = 0;
          let pAnger = 0;
          let pFear = 0;
          let pEtereo = 0;
          let pTransparency = 0;
          let pWater = 0;
          let pFire = 0;
          let pMetal = 0;

          mappedInfluences.forEach(inf => {
            const dx = x - inf.projX;
            const dy = y - inf.projY;
            const dist = Math.hypot(dx, dy);
            const localWeight = Math.max(0, 1.0 - dist / 50) * inf.weight;
            if (localWeight > 0) {
              if (inf.label === 'fogo' || inf.label === 'colérico' || inf.label === 'fúria') pFire += localWeight;
              if (inf.label === 'água' || inf.label === 'tristeza' || inf.label === 'melancolia') pWater += localWeight;
              if (inf.label === 'metal' || inf.label === 'bruto') pMetal += localWeight;
              if (inf.label === 'frio' || inf.label === 'azul') pColdness += localWeight;
              if (inf.label === 'quente' || inf.label === 'vermelho') pWarmth += localWeight;
              if (inf.label === 'áspera' || inf.label === 'poeira' || inf.label === 'áspero') pRoughness += localWeight;
              if (inf.label === 'etéreo' || inf.label === 'névoa') pEtereo += localWeight;
              if (inf.label === 'translúcido' || inf.label === 'vazio') pTransparency += localWeight;
            }
          });

          pFire = Math.max(pFire, (activeProps.chromaticAberration ?? 0.0) * amp);
          pWater = Math.max(pWater, (activeProps.liquidWarp ?? 0.0) * amp);
          pMetal = Math.max(pMetal, (activeProps.friction ?? 0.0) * amp);
          pColdness = Math.max(pColdness, coldness * amp);
          pWarmth = Math.max(pWarmth, warmth * amp);
          pRoughness = Math.max(pRoughness, roughness * amp);
          pEtereo = Math.max(pEtereo, etereo * amp);
          pTransparency = Math.max(pTransparency, transparency * amp);
          pJoy = Math.max(pJoy, joy * amp);
          pSadness = Math.max(pSadness, sadness * amp);
          pFear = Math.max(pFear, fear * amp);

          let shiftX = 0;
          let shiftY = 0;
          if (pWater > 0.05) {
            const nVal = getNoise2D(x * 0.05, y * 0.05 + Date.now() * 0.001);
            shiftX += Math.round((nVal - 0.5) * pWater * 12);
          }
          if (pFire > 0.05) {
            const nVal = getNoise2D(x * 0.08 + Date.now() * 0.002, y * 0.08);
            shiftY += Math.round((nVal - 0.5) * pFire * 15);
          }

          // Shaders: Point Cloud Dispersion / Particle disintegration
          if (pEtereo > 0.15) {
            const dispAmount = pEtereo * 8 * amp;
            const px = Math.round(x + (Math.random() - 0.5) * dispAmount);
            const py = Math.round(y + (Math.random() - 0.5) * dispAmount);
            const srcX = Math.max(0, Math.min(renderW - 1, px));
            const srcY = Math.max(0, Math.min(renderH - 1, py));
            const srcIdx = (srcY * renderW + srcX) * 4;
            let r_d = temp[srcIdx];
            let g_d = temp[srcIdx+1];
            let b_d = temp[srcIdx+2];
            let a_d = temp[srcIdx+3] * (1.0 - pEtereo * 0.4);
            temp[srcIdx] = r_d;
            temp[srcIdx+1] = g_d;
            temp[srcIdx+2] = b_d;
            temp[srcIdx+3] = a_d;
          }

          const srcX = Math.max(0, Math.min(renderW - 1, x + shiftX));
          const srcY = Math.max(0, Math.min(renderH - 1, y + shiftY));
          const srcIdx = (srcY * renderW + srcX) * 4;
          const targetIdx = (y * renderW + x) * 4;

          let r = temp[srcIdx];
          let g = temp[srcIdx + 1];
          let b = temp[srcIdx + 2];
          let a = temp[srcIdx + 3];

          if (pFire > 0.05) {
            const offset = Math.round(pFire * 5);
            const redX = Math.max(0, Math.min(renderW - 1, srcX - offset));
            const blueX = Math.max(0, Math.min(renderW - 1, srcX + offset));
            r = temp[(srcY * renderW + redX) * 4];
            b = temp[(srcY * renderW + blueX) * 4];
          }

          // Sobel outline contour high-contrast highlights
          if (pMetal > 0.15) {
            const mag = getSobelMag(srcX, srcY);
            if (mag > 45) {
              const edgeVal = Math.min(255, mag * 2.2);
              r = r * (1.0 - pMetal * 0.7) + edgeVal * pMetal * 0.7;
              g = g * (1.0 - pMetal * 0.7) + edgeVal * pMetal * 0.7;
              b = b * (1.0 - pMetal * 0.7) + edgeVal * pMetal * 0.7;
            }
          }

          // Shaders: Scanline and VHS horizontal dark bars and static grain
          if (pFear > 0.15) {
            if (y % 4 === 0) {
              r = Math.max(0, r - pFear * 70);
              g = Math.max(0, g - pFear * 70);
              b = Math.max(0, b - pFear * 70);
            }
            const noise = (Math.random() - 0.5) * pFear * 65;
            r = Math.max(0, Math.min(255, r + noise));
            g = Math.max(0, Math.min(255, g + noise));
            b = Math.max(0, Math.min(255, b + noise));
          }

          if (pRoughness > 0.1) {
            const bayer = [
              [  0, 48, 12, 60 ],
              [ 32, 16, 44, 28 ],
              [  8, 56,  4, 52 ],
              [ 40, 24, 36, 20 ]
            ];
            const bx = x % 4;
            const by = y % 4;
            const bThresh = (bayer[by][bx] + 0.5) / 64 * 255;
            const grayVal = 0.299 * r + 0.587 * g + 0.114 * b;
            const ditherVal = grayVal > bThresh ? 255 : 0;
            r = r * (1.0 - pRoughness) + ditherVal * pRoughness;
            g = g * (1.0 - pRoughness) + ditherVal * pRoughness;
            b = b * (1.0 - pRoughness) + ditherVal * pRoughness;
          }

          if (pJoy > 0.1) {
            r = Math.min(255, Math.max(0, (r - 128) * (1.0 + pJoy * 0.6) + 128 + pJoy * 30));
            g = Math.min(255, Math.max(0, (g - 128) * (1.0 + pJoy * 0.6) + 128 + pJoy * 30));
            b = Math.min(255, Math.max(0, (b - 128) * (1.0 + pJoy * 0.6) + 128 + pJoy * 30));
          }
          if (pSadness > 0.1) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = Math.max(0, (r * (1.0 - pSadness) + gray * pSadness) - pSadness * 40);
            g = Math.max(0, (g * (1.0 - pSadness) + gray * pSadness) - pSadness * 40);
            b = Math.max(0, (b * (1.0 - pSadness) + gray * pSadness) - pSadness * 40);
          }

          if (pWarmth > 0.1) {
            r = r * (1.0 - pWarmth * 0.45) + 239 * pWarmth * 0.45;
            g = g * (1.0 - pWarmth * 0.45) + 68 * pWarmth * 0.2;
          }
          if (pColdness > 0.1) {
            r = r * (1.0 - pColdness * 0.45) + 59 * pColdness * 0.2;
            b = b * (1.0 - pColdness * 0.45) + 246 * pColdness * 0.45;
          }

          if (pTransparency > 0.1) {
            a = a * (1.0 - pTransparency * 0.7);
          }

          data[targetIdx] = r;
          data[targetIdx + 1] = g;
          data[targetIdx + 2] = b;
          data[targetIdx + 3] = a;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Shaders: Monospace character ASCII grid rendering overlay
      const asciiAmt = Math.max(activeProps.density ?? 0.0, activeProps.roughness ?? 0.0) * amp;
      if (asciiAmt > 0.65) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(0, 0, renderW, renderH);

        ctx.fillStyle = `rgba(251, 249, 245, ${asciiAmt * 0.95})`;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const gridSize = 6;
        const chars = '@#*+-. ';
        for (let gy = gridSize/2; gy < renderH; gy += gridSize) {
          for (let gx = gridSize/2; gx < renderW; gx += gridSize) {
            const pIdx = (Math.round(gy) * renderW + Math.round(gx)) * 4;
            if (pIdx < data.length) {
              const br = (data[pIdx] + data[pIdx+1] + data[pIdx+2]) / 3;
              const charIdx = Math.min(chars.length - 1, Math.floor((1.0 - br / 255) * chars.length));
              ctx.fillText(chars[charIdx], gx, gy);
            }
          }
        }
      }

      // Apply Ritual overlays (geometric ritual diagrams)
      const ritualShapesVal = Math.max(activeProps.ritual ?? 0.0, activeProps.ritualShapes ?? 0.0) * amp;
      if (ritualShapesVal > 0.1) {
        ctx.strokeStyle = `rgba(251, 249, 245, ${0.15 * ritualShapesVal})`;
        ctx.lineWidth = 0.75 + ritualShapesVal * 0.75;

        ctx.strokeRect(4, 4, renderW - 8, renderH - 8);

        const maxRadius = Math.min(renderW, renderH) / 3;
        ctx.beginPath();
        ctx.arc(renderW/2, renderH/2, maxRadius, 0, Math.PI*2);
        ctx.stroke();

        if (ritualShapesVal > 0.4) {
          ctx.beginPath();
          ctx.arc(renderW/2, renderH/2, maxRadius * 0.6, 0, Math.PI*2);
          ctx.stroke();
        }

        if (ritualShapesVal > 0.7) {
          ctx.beginPath();
          ctx.arc(renderW/2, renderH/2, maxRadius * 0.3, 0, Math.PI*2);
          ctx.stroke();
        }

        // Rotating axes/lines
        const angle = (Date.now() / 3000) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(renderW/2 - Math.cos(angle) * maxRadius, renderH/2 - Math.sin(angle) * maxRadius);
        ctx.lineTo(renderW/2 + Math.cos(angle) * maxRadius, renderH/2 + Math.sin(angle) * maxRadius);
        ctx.moveTo(renderW/2 - Math.cos(angle + Math.PI/2) * maxRadius, renderH/2 - Math.sin(angle + Math.PI/2) * maxRadius);
        ctx.lineTo(renderW/2 + Math.cos(angle + Math.PI/2) * maxRadius, renderH/2 + Math.sin(angle + Math.PI/2) * maxRadius);
        ctx.stroke();
      }

      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animFrameId);
  }, [props, influences, renderW, renderH, loadedUrl]);

  // Apply density visual scaling compression (nodes get smaller/compressed if density is high)
  const densityScale = props.density > 0.3 ? 1.0 - Math.min(0.35, 0.25 * intensity) : 1.0;

  return (
    <div 
      className="flex flex-col items-center gap-1 select-none pointer-events-none transition-transform duration-300"
      style={{ transform: `scale(${densityScale})`, width: '170px' }}
    >
      <div 
        style={{ width: `${renderW}px`, height: `${renderH}px` }}
        className="rounded border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center"
      >
        {loadedUrl ? (
          <canvas 
            ref={canvasRef} 
            width={renderW} 
            height={renderH} 
            style={{ width: `${renderW}px`, height: `${renderH}px` }}
            className="object-contain"
          />
        ) : (
          <div className="text-[7px] font-mono text-[#fbf9f5]/20 animate-pulse uppercase tracking-wider">carregando...</div>
        )}
      </div>
      <span className="text-[7.5px] font-mono text-[#fbf9f5]/40 lowercase tracking-wider truncate max-w-[150px]">{label}</span>
    </div>
  );
};

// Audio engine for V2 relational syntheses using native Web Audio API
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 3.8;

  // Active looping synth voices mapped by node ID
  // polyOscPairs: array of [oscA, oscB | null] — one pair per pressed note (polyphony)
  public voices: Map<string, {
    polyOscPairs: Array<[OscillatorNode, OscillatorNode | null]>;
    noiseSource: AudioBufferSourceNode | null;
    audioSource: AudioBufferSourceNode | null;
    audioBuffer: AudioBuffer | null;
    gainNode: GainNode;
    panNode: StereoPannerNode | null;
    filterNode: BiquadFilterNode;
    delayNode: DelayNode;
    delayGainNode: GainNode;
    waveShaperNode: WaveShaperNode;
    type: string;
    baseOscType: OscillatorType;
    baseOscType2: OscillatorType | null;
    baseDetune: number;
  }> = new Map();

  private noiseBuffer: AudioBuffer | null = null;
  private globalPitchMultipliers: number[] = [1.0];

  constructor() {}

  setGlobalPitchMultipliers(multipliers: number[]) {
    this.globalPitchMultipliers = multipliers.length > 0 ? multipliers : [1.0];
  }

  getAudioContext(): AudioContext | null {
    this.init();
    return this.ctx;
  }

  setMasterVolume(vol: number) {
    this.masterVolume = vol;
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }
  }

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime); // Richer global gain
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Falha ao inicializar AudioContext V2:', e);
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getNoiseBuffer(): AudioBuffer | null {
    this.init();
    if (!this.ctx) return null;
    if (!this.noiseBuffer) {
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.noiseBuffer;
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Acoustic grain click trigger (vinyl crackles) for roughness
  private playCrackle(gain: GainNode, volume: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      osc.connect(clickGain);
      clickGain.connect(gain);

      // High-pitched click/pop (vinyl style)
      osc.frequency.setValueAtTime(2500 + Math.random() * 4000, now);
      osc.type = 'triangle';

      clickGain.gain.setValueAtTime(0, now);
      clickGain.gain.linearRampToValueAtTime(volume * 0.14, now + 0.001);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.005 + Math.random() * 0.012);

      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) {}
  }

  // Synchronizes voices to the active `som` nodes in canvas
  updateActiveVoices(
    somNodes: Array<{ 
      id: string; 
      label: string; 
      x: number; 
      y: number; 
      intensity?: number;
      cropStart?: number;
      cropEnd?: number;
      playhead?: number;
      isLooping?: boolean;
      playbackSeekTrigger?: number;
    }>,
    activeModulations: Map<string, any>,
    audioBuffers?: Map<string, AudioBuffer>
  ) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) {
      this.clearAllVoices();
      return;
    }

    const now = this.ctx.currentTime;
    const activeIds = new Set(somNodes.map(n => n.id));

    // Cleanup stopped voices
    for (const [id, voice] of this.voices.entries()) {
      if (!activeIds.has(id)) {
        this.stopVoice(id);
      }
    }

    // Create or update voices
    somNodes.forEach(node => {
      let voice = this.voices.get(node.id);
      const buffer = audioBuffers?.get(node.id) || null;
      const lastSeekTrigger = (voice as any)?.playbackSeekTrigger;

      const mustRecreate = voice && (
        (buffer && !voice.audioBuffer) ||
        (node.playbackSeekTrigger !== undefined && node.playbackSeekTrigger !== lastSeekTrigger)
      );

      if (mustRecreate) {
        this.stopVoice(node.id);
        this.voices.delete(node.id);
        voice = undefined;
      }
      if (!voice) {
        voice = this.createVoice(
          node.id, 
          node.label, 
          buffer, 
          node.cropStart, 
          node.cropEnd, 
          node.playhead, 
          node.isLooping
        );
        if (!voice) return;
        (voice as any).playbackSeekTrigger = node.playbackSeekTrigger;
      }

      // Modulator active states for this node
      const mods = activeModulations.get(node.id) || getInitialSemioticProps();
      const nodeIntensity = node.intensity ?? 1.0;

      let pitchFreq = 220;
      let filterCutoff = 450;
      let filterQ = 1.0;
      let volume = 0.55; // Louder default volume for individual nodes
      let delayFeedback = 0.15;
      let delayTime = 0.35;
      let distortionAmount = 0;
      const canvasWidth = 1200;
      const normalizedX = (node.x / canvasWidth) * 2 - 1; // -1 to 1
      let pan = Math.max(-1.0, Math.min(1.0, normalizedX + (mods.spatiality ?? 0.0)));

      // Semiotic Grammar Phase 1 parameters
      let attackTime = 0.2;
      if (mods.attack) {
        attackTime = 0.2 + Math.min(2.0, mods.attack * 0.8);
      }
      if (mods.resonance) {
        filterQ = Math.max(0.1, filterQ + mods.resonance);
      }
      if (mods.delayFeedback) {
        delayFeedback = Math.min(0.95, delayFeedback + mods.delayFeedback);
      }
      if (mods.delayTime) {
        delayTime = Math.min(2.0, delayTime + mods.delayTime);
      }

      // Base Voice Configurations
      if (node.label === 'sopro') {
        pitchFreq = 196; // G3
        filterCutoff = 350;
        volume = 0.45;
      } else if (node.label === 'grave seco') {
        pitchFreq = 65.41; // C2
        filterCutoff = 130;
        volume = 0.75;
      } else if (node.label === 'ruído fino') {
        pitchFreq = 600;
        filterCutoff = 2800;
        volume = 0.35;
      } else if (node.label === 'ressonância curta') {
        const pulse = Math.sin(now * 3.5) * 0.5 + 0.5;
        pitchFreq = 329.63; // E4
        filterCutoff = 600 + pulse * 1400;
        filterQ = 9.0;
        volume = 0.5 * pulse;
      } else if (node.label === 'pulso') {
        const beat = (Math.floor(now * 2.5) % 2 === 0) ? 1.0 : 0.05;
        pitchFreq = 110; // A2
        filterCutoff = 190;
        volume = 0.65 * beat;
      } else if (node.label === 'silêncio ativo') {
        pitchFreq = 40;
        filterCutoff = 70;
        volume = 0.15;
      }

      // 1. ATRIBUTOS (conceptual state impacts)
      if (mods.quente) {
        pitchFreq *= 0.85; // Heat expands and lowers pitch slightly
        filterCutoff *= 1.8; // Cutoff opens, warmer higher harmonics
        volume *= 1.35;
      }
      if (mods.frio) {
        pitchFreq *= 1.4; // Cold contracts, higher frequency tension
        filterCutoff *= 0.6; // Darker filter range
        volume *= 0.75;
      }
      if (mods.denso) {
        pitchFreq *= 0.5; // Thicker low octaves
        volume *= 1.5;
      }
      if (mods.etéreo) {
        filterCutoff = Math.max(900, filterCutoff + 400);
        delayFeedback = Math.max(delayFeedback, 0.55);
        volume *= 0.8;
      }
      if (mods.aspero || mods.roughness) {
        const rough = Math.max(mods.aspero ? 0.6 : 0, mods.roughness ?? 0);
        distortionAmount = Math.max(distortionAmount, Math.min(250, rough * 180));
        filterQ += rough * 4.0;
        volume *= (1 + rough * 0.25);
        if (rough > 0.15 && Math.random() < rough * 0.18) {
          this.playCrackle(voice.gainNode, rough);
        }
      }
      if (mods.translúcido) {
        filterQ = Math.max(filterQ, 12); // High resonance peak
        volume *= 0.65;
      }
      if (mods.infantil) {
        pitchFreq += Math.sin(now * 15) * 18;
        filterCutoff *= 1.4;
      }
      if (mods.sagrado) {
        delayFeedback = Math.min(0.95, delayFeedback + 0.6);
        delayTime = Math.min(1.8, delayTime + 0.55);
        volume *= 1.3;
      }
      if (mods.erotico) {
        volume *= (1 + Math.sin(now * 3.5) * 0.25);
        filterCutoff *= 0.75;
      }

      // 2. CORES (synesthetic emotional contaminations)
      if (mods.colorRed) {
        filterCutoff *= 1.5;
        volume *= 1.3;
        distortionAmount = Math.max(distortionAmount, 10);
      }
      if (mods.colorBlue) {
        filterCutoff *= 0.7;
        volume *= 0.8;
        delayFeedback = Math.max(delayFeedback, 0.45);
      }
      if (mods.colorGold) {
        pitchFreq *= 1.5;
        filterQ = Math.max(filterQ, 5.0);
        volume *= 1.2;
      }

      // 3. FORÇAS (tensions & movement)
      if (mods.elevacao) {
        pitchFreq *= 1.6; // Slide/elevate frequency
      }
      if (mods.descida) {
        pitchFreq *= 0.6; // Descend frequency
      }
      if (mods.expansao) {
        volume *= 1.4;
        delayFeedback = Math.max(delayFeedback, 0.4);
      }
      if (mods.contracao) {
        volume *= 0.4;
      }

      // 4. RELAÇÕES (acoustic inter-connections)
      if (mods.eco) {
        delayFeedback = Math.max(delayFeedback, 0.7);
        delayTime = Math.min(1.5, delayTime + 0.45);
      }
      if (mods.friccao) {
        pitchFreq += Math.sin(now * 25) * 12; // Vibrato jitter modulation
        distortionAmount = Math.max(distortionAmount, 25);
      }
      if (mods.ressonancia) {
        filterQ = Math.max(filterQ, 15.0);
        pitchFreq *= 1.05;
      }
      if (mods.afinidade) {
        pitchFreq *= 1.5;
      }
      if (mods.contraste) {
        pitchFreq *= 1.05;
      }
      if (mods.continuidade) {
        delayFeedback = Math.min(0.92, delayFeedback + 0.4);
        volume *= 1.2;
      }
      if (mods.atravessamento) {
        distortionAmount = Math.max(distortionAmount, 120);
      }

      // 5. ENCARNAÇÕES
      if (mods.jardim) {
        pitchFreq *= 1.9;
        filterCutoff = Math.max(filterCutoff, 2500);
      }
      if (mods.paisagem) {
        delayTime = Math.min(1.2, delayTime + 0.5);
      }
      if (mods.ambiencia) {
        delayFeedback = Math.min(0.9, delayFeedback + 0.5);
        volume *= 1.25;
      }
      if (mods.joia) {
        filterQ = Math.max(filterQ, 20.0);
        filterCutoff = Math.max(filterCutoff, 3000);
      }
      if (mods.objeto) {
        delayFeedback = Math.max(0, delayFeedback - 0.5);
      }
      if (mods.espaco) {
        delayTime = Math.min(1.9, delayTime + 0.85);
      }
      if (mods.ritual) {
        pitchFreq *= 0.8;
        filterCutoff = Math.max(60, filterCutoff * 0.6);
      }
      if (mods.criativa) {
        filterCutoff += Math.sin(now * 1.5) * 250;
      }

      // 6. TEMPERAMENTOS
      if (mods.sanguine) {
        filterCutoff = Math.max(filterCutoff, 800);
        pitchFreq += Math.sin(now * 6) * 8;
        volume *= 1.2;
      }
      if (mods.choleric) {
        distortionAmount = Math.max(distortionAmount, 100);
        volume *= 1.35;
      }
      if (mods.melancholic) {
        pitchFreq *= 0.65;
        delayFeedback = Math.min(0.88, delayFeedback + 0.5);
      }
      if (mods.phlegmatic) {
        distortionAmount *= 0.1;
        delayFeedback *= 0.1;
        volume *= 0.8;
      }

      const targetCount = this.globalPitchMultipliers.length;

      // --- Polyphony/Audio Source playback update ---
      if (voice.audioSource) {
        const jitterRate = (mods.jitter ?? 0.0) * 35; // 0 to 35Hz
        const jitterVal = jitterRate > 0 ? Math.sin(now * jitterRate) * (mods.jitter ?? 0.0) * 15 : 0;
        const pitchMultiplier = (pitchFreq + jitterVal) / 220; // 220 is standard A3 base
        if (isFinite(pitchMultiplier)) {
          voice.audioSource.playbackRate.setTargetAtTime(Math.max(0.05, Math.min(4.0, pitchMultiplier)), now, 0.08);
        }
      } else {
        // --- Polyphony: sync oscillator pairs to active pitch multipliers ---
        const currentCount = voice.polyOscPairs.length;

        // Add new oscillator pairs for extra notes
        for (let pi = currentCount; pi < targetCount; pi++) {
          if (!this.ctx) break;
          try {
            const oscA = this.ctx.createOscillator();
            oscA.type = voice.baseOscType;
            const freq = pitchFreq * this.globalPitchMultipliers[pi];
            oscA.frequency.setValueAtTime(isFinite(freq) ? freq : pitchFreq, now);
            oscA.connect(voice.waveShaperNode);
            oscA.start(now);

            let oscB: OscillatorNode | null = null;
            if (voice.baseOscType2) {
              oscB = this.ctx.createOscillator();
              oscB.type = voice.baseOscType2;
              oscB.frequency.setValueAtTime(isFinite(freq) ? freq * voice.baseDetune : pitchFreq, now);
              oscB.connect(voice.waveShaperNode);
              oscB.start(now);
            }
            voice.polyOscPairs.push([oscA, oscB]);
          } catch (e) {}
        }

        // Remove oscillator pairs for released notes
        while (voice.polyOscPairs.length > targetCount) {
          const [oscA, oscB] = voice.polyOscPairs.pop()!;
          try {
            oscA.stop(now + 0.05);
            setTimeout(() => { try { oscA.disconnect(); } catch(e){} }, 100);
            if (oscB) {
              oscB.stop(now + 0.05);
              setTimeout(() => { try { oscB.disconnect(); } catch(e){} }, 100);
            }
          } catch (e) {}
        }

        // Update frequencies for all existing pairs
        const detuneCents = (mods.detune ?? 0.0) * nodeIntensity;
        const jitterRate = (mods.jitter ?? 0.0) * 35; // 0 to 35Hz
        const jitterVal = jitterRate > 0 ? Math.sin(now * jitterRate) * (mods.jitter ?? 0.0) * 15 : 0;
        voice.polyOscPairs.forEach(([oscA, oscB], pi) => {
          const freq = (pitchFreq + jitterVal) * (this.globalPitchMultipliers[pi] ?? 1.0);
          if (isFinite(freq)) {
            oscA.frequency.setTargetAtTime(freq, now, 0.05);
            if (oscA.detune) {
              oscA.detune.setTargetAtTime(detuneCents, now, 0.1);
            }
            if (oscB) {
              oscB.frequency.setTargetAtTime(freq * voice.baseDetune, now, 0.05);
              if (oscB.detune) {
                oscB.detune.setTargetAtTime(-detuneCents, now, 0.1);
              }
            }
          }
        });
      }

      if (voice.filterNode) {
        voice.filterNode.frequency.setTargetAtTime(filterCutoff, now, 0.2);
        voice.filterNode.Q.setTargetAtTime(filterQ, now, 0.15);
      }
      if (voice.delayNode && isFinite(delayTime)) {
        voice.delayNode.delayTime.setTargetAtTime(Math.max(0.01, Math.min(2.0, delayTime)), now, 0.5);
      }
      if (voice.delayGainNode) {
        voice.delayGainNode.gain.setTargetAtTime(delayFeedback, now, 0.25);
      }
      if (voice.gainNode) {
        const polyScale = Math.max(0.4, 1.0 / Math.sqrt(targetCount));
        voice.gainNode.gain.setTargetAtTime(volume * 2.5 * nodeIntensity * polyScale, now, attackTime);
      }
      if (voice.waveShaperNode && distortionAmount > 0) {
        voice.waveShaperNode.curve = this.makeDistortionCurve(distortionAmount) as any;
      } else if (voice.waveShaperNode) {
        voice.waveShaperNode.curve = null;
      }
      if (voice.panNode && voice.panNode.pan && isFinite(pan)) {
        voice.panNode.pan.setTargetAtTime(pan, now, 0.25);
      }
    });
  }

  private createVoice(
    id: string, 
    label: string, 
    audioBuffer?: AudioBuffer | null,
    cropStart?: number,
    cropEnd?: number,
    playhead?: number,
    isLooping?: boolean
  ) {
    this.init();
    if (!this.ctx || !this.masterGain) return undefined;

    const now = this.ctx.currentTime;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);

    const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    const filterNode = this.ctx.createBiquadFilter();
    filterNode.type = 'lowpass';

    const waveShaperNode = this.ctx.createWaveShaper();

    const delayNode = this.ctx.createDelay(1.5);
    const delayGainNode = this.ctx.createGain();
    delayNode.delayTime.setValueAtTime(0.45, now);
    delayGainNode.gain.setValueAtTime(0, now);

    // Default oscillator type configuration for polyphony
    let baseOscType: OscillatorType = 'sine';
    let baseOscType2: OscillatorType | null = null;
    let baseDetune = 1.006;
    let noiseSource: AudioBufferSourceNode | null = null;
    let audioSource: AudioBufferSourceNode | null = null;

    if (audioBuffer) {
      audioSource = this.ctx.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.loop = isLooping !== false;
      if (cropStart !== undefined) audioSource.loopStart = cropStart;
      if (cropEnd !== undefined) audioSource.loopEnd = cropEnd;
    } else if (label === 'sopro') {
      baseOscType = 'sine';
      const buffer = this.getNoiseBuffer();
      if (buffer) {
        noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;
      }
    } else if (label === 'grave seco') {
      baseOscType = 'triangle';
      baseOscType2 = 'sine';
      baseDetune = 1.009;
    } else if (label === 'ruído fino') {
      const buffer = this.getNoiseBuffer();
      if (buffer) {
        noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;
      }
    } else if (label === 'ressonância curta') {
      baseOscType = 'sine';
      baseOscType2 = 'sine';
      baseDetune = 1.5; // perfect fifth
    } else if (label === 'pulso') {
      baseOscType = 'square';
    } else {
      baseOscType = 'sine';
    }

    // Connect shared routing (oscillators created dynamically via updateActiveVoices)
    if (audioSource) audioSource.connect(waveShaperNode);
    if (noiseSource) noiseSource.connect(waveShaperNode);

    waveShaperNode.connect(filterNode);
    
    let filterDest: AudioNode = filterNode;
    if (panNode) {
      filterNode.connect(panNode);
      filterDest = panNode;
    }
    filterDest.connect(gainNode);

    // Feedback Delay Loop
    filterNode.connect(delayNode);
    delayNode.connect(delayGainNode);
    delayGainNode.connect(gainNode);
    delayGainNode.connect(delayNode);

    gainNode.connect(this.masterGain);

    if (noiseSource) noiseSource.start(now);
    if (audioSource) {
      const offset = playhead !== undefined ? playhead : (cropStart ?? 0);
      audioSource.start(now, offset);
    }

    const voiceEntry = {
      polyOscPairs: [] as [OscillatorNode, OscillatorNode | null][],
      noiseSource,
      audioSource,
      audioBuffer: audioBuffer || null,
      gainNode,
      panNode,
      filterNode,
      delayNode,
      delayGainNode,
      waveShaperNode,
      type: label,
      baseOscType,
      baseOscType2,
      baseDetune,
    };

    this.voices.set(id, voiceEntry);
    return voiceEntry;
  }

  public stopVoice(id: string) {
    const voice = this.voices.get(id);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.linearRampToValueAtTime(0, now + 0.3);

    setTimeout(() => {
      try {
        for (const [oscA, oscB] of voice.polyOscPairs) {
          try { oscA.stop(); } catch(e) {}
          try { oscA.disconnect(); } catch(e) {}
          if (oscB) {
            try { oscB.stop(); } catch(e) {}
            try { oscB.disconnect(); } catch(e) {}
          }
        }
        if (voice.noiseSource) { voice.noiseSource.stop(); voice.noiseSource.disconnect(); }
        if (voice.audioSource) { voice.audioSource.stop(); voice.audioSource.disconnect(); }
        voice.filterNode.disconnect();
        voice.gainNode.disconnect();
        voice.delayNode.disconnect();
        voice.delayGainNode.disconnect();
        voice.waveShaperNode.disconnect();
      } catch (e) {}
    }, 350);

    this.voices.delete(id);
  }

  clearAllVoices() {
    for (const id of Array.from(this.voices.keys())) {
      this.stopVoice(id);
    }
  }

  mute(muteState: boolean) {
    this.isMuted = muteState;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muteState ? 0 : this.masterVolume, this.ctx.currentTime, 0.1);
    }
    if (muteState) {
      this.clearAllVoices();
    }
  }

  playTrigger(
    type: string,
    action: 'hover' | 'drag-start' | 'drag-end' | 'proximity' | 'interfere' | 'regulate',
    mods?: {
      quente?: boolean;
      frio?: boolean;
      aspero?: boolean;
      denso?: boolean;
      etereo?: boolean;
      sagrado?: boolean;
      erotico?: boolean;
      infantil?: boolean;
      translucido?: boolean;
      eco?: boolean;
      friccao?: boolean;
      intensity?: number;
    }
  ) {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const intensity = mods?.intensity ?? 1.0;

    let baseFreq = 220;
    let release = 0.5 * intensity;
    let volume = 0.45 * intensity;

    if (mods?.etereo) {
      release *= 2.5;
      volume *= 0.6;
    }
    if (mods?.denso) {
      volume *= 1.8;
      release *= 0.7;
    }
    if (mods?.translucido) {
      release = 0.15;
      volume *= 0.7;
    }
    if (mods?.frio) {
      baseFreq *= 1.35;
      release *= 0.5;
    }
    if (mods?.quente) {
      baseFreq *= 0.8;
    }
    if (mods?.eco) {
      release *= 2.0;
    }
    if (mods?.friccao) {
      volume *= 1.2;
    }

    if (mods?.sagrado) {
      this.triggerTone(880, 'sine', 0.12 * volume, 0.005, 1.2 * release, 1760);
      return;
    }
    if (mods?.erotico) {
      this.triggerTone(55, 'triangle', 0.3 * volume, 0.1, 0.8 * release);
      return;
    }
    if (mods?.infantil) {
      this.triggerTone(660, 'sine', 0.15 * volume, 0.002, 0.2 * release, 1320);
      return;
    }

    const activeRelease = mods?.eco ? release * 2 : release;

    switch (type) {
      case 'cor':
        this.triggerTone(baseFreq, 'triangle', volume * 1.2, 0.08, activeRelease);
        break;
      case 'som':
        this.triggerTone(baseFreq * 2, 'sine', volume, 0.005, activeRelease * 0.25);
        break;
      case 'silêncio':
        this.triggerDucking();
        break;
      case 'imagem':
        this.triggerNoise(0.06 * volume, 0.04, activeRelease * 0.3, 1200);
        break;
      case 'palavra':
        this.triggerNoise(0.04 * volume, 0.02, activeRelease * 0.4, 2500);
        break;
      case 'atmosfera':
      case 'ar':
        this.triggerNoise(0.03 * volume, 0.12, activeRelease * 1.5, 1800);
        break;
      case 'terra':
      case 'barro':
        this.triggerTone(baseFreq * 0.4, 'sine', volume * 2.0, 0.1, activeRelease * 1.2);
        break;
      case 'fogo':
        this.triggerCrackles(volume);
        break;
      case 'água':
        this.triggerWaterDrop(volume);
        break;
      case 'sangue':
        this.triggerTone(baseFreq * 0.5, 'triangle', volume * 1.5, 0.06, activeRelease * 1.1);
        break;
      case 'ouro':
        this.triggerTone(980, 'sine', 0.15 * volume, 0.005, activeRelease * 0.5, 1960);
        break;
      case 'ruína':
        this.triggerTone(135, 'sawtooth', 0.12 * volume, 0.01, activeRelease * 0.5);
        break;
      case 'jardim':
        this.triggerTone(baseFreq * 1.5, 'sine', volume * 0.8, 0.06, activeRelease * 0.8);
        break;
      default:
        if (action === 'regulate') {
          this.triggerNoise(0.05, 0.005, 0.05, 800 + intensity * 600);
        } else {
          this.triggerTone(baseFreq * 1.33, 'sine', volume * 0.5, 0.02, activeRelease * 0.4);
        }
        break;
    }

    if (mods?.aspero && type !== 'fogo') {
      this.triggerNoise(0.03 * volume, 0.01, 0.15, 3000);
    }
  }

  private triggerTone(freq: number, type: OscillatorType, volume: number, attack: number, release: number, secondFreq?: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + release);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + attack + release + 0.1);

    if (secondFreq) {
      this.triggerTone(secondFreq, type, volume * 0.4, attack, release);
    }
  }

  private triggerNoise(volume: number, attack: number, release: number, filterFreq: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    
    const bufferSize = this.ctx.sampleRate * (attack + release + 0.1);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(1.2, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + attack + release);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    noiseSource.start(now);
  }

  private triggerCrackles(volumeScale = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.05 + Math.random() * 0.03;
      this.triggerTone(1100 + Math.random() * 700, 'sawtooth', 0.03 * volumeScale, 0.001, 0.008);
    }
  }

  private triggerWaterDrop(volumeScale = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2 * volumeScale, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  private triggerDucking() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    this.masterGain.gain.exponentialRampToValueAtTime(0.85, now + 1.5);
  }}

const NOTE_NAMES = ["dó", "dó#", "ré", "ré#", "mi", "fá", "fá#", "sol", "sol#", "lá", "lá#", "si"];
const getNoteName = (midiNote: number) => {
  const noteIndex = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${NOTE_NAMES[noteIndex]} (c${octave})`;
};

const KEY_NOTE_MAP: Record<string, number> = {
  'a': 60, // C4
  'w': 61, // C#4
  's': 62, // D4
  'e': 63, // D#4
  'd': 64, // E4
  'f': 65, // F4
  't': 66, // F#4
  'g': 67, // G4
  'y': 68, // G#4
  'h': 69, // A4
  'u': 70, // A#4
  'j': 71, // B4
  'k': 72, // C5
  'o': 73, // C#5
  'l': 74, // D5
  'p': 75, // D#5
  'ç': 76, // E5
  ';': 76, // E5
};

interface CanvasNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  colorValue?: string;
  isDragging?: boolean;
  intensity?: number;
  snappedToId?: string; // Core node snapped host
  snapOffset?: { dx: number; dy: number }; // Offset relative to host
  imageDataId?: string;
  imageDataUrl?: string;
  audioDataId?: string;
  audioDataUrl?: string;
  audioDuration?: number;
  audioPeaks?: number[];
  isPlaying?: boolean;
  isLooping?: boolean;
  cropStart?: number;
  cropEnd?: number;
  playhead?: number;
  width?: number;
  playbackSeekTrigger?: number;
}

interface AtelieWorkspaceProps {
  activeContextNode: PulsoContextNode;
  isActive?: boolean;
}

// Structuring Matérias in coherent families
const FAMILIES_MATERIAS: Record<string, Array<{ label: string; colorValue?: string }>> = {
  cor: [
    { label: 'vermelho', colorValue: '#ef4444' },
    { label: 'vinho', colorValue: '#781a1a' },
    { label: 'ferrugem', colorValue: '#b45309' },
    { label: 'rosa', colorValue: '#ec4899' },
    { label: 'âmbar', colorValue: '#f59e0b' },
    { label: 'dourado', colorValue: '#fbbf24' },
    { label: 'azul', colorValue: '#3b82f6' },
    { label: 'verde', colorValue: '#10b981' },
    { label: 'preto', colorValue: '#000000' },
    { label: 'branco', colorValue: '#ffffff' },
    { label: 'cinza', colorValue: '#6b7280' }
  ],
  elementos: [
    { label: 'água' },
    { label: 'fogo' },
    { label: 'ar' },
    { label: 'terra' }
  ],
  natureza: [
    { label: 'pedra' },
    { label: 'barro' },
    { label: 'fumaça' },
    { label: 'planta' },
    { label: 'metal' },
    { label: 'névoa' },
    { label: 'poeira' },
    { label: 'sal' },
    { label: 'ferrugem' },
    { label: 'sangue' },
    { label: 'ruína' }
  ],
  som: [
    { label: 'pulso' },
    { label: 'grave seco' },
    { label: 'sopro' },
    { label: 'fricção' },
    { label: 'ruído fino' },
    { label: 'ressonância curta' },
    { label: 'silêncio ativo' }
  ],
  textura: [
    { label: 'lisa' },
    { label: 'áspera' },
    { label: 'porosa' },
    { label: 'fibrosa' },
    { label: 'rachada' },
    { label: 'aveludada' },
    { label: 'granulada' },
    { label: 'úmida' },
    { label: 'seca' }
  ],
  atmosfera: [
    { label: 'névoa' },
    { label: 'suspensão' },
    { label: 'calor' },
    { label: 'sombra' },
    { label: 'rarefação' },
    { label: 'melancolia' },
    { label: 'liturgia' }
  ],
  palavra: [
    { label: 'faixa verbal curta' },
    { label: 'inscrição' },
    { label: 'fragmento' },
    { label: 'nome' },
    { label: 'frase mínima' }
  ],
  imagem: [
    { label: 'fragmento recortado' },
    { label: 'mancha' },
    { label: 'silhueta' },
    { label: 'recorte fotográfico' },
    { label: 'ruído visual' }
  ],
  temperamentos: [
    { label: 'sanguíneo' },
    { label: 'colérico' },
    { label: 'melancólico' },
    { label: 'fleumático' }
  ]
};

const RESERVOIR_EMOCOES = {
  alegria: [
    'euforia', 'entusiasmo', 'satisfação', 'otimismo', 'contentamento', 
    'orgulho', 'alívio', 'serenidade', 'fascínio', 'júbilo', 
    'gratidão', 'ternura', 'admiração', 'afeto', 'esperança', 
    'compaixão', 'vitalidade', 'brilho', 'deleite', 'êxtase'
  ],
  tristeza: [
    'melancolia', 'desalento', 'solidão', 'pesar', 'angústia', 
    'nostalgia', 'amargura', 'luto', 'desânimo', 'tédio', 
    'desamparo', 'apatia', 'frustração', 'abandono', 'rejeição', 
    'culpa', 'piedade', 'mágoa', 'arrependimento', 'vazio'
  ],
  raiva: [
    'fúria', 'ira', 'indignação', 'irritação', 'ressentimento', 
    'desprezo', 'hostilidade', 'aversão', 'ciúme', 'inveja', 
    'ódio', 'impaciência', 'rancor', 'agressividade', 'tensão', 
    'repulsa', 'despeito', 'revolta', 'fricção interna', 'indignado'
  ],
  medo: [
    'pânico', 'terror', 'ansiedade', 'pavor', 'apreensão', 
    'desconfiança', 'insegurança', 'fobia', 'aflição', 'paralisia', 
    'susto', 'nervosismo', 'vulnerabilidade', 'sombra', 'receio', 
    'hesitação', 'timidez', 'desassossego', 'inquietude', 'pavoroso'
  ]
};

const RESERVOIR_ATRIBUTOS = [
  'quente', 'frio', 'seco', 'úmido', 'áspero', 'liso', 'denso', 'rarefeito', 'opaco', 'translúcido', 'sagrado', 'erótico', 'infantil', 'terroso', 'etéreo', 'delicado', 'bruto', 'ritual', 'sombrio', 'luminoso'
];

const RESERVOIR_FORCAS = [
  'expansão', 'contração', 'elevação', 'descida', 'dissolução', 'condensação', 'fricção', 'fusão', 'ruptura', 'sustentação', 'germinação', 'combustão'
];

const RESERVOIR_OPERACOES = [
  'mover', 'aproximar', 'afastar', 'sobrepor', 'agrupar', 'separar', 'misturar', 'contaminar'
];

const RESERVOIR_RELACOES = [
  'ressonância', 'eco', 'afinidade', 'contraste', 'continuidade', 'atravessamento'
];

const RESERVOIR_ENCARNACOES = [
  'jardim', 'paisagem visual', 'ambiência sonora', 'joia', 'objeto', 'espaço', 'ritual', 'direção criativa'
];

export default function AtelieWorkspaceV2({ activeContextNode, isActive = true }: AtelieWorkspaceProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const audioEngineRef = React.useRef<AudioEngine | null>(null);
  
  const [isMuted, setIsMuted] = React.useState(false);
  const [masterVolume, setMasterVolume] = React.useState(3.8);
  const [dimensions, setDimensions] = React.useState({ width: 1200, height: 800 });
  const [zoom, setZoom] = React.useState(1.0);
  const [panX, setPanX] = React.useState(0);
  const [panY, setPanY] = React.useState(0);
  const [isPanning, setIsPanning] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<string[]>([]);
  const selectedNodeId = selectedNodeIds[0] || null;
  const setSelectedNodeId = (id: string | null) => {
    setSelectedNodeIds(id ? [id] : []);
  };
  const [debugOverrides, setDebugOverrides] = React.useState<Record<string, SemioticBaseProperties>>({});

  // Saved Mesas State
  const [savedMesas, setSavedMesas] = React.useState<Record<string, CanvasNode[]>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isOpenMenu, setIsOpenMenu] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [octaveOffset, setOctaveOffset] = React.useState(0);
  const [globalPitchMultipliers, setGlobalPitchMultipliers] = React.useState<number[]>([1.0]);
  const [activeNoteName, setActiveNoteName] = React.useState("dó (c4)");
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = React.useState(false);

  // Load Saved Mesas from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('pulso-atelie-saved-mesas');
    if (saved) {
      try {
        setSavedMesas(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  React.useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const savedVol = localStorage.getItem('pulso-atelie-master-volume');
      if (savedVol) {
        const v = parseFloat(savedVol);
        if (!isNaN(v)) setMasterVolume(v);
      }
    }
  }, []);

  React.useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      localStorage.setItem('pulso-atelie-master-volume', masterVolume.toString());
      const engine = getAudioEngine();
      if (engine) {
        engine.setMasterVolume(masterVolume);
      }
    }
  }, [masterVolume, isMounted]);
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // V2 Invocator popover state
  const [summonPosition, setSummonPosition] = React.useState<{ x: number; y: number; clientX: number; clientY: number; category: string } | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions(prev => {
          if (prev.width === rect.width && prev.height === rect.height) return prev;
          return { width: rect.width, height: rect.height };
        });
      }
    };
    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(container);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateDimensions);
    }
    return () => {
      resizeObserver.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateDimensions);
      }
    };
  }, []);

  const getAudioEngine = () => {
    if (!audioEngineRef.current && typeof window !== 'undefined') {
      audioEngineRef.current = new AudioEngine();
    }
    return audioEngineRef.current;
  };

  const resumeAudio = () => {
    const engine = getAudioEngine();
    if (engine) engine.resume();
  };

  // V2 Starts completely empty (Vacuum)
  const [nodes, setNodes] = React.useState<CanvasNode[]>([]);
  const audioBuffersRef = React.useRef<Map<string, AudioBuffer>>(new Map());
  const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const loadingNodeIdsRef = React.useRef<Set<string>>(new Set());

  // Load custom audio buffers from IndexedDB on nodes change
  React.useEffect(() => {
    nodes.forEach(node => {
      if (node && node.type === 'som' && node.audioDataId) {
        if (audioBuffersRef.current.has(node.id) || loadingNodeIdsRef.current.has(node.id)) {
          return;
        }
        loadingNodeIdsRef.current.add(node.id);
        loadAudioIDB(node.audioDataId).then(record => {
          if (record && record.dataUrl) {
            try {
              const arrayBuffer = dataURItoArrayBuffer(record.dataUrl);
              const engine = getAudioEngine();
              const mainCtx = engine ? engine.getAudioContext() : null;
              if (mainCtx) {
                mainCtx.decodeAudioData(arrayBuffer, (decoded) => {
                  audioBuffersRef.current.set(node.id, decoded);
                  // Trigger a state re-render so AudioEngine plays the decoded buffer!
                  forceUpdate();
                }, (err) => {
                  console.error("mainCtx decodeAudioData error:", err);
                  loadingNodeIdsRef.current.delete(node.id);
                });
              } else {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                const tempCtx = new AudioContextClass();
                tempCtx.decodeAudioData(arrayBuffer, (decoded) => {
                  audioBuffersRef.current.set(node.id, decoded);
                  forceUpdate();
                  tempCtx.close();
                });
              }
            } catch (err) {
              console.error("IDB audio buffer decode error:", err);
              loadingNodeIdsRef.current.delete(node.id);
            }
          } else {
            loadingNodeIdsRef.current.delete(node.id);
          }
        }).catch(err => {
          console.error("loadAudioIDB error:", err);
          loadingNodeIdsRef.current.delete(node.id);
        });
      }
    });
  }, [nodes]);

  const playSensorialSound = (
    type: string,
    action: 'hover' | 'drag-start' | 'drag-end' | 'proximity' | 'interfere' | 'regulate',
    nodeId?: string
  ) => {
    const engine = getAudioEngine();
    if (!engine) return;

    let mods = { intensity: 1.0 };
    if (nodeId) {
      const activeMods = computedRelations.activeModulations.get(nodeId);
      const targetNode = nodes.find(n => n.id === nodeId);
      if (activeMods) {
        mods = {
          ...activeMods,
          intensity: targetNode?.intensity ?? 1.0
        };
      }
    }

    engine.playTrigger(type, action, mods);
  };

  // Viscous physics loop (with snap follow-up)
  React.useEffect(() => {
    let active = true;
    const container = containerRef.current;
    let lastTime = performance.now();

    const loop = () => {
      if (!active || !container || !isActive) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 100 || rect.height <= 100) {
        requestAnimationFrame(loop);
        return;
      }

      const nowTime = performance.now();
      const dt = (nowTime - lastTime) / 1000;
      lastTime = nowTime;

      const screenMarginX = 24;
      const screenMarginY = 24;
      const minX = (screenMarginX - rect.width / 2 - panX) / zoom + rect.width / 2;
      const maxX = (rect.width - screenMarginX - rect.width / 2 - panX) / zoom + rect.width / 2;
      const minY = (screenMarginY - rect.height / 2 - panY) / zoom + rect.height / 2;
      const maxY = (rect.height - screenMarginY - rect.height / 2 - panY) / zoom + rect.height / 2;

      setNodes(prevNodes => {
        // First, increment playhead on all playing audio nodes
        const withPlayhead = prevNodes.map(node => {
          if (node.type === 'som' && node.isPlaying && node.audioDuration) {
            const start = node.cropStart ?? 0;
            const end = node.cropEnd ?? node.audioDuration;
            let p = (node.playhead ?? start) + dt;
            if (p >= end) {
              p = node.isLooping ? start : end;
            }
            return { ...node, playhead: p };
          }
          return node;
        });

        // Calculate core/independent nodes movement
        const updated = withPlayhead.map(node => {
          if (node.isDragging || node.snappedToId) return node;

          let nextX = node.x + node.vx;
          let nextY = node.y + node.vy;
          let nextVx = node.vx * 0.92;
          let nextVy = node.vy * 0.92;

          if (nextX < minX) {
            nextX = minX;
            nextVx = -nextVx * 0.2;
          } else if (nextX > maxX) {
            nextX = maxX;
            nextVx = -nextVx * 0.2;
          }

          if (nextY < minY) {
            nextY = minY;
            nextVy = -nextVy * 0.2;
          } else if (nextY > maxY) {
            nextY = maxY;
            nextVy = -nextVy * 0.2;
          }

          return {
            ...node,
            x: nextX,
            y: nextY,
            vx: nextVx,
            vy: nextVy
          };
        });

        // Update snapped nodes to follow their hosts
        return updated.map(node => {
          if (node.snappedToId && !node.isDragging) {
            const host = updated.find(h => h.id === node.snappedToId);
            if (host) {
              const offset = node.snapOffset || { dx: 0, dy: 0 };
              return {
                ...node,
                x: host.x + offset.dx,
                y: host.y + offset.dy,
                vx: host.vx,
                vy: host.vy
              };
            }
          }
          return node;
        });
      });

      requestAnimationFrame(loop);
    };

    if (isActive) {
      requestAnimationFrame(loop);
    }
    return () => {
      active = false;
    };
  }, [isActive, zoom, panX, panY]);

  const handleWheel = (e: React.WheelEvent) => {
    setZoom(prev => Math.min(2.0, Math.max(0.25, prev - e.deltaY * 0.0015)));
  };

  const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
    resumeAudio();
    const target = e.target as HTMLElement;
    if (
      target.closest('.canvas-node') || 
      target.closest('button') || 
      target.closest('input') || 
      target.closest('.summon-popover')
    ) {
      return;
    }
    setSelectedNodeIds([]);
    setIsPanning(true);
    
    let lastX = e.clientX;
    let lastY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleWorkspaceTouchStart = (e: React.TouchEvent) => {
    resumeAudio();
    const target = e.target as HTMLElement;
    if (
      target.closest('.canvas-node') || 
      target.closest('button') || 
      target.closest('input') || 
      target.closest('.summon-popover')
    ) {
      return;
    }
    setSelectedNodeIds([]);
    setIsPanning(true);
    
    let lastX = e.touches[0].clientX;
    let lastY = e.touches[0].clientY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const dx = moveEvent.touches[0].clientX - lastX;
      const dy = moveEvent.touches[0].clientY - lastY;
      lastX = moveEvent.touches[0].clientX;
      lastY = moveEvent.touches[0].clientY;
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
    };

    const handleTouchEnd = () => {
      setIsPanning(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Polyphonic keyboard note state
  const [activePressedKeys, setActivePressedKeys] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      const key = e.key.toLowerCase();

      // Resume audio context on user keyboard interaction
      resumeAudio();

      // Adjust hovered node volume with Open Bracket ([) and Close Bracket (]) keys
      if (hoveredNodeId && (key === '[' || key === ']')) {
        e.preventDefault();
        setNodes(prev => prev.map(n => {
          if (n.id === hoveredNodeId && n.type === 'som') {
            const step = key === ']' ? 0.05 : -0.05;
            return {
              ...n,
              intensity: Math.min(1.5, Math.max(0, (n.intensity ?? 1.0) + step))
            };
          }
          return n;
        }));
        return;
      }

      // Delete/Backspace nodes
      if (key === 'delete' || key === 'backspace') {
        if (selectedNodeIds.length > 0 && !editingId) {
          setNodes(prev => prev.filter(n => !selectedNodeIds.includes(n.id) && !selectedNodeIds.includes(n.snappedToId || '')));
          setSelectedNodeIds([]);
        }
        return;
      }

      // Octave Shift
      let nextOctaveOffset = octaveOffset;
      if (key === 'z') {
        nextOctaveOffset = Math.max(-2, octaveOffset - 1);
        setOctaveOffset(nextOctaveOffset);
      }
      if (key === 'x') {
        nextOctaveOffset = Math.min(2, octaveOffset + 1);
        setOctaveOffset(nextOctaveOffset);
      }

      // Add pressed key or transpose holding keys
      if (KEY_NOTE_MAP[key] !== undefined || key === 'z' || key === 'x') {
        const nextPressed = { ...activePressedKeys };
        if (KEY_NOTE_MAP[key] !== undefined) {
          nextPressed[key] = KEY_NOTE_MAP[key] + (nextOctaveOffset * 12);
        }
        // If octave shifted, transpose all currently held keys in real-time
        if (key === 'z' || key === 'x') {
          Object.keys(nextPressed).forEach(k => {
            nextPressed[k] = KEY_NOTE_MAP[k] + (nextOctaveOffset * 12);
          });
        }
        setActivePressedKeys(nextPressed);

        const activeMidiNotes = Object.values(nextPressed);
        if (activeMidiNotes.length > 0) {
          const multipliers = activeMidiNotes.map(note => Math.pow(2, (note - 60) / 12));
          setGlobalPitchMultipliers(multipliers);
          const noteNames = activeMidiNotes.map(note => getNoteName(note)).join(" + ");
          setActiveNoteName(noteNames);
          const engine = getAudioEngine();
          if (engine) {
            engine.setGlobalPitchMultipliers(multipliers);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEY_NOTE_MAP[key] !== undefined && activePressedKeys[key] !== undefined) {
        const nextPressed = { ...activePressedKeys };
        delete nextPressed[key];
        setActivePressedKeys(nextPressed);

        const activeMidiNotes = Object.values(nextPressed);
        const engine = getAudioEngine();
        if (activeMidiNotes.length > 0) {
          const multipliers = activeMidiNotes.map(note => Math.pow(2, (note - 60) / 12));
          setGlobalPitchMultipliers(multipliers);
          const noteNames = activeMidiNotes.map(note => getNoteName(note)).join(" + ");
          setActiveNoteName(noteNames);
          if (engine) {
            engine.setGlobalPitchMultipliers(multipliers);
          }
        } else {
          // If no keys are pressed, lock back to [1.0] as base pitch transposition
          setGlobalPitchMultipliers([1.0]);
          if (engine) {
            engine.setGlobalPitchMultipliers([1.0]);
          }
        }
      }
    };
 
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeIds, editingId, octaveOffset, activePressedKeys, hoveredNodeId]);

  // Handle Paste (Ctrl+V) of images
  React.useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;
          
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            if (!dataUrl) return;
            
            // Create a node
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const centerX = -panX / zoom + rect.width / 2;
            const centerY = -panY / zoom + rect.height / 2;
            
            // Generate ID
            const newId = `img-${Date.now()}`;
            
            // Save to IndexedDB
            await saveImageIDB(newId, dataUrl);
            
            const newNode: CanvasNode = {
              id: newId,
              label: 'imagem colada',
              x: centerX,
              y: centerY,
              vx: 0,
              vy: 0,
              type: 'imagem',
              imageDataId: newId,
              imageDataUrl: dataUrl,
              intensity: 1.0
            };
            
            setNodes(prev => [...prev, newNode]);
          };
          reader.readAsDataURL(file);
          break; // Process one image at a time
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [panX, panY, zoom]);

  // Open popover to summon node on double click or category click
  const openSummonPopover = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    const x = (clientX - rect.left - rect.width / 2 - panX) / zoom + rect.width / 2;
    const y = (clientY - rect.top - rect.height / 2 - panY) / zoom + rect.height / 2;

    setSummonPosition({
      x,
      y,
      clientX: Math.min(clientX, window.innerWidth - 240),
      clientY: Math.min(clientY, window.innerHeight - 360),
      category
    });
  };

  const spawnNode = (label: string, type: string, colorValue?: string) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    // Spawn exactly in the center of the visible screen (accounting for pan and zoom)
    const centerX = -panX / zoom + rect.width / 2;
    const centerY = -panY / zoom + rect.height / 2;

    // Avoid overlapping with existing nodes.
    // Minimum distance threshold to be considered occupied is 70px.
    // We search in concentric rings around centerX, centerY if occupied.
    const isOccupied = (x: number, y: number) => {
      const threshold = 70;
      return nodes.some(n => {
        const dx = n.x - x;
        const dy = n.y - y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
      });
    };

    let spawnX = centerX;
    let spawnY = centerY;

    if (isOccupied(spawnX, spawnY)) {
      let found = false;
      for (let ring = 1; ring <= 15 && !found; ring++) {
        const radius = 75 * ring;
        const steps = 8 * ring;
        for (let i = 0; i < steps; i++) {
          const angle = (i * 2 * Math.PI) / steps;
          const testX = centerX + radius * Math.cos(angle);
          const testY = centerY + radius * Math.sin(angle);
          if (!isOccupied(testX, testY)) {
            spawnX = testX;
            spawnY = testY;
            found = true;
            break;
          }
        }
      }
    }

    if (type === 'imagem') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          document.body.removeChild(input);
          return;
        }
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
          const dataUrl = readerEvent.target?.result as string;
          if (!dataUrl) {
            document.body.removeChild(input);
            return;
          }
          
          const newId = `img-${Date.now()}`;
          await saveImageIDB(newId, dataUrl);
          
          const newNode: CanvasNode = {
            id: newId,
            label,
            x: spawnX,
            y: spawnY,
            vx: 0,
            vy: 0,
            type,
            imageDataId: newId,
            imageDataUrl: dataUrl,
            intensity: 1.0
          };
          setNodes(prev => [...prev, newNode]);
          document.body.removeChild(input);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      setSummonPosition(null);
      return;
    }

    const newId = `m-${Date.now()}`;
    const newNode: CanvasNode = {
      id: newId,
      label,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      type,
      colorValue,
      intensity: 1.0
    };
    setNodes(prev => [...prev, newNode]);
    setSummonPosition(null);
    playSensorialSound(type, 'drag-end', newId);
  };

  // Drag start (clears previous snap/coupling status)
  const handleDragStart = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    if (editingId) return;
    e.preventDefault();
    resumeAudio();

    const isShiftPressed = e.shiftKey;
    const isCmdOrCtrl = ('metaKey' in e && e.metaKey) || ('ctrlKey' in e && e.ctrlKey);

    let newSelectedIds = [...selectedNodeIds];
    if (isCmdOrCtrl) {
      if (selectedNodeIds.includes(id)) {
        newSelectedIds = newSelectedIds.filter(x => x !== id);
      } else {
        newSelectedIds.push(id);
      }
    } else {
      if (!selectedNodeIds.includes(id) && !isShiftPressed) {
        newSelectedIds = [id];
      }
    }
    setSelectedNodeIds(newSelectedIds);

    const node = nodes.find(n => n.id === id);
    if (!node) return;

    let lastClientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    let lastClientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    let speedX = 0;
    let speedY = 0;

    if (isShiftPressed) {
      playSensorialSound(node.type, 'regulate', id);
      
      const handleIntensityMove = (moveEvent: MouseEvent | TouchEvent) => {
        const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
        const dy = lastClientY - currentY;
        lastClientY = currentY;

        setNodes(prev => prev.map(n => {
          if (n.id === id) {
            const nextIntensity = Math.min(2.0, Math.max(0.1, (n.intensity ?? 1.0) + dy * 0.008));
            if (Math.abs(dy) > 1.5) {
              playSensorialSound(n.type, 'regulate', id);
            }
            return {
              ...n,
              intensity: nextIntensity
            };
          }
          return n;
        }));
      };

      const handleIntensityEnd = () => {
        window.removeEventListener('mousemove', handleIntensityMove);
        window.removeEventListener('mouseup', handleIntensityEnd);
        window.removeEventListener('touchmove', handleIntensityMove);
        window.removeEventListener('touchend', handleIntensityEnd);
      };

      window.addEventListener('mousemove', handleIntensityMove);
      window.addEventListener('mouseup', handleIntensityEnd);
      window.addEventListener('touchmove', handleIntensityMove, { passive: true });
      window.addEventListener('touchend', handleIntensityEnd);
      return;
    }

    playSensorialSound(node.type, 'drag-start', id);
    setNodes(prev => prev.map(n => newSelectedIds.includes(n.id) ? { ...n, isDragging: true, vx: 0, vy: 0, snappedToId: undefined, snapOffset: undefined } : n));

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const dx = (clientX - lastClientX) / zoom;
      const dy = (clientY - lastClientY) / zoom;

      speedX = dx;
      speedY = dy;

      lastClientX = clientX;
      lastClientY = clientY;

      setNodes(prev => prev.map(n => {
        if (newSelectedIds.includes(n.id)) {
          return {
            ...n,
            x: n.x + dx,
            y: n.y + dy,
            vx: dx,
            vy: dy
          };
        }
        return n;
      }));
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);

      setNodes(prev => {
        const draggedNode = prev.find(n => n.id === id);
        if (!draggedNode) return prev;

        const isModulator = draggedNode.type === 'atributo' || draggedNode.type === 'forca';
        let snapHostId: string | undefined;
        let snapOffset: { dx: number; dy: number } | undefined;

        if (isModulator) {
          const coreNodes = prev.filter(n => n.id !== id && (n.type === 'elementos' || n.type === 'natureza' || n.type === 'cor' || n.type === 'som'));
          let minDistance = 85;
          
          coreNodes.forEach(core => {
            const dist = Math.hypot(draggedNode.x - core.x, draggedNode.y - core.y);
            if (dist < minDistance) {
              minDistance = dist;
              snapHostId = core.id;
              const angle = Math.atan2(draggedNode.y - core.y, draggedNode.x - core.x);
              snapOffset = {
                dx: Math.cos(angle) * 32,
                dy: Math.sin(angle) * 32
              };
            }
          });
        }

        return prev.map(n => {
          if (newSelectedIds.includes(n.id)) {
            if (n.id === id) playSensorialSound(n.type, 'drag-end', id);
            return {
              ...n,
              isDragging: false,
              vx: speedX * 0.85,
              vy: speedY * 0.85,
              snappedToId: n.id === id ? snapHostId : n.snappedToId,
              snapOffset: n.id === id ? snapOffset : n.snapOffset,
              x: (n.id === id && snapHostId) ? prev.find(host => host.id === snapHostId)!.x + snapOffset!.dx : n.x,
              y: (n.id === id && snapHostId) ? prev.find(host => host.id === snapHostId)!.y + snapOffset!.dy : n.y,
            };
          }
          return n;
        });
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
  };

  const handleResizeStart = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resumeAudio();

    const node = nodes.find(n => n.id === id);
    if (!node) return;

    let startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = node.width ?? 120;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const dx = (clientX - startX) / zoom;
      const newWidth = Math.max(60, Math.min(500, startWidth + dx));
      setNodes(prev => prev.map(n => n.id === id ? { ...n, width: newWidth } : n));
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
  };

  const handleCropStartDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === id);
    if (!node || !node.audioDuration) return;

    let startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialCropStart = node.cropStart ?? 0;
    const waveWidth = node.width ?? 120;
    const duration = node.audioDuration;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const dx = (clientX - startX) / zoom;
      const currentSpan = (node.cropEnd ?? duration) - initialCropStart;
      const dxSeconds = (dx / waveWidth) * currentSpan;
      const newCropStart = Math.max(0, Math.min((node.cropEnd ?? duration) - 0.5, initialCropStart + dxSeconds));
      setNodes(prev => prev.map(n => n.id === id ? { ...n, cropStart: newCropStart, playhead: Math.max(newCropStart, n.playhead ?? 0) } : n));
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      setNodes(prev => prev.map(n => n.id === id ? { ...n, playbackSeekTrigger: Date.now() } : n));
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
  };

  const handleCropEndDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === id);
    if (!node || !node.audioDuration) return;

    let startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialCropEnd = node.cropEnd ?? node.audioDuration;
    const waveWidth = node.width ?? 120;
    const duration = node.audioDuration;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const dx = (clientX - startX) / zoom;
      const currentSpan = initialCropEnd - (node.cropStart ?? 0);
      const dxSeconds = (dx / waveWidth) * currentSpan;
      const newCropEnd = Math.max((node.cropStart ?? 0) + 0.5, Math.min(duration, initialCropEnd + dxSeconds));
      setNodes(prev => prev.map(n => n.id === id ? { ...n, cropEnd: newCropEnd, playhead: Math.min(newCropEnd, n.playhead ?? duration) } : n));
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      setNodes(prev => prev.map(n => n.id === id ? { ...n, playbackSeekTrigger: Date.now() } : n));
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
  };

  const handlePlayheadDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === id);
    if (!node || !node.audioDuration) return;

    let startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialPlayhead = node.playhead ?? node.cropStart ?? 0;
    const waveWidth = node.width ?? 120;
    const duration = node.audioDuration;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const dx = (clientX - startX) / zoom;
      const currentSpan = (node.cropEnd ?? duration) - (node.cropStart ?? 0);
      const dxSeconds = (dx / waveWidth) * currentSpan;
      const newPlayhead = Math.max(node.cropStart ?? 0, Math.min(node.cropEnd ?? duration, initialPlayhead + dxSeconds));
      setNodes(prev => prev.map(n => n.id === id ? { ...n, playhead: newPlayhead } : n));
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      setNodes(prev => prev.map(n => n.id === id ? { ...n, playbackSeekTrigger: Date.now() } : n));
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
  };

  const deleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(prev => prev.filter(n => n.id !== id && n.snappedToId !== id));
    setSelectedNodeIds(prev => prev.filter(x => x !== id));
  };

  const handleSaveMesa = (name: string) => {
    if (!name.trim()) return;
    const keyName = name.trim().toLowerCase();
    const cleanNodes = nodes.map(({ imageDataUrl, audioDataUrl, ...rest }) => rest);
    const updated = { ...savedMesas, [keyName]: cleanNodes };
    setSavedMesas(updated);
    localStorage.setItem('pulso-atelie-saved-mesas', JSON.stringify(updated));
    setIsSaving(false);
    setSaveName("");
  };

  const handleOpenMesa = (name: string) => {
    const targetNodes = savedMesas[name];
    if (targetNodes) {
      setNodes(targetNodes);
      setIsOpenMenu(false);
    }
  };

  const handleNewMesa = () => {
    if (window.confirm("Deseja criar uma nova mesa limpa? Todos os elementos atuais serão removidos.")) {
      setNodes([]);
    }
  };

  const togglePlayAudioNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    resumeAudio();
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        const nextPlayState = !n.isPlaying;
        const engine = getAudioEngine();
        if (engine && !nextPlayState) {
          engine.stopVoice(id);
        }
        return { ...n, isPlaying: nextPlayState };
      }
      return n;
    }));
  };

  const toggleLoopAudioNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        const nextLoop = !n.isLooping;
        const engine = getAudioEngine();
        if (engine) {
          const voice = engine.voices.get(id);
          if (voice && voice.audioSource) {
            voice.audioSource.loop = nextLoop;
          }
        }
        return { ...n, isLooping: nextLoop };
      }
      return n;
    }));
  };

  const splitAudioNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (!node || !node.audioDuration) return;
    
    const currentPlayhead = node.playhead || (node.cropStart ?? 0) + ((node.cropEnd ?? node.audioDuration) - (node.cropStart ?? 0)) / 2;
    
    setNodes(prev => {
      const list = [...prev];
      const idx = list.findIndex(n => n.id === id);
      if (idx === -1) return prev;
      
      const orig = list[idx];
      const segA = {
        ...orig,
        label: `${orig.label}-a`,
        cropEnd: currentPlayhead,
        isPlaying: false
      };
      const segB = {
        ...orig,
        id: `aud-${Date.now()}-split`,
        label: `${orig.label}-b`,
        x: orig.x + 80,
        y: orig.y,
        cropStart: currentPlayhead,
        isPlaying: false
      };
      
      list[idx] = segA;
      list.push(segB);
      
      const buffer = audioBuffersRef.current.get(id);
      if (buffer) {
        audioBuffersRef.current.set(segB.id, buffer);
      }
      
      return list;
    });
  };

  const computeOfflineAudioParams = (mods: any, label: string) => {
    let baseFreq = 220;
    let filterCutoff = 800;
    let filterQ = 1.0;
    let volume = 1.0;
    let delayTime = 0.35;
    let delayFeedback = 0.15;
    let distortionAmount = 0;

    // Base Voice Configurations
    if (label === 'pulso') {
      baseFreq = 110;
      filterCutoff = 250;
      volume = 1.4;
    } else if (label === 'grave seco') {
      baseFreq = 55;
      filterCutoff = 120;
      volume = 2.0;
    } else if (label === 'sopro') {
      baseFreq = 174.61;
      filterCutoff = 600;
      volume = 1.5;
    } else if (label === 'fricção') {
      baseFreq = 293.66;
      filterCutoff = 1500;
      volume = 1.2;
    } else if (label === 'ruído fino') {
      baseFreq = 800;
      filterCutoff = 4000;
      volume = 1.0;
    } else if (label === 'ressonância curta') {
      baseFreq = 440;
      filterCutoff = 1200;
      filterQ = 8.0;
      volume = 1.4;
    } else if (label === 'silêncio ativo') {
      baseFreq = 36.71;
      filterCutoff = 70;
      volume = 0.4;
    }

    // Apply Modulations from the field of influence
    if (mods.warmth) {
      baseFreq *= (1 - Math.min(0.8, mods.warmth * 0.25));
      filterCutoff *= (1 + mods.warmth * 1.5);
      volume *= (1 + mods.warmth * 0.3);
    }
    if (mods.coldness) {
      baseFreq *= (1 + mods.coldness * 0.45);
      filterCutoff *= (1 - Math.min(0.9, mods.coldness * 0.5));
      volume *= (1 - Math.min(0.7, mods.coldness * 0.25));
    }
    if (mods.roughness) {
      distortionAmount = Math.min(250, mods.roughness * 180);
      filterQ += mods.roughness * 4.0;
    }
    if (mods.softness) {
      distortionAmount = 0;
      filterCutoff = Math.max(80, filterCutoff * (1 - Math.min(0.8, mods.softness * 0.4)));
      volume *= (1 - Math.min(0.6, mods.softness * 0.2));
    }
    if (mods.density) {
      baseFreq *= (1 - Math.min(0.7, mods.density * 0.4));
      volume *= (1 + mods.density * 0.5);
    }
    if (mods.etéreo) {
      delayFeedback = Math.min(0.9, 0.2 + mods.etéreo * 0.65);
      delayTime = 0.3 + mods.etéreo * 0.5;
      volume *= (1 - Math.min(0.7, mods.etéreo * 0.3));
    }
    if (mods.transparency) {
      filterQ = Math.max(0.1, filterQ * (1 - Math.min(0.95, mods.transparency * 0.8)));
      volume *= (1 - Math.min(0.8, mods.transparency * 0.4));
    }
    if (mods.elevation) {
      baseFreq *= (1 + mods.elevation * 0.8);
    }
    if (mods.descent) {
      baseFreq *= (1 - Math.min(0.6, mods.descent * 0.4));
    }
    if (mods.expansion) {
      volume *= (1 + mods.expansion * 0.45);
      delayFeedback = Math.min(0.85, delayFeedback + mods.expansion * 0.4);
    }
    if (mods.contraction) {
      volume *= (1 - Math.min(0.95, mods.contraction * 0.85));
    }
    if (mods.tension) {
      baseFreq *= (1 + mods.tension * 0.3);
      filterCutoff *= (1 + mods.tension * 0.4);
    }
    if (mods.relaxation) {
      baseFreq *= (1 - Math.min(0.5, mods.relaxation * 0.25));
      filterCutoff *= (1 - Math.min(0.7, mods.relaxation * 0.5));
    }
    if (mods.velocity) {
      baseFreq *= (1 + mods.velocity * 0.5);
    }
    if (mods.slowdown) {
      baseFreq *= (1 - Math.min(0.75, mods.slowdown * 0.5));
    }
    if (mods.clarity) {
      filterCutoff *= (1 + mods.clarity * 1.0);
    }
    if (mods.shadow) {
      filterCutoff *= (1 - Math.min(0.9, mods.shadow * 0.65));
    }
    if (mods.limiar) {
      volume *= (1 - Math.min(0.9, mods.limiar * 0.7));
    }
    if (mods.eco) {
      delayFeedback = Math.min(0.85, delayFeedback + mods.eco * 0.35);
      delayTime = Math.min(1.5, delayTime + mods.eco * 0.45);
    }
    if (mods.afinidade) {
      baseFreq = baseFreq * 1.5;
    }
    if (mods.contraste) {
      baseFreq *= 1.05;
    }
    if (mods.continuidade || mods.continuity) {
      const cont = mods.continuidade ?? mods.continuity;
      delayFeedback = Math.min(0.92, delayFeedback + cont * 0.4);
      volume *= (1 + cont * 0.2);
    }
    if (mods.atravessamento) {
      distortionAmount = Math.max(distortionAmount, mods.atravessamento * 120);
    }
    if (mods.jardim) {
      baseFreq *= (1 + mods.jardim * 0.9);
      filterCutoff = Math.max(filterCutoff, 2500 * mods.jardim);
    }
    if (mods.paisagem) {
      delayTime = Math.min(1.2, delayTime + mods.paisagem * 0.5);
    }
    if (mods.ambiencia) {
      delayFeedback = Math.min(0.9, delayFeedback + mods.ambiencia * 0.5);
      volume *= (1 + mods.ambiencia * 0.25);
    }
    if (mods.joia) {
      filterQ = Math.max(filterQ, 20.0 * mods.joia);
      filterCutoff = Math.max(filterCutoff, 3000 * mods.joia);
    }
    if (mods.objeto) {
      delayFeedback = Math.max(0, delayFeedback - mods.objeto * 0.5);
    }
    if (mods.espaco) {
      delayTime = Math.min(1.9, delayTime + mods.espaco * 0.85);
    }
    if (mods.ritual) {
      baseFreq *= (1 - Math.min(0.5, mods.ritual * 0.2));
      filterCutoff = Math.max(60, filterCutoff * (1 - mods.ritual * 0.4));
    }

    return { baseFreq, filterCutoff, filterQ, volume, delayTime, delayFeedback, distortionAmount };
  };

  const downloadAlteredAudio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (!node || !node.audioDataId) return;

    const buffer = audioBuffersRef.current.get(id);
    if (!buffer) {
      alert("Áudio ainda decodificando. Por favor, aguarde.");
      return;
    }

    const mods = computedRelations.activeModulations.get(id) || getInitialSemioticProps();
    const start = node.cropStart ?? 0;
    const end = node.cropEnd ?? buffer.duration;
    const duration = end - start;
    if (duration <= 0) return;

    try {
      const sampleRate = buffer.sampleRate;
      const offlineCtx = new OfflineAudioContext(2, Math.max(1, sampleRate * duration), sampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      
      const shaper = offlineCtx.createWaveShaper();
      const delay = offlineCtx.createDelay(2.0);
      const delayGain = offlineCtx.createGain();
      const panNode = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
      const gainNode = offlineCtx.createGain();

      source.connect(shaper);
      shaper.connect(filter);
      
      let finalDest: AudioNode = filter;
      if (panNode) {
        filter.connect(panNode);
        finalDest = panNode;
      }
      finalDest.connect(gainNode);

      filter.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(filter);
      delayGain.connect(gainNode);

      gainNode.connect(offlineCtx.destination);

      const params = computeOfflineAudioParams(mods, node.label);

      const pitchMultiplier = params.baseFreq / 220;
      source.playbackRate.setValueAtTime(pitchMultiplier, 0);

      filter.frequency.setValueAtTime(Math.max(20, Math.min(20000, params.filterCutoff)), 0);
      filter.Q.setValueAtTime(Math.max(0.0001, params.filterQ), 0);
      delay.delayTime.setValueAtTime(Math.max(0.01, Math.min(2.0, params.delayTime)), 0);
      delayGain.gain.setValueAtTime(params.delayFeedback, 0);

      const nodeIntensity = node.intensity ?? 1.0;
      gainNode.gain.setValueAtTime(params.volume * 1.5 * nodeIntensity, 0);

      if (params.distortionAmount > 0) {
        shaper.curve = makeDistortionCurveOffline(params.distortionAmount);
      }

      source.start(0, start, duration);
      source.stop(duration);

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = bufferToWav(renderedBuffer);

      const downloadUrl = URL.createObjectURL(wavBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${node.label}-atelie.wav`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Offline render error:", err);
      alert("Erro ao processar e baixar áudio.");
    }
  };

  const downloadFullMixdown = async () => {
    const somNodes = nodes.filter(n => n.type === 'som');
    if (somNodes.length === 0) {
      alert("Nenhum som ativo na mesa para exportar.");
      return;
    }

    let mixdownDuration = 30; // Default 30s for synths
    const customAudios = somNodes.filter(n => n.audioDataId);
    if (customAudios.length > 0) {
      const maxCustomDuration = Math.max(...customAudios.map(n => (n.cropEnd ?? n.audioDuration ?? 0) - (n.cropStart ?? 0)));
      if (maxCustomDuration > 0) {
        mixdownDuration = Math.min(180, maxCustomDuration); // Cap at 3 minutes to avoid browser memory OOM
      }
    }

    try {
      // Create OfflineAudioContext
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, Math.max(1, sampleRate * mixdownDuration), sampleRate);

      // Recreate the signal chain for each sound node inside the offlineCtx
      for (const node of somNodes) {
        const id = node.id;
        const mods = computedRelations.activeModulations.get(id) || getInitialSemioticProps();
        const buffer = audioBuffersRef.current.get(id);

        let source: AudioScheduledSourceNode;
        if (buffer) {
          const bufSource = offlineCtx.createBufferSource();
          bufSource.buffer = buffer;
          bufSource.loop = node.isLooping !== false;
          bufSource.loopStart = node.cropStart ?? 0;
          bufSource.loopEnd = node.cropEnd ?? buffer.duration;
          
          const startOffset = node.cropStart ?? 0;
          bufSource.start(0, startOffset, mixdownDuration);
          source = bufSource;
        } else {
          // It's a synth (sopro, grave seco, etc.)
          let baseFreq = 220;
          if (node.label === 'sopro') baseFreq = 196;
          else if (node.label === 'grave seco') baseFreq = 65.41;
          else if (node.label === 'ruído fino') baseFreq = 600;
          else if (node.label === 'ressonância curta') baseFreq = 329.63;
          else if (node.label === 'pulso') baseFreq = 110;
          else if (node.label === 'silêncio ativo') baseFreq = 40;

          const osc = offlineCtx.createOscillator();
          osc.type = (node.label === 'grave seco') ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(baseFreq, 0);
          osc.start(0);
          osc.stop(mixdownDuration);
          source = osc;
        }

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';

        const shaper = offlineCtx.createWaveShaper();
        const delay = offlineCtx.createDelay(2.0);
        const delayGain = offlineCtx.createGain();
        const panNode = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
        const gainNode = offlineCtx.createGain();

        // Connect source
        source.connect(shaper);
        shaper.connect(filter);

        let finalDest: AudioNode = filter;
        if (panNode) {
          filter.connect(panNode);
          finalDest = panNode;
        }
        finalDest.connect(gainNode);

        // Feedback Delay Loop
        filter.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(filter);
        delayGain.connect(gainNode);

        gainNode.connect(offlineCtx.destination);

        const params = computeOfflineAudioParams(mods, node.label);

        if (source instanceof OscillatorNode) {
          source.frequency.setValueAtTime(params.baseFreq, 0);
        } else if (source instanceof AudioBufferSourceNode) {
          const pitchMultiplier = params.baseFreq / 220;
          source.playbackRate.setValueAtTime(pitchMultiplier, 0);
        }

        filter.frequency.setValueAtTime(Math.max(20, Math.min(20000, params.filterCutoff)), 0);
        filter.Q.setValueAtTime(Math.max(0.0001, params.filterQ), 0);
        delay.delayTime.setValueAtTime(Math.max(0.01, Math.min(2.0, params.delayTime)), 0);
        delayGain.gain.setValueAtTime(params.delayFeedback, 0);

        const nodeIntensity = node.intensity ?? 1.0;
        const canvasWidth = 1200;
        const normalizedX = (node.x / canvasWidth) * 2 - 1; // -1 to 1
        const pan = Math.max(-1.0, Math.min(1.0, normalizedX + (mods.spatiality ?? 0.0)));
        if (panNode && panNode.pan) {
          panNode.pan.setValueAtTime(pan, 0);
        }

        gainNode.gain.setValueAtTime(params.volume * 1.5 * nodeIntensity, 0);

        if (params.distortionAmount > 0) {
          shaper.curve = makeDistortionCurveOffline(params.distortionAmount);
        }
      }

      // Render mixdown WAV
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = bufferToWav(renderedBuffer);

      const downloadUrl = URL.createObjectURL(wavBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `mesa-mixdown-${Date.now()}.wav`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Erro na mixagem da mesa:", err);
      alert("Não foi possível gerar a mixagem da mesa.");
    }
  };

  const makeDistortionCurveOffline = (amount: number) => {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  const bufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let offset = 0;
    let pos = 0;

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1); // raw PCM
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);

    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < numOfChan; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset] || 0));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([bufferArr], { type: "audio/wav" });
  };

  const handleWorkspaceDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target !== containerRef.current) return;
    openSummonPopover('todos', e);
  };

  const finishEditing = (id: string, newLabel: string) => {
    setEditingId(null);
    if (!newLabel.trim()) {
      setNodes(prev => prev.filter(n => n.id !== id));
      return;
    }
    setNodes(prev => prev.map(n => n.id === id ? { ...n, label: newLabel.toLowerCase() } : n));
  };

  // V2 Relational calculation hook (calculates properties and proximity)
  const computedRelations = React.useMemo(() => {
    if (semioticGrammarEnabled) {
      return computeSemioticRelations(nodes) as any;
    }

    const activeModulations = new Map<string, {
      quente: boolean;
      frio: boolean;
      aspero: boolean;
      liso: boolean;
      denso: boolean;
      etéreo: boolean;
      sagrado: boolean;
      erotico: boolean;
      infantil: boolean;
      translucido: boolean;
      eco: boolean;
      friccao: boolean;
      elevacao: boolean;
      descida: boolean;
      expansao: boolean;
      contracao: boolean;
      colorRed: boolean;
      colorBlue: boolean;
      colorGold: boolean;
      ressonancia: boolean;
      afinidade: boolean;
      contraste: boolean;
      continuidade: boolean;
      atravessamento: boolean;
      jardim: boolean;
      paisagem: boolean;
      ambiencia: boolean;
      joia: boolean;
      objeto: boolean;
      espaco: boolean;
      ritual: boolean;
      criativa: boolean;
      sanguine: boolean;
      choleric: boolean;
      melancholic: boolean;
      phlegmatic: boolean;
      contaminacaoCor: string | null;
      proximities: Array<{ otherId: string; distance: number }>;
    }>();

    nodes.forEach(n => {
      activeModulations.set(n.id, {
        quente: false,
        frio: false,
        aspero: false,
        liso: false,
        denso: false,
        etéreo: false,
        sagrado: false,
        erotico: false,
        infantil: false,
        translucido: false,
        eco: false,
        friccao: false,
        elevacao: false,
        descida: false,
        expansao: false,
        contracao: false,
        colorRed: false,
        colorBlue: false,
        colorGold: false,
        ressonancia: false,
        afinidade: false,
        contraste: false,
        continuidade: false,
        atravessamento: false,
        jardim: false,
        paisagem: false,
        ambiencia: false,
        joia: false,
        objeto: false,
        espaco: false,
        ritual: false,
        criativa: false,
        sanguine: false,
        choleric: false,
        melancholic: false,
        phlegmatic: false,
        contaminacaoCor: null,
        proximities: []
      });
    });

    const interferenceZones: Array<{ x: number; y: number; size: number; labelA: string; labelB: string; typeA: string; typeB: string }> = [];

    // Loop through node pairs to check for snapped states and proximity modulations
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        // Two nodes are connected if one is snapped to the other OR if they are physically very close
        const isSnapped = nodeA.snappedToId === nodeB.id || nodeB.snappedToId === nodeA.id;
        const dist = isSnapped ? 30 : Math.hypot(nodeB.x - nodeA.x, nodeB.y - nodeA.y);

        if (dist < 100) {
          const modA = activeModulations.get(nodeA.id);
          const modB = activeModulations.get(nodeB.id);

          if (modA && modB) {
            modA.proximities.push({ otherId: nodeB.id, distance: dist });
            modB.proximities.push({ otherId: nodeA.id, distance: dist });

            if (nodeB.type === 'atributo') {
              if (nodeB.label === 'quente') modA.quente = true;
              if (nodeB.label === 'frio') modA.frio = true;
              if (nodeB.label === 'áspero') modA.aspero = true;
              if (nodeB.label === 'liso') modA.liso = true;
              if (nodeB.label === 'denso') modA.denso = true;
              if (nodeB.label === 'etéreo') modA.etéreo = true;
              if (nodeB.label === 'sagrado') modA.sagrado = true;
              if (nodeB.label === 'erótico') modA.erotico = true;
              if (nodeB.label === 'infantil') modA.infantil = true;
              if (nodeB.label === 'translúcido') modA.translucido = true;
            }
            if (nodeA.type === 'atributo') {
              if (nodeA.label === 'quente') modB.quente = true;
              if (nodeA.label === 'frio') modB.frio = true;
              if (nodeA.label === 'áspero') modB.aspero = true;
              if (nodeA.label === 'liso') modB.liso = true;
              if (nodeA.label === 'denso') modB.denso = true;
              if (nodeA.label === 'etéreo') modB.etéreo = true;
              if (nodeA.label === 'sagrado') modB.sagrado = true;
              if (nodeA.label === 'erótico') modB.erotico = true;
              if (nodeA.label === 'infantil') modB.infantil = true;
              if (nodeA.label === 'translúcido') modB.translucido = true;
            }

            // Relations
            if (nodeB.type === 'relacao') {
              if (nodeB.label === 'eco') modA.eco = true;
              if (nodeB.label === 'ressonância') modA.ressonancia = true;
              if (nodeB.label === 'afinidade') modA.afinidade = true;
              if (nodeB.label === 'contraste') modA.contraste = true;
              if (nodeB.label === 'continuidade') modA.continuidade = true;
              if (nodeB.label === 'atravessamento') modA.atravessamento = true;
            }
            if (nodeA.type === 'relacao') {
              if (nodeA.label === 'eco') modB.eco = true;
              if (nodeA.label === 'ressonância') modB.ressonancia = true;
              if (nodeA.label === 'afinidade') modB.afinidade = true;
              if (nodeA.label === 'contraste') modB.contraste = true;
              if (nodeA.label === 'continuidade') modB.continuidade = true;
              if (nodeA.label === 'atravessamento') modB.atravessamento = true;
            }

            // Encarnações
            if (nodeB.type === 'encarnacao') {
              if (nodeB.label === 'jardim') modA.jardim = true;
              if (nodeB.label === 'paisagem visual') modA.paisagem = true;
              if (nodeB.label === 'ambiência sonora') modA.ambiencia = true;
              if (nodeB.label === 'joia') modA.joia = true;
              if (nodeB.label === 'objeto') modA.objeto = true;
              if (nodeB.label === 'espaço') modA.espaco = true;
              if (nodeB.label === 'ritual') modA.ritual = true;
              if (nodeB.label === 'direção criativa') modA.criativa = true;
            }
            if (nodeA.type === 'encarnacao') {
              if (nodeA.label === 'jardim') modB.jardim = true;
              if (nodeA.label === 'paisagem visual') modB.paisagem = true;
              if (nodeA.label === 'ambiência sonora') modB.ambiencia = true;
              if (nodeA.label === 'joia') modB.joia = true;
              if (nodeA.label === 'objeto') modB.objeto = true;
              if (nodeA.label === 'espaço') modB.espaco = true;
              if (nodeA.label === 'ritual') modB.ritual = true;
              if (nodeA.label === 'direção criativa') modB.criativa = true;
            }

            // Temperamentos
            if (nodeB.type === 'temperamentos') {
              if (nodeB.label === 'sanguíneo') modA.sanguine = true;
              if (nodeB.label === 'colérico') modA.choleric = true;
              if (nodeB.label === 'melancólico') modA.melancholic = true;
              if (nodeB.label === 'fleumático') modA.phlegmatic = true;
            }
            if (nodeA.type === 'temperamentos') {
              if (nodeA.label === 'sanguíneo') modB.sanguine = true;
              if (nodeA.label === 'colérico') modB.choleric = true;
              if (nodeA.label === 'melancólico') modB.melancholic = true;
              if (nodeA.label === 'fleumático') modB.phlegmatic = true;
            }

            if (nodeB.type === 'forca') {
              if (nodeB.label === 'fricção') modA.friccao = true;
              if (nodeB.label === 'elevação') modA.elevacao = true;
              if (nodeB.label === 'descida') modA.descida = true;
              if (nodeB.label === 'expansão') modA.expansao = true;
              if (nodeB.label === 'contração') modA.contracao = true;
            }
            if (nodeA.type === 'forca') {
              if (nodeA.label === 'fricção') modB.friccao = true;
              if (nodeA.label === 'elevação') modB.elevacao = true;
              if (nodeA.label === 'descida') modB.descida = true;
              if (nodeA.label === 'expansão') modB.expansao = true;
              if (nodeA.label === 'contração') modB.contracao = true;
            }

            if (nodeB.type === 'cor') {
              modA.contaminacaoCor = nodeB.colorValue || '#ef4444';
              if (nodeB.label === 'vermelho' || nodeB.label === 'vinho' || nodeB.label === 'ferrugem' || nodeB.label === 'sangue') modA.colorRed = true;
              if (nodeB.label === 'azul' || nodeB.label === 'cinza' || nodeB.label === 'preto') modA.colorBlue = true;
              if (nodeB.label === 'dourado' || nodeB.label === 'âmbar') modA.colorGold = true;
            }
            if (nodeA.type === 'cor') {
              modB.contaminacaoCor = nodeA.colorValue || '#ef4444';
              if (nodeA.label === 'vermelho' || nodeA.label === 'vinho' || nodeA.label === 'ferrugem' || nodeA.label === 'sangue') modB.colorRed = true;
              if (nodeA.label === 'azul' || nodeA.label === 'cinza' || nodeA.label === 'preto') modB.colorBlue = true;
              if (nodeA.label === 'dourado' || nodeA.label === 'âmbar') modB.colorGold = true;
            }

            if (nodeA.type !== 'atributo' && nodeB.type !== 'atributo' && nodeA.type !== 'forca' && nodeB.type !== 'forca' && nodeA.type !== 'relacao' && nodeB.type !== 'relacao') {
              interferenceZones.push({
                x: (nodeA.x + nodeB.x) / 2,
                y: (nodeA.y + nodeB.y) / 2,
                size: Math.max(20, 80 - dist * 0.4) * ((nodeA.intensity ?? 1.0) + (nodeB.intensity ?? 1.0)) / 2,
                labelA: nodeA.label,
                labelB: nodeB.label,
                typeA: nodeA.type,
                typeB: nodeB.type
              });
            }
          }
        }
      }
    }

    return { activeModulations, interferenceZones };
  }, [nodes]);

  // Continuous relational audio controller
  React.useEffect(() => {
    const engine = getAudioEngine();
    if (!engine) return;

    const somNodes = nodes.filter(n => n && n.type === 'som' && (!n.audioDataId || n.isPlaying));
    if (somNodes.length === 0 || isMuted) {
      engine.clearAllVoices();
      return;
    }

    engine.updateActiveVoices(
      somNodes.map(n => ({ 
        id: n.id, 
        label: n.label, 
        x: n.x, 
        y: n.y, 
        intensity: n.intensity ?? 1.0,
        cropStart: n.cropStart,
        cropEnd: n.cropEnd,
        playhead: n.playhead,
        isLooping: n.isLooping,
        playbackSeekTrigger: n.playbackSeekTrigger
      })),
      computedRelations.activeModulations,
      audioBuffersRef.current
    );
  }, [nodes, computedRelations, isMuted, globalPitchMultipliers]);

  const toggleMute = () => {
    const engine = getAudioEngine();
    if (engine) {
      const nextState = !isMuted;
      engine.mute(nextState);
      setIsMuted(nextState);
    }
  };

  // Render specific minimal vector shape for each element
  const renderNodeGraphics = (
    node: CanvasNode,
    isQuente: boolean,
    isFrio: boolean,
    isAspero: boolean,
    isLiso: boolean,
    isDenso: boolean,
    isEtereo: boolean,
    isSagrado: boolean,
    isErotico: boolean,
    isInfantil: boolean,
    isTranslucido: boolean,
    isEco: boolean,
    isFriccao: boolean,
    contaminatedColor: string | null
  ) => {
    const color = contaminatedColor || node.colorValue || '#fbf9f5';

    let finalColor = color;
    if (isFrio && node.type === 'cor') {
      finalColor = '#e2e8f0';
    }

    const hotWobbleClass = isQuente ? 'animate-wobble-fluid' : '';
    const frictionClass = isFriccao ? 'animate-shake-jitter' : '';

    if (node.type === 'imagem') {
      const rawMod = computedRelations.activeModulations.get(node.id);
      const overrides = debugOverrides[node.id];
      const mergedProps = overrides ? { ...(rawMod || getInitialSemioticProps()), ...overrides } : (rawMod || getInitialSemioticProps());
      const influences: SemioticInfluence[] = [];
      const rangeLimit = 200;
      nodes.forEach(el => {
        if (el.id !== node.id && el.type !== 'som' && el.type !== 'imagem') {
          const isSnapped = el.snappedToId === node.id;
          const dist = isSnapped ? 30 : Math.hypot(el.x - node.x, el.y - node.y);
          if (dist < rangeLimit) {
            influences.push({
              label: el.label,
              type: el.type,
              dx: el.x - node.x,
              dy: el.y - node.y,
              dist,
              weight: Math.max(0, 1.0 - dist / rangeLimit)
            });
          }
        }
      });

      return (
        <ImageNodeCanvas
          nodeId={node.id}
          imageDataId={node.imageDataId}
          imageDataUrl={node.imageDataUrl}
          props={mergedProps}
          intensity={node.intensity ?? 1.0}
          label={node.label}
          influences={influences}
        />
      );
    }

    if (node.type === 'cor') {
      return (
        <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
          <div 
            className={`w-6 h-6 rounded-full transition-all duration-300 ${isLiso ? '' : 'border border-white/10'} ${hotWobbleClass} ${frictionClass}`}
            style={{ 
              backgroundColor: finalColor,
              borderRadius: isQuente ? undefined : '50%'
            }}
          />
          <span className="text-[7.5px] font-mono text-[#fbf9f5]/40 lowercase tracking-wider">{node.label}</span>
        </div>
      );
    }

    // ELEMENTS
    if (node.label === 'água') {
      return (
        <svg className={`w-8 h-5 stroke-[#fbf9f5]/75 fill-none ${hotWobbleClass} ${frictionClass}`} viewBox="0 0 30 15">
          <path d="M0,3 Q7.5,0 15,3 T30,3 M0,8 Q7.5,5 15,8 T30,8 M0,13 Q7.5,10 15,13 T30,13" strokeWidth="0.75" stroke={finalColor} />
        </svg>
      );
    }
    if (node.label === 'fogo') {
      return (
        <svg className={`w-6 h-8 fill-none stroke-[#fbf9f5]/85 ${hotWobbleClass} ${frictionClass} ${isFrio ? '' : 'animate-pulse'}`} viewBox="0 0 20 30">
          <path d="M10,28 C15,22 18,15 15,8 C12,18 8,15 5,5 C2,16 5,22 10,28 Z" strokeWidth="0.75" stroke={finalColor} />
        </svg>
      );
    }
    if (node.label === 'ar') {
      return (
        <svg className={`w-8 h-8 stroke-[#fbf9f5]/55 fill-none ${hotWobbleClass} ${frictionClass}`} viewBox="0 0 30 30">
          <path d="M5,15 C5,8 12,5 18,8 C24,12 25,18 20,22 C15,25 10,22 10,18 C10,14 14,12 16,14" strokeWidth="0.75" stroke={finalColor} />
        </svg>
      );
    }
    if (node.label === 'terra') {
      return (
        <div 
          className={`w-5 h-7 border border-[#fbf9f5]/25 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] rotate-[25deg] ${hotWobbleClass} ${frictionClass}`}
          style={{ 
            backgroundColor: finalColor === '#fbf9f5' ? 'rgba(251, 249, 245, 0.15)' : finalColor,
          }}
        />
      );
    }

    // NATUREZA
    if (node.label === 'pedra') {
      return (
        <svg className={`w-7 h-7 stroke-[#fbf9f5]/60 fill-[#fbf9f5]/5 ${frictionClass}`} viewBox="0 0 24 24">
          <polygon points="6,20 2,10 10,2 20,6 18,20" strokeWidth="0.75" stroke={finalColor} />
        </svg>
      );
    }
    if (node.label === 'barro') {
      return (
        <div 
          className={`w-8 h-7 transition-all duration-300 ${hotWobbleClass} ${frictionClass}`}
          style={{ 
            borderRadius: isQuente ? undefined : '35% 65% 55% 45% / 45% 35% 65% 55%',
            backgroundColor: finalColor === '#fbf9f5' ? 'rgba(251, 249, 245, 0.2)' : finalColor,
            border: '1px solid rgba(251, 249, 245, 0.15)'
          }}
        />
      );
    }
    if (node.label === 'fumaça') {
      return (
        <div className={`relative w-8 h-8 flex items-center justify-center ${hotWobbleClass} ${frictionClass}`}>
          <div className="absolute w-5 h-5 bg-[#fbf9f5]/8 rounded-full blur-[2px] -translate-y-1" />
          <div className="absolute w-4 h-4 bg-[#fbf9f5]/6 rounded-full blur-[3px]" />
          <div className="absolute w-3 h-3 bg-[#fbf9f5]/40 rounded-full blur-[1px] translate-y-1" />
        </div>
      );
    }
    if (node.label === 'planta') {
      return (
        <svg className={`w-6 h-8 stroke-[#fbf9f5]/65 fill-none ${hotWobbleClass} ${frictionClass}`} viewBox="0 0 20 30">
          <line x1="10" y1="28" x2="10" y2="4" strokeWidth="0.75" />
          <path d="M10,18 Q16,14 16,10 M10,12 Q4,10 4,6" strokeWidth="0.75" />
        </svg>
      );
    }
    if (node.label === 'metal') {
      return (
        <div className={`w-8 h-4 flex flex-col gap-1 items-center justify-center ${frictionClass}`}>
          <div className="w-8 h-[1.25px] bg-white opacity-90 rotate-[-15deg] shadow-[0_0_4px_#fff]" />
          <div className="w-6 h-[0.75px] bg-white opacity-40 rotate-[-15deg]" />
        </div>
      );
    }
    if (node.label === 'névoa') {
      return <div className={`w-12 h-6 bg-[#fbf9f5]/8 blur-[4px] rounded-lg ${hotWobbleClass}`} />;
    }
    if (node.label === 'poeira') {
      return (
        <div className={`relative w-6 h-6 ${frictionClass}`}>
          <div className="absolute top-1 left-2 w-0.5 h-0.5 bg-[#fbf9f5]/70 rounded-full" />
          <div className="absolute top-4 left-1 w-[0.75px] h-[0.75px] bg-[#fbf9f5]/50 rounded-full" />
          <div className="absolute top-3 left-4 w-0.5 h-0.5 bg-[#fbf9f5]/60 rounded-full" />
          <div className="absolute top-2 left-5 w-[0.75px] h-[0.75px] bg-[#fbf9f5]/40 rounded-full" />
          <div className="absolute top-5 left-3 w-0.5 h-0.5 bg-[#fbf9f5]/80 rounded-full" />
        </div>
      );
    }
    if (node.label === 'sal') {
      return <div className={`w-2.5 h-2.5 border border-[#fbf9f5]/60 bg-[#fbf9f5]/15 rotate-45 shadow-[0_0_2px_rgba(251,249,245,0.4)] ${frictionClass}`} />;
    }
    if (node.label === 'ferrugem') {
      return (
        <div className={`w-6 h-6 rounded-md bg-[#b45309]/30 border border-[#b45309]/50 flex flex-wrap p-0.5 gap-0.5 ${frictionClass}`}>
          <div className="w-1 h-1 bg-[#fbbf24] rounded-full opacity-60" />
          <div className="w-1 h-1 bg-[#781a1a] rounded-full opacity-80" />
        </div>
      );
    }
    if (node.label === 'sangue') {
      return (
        <div 
          className={`w-3.5 h-5 bg-[#b8283e]/90 border border-white/5 shadow-[0_0_6px_rgba(184,40,62,0.3)] ${hotWobbleClass} ${frictionClass}`} 
          style={{ borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%' }}
        />
      );
    }
    if (node.label === 'ruína') {
      return (
        <svg className={`w-7 h-7 stroke-[#fbf9f5]/65 fill-none ${frictionClass}`} viewBox="0 0 24 24">
          <path d="M4,20 H20 M6,16 H14 M8,12 H11 M16,12 H18" strokeWidth="1" stroke={finalColor} />
          <line x1="5" y1="18" x2="5" y2="20" strokeWidth="1" stroke={finalColor} />
          <line x1="13" y1="14" x2="13" y2="16" strokeWidth="1" stroke={finalColor} />
          <rect x="15" y="16" width="3" height="4" strokeWidth="1" stroke={finalColor} fill="rgba(251, 249, 245, 0.1)" />
        </svg>
      );
    }

    // SOM
    if (node.type === 'som') {
      if (node.audioDataId) {
        const hasPeaks = node.audioPeaks && Array.isArray(node.audioPeaks) && node.audioPeaks.length > 0;
        const waveWidth = node.width ?? 120;
        let wavePath = `M 0,12 L ${waveWidth},12`;

        const isSelected = selectedNodeIds.includes(node.id);
        const pinkColor = '#ec4899';
        const cropStart = node.cropStart ?? 0;
        const duration = node.audioDuration ?? 1;
        const cropEnd = node.cropEnd ?? duration;
        const playhead = node.playhead ?? cropStart;

        if (hasPeaks) {
          const peaks = node.audioPeaks!;
          const startRatio = cropStart / duration;
          const endRatio = cropEnd / duration;
          const startIndex = Math.floor(startRatio * peaks.length);
          const endIndex = Math.ceil(endRatio * peaks.length);
          const croppedPeaks = peaks.slice(startIndex, endIndex);

          const h = 24;
          const step = waveWidth / Math.max(1, croppedPeaks.length);
          const mid = h / 2;
          let pD = "";
          croppedPeaks.forEach((p, idx) => {
            const x = idx * step;
            const val = Math.max(0.5, p * (mid - 1));
            pD += ` M ${x},${mid - val} L ${x},${mid + val}`;
          });
          wavePath = pD;
        }

        const progressRatio = (playhead - cropStart) / Math.max(0.001, cropEnd - cropStart);
        const playheadPx = Math.max(0, Math.min(waveWidth, progressRatio * waveWidth));

        // In cropped view, the boundaries correspond to the edges of the visible width
        const leftPx = 0;
        const rightPx = waveWidth;

        return (
          <div className="flex flex-col items-center gap-1 select-none font-mono pointer-events-auto relative">
            {/* Waveform graphic container */}
            <div 
              className="relative h-6 overflow-visible"
              style={{ width: `${waveWidth}px` }}
            >
              <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${waveWidth} 24`}>
                <defs>
                  <clipPath id={`clip-progress-${node.id}`}>
                    <rect x="0" y="0" width={Math.max(0, playheadPx)} height="24" />
                  </clipPath>
                </defs>
                {/* Background Waveform (Unplayed / Normal Color) */}
                <path
                  d={wavePath}
                  fill="none"
                  stroke={finalColor}
                  strokeWidth="1.25"
                  opacity="0.3"
                />
                {/* Foreground Waveform (Played Progress / Pink Color) */}
                <path
                  d={wavePath}
                  fill="none"
                  stroke={pinkColor}
                  strokeWidth="1.25"
                  clipPath={`url(#clip-progress-${node.id})`}
                  className={node.isPlaying ? 'animate-pulse' : undefined}
                />
              </svg>

              {/* Crop & Playhead Handles - rendered only when node is selected */}
              {isSelected && (
                <>
                  {/* Left Crop Handle */}
                  <div
                    onMouseDown={(e) => handleCropStartDrag(node.id, e)}
                    onTouchStart={(e) => handleCropStartDrag(node.id, e)}
                    className="absolute top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center animate-fade-in"
                    style={{ left: `${leftPx}px`, transform: 'translateX(-50%)' }}
                    title="Ajustar início do corte (arrastar esquerda/direita)"
                  >
                    <div className="w-[2px] h-full bg-[#ec4899] rounded-full shadow-[0_0_4px_rgba(236,72,153,0.5)]" />
                  </div>

                  {/* Right Crop Handle */}
                  <div
                    onMouseDown={(e) => handleCropEndDrag(node.id, e)}
                    onTouchStart={(e) => handleCropEndDrag(node.id, e)}
                    className="absolute top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center animate-fade-in"
                    style={{ left: `${rightPx}px`, transform: 'translateX(-50%)' }}
                    title="Ajustar fim do corte (arrastar esquerda/direita)"
                  >
                    <div className="w-[2px] h-full bg-[#ec4899] rounded-full shadow-[0_0_4px_rgba(236,72,153,0.5)]" />
                  </div>

                  {/* Playhead Handle */}
                  <div
                    onMouseDown={(e) => handlePlayheadDrag(node.id, e)}
                    onTouchStart={(e) => handlePlayheadDrag(node.id, e)}
                    className="absolute top-[-3px] bottom-0 w-2.5 cursor-grab active:cursor-grabbing z-25 flex flex-col items-center"
                    style={{ left: `${playheadPx}px`, transform: 'translateX(-50%)' }}
                    title="Arrastar cursor de reprodução"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white border border-[#ec4899] shadow-sm" />
                    <div className="w-[1px] flex-1 bg-white" />
                  </div>

                  {/* Lateral resize handle (Right edge) */}
                  <div
                    onMouseDown={(e) => handleResizeStart(node.id, e)}
                    onTouchStart={(e) => handleResizeStart(node.id, e)}
                    className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-2 h-5 cursor-ew-resize flex items-center justify-center group z-30"
                    title="Arrastar para ajustar largura da onda"
                  >
                    <div className="w-[2px] h-3 bg-white/40 group-hover:bg-[#ec4899] transition-colors rounded-full" />
                  </div>
                </>
              )}
            </div>
            
            {/* Controls panel: play/pause, loop, cut, download */}
            <div className="flex items-center justify-center gap-2.5 mt-0.5 text-[8px] select-none">
              <button 
                onClick={(e) => togglePlayAudioNode(node.id, e)}
                className="bg-transparent border-none text-[#fbf9f5]/55 hover:text-[#ec4899] p-0.5 cursor-pointer font-mono text-[9px] transition-colors"
                title={node.isPlaying ? "Pause" : "Play"}
              >
                {node.isPlaying ? "\u2016" : "\u25B6"}
              </button>

              <button 
                onClick={(e) => toggleLoopAudioNode(node.id, e)}
                className={`bg-transparent border-none p-0.5 cursor-pointer font-mono transition-colors text-[9px] ${
                  node.isLooping ? 'text-[#ec4899] font-bold' : 'text-[#fbf9f5]/35 hover:text-[#ec4899]'
                }`}
                title="Alternar Loop"
              >
                {"\u27F3"}
              </button>

              <button 
                onClick={(e) => splitAudioNode(node.id, e)}
                className="bg-transparent border-none text-[#fbf9f5]/35 hover:text-[#ec4899] p-0.5 cursor-pointer font-mono text-[8px] transition-colors"
                title="Cortar no meio"
              >
                {"\u2702"}
              </button>

              <button 
                onClick={(e) => downloadAlteredAudio(node.id, e)}
                className="bg-transparent border-none text-[#fbf9f5]/35 hover:text-[#ec4899] p-0.5 cursor-pointer font-mono text-[9px] transition-colors"
                title="Download Alterado"
              >
                {"\u2193"}
              </button>
            </div>
            <span className="text-[6.5px] text-[#fbf9f5]/35 tracking-wider lowercase max-w-[100px] truncate mt-0.5">{node.label}</span>
          </div>
        );
      }

      let waveD = "M 0,10 C 10,-2 15,22 25,10 C 35,-2 40,22 50,10";
      if (node.label === 'grave seco') waveD = "M 0,10 L 50,10 M 0,14 L 50,14";
      if (node.label === 'sopro') waveD = "M 0,5 Q 12.5,15 25,5 T 50,5";
      if (node.label === 'fricção') waveD = "M 0,10 L 5,5 L 10,15 L 15,5 L 20,15 L 25,5 L 30,15 L 35,5 L 40,15 L 45,5 L 50,10";
      if (node.label === 'ruído fino') waveD = "M 5,2 L 5,18 M 15,0 L 15,20 M 25,2 L 25,18 M 35,0 L 35,20 M 45,2 L 45,18";

      return (
        <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
          {node.label === 'silêncio ativo' ? (
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="w-1 h-1 bg-[#fbf9f5]/70 rounded-full" />
              <div className="absolute w-6 h-6 border border-dashed border-[#fbf9f5]/10 rounded-full animate-ping" style={{ animationDuration: '4s' }} />
            </div>
          ) : (
            <svg className={`w-10 h-5 overflow-visible ${frictionClass}`} viewBox="0 0 50 20">
              <path
                d={waveD}
                fill="none"
                stroke={finalColor}
                strokeWidth="0.75"
                className={node.label === 'grave seco' ? undefined : "animate-wave-flow"}
              />
            </svg>
          )}
          <span className="text-[7px] font-mono text-[#fbf9f5]/40 tracking-wider lowercase">{node.label}</span>
        </div>
      );
    }

    // TEXTURAS
    if (node.type === 'textura') {
      let lines = <path d="M 0,3 L 24,3 M 0,9 L 24,9 M 0,15 L 24,15 M 0,21 L 24,21 M 3,0 L 3,24 M 11,0 L 11,24 M 19,0 L 19,24" strokeWidth="0.5" />;
      if (node.label === 'áspera') lines = <path d="M0,0 L24,4 L0,8 L24,12 L0,16 L24,20" strokeWidth="0.5" />;
      if (node.label === 'lisa') lines = <line x1="0" y1="12" x2="24" y2="12" strokeWidth="0.75" />;
      if (node.label === 'porosa') lines = <circle cx="12" cy="12" r="8" strokeDasharray="1 2" strokeWidth="0.75" />;
      if (node.label === 'fibrosa') lines = <path d="M0,0 C6,12 18,12 24,24 M24,0 C18,12 6,12 0,24" strokeWidth="0.5" />;
      if (node.label === 'rachada') lines = <path d="M0,12 L8,8 L16,16 L24,12 M12,0 L8,8 M16,16 L12,24" strokeWidth="0.5" />;
      if (node.label === 'aveludada') lines = <path d="M0,10 C12,2 12,22 24,10 M0,14 C12,6 12,26 24,14" strokeWidth="0.5" />;
      if (node.label === 'granulada') lines = <path d="M2,2 L3,3 M12,4 L13,5 M20,2 L21,3 M6,12 L7,13 M18,14 L19,15 M10,20 L11,21" strokeWidth="1" />;
      if (node.label === 'úmida') lines = <path d="M6,4 Q6,8 8,10 M18,4 Q18,8 20,10 M12,12 Q12,16 14,18" strokeWidth="0.75" />;
      if (node.label === 'seca') lines = <path d="M0,0 L24,24 M24,0 L0,24 M0,12 L24,12 M12,0 L12,24" strokeWidth="0.25" />;

      const coldScaleClass = isFrio ? 'scale-[0.7] opacity-80' : '';

      return (
        <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
          <svg className={`w-8 h-8 stroke-[#fbf9f5]/50 fill-none transition-all duration-300 ${coldScaleClass} ${frictionClass}`} viewBox="0 0 24 24">
            {lines}
          </svg>
          <span className="text-[7px] font-mono text-[#fbf9f5]/40 lowercase">{node.label}</span>
        </div>
      );
    }

    let formattedLabel = node.label;
    if (node.type === 'atributo') {
      formattedLabel = `(${node.label})`;
    } else if (node.type === 'forca') {
      formattedLabel = `/${node.label}/`;
    } else if (node.type === 'operacao') {
      formattedLabel = `[${node.label}]`;
    } else if (node.type === 'relacao') {
      formattedLabel = `⟨${node.label}⟩`;
    } else if (node.type === 'encarnacao') {
      formattedLabel = `~${node.label}~`;
    } else if (node.type === 'temperamentos') {
      formattedLabel = `*${node.label}*`;
    } else if (node.type === 'emoAlegria' || node.type === 'emoTristeza' || node.type === 'emoRaiva' || node.type === 'emoMedo') {
      formattedLabel = `{${node.label}}`;
    }

    return (
      <span className="text-[9.5px] font-mono tracking-wider text-[#fbf9f5] lowercase">
        {formattedLabel}
      </span>
    );
  };

  return (
    <div 
      ref={containerRef}
      onDoubleClick={handleWorkspaceDoubleClick}
      onWheel={handleWheel}
      onMouseDown={handleWorkspaceMouseDown}
      onTouchStart={handleWorkspaceTouchStart}
      className={`absolute inset-0 w-full h-full select-none overflow-hidden bg-transparent ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <style>{`
        @keyframes wave-flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -20; }
        }
        .animate-wave-flow {
          stroke-dasharray: 4 2;
          animation: wave-flow 2.5s linear infinite;
        }
        .rough-edge {
          filter: url(#rough-filter);
        }
        .dust-fog {
          filter: blur(8px);
          animation: breathe-fog 6s ease-in-out infinite alternate;
        }
        @keyframes breathe-fog {
          0% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.95); }
          100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite alternate;
        }
        @keyframes pulse-slow {
          0% { opacity: 0.5; transform: scale(0.96); }
          100% { opacity: 0.9; transform: scale(1.04); }
        }
        @keyframes wobble-fluid {
          0% { border-radius: 42% 58% 30% 70% / 45% 45% 55% 55%; }
          50% { border-radius: 60% 40% 60% 40% / 50% 50% 50% 50%; }
          100% { border-radius: 42% 58% 30% 70% / 45% 45% 55% 55%; }
        }
        .animate-wobble-fluid {
          animation: wobble-fluid 3.5s ease-in-out infinite;
        }
        @keyframes shake-jitter {
          0% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-1px, -1px) rotate(-0.5deg); }
          20% { transform: translate(1px, 0px) rotate(0.5deg); }
          30% { transform: translate(0px, 1px) rotate(0deg); }
          40% { transform: translate(-1px, -1px) rotate(0.5deg); }
          50% { transform: translate(1px, 1px) rotate(-0.5deg); }
          60% { transform: translate(-1px, 0px) rotate(0deg); }
          70% { transform: translate(0px, -1px) rotate(0.5deg); }
          80% { transform: translate(1px, 1px) rotate(-0.5deg); }
          90% { transform: translate(-1px, 1px) rotate(0deg); }
        }
        .animate-shake-jitter {
          animation: shake-jitter 0.4s linear infinite;
        }
      `}</style>

      {/* SVG Filters for ASPEO (rough edge) attribute */}
      <svg className="hidden">
        <defs>
          <filter id="rough-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>



      {/* Main Canvas Viewport */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)'
        }}
      >
        {/* Subtle coordinate alignment axes */}
        {nodes.map((nodeA, idxA) => {
          return nodes.slice(idxA + 1).map((nodeB) => {
            const isXAligned = Math.abs(nodeA.x - nodeB.x) < 6;
            const isYAligned = Math.abs(nodeA.y - nodeB.y) < 6;
            if (isXAligned || isYAligned) {
              return (
                <svg key={`align-${nodeA.id}-${nodeB.id}`} className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {isXAligned && (
                    <line
                      x1={nodeA.x}
                      y1={80}
                      x2={nodeA.x}
                      y2="calc(100% - 80px)"
                      stroke="rgba(251, 249, 245, 0.03)"
                      strokeDasharray="2 4"
                      strokeWidth="0.5"
                    />
                  )}
                  {isYAligned && (
                    <line
                      x1={80}
                      y1={nodeA.y}
                      x2="calc(100% - 80px)"
                      y2={nodeA.y}
                      stroke="rgba(251, 249, 245, 0.03)"
                      strokeDasharray="2 4"
                      strokeWidth="0.5"
                    />
                  )}
                </svg>
              );
            }
            return null;
          });
        })}

        {/* Relationship and Force connection bridges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {nodes.map(node => {
            const isModifier = ['relacao', 'forca', 'operacao', 'encarnacao', 'atributo', 'temperamentos', 'emoAlegria', 'emoTristeza', 'emoRaiva', 'emoMedo'].includes(node.type);
            if (!isModifier) return null;

            // Find closest neighbor node (that is NOT itself)
            let closestNode: CanvasNode | null = null;
            let minDistance = 150; // max influence radius
            for (const other of nodes) {
              if (other.id === node.id) continue;
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDistance) {
                minDistance = dist;
                closestNode = other;
              }
            }

            if (!closestNode) return null;

            // Draw a connection bridge line
            return (
              <g key={`bridge-${node.id}-${closestNode.id}`}>
                <line
                  x1={node.x}
                  y1={node.y}
                  x2={closestNode.x}
                  y2={closestNode.y}
                  stroke="rgba(251, 249, 245, 0.12)"
                  strokeDasharray="2 3"
                  strokeWidth="0.75"
                />
                <circle
                  cx={(node.x + closestNode.x) / 2}
                  cy={(node.y + closestNode.y) / 2}
                  r="2"
                  fill="#fbf9f5"
                  className="animate-pulse"
                  style={{ opacity: 0.5 }}
                />
              </g>
            );
          })}
        </svg>

        {/* Interference zones in space (Fuzzy third conditions) */}
        {computedRelations.interferenceZones.map((zone: any, idx: number) => (
          <div
            key={`interfere-${idx}`}
            className="absolute pointer-events-none select-none flex flex-col items-center justify-center mix-blend-screen"
            style={{
              left: zone.x,
              top: zone.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div 
              className="rounded-full bg-[#fbf9f5]/4 dust-fog"
              style={{
                width: zone.size * 1.5,
                height: zone.size * 1.5,
              }}
            />
            <div className="absolute flex flex-col items-center">
              <span className="text-[6px] font-mono tracking-[0.2em] text-[#fbf9f5]/35 uppercase">
                {zone.labelA} × {zone.labelB}
              </span>
            </div>
          </div>
        ))}
        {/* Matter Rendering (Boundaryless elements) */}
        {nodes.map(node => {
          const rawMod = computedRelations.activeModulations.get(node.id);
          const mod = rawMod ? {
            ...rawMod,
            quente: (rawMod.warmth ?? 0.0) > 0.1 || !!rawMod.quente,
            frio: (rawMod.coldness ?? 0.0) > 0.1 || !!rawMod.frio,
            aspero: (rawMod.roughness ?? 0.0) > 0.1 || !!rawMod.aspero,
            liso: (rawMod.softness ?? 0.0) > 0.1 || !!rawMod.liso,
            denso: (rawMod.density ?? 0.0) > 0.1 || !!rawMod.denso,
            etéreo: (rawMod.etéreo ?? 0.0) > 0.1 || !!rawMod.etéreo,
            sagrado: (rawMod.sagrado ?? 0.0) > 0.1 || !!rawMod.sagrado,
            erotico: (rawMod.erotico ?? 0.0) > 0.1 || !!rawMod.erotico,
            infantil: (rawMod.infantil ?? 0.0) > 0.1 || !!rawMod.infantil,
            translucido: (rawMod.transparency ?? 0.0) > 0.1 || !!rawMod.translucido,
            eco: (rawMod.eco ?? 0.0) > 0.1 || !!rawMod.eco,
            friccao: (rawMod.friction ?? 0.0) > 0.1 || !!rawMod.friccao
          } : null;
          const isQuente = mod?.quente ?? false;
          const isFrio = mod?.frio ?? false;
          const isAspero = mod?.aspero ?? false;
          const isLiso = mod?.liso ?? false;
          const isDenso = mod?.denso ?? false;
          const isEtereo = mod?.etéreo ?? false;
          const isSagrado = mod?.sagrado ?? false;
          const isErotico = mod?.erotico ?? false;
          const isInfantil = mod?.infantil ?? false;
          const isTranslucido = mod?.translucido ?? false;
          const isEco = mod?.eco ?? false;
          const isFriccao = mod?.friccao ?? false;
          const contaminatedColor = (semioticGrammarEnabled ? computedRelations.contaminatedColors.get(node.id) : mod?.contaminacaoCor) ?? null;
          const nodeIntensity = node.intensity ?? 1.0;

          let scale = nodeIntensity;
          if (isDenso) scale *= 0.75;
          if (isEtereo) scale *= 1.25;

          const isSelected = selectedNodeIds.includes(node.id);
          if (isSelected) scale *= 1.15;

          let nodeOpacity = 0.85;
          if (isEtereo) nodeOpacity = 0.4;
          if (isTranslucido) nodeOpacity = 0.15;
          if (isDenso) nodeOpacity = 1.0;

          // Boundary dynamic blur
          const screenMarginX = 24;
          const screenMarginY = 24;
          const physicalX = (node.x - dimensions.width / 2) * zoom + dimensions.width / 2 + panX;
          const physicalY = (node.y - dimensions.height / 2) * zoom + dimensions.height / 2 + panY;
          const distLeft = physicalX - screenMarginX;
          const distRight = (dimensions.width - screenMarginX) - physicalX;
          const distTop = physicalY - screenMarginY;
          const distBottom = (dimensions.height - screenMarginY) - physicalY;
          const minDistance = Math.min(distLeft, distRight, distTop, distBottom);

          let boundaryBlur = 0;
          if (minDistance < 20) {
            const ratio = 1 - Math.max(0, minDistance) / 20;
            boundaryBlur = ratio * 6; // Max 6px blur at very outer edge
          }

          let shadowStyle: React.CSSProperties = {};
          let filterString = '';
          if (isQuente) filterString += 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.35)) ';
          if (isFrio) filterString += 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.35)) ';
          if (boundaryBlur > 0) filterString += `blur(${boundaryBlur}px) `;

          if (filterString) {
            shadowStyle = { filter: filterString };
          }

          // Visual decorations for modulations
          const extraDecorations = [];
          if (isSagrado) {
            extraDecorations.push(
              <div key="sagrado-halo" className="absolute -inset-2 border-y border-[#fbbf24]/20 animate-pulse rounded-full" />
            );
          }
          if (isErotico) {
            extraDecorations.push(
              <div key="erotico-pulse" className="absolute -inset-1.5 border border-[#ec4899]/15 animate-pulse-slow rounded-full" />
            );
          }
          if (isInfantil) {
            extraDecorations.push(
              <div key="infantil-circle" className="absolute w-2 h-2 rounded-full border border-[#fbf9f5]/10 animate-bounce -top-3" />
            );
          }
          if (isEco) {
            extraDecorations.push(
              <div key="eco-ring-1" className="absolute -inset-4 border border-[#fbf9f5]/5 rounded-full animate-ping" style={{ animationDuration: '3.5s' }} />
            );
          }

          // Coupled halo decoration (if this is a host core node with snapped children)
          const isCoreNode = node.type === 'elementos' || node.type === 'natureza' || node.type === 'cor' || node.type === 'som';
          const coupledChildrenCount = isCoreNode ? nodes.filter(n => n.snappedToId === node.id).length : 0;
          if (coupledChildrenCount > 0) {
            extraDecorations.push(
              <div 
                key="coupled-halo" 
                className="absolute -inset-4 border border-dashed border-[#fbf9f5]/10 rounded-full animate-pulse pointer-events-none"
                style={{ animationDuration: '4s' }}
              />
            );
          }

          const isHovered = hoveredNodeId === node.id;

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleDragStart(node.id, e)}
              onTouchStart={(e) => handleDragStart(node.id, e)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              className={`canvas-node absolute z-20 select-none cursor-grab active:cursor-grabbing origin-center transition-all duration-300 ease-out ${
                node.isDragging ? 'z-30' : ''
              }`}
              style={{
                left: node.x,
                top: node.y,
                transform: `translate(-50%, -50%) scale(${scale})`,
                opacity: nodeOpacity,
                ...shadowStyle
              }}
            >
              {editingId === node.id ? (
                <input
                  type="text"
                  defaultValue={node.label}
                  autoFocus
                  onBlur={(e) => finishEditing(node.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishEditing(node.id, e.currentTarget.value);
                  }}
                  className="bg-transparent border-b border-[#fbf9f5]/25 text-[11px] text-white outline-none font-sans lowercase text-center tracking-wider max-w-[150px]"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div 
                  className={`flex flex-col items-center relative p-2 ${isAspero ? 'rough-edge' : ''}`}
                >
                  {isHovered && !node.isDragging && (
                    <>
                      <button
                        onClick={(e) => deleteNode(node.id, e)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="absolute -top-1 -right-1 text-[8px] font-mono text-[#fbf9f5]/30 hover:text-[#b8283e] cursor-pointer border-none bg-transparent outline-none py-0 px-1"
                        title="Deletar módulo"
                      >
                        [✕]
                      </button>
                      {(node.type === 'som' || node.type === 'imagem') && (
                        <div 
                          className="absolute right-[-18px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 pointer-events-auto z-40 cursor-ns-resize"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            resumeAudio();
                            const barRect = e.currentTarget.getBoundingClientRect();
                            const handleMove = (moveEvent: MouseEvent) => {
                              const clientY = moveEvent.clientY;
                              const ratio = Math.min(1, Math.max(0, 1 - (clientY - barRect.top) / barRect.height));
                              const nextVolume = ratio * 1.5; // Scale to 0% - 150%
                              setNodes(prev => prev.map(n => n.id === node.id ? { ...n, intensity: nextVolume } : n));
                            };
                            const handleEnd = () => {
                              window.removeEventListener('mousemove', handleMove);
                              window.removeEventListener('mouseup', handleEnd);
                            };
                            window.addEventListener('mousemove', handleMove);
                            window.addEventListener('mouseup', handleEnd);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            resumeAudio();
                            const barRect = e.currentTarget.getBoundingClientRect();
                            const handleMove = (moveEvent: TouchEvent) => {
                              const clientY = moveEvent.touches[0].clientY;
                              const ratio = Math.min(1, Math.max(0, 1 - (clientY - barRect.top) / barRect.height));
                              const nextVolume = ratio * 1.5; // Scale to 0% - 150%
                              setNodes(prev => prev.map(n => n.id === node.id ? { ...n, intensity: nextVolume } : n));
                            };
                            const handleEnd = () => {
                              window.removeEventListener('touchmove', handleMove);
                              window.removeEventListener('touchend', handleEnd);
                            };
                            window.addEventListener('touchmove', handleMove, { passive: false });
                            window.addEventListener('touchend', handleEnd);
                          }}
                          title={node.type === 'som' ? "Ajustar Volume do Módulo" : "Ajustar Intensidade da Transmutação"}
                        >
                          <div className="w-1 h-8 bg-[#fbf9f5]/15 relative rounded-full overflow-hidden border border-[#fbf9f5]/10">
                            <div 
                              className="absolute bottom-0 w-full bg-[#fbf9f5]/70 transition-all duration-75"
                              style={{ height: `${((node.intensity ?? 1.0) / 1.5) * 100}%` }}
                            />
                          </div>
                          <span className="text-[5px] font-mono text-[#fbf9f5]/35">{Math.round((node.intensity ?? 1.0) * 100)}%</span>
                        </div>
                      )}
                    </>
                  )}

                  {extraDecorations}

                  {renderNodeGraphics(
                    node,
                    isQuente,
                    isFrio,
                    isAspero,
                    isLiso,
                    isDenso,
                    isEtereo,
                    isSagrado,
                    isErotico,
                    isInfantil,
                    isTranslucido,
                    isEco,
                    isFriccao,
                    contaminatedColor
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ──────────────── ACTIVE MARGINS (Restructured strictly to Left and Right layouts) ──────────────── */}

      {/* LEFT ZONE MENUS */}
      <div className="absolute left-[280px] top-1/2 -translate-y-1/2 flex flex-col gap-8 z-30 select-none items-start pointer-events-none">
        <button 
          onClick={(e) => openSummonPopover('materias', e)}
          className="text-[7.5px] font-mono tracking-[0.3em] text-[#fbf9f5]/30 hover:text-white uppercase bg-transparent border-none outline-none cursor-pointer py-1 transition-colors pointer-events-auto"
        >
          [matérias]
        </button>
        <button 
          onClick={(e) => openSummonPopover('atributos', e)}
          className="text-[7.5px] font-mono tracking-[0.3em] text-[#fbf9f5]/30 hover:text-white uppercase bg-transparent border-none outline-none cursor-pointer py-1 transition-colors pointer-events-auto"
        >
          [atributos]
        </button>
        <button 
          onClick={(e) => openSummonPopover('relações', e)}
          className="text-[7.5px] font-mono tracking-[0.3em] text-[#fbf9f5]/30 hover:text-white uppercase bg-transparent border-none outline-none cursor-pointer py-1 transition-colors pointer-events-auto"
        >
          [relações]
        </button>
        <button 
          onClick={(e) => openSummonPopover('emoções', e)}
          className="text-[7.5px] font-mono tracking-[0.3em] text-[#fbf9f5]/30 hover:text-white uppercase bg-transparent border-none outline-none cursor-pointer py-1 transition-colors pointer-events-auto"
        >
          [emoções]
        </button>
        <button 
          onClick={(e) => openSummonPopover('forcas', e)}
          className="text-[7.5px] font-mono tracking-[0.3em] text-[#fbf9f5]/30 hover:text-white uppercase bg-transparent border-none outline-none cursor-pointer py-1 transition-colors pointer-events-auto"
        >
          [forças]
        </button>
        <button 
          onClick={(e) => openSummonPopover('encarnações', e)}
          className="text-[7.5px] font-mono tracking-[0.3em] text-[#fbf9f5]/30 hover:text-white uppercase bg-transparent border-none outline-none cursor-pointer py-1 transition-colors pointer-events-auto"
        >
          [encarnações]
        </button>
        <button 
          onClick={(e) => openSummonPopover('temperamentos', e)}
          className="text-[7.5px] font-mono tracking-[0.3em] text-[#fbf9f5]/30 hover:text-white uppercase bg-transparent border-none outline-none cursor-pointer py-1 transition-colors pointer-events-auto"
        >
          [temperamentos]
        </button>
      </div>

      {/* Summoning Popover */}
      {summonPosition && (
        <div 
          className="summon-popover fixed bg-black/90 backdrop-blur-xl border border-[#fbf9f5]/10 p-4 rounded-xl shadow-2xl z-50 w-64 max-h-[350px] overflow-y-auto no-scrollbar font-mono text-[9.5px] lowercase animate-fade-in"
          style={{
            left: summonPosition.clientX,
            top: summonPosition.clientY,
          }}
          onMouseLeave={() => setSummonPosition(null)}
        >
          <div className="flex justify-between items-center mb-3 border-b border-[#fbf9f5]/10 pb-1.5">
            <span className="text-[#fbf9f5]/40 font-bold uppercase text-[7.5px] tracking-wider">
              {summonPosition.category === 'todos' ? '[invocar módulo]' : `[${summonPosition.category}]`}
            </span>
            <button 
              onClick={() => setSummonPosition(null)} 
              className="text-[#fbf9f5]/30 hover:text-white bg-transparent border-none outline-none cursor-pointer font-sans"
            >
              [✕]
            </button>
          </div>
          
          <div className="space-y-3">
            {(summonPosition.category === 'todos' || summonPosition.category === 'materias') && (
              <div className="space-y-3">
                {/* SOM */}
                <div>
                  <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">som</span>
                  <div className="flex flex-wrap gap-1">
                    {FAMILIES_MATERIAS.som.map(item => (
                      <button
                        key={item.label}
                        onClick={() => spawnNode(item.label, 'som')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* IMAGEM */}
                <div>
                  <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">imagem</span>
                  <div className="flex flex-wrap gap-1">
                    {FAMILIES_MATERIAS.imagem?.map(item => (
                      <button
                        key={item.label}
                        onClick={() => spawnNode(item.label, 'imagem')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TEXTURA */}
                <div>
                  <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">textura</span>
                  <div className="flex flex-wrap gap-1">
                    {FAMILIES_MATERIAS.textura.map(item => (
                      <button
                        key={item.label}
                        onClick={() => spawnNode(item.label, 'textura')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* COR */}
                <div>
                  <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">cor</span>
                  <div className="flex flex-wrap gap-1">
                    {FAMILIES_MATERIAS.cor.map(item => (
                      <button
                        key={item.label}
                        onClick={() => spawnNode(item.label, 'cor', item.colorValue)}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* NATUREZA */}
                <div>
                  <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">natureza</span>
                  <div className="flex flex-wrap gap-1">
                    {FAMILIES_MATERIAS.natureza.map(item => (
                      <button
                        key={item.label}
                        onClick={() => spawnNode(item.label, 'natureza')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ELEMENTOS */}
                <div>
                  <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">elementos</span>
                  <div className="flex flex-wrap gap-1">
                    {FAMILIES_MATERIAS.elementos.map(item => (
                      <button
                        key={item.label}
                        onClick={() => spawnNode(item.label, 'elementos')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(summonPosition.category === 'todos' || summonPosition.category === 'atributos') && (
              <div>
                {summonPosition.category === 'todos' && <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">atributos</span>}
                <div className="flex flex-wrap gap-1">
                  {RESERVOIR_ATRIBUTOS.map(attr => (
                    <button
                      key={attr}
                      onClick={() => spawnNode(attr, 'atributo')}
                      className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                    >
                      {attr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(summonPosition.category === 'todos' || summonPosition.category === 'forcas') && (
              <div>
                {summonPosition.category === 'todos' && <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">forças</span>}
                <div className="flex flex-wrap gap-1">
                  {RESERVOIR_FORCAS.map(force => (
                    <button
                      key={force}
                      onClick={() => spawnNode(force, 'forca')}
                      className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                    >
                      {force}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(summonPosition.category === 'todos' || summonPosition.category === 'temperamentos') && (
              <div>
                <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">temperamentos</span>
                <div className="flex flex-wrap gap-1">
                  {FAMILIES_MATERIAS.temperamentos.map(item => (
                    <button
                      key={item.label}
                      onClick={() => spawnNode(item.label, 'temperamentos')}
                      className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(summonPosition.category === 'todos' || summonPosition.category === 'relações') && (
              <div>
                {summonPosition.category === 'todos' && <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">relações</span>}
                <div className="flex flex-wrap gap-1">
                  {RESERVOIR_RELACOES.map(rel => (
                    <button
                      key={rel}
                      onClick={() => spawnNode(rel, 'relacao')}
                      className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                    >
                      ⟨{rel}⟩
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(summonPosition.category === 'todos' || summonPosition.category === 'encarnações') && (
              <div>
                {summonPosition.category === 'todos' && <span className="text-[#fbf9f5]/35 font-bold uppercase text-[6px] tracking-widest block mb-1">encarnações</span>}
                <div className="flex flex-wrap gap-1">
                  {RESERVOIR_ENCARNACOES.map(enc => (
                    <button
                      key={enc}
                      onClick={() => spawnNode(enc, 'encarnacao')}
                      className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                    >
                      {enc}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(summonPosition.category === 'todos' || summonPosition.category === 'emoções') && (
              <div className="space-y-2">
                {/* ALEGRIA */}
                <div>
                  <span className="text-[#ef4444]/60 font-bold uppercase text-[6px] tracking-widest block mb-0.5">alegria</span>
                  <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                    {RESERVOIR_EMOCOES.alegria.map(emo => (
                      <button
                        key={emo}
                        onClick={() => spawnNode(emo, 'emoAlegria')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TRISTEZA */}
                <div>
                  <span className="text-[#3b82f6]/60 font-bold uppercase text-[6px] tracking-widest block mb-0.5">tristeza</span>
                  <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                    {RESERVOIR_EMOCOES.tristeza.map(emo => (
                      <button
                        key={emo}
                        onClick={() => spawnNode(emo, 'emoTristeza')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* RAIVA */}
                <div>
                  <span className="text-[#781a1a]/70 font-bold uppercase text-[6px] tracking-widest block mb-0.5">raiva</span>
                  <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                    {RESERVOIR_EMOCOES.raiva.map(emo => (
                      <button
                        key={emo}
                        onClick={() => spawnNode(emo, 'emoRaiva')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MEDO */}
                <div>
                  <span className="text-[#6b7280]/70 font-bold uppercase text-[6px] tracking-widest block mb-0.5">medo</span>
                  <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                    {RESERVOIR_EMOCOES.medo.map(emo => (
                      <button
                        key={emo}
                        onClick={() => spawnNode(emo, 'emoMedo')}
                        className="px-1.5 py-0.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/15 text-white/70 hover:text-white rounded border border-[#fbf9f5]/5 cursor-pointer lowercase"
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sensory controls & Active notes */}
      <div className="absolute bottom-6 left-[280px] flex items-center gap-6 pointer-events-auto z-10 text-[9.5px] font-mono tracking-widest text-[#fbf9f5]/20 lowercase">
        <button 
          onClick={toggleMute}
          className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
        >
          [ som: {isMuted ? 'mutado' : 'ativo'} ]
        </button>
        <div className="flex items-center gap-2 text-[#fbf9f5]/35 text-[9.5px]">
          <span>vol:</span>
          <input 
            type="range" 
            min="0" 
            max="6" 
            step="0.1" 
            value={masterVolume} 
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setMasterVolume(val);
              if (val > 0 && isMuted) {
                setIsMuted(false);
                const engine = getAudioEngine();
                if (engine) engine.mute(false);
              }
            }}
            className="w-16 h-1 bg-[#fbf9f5]/10 rounded-lg appearance-none cursor-pointer accent-white pointer-events-auto"
          />
          <span className="text-[#fbf9f5]/55 w-6 text-right">{Math.round((masterVolume / 3.8) * 100)}%</span>
        </div>
        <button 
          onClick={() => setZoom(1.0)}
          className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
          title="Resetar escala"
        >
          [ zoom: {Math.round(zoom * 100)}% ]
        </button>
        <button 
          onClick={() => setOctaveOffset(0)}
          className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
          title="Resetar oitava (Z/X para alterar)"
        >
          [ oitava: {octaveOffset > 0 ? `+${octaveOffset}` : octaveOffset} ]
        </button>
        <button 
          onClick={() => {
            setGlobalPitchMultipliers([1.0]);
            setActiveNoteName("dó (c4)");
            const engine = getAudioEngine();
            if (engine) engine.setGlobalPitchMultipliers([1.0]);
          }}
          className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
          title="Resetar tom para Dó"
        >
          [ tom: {activeNoteName} ]
        </button>
      </div>

      {/* Floating Collapsible Workspace Menu (Top-Right) */}
      <div className="absolute top-20 right-6 flex flex-col items-end gap-1.5 z-40 text-[9.5px] font-mono tracking-widest text-[#fbf9f5]/35 lowercase pointer-events-none">
        <button
          onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
          className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white pointer-events-auto cursor-pointer outline-none font-mono py-1 px-2 text-[9.5px]"
          title="Abrir/Fechar menu de mesa"
        >
          [ gerenciar mesa {isWorkspaceMenuOpen ? '▲' : '▼'} ]
        </button>
        
        {isWorkspaceMenuOpen && (
          <div className="flex flex-col items-end gap-2.5 mt-2 pl-4 pointer-events-auto select-none">
            {/* Mesa/Board Actions */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[#fbf9f5]/15 text-[6.5px] tracking-widest uppercase mb-0.5">mesa</span>
              <button 
                onClick={handleNewMesa}
                className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
              >
                [ novo ]
              </button>

              {isSaving ? (
                <div className="flex items-center gap-1 font-mono text-[9.5px] text-[#fbf9f5]/55">
                  <span>nome:</span>
                  <input
                    type="text"
                    placeholder="mesa..."
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveMesa(saveName);
                      if (e.key === 'Escape') setIsSaving(false);
                    }}
                    className="bg-transparent border-b border-[#fbf9f5]/25 text-[9.5px] text-white outline-none font-mono lowercase w-16"
                    autoFocus
                  />
                  <button 
                    onClick={() => handleSaveMesa(saveName)}
                    className="border-none bg-transparent text-white/70 hover:text-white cursor-pointer font-mono py-0 px-1 text-[9.5px]"
                  >
                    ✓
                  </button>
                  <button 
                    onClick={() => setIsSaving(false)}
                    className="border-none bg-transparent text-[#b8283e] cursor-pointer font-mono py-0 px-1 text-[9.5px]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsSaving(true)}
                  className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
                >
                  [ salvar ]
                </button>
              )}

              <div className="relative">
                <button 
                  onClick={() => setIsOpenMenu(!isOpenMenu)}
                  className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
                >
                  [ abrir: {Object.keys(savedMesas).length} ]
                </button>
                {isOpenMenu && Object.keys(savedMesas).length > 0 && (
                  <div className="absolute right-0 top-5 bg-[#141210]/95 border border-[#fbf9f5]/15 p-2 rounded flex flex-col gap-1 z-40 max-h-[120px] overflow-y-auto custom-scrollbar min-w-[80px]">
                    {Object.keys(savedMesas).map(name => (
                      <button
                        key={name}
                        onClick={() => handleOpenMesa(name)}
                        className="text-[9px] font-mono text-right bg-transparent hover:bg-[#fbf9f5]/10 text-white/70 hover:text-white border-none py-0.5 px-1 cursor-pointer lowercase"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[#fbf9f5]/15 text-[6.5px] tracking-widest uppercase mb-0.5">exportar</span>
              <button 
                onClick={downloadFullMixdown}
                className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-[#ec4899] cursor-pointer outline-none font-mono py-0 px-1 transition-colors text-[9.5px]"
                title="Baixar mixagem de todos os sons ativos"
              >
                [ mixar mesa ]
              </button>

              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/tabela_de_atuacao.md';
                  link.download = 'tabela_de_atuacao.md';
                  link.click();
                }}
                className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
                title="Baixar a tabela de atuação semiótica completa"
              >
                [ download atuação ]
              </button>
            </div>

            {/* Add Files */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[#fbf9f5]/15 text-[6.5px] tracking-widest uppercase mb-0.5">carregar arquivos</span>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.style.display = 'none';
                  document.body.appendChild(input);
                  input.onchange = async (event) => {
                    const files = (event.target as HTMLInputElement).files;
                    if (!files) {
                      document.body.removeChild(input);
                      return;
                    }
                    const container = containerRef.current;
                    const rect = container?.getBoundingClientRect();
                    const spawnX = rect ? -panX / zoom + rect.width / 2 : 100;
                    const spawnY = rect ? -panY / zoom + rect.height / 2 : 100;
                    
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      const reader = new FileReader();
                      reader.onload = async (readerEvent) => {
                        const dataUrl = readerEvent.target?.result as string;
                        if (!dataUrl) return;
                        const newId = `img-${Date.now()}-${i}`;
                        await saveImageIDB(newId, dataUrl);
                        
                        const newNode: CanvasNode = {
                          id: newId,
                          label: file.name.split('.')[0] || 'imagem',
                          x: spawnX + (i * 20),
                          y: spawnY + (i * 20),
                          vx: 0,
                          vy: 0,
                          type: 'imagem',
                          imageDataId: newId,
                          imageDataUrl: dataUrl,
                          intensity: 1.0
                        };
                        setNodes(prev => [...prev, newNode]);
                      };
                      reader.readAsDataURL(file);
                    }
                    document.body.removeChild(input);
                  };
                  input.click();
                }}
                className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
                title="Importar imagens para o campo"
              >
                [ + imagem ]
              </button>

              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'audio/*';
                  input.multiple = true;
                  input.style.display = 'none';
                  document.body.appendChild(input);
                  input.onchange = async (event) => {
                    const files = (event.target as HTMLInputElement).files;
                    if (!files) {
                      document.body.removeChild(input);
                      return;
                    }
                    const container = containerRef.current;
                    const rect = container?.getBoundingClientRect();
                    const spawnX = rect ? -panX / zoom + rect.width / 2 : 100;
                    const spawnY = rect ? -panY / zoom + rect.height / 2 : 100;
                    
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      try {
                        const record = await processUploadedAudio(file);
                        await saveAudioIDB(record);
                        
                        const arrayBuffer = dataURItoArrayBuffer(record.dataUrl);
                        const engine = getAudioEngine();
                        const mainCtx = engine ? engine.getAudioContext() : null;
                        let decoded: AudioBuffer;
                        if (mainCtx) {
                          decoded = await mainCtx.decodeAudioData(arrayBuffer);
                        } else {
                          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                          const tempCtx = new AudioContextClass();
                          decoded = await tempCtx.decodeAudioData(arrayBuffer);
                          tempCtx.close();
                        }
                        audioBuffersRef.current.set(record.id, decoded);
                        
                        const newNode: CanvasNode = {
                          id: record.id,
                          label: record.name,
                          x: spawnX + (i * 20),
                          y: spawnY + (i * 20),
                          vx: 0,
                          vy: 0,
                          type: 'som',
                          audioDataId: record.id,
                          audioDataUrl: record.dataUrl,
                          audioDuration: record.duration,
                          audioPeaks: record.peaks,
                          isPlaying: false,
                          isLooping: true,
                          cropStart: 0,
                          cropEnd: record.duration,
                          playhead: 0,
                          intensity: 1.0
                        };
                        setNodes(prev => [...prev, newNode]);
                        setAudioEnabled(true);
                      } catch (err) {
                        console.error("Erro no processamento do áudio V2:", err);
                      }
                    }
                    document.body.removeChild(input);
                  };
                  input.click();
                }}
                className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-white cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
                title="Importar áudios customizados para manipulação"
              >
                [ + áudio ]
              </button>
            </div>

            {/* Clear/Reset Actions */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[#fbf9f5]/15 text-[6.5px] tracking-widest uppercase mb-0.5">limpar</span>
              <button
                onClick={() => {
                  if (window.confirm("Remover todas as imagens do campo?")) {
                    setNodes(prev => prev.filter(n => n.type !== 'imagem'));
                  }
                }}
                className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-[#b8283e] cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
                title="Remover todas as imagens do campo"
              >
                [ limpar imagens ]
              </button>

              <button
                onClick={() => {
                  if (window.confirm("Limpar toda a mesa de atuação?")) {
                    setNodes([]);
                  }
                }}
                className="border-none bg-transparent text-[#fbf9f5]/35 hover:text-[#b8283e] cursor-pointer outline-none font-mono py-0 px-1 text-[9.5px]"
                title="Limpar todos os elementos da mesa"
              >
                [ limpar mesa ]
              </button>
            </div>

            {/* Info Status */}
            <div className="text-[7.5px] text-[#fbf9f5]/15 select-none pt-1 border-t border-[#fbf9f5]/5 text-right w-full">
              imagens: {nodes.filter(n => n.type === 'imagem').length} | áudios: {nodes.filter(n => n.type === 'som' && n.audioDataId).length}
            </div>
          </div>
        )}
      </div>

      {/* Floating Semiotic Debug Panel */}
      {selectedNodeId && nodes.find(n => n.id === selectedNodeId)?.type === 'imagem' && (
        <div className="fixed top-24 right-4 bg-black/95 backdrop-blur-xl border border-[#fbf9f5]/15 p-4 rounded-xl shadow-2xl z-40 w-64 font-mono text-[9px] lowercase pointer-events-auto">
          <div className="flex justify-between items-center mb-3 border-b border-[#fbf9f5]/10 pb-1.5 text-[7px] tracking-wider uppercase">
            <span className="text-[#fbf9f5]/50 font-bold">[depuração visual: {nodes.find(n => n.id === selectedNodeId)?.label}]</span>
            <button 
              onClick={() => {
                setDebugOverrides(prev => {
                  const copy = { ...prev };
                  delete copy[selectedNodeId];
                  return copy;
                });
              }}
              className="text-[#fbf9f5]/30 hover:text-white bg-transparent border-none outline-none cursor-pointer"
            >
              [limpar]
            </button>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'liquidWarp (água)', key: 'liquidWarp' },
              { label: 'chromaticAberration (fogo)', key: 'chromaticAberration' },
              { label: 'pixelSort (colérico/pânico)', key: 'pixelSort' },
              { label: 'threshold (contraste/vazio)', key: 'threshold' },
              { label: 'trama (áspero/poeira)', key: 'halftoneIntensity' },
              { label: 'dispersão (etéreo/névoa)', key: 'etéreo' },
              { label: 'ascii (densidade/bruto)', key: 'density' },
              { label: 'scanlines (medo/ruína)', key: 'fear' }
            ].map(slider => {
              const nodeOverrides = debugOverrides[selectedNodeId] || {};
              const currentVal = (nodeOverrides as any)[slider.key] ?? (computedRelations.activeModulations.get(selectedNodeId) as any)?.[slider.key] ?? 0;
              return (
                <div key={slider.key} className="space-y-1 text-[#fbf9f5]/55">
                  <div className="flex justify-between">
                    <span>{slider.label}</span>
                    <span>{Number(currentVal).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={currentVal}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setDebugOverrides(prev => ({
                        ...prev,
                        [selectedNodeId]: {
                          ...(prev[selectedNodeId] || {}),
                          [slider.key]: val
                        }
                      }));
                    }}
                    className="w-full h-1 bg-[#fbf9f5]/15 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
