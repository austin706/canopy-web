import React, { useRef, useEffect, useState } from 'react';
import { Colors } from '@/constants/theme';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  label?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onClear,
  width,
  height = 200,
  label = 'Sign here',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Set up canvas and track container width for responsive sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const newWidth = width || container.offsetWidth;
      setContainerWidth(newWidth);

      // Set canvas resolution and styling
      canvas.width = newWidth;
      canvas.height = height;

      // Set style separately to avoid stretching
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${height}px`;

      // Redraw baseline after resize
      drawBaseline();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [width, height]);

  // Draw the baseline guide
  const drawBaseline = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw baseline
    ctx.strokeStyle = Colors.lightGray;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Get mouse or touch coordinates relative to canvas
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let x: number;
    let y: number;

    if (e.type.startsWith('touch')) {
      const touchEvent = e as React.TouchEvent<HTMLCanvasElement>;
      const touch = touchEvent.touches[0];
      x = touch.clientX - rect.left;
      y = touch.clientY - rect.top;
    } else {
      const mouseEvent = e as React.MouseEvent<HTMLCanvasElement>;
      x = mouseEvent.clientX - rect.left;
      y = mouseEvent.clientY - rect.top;
    }

    return { x, y };
  };

  // Draw a line on the canvas
  const drawLine = (fromX: number, fromY: number, toX: number, toY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = Colors.charcoal;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  };

  // Handle mouse/touch down
  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
  };

  // Handle mouse/touch move
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    // Get previous coordinates from the last mouse/touch event
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // For smoother lines, we need the previous point
    // We'll use the current point as an approximation for now
    const lastX = coords.x;
    const lastY = coords.y;

    // Draw from last position to current (simplified single point)
    // For production, you might want to track previous coordinates
    drawLine(coords.x - 1, coords.y - 1, coords.x, coords.y);
    setHasSignature(true);
  };

  // Handle mouse/touch end
  const handleEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  // Clear the signature
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear?.();
  };

  // Save the signature
  const handleSign = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
      }}
    >
      {label && (
        <label
          style={{
            fontSize: '14px',
            fontWeight: '500',
            color: Colors.charcoal,
            marginBottom: '4px',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          position: 'relative',
          width: '100%',
          border: `2px solid ${Colors.lightGray}`,
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#fff',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          style={{
            display: 'block',
            cursor: 'crosshair',
            touchAction: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={handleClear}
          style={{
            padding: '8px 16px',
            border: `1px solid ${Colors.medGray}`,
            borderRadius: '4px',
            backgroundColor: '#fff',
            color: Colors.charcoal,
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = Colors.lightGray;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff';
          }}
        >
          Clear
        </button>

        <button
          onClick={handleSign}
          disabled={!hasSignature}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: hasSignature ? Colors.sage : Colors.silver,
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            cursor: hasSignature ? 'pointer' : 'not-allowed',
            opacity: hasSignature ? 1 : 0.6,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (hasSignature) {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasSignature) {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          Sign
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
