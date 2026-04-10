import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  imageFile: File;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
  shape?: 'circle' | 'square';
  outputSize?: number;
}

/**
 * Lightweight photo crop modal — lets users drag-to-reposition and
 * pinch/scroll to zoom before uploading a profile photo.
 *
 * No external dependencies; uses canvas for the final crop.
 */
export default function PhotoCropModal({ imageFile, onCrop, onCancel, shape = 'circle', outputSize = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [processing, setProcessing] = useState(false);

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImageSrc(url);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Crop area is 280x280 in the UI
  const CROP_SIZE = 280;

  // Calculate how the image fits within the crop area at current zoom
  const getImageDisplaySize = useCallback(() => {
    if (!imageSize.w || !imageSize.h) return { w: 0, h: 0 };
    const aspect = imageSize.w / imageSize.h;
    // Fit so shortest side fills the crop area, then apply zoom
    let w: number, h: number;
    if (aspect >= 1) {
      h = CROP_SIZE * zoom;
      w = h * aspect;
    } else {
      w = CROP_SIZE * zoom;
      h = w / aspect;
    }
    return { w, h };
  }, [imageSize, zoom]);

  // Clamp offset so image always covers the crop area
  const clampOffset = useCallback((ox: number, oy: number) => {
    const { w, h } = getImageDisplaySize();
    const maxX = Math.max(0, (w - CROP_SIZE) / 2);
    const maxY = Math.max(0, (h - CROP_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    };
  }, [getImageDisplaySize]);

  // Mouse/touch handlers for dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy));
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  // Scroll to zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.min(3, Math.max(1, zoom - e.deltaY * 0.002));
    setZoom(newZoom);
    // Re-clamp offset at new zoom
    setOffset(prev => clampOffset(prev.x, prev.y));
  };

  // Crop and output
  const handleCrop = async () => {
    if (!imageSrc) return;
    setProcessing(true);

    const img = new Image();
    img.src = imageSrc;
    await new Promise(resolve => { img.onload = resolve; });

    const { w: displayW, h: displayH } = getImageDisplaySize();

    // Map crop area back to source image coordinates
    const scaleX = img.naturalWidth / displayW;
    const scaleY = img.naturalHeight / displayH;

    // The crop area center in display coords is the image center offset by -offset
    const cropCenterX = displayW / 2 - offset.x;
    const cropCenterY = displayH / 2 - offset.y;

    const srcX = (cropCenterX - CROP_SIZE / 2) * scaleX;
    const srcY = (cropCenterY - CROP_SIZE / 2) * scaleY;
    const srcW = CROP_SIZE * scaleX;
    const srcH = CROP_SIZE * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d')!;

    // If circle, clip to circle
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputSize, outputSize);

    canvas.toBlob(blob => {
      if (blob) onCrop(blob);
      setProcessing(false);
    }, 'image/jpeg', 0.9);
  };

  const displaySize = getImageDisplaySize();

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--color-card-background, #fff)', borderRadius: 16,
        padding: 24, maxWidth: 400, width: '100%',
      }}>
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>Position Your Photo</h3>
        <p className="text-sm text-gray" style={{ marginBottom: 16 }}>
          Drag to reposition. Scroll to zoom.
        </p>

        {/* Crop area */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          style={{
            width: CROP_SIZE, height: CROP_SIZE,
            margin: '0 auto 16px', position: 'relative',
            overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab',
            borderRadius: shape === 'circle' ? '50%' : 12,
            border: '3px solid var(--color-sage, #8B9E7E)',
            background: '#f0f0f0',
            touchAction: 'none',
          }}
        >
          {imageSrc && (
            <img
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              style={{
                position: 'absolute',
                width: displaySize.w,
                height: displaySize.h,
                left: '50%', top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '0 12px' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>-</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => {
              const z = parseFloat(e.target.value);
              setZoom(z);
              setOffset(prev => clampOffset(prev.x, prev.y));
            }}
            style={{ flex: 1, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>+</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleCrop} disabled={processing} style={{ flex: 1 }}>
            {processing ? 'Saving...' : 'Save Photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
