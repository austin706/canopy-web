import { useState, useRef } from 'react';
import { scanEquipmentLabel, lookupByModelNumber, type ScanResult } from '@/services/ai';
import { Colors } from '@/constants/theme';
import type { EquipmentCategory } from '@/types';

interface EquipmentScannerProps {
  onScanComplete?: (data: ScanResult & { name: string; category: EquipmentCategory }) => void;
  onClose?: () => void;
}

const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'water_heater', label: 'Water Heater' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'roof', label: 'Roof' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'safety', label: 'Safety' },
  { value: 'pool', label: 'Pool' },
  { value: 'garage', label: 'Garage' },
];

/**
 * Check if a file is HEIC/HEIF format (common on iPhones).
 */
function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
}

/**
 * Compress, resize, and convert an image to JPEG for the AI scanner.
 * Handles HEIC files from iPhones by converting first.
 * Tries multiple strategies in order for maximum browser/format compatibility.
 * Returns a base64 string (without data URL prefix) of the compressed JPEG.
 */
async function compressImageFromFile(file: File, previewDataUrl: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> {
  // Helper: draw to canvas and export as JPEG base64
  const canvasToJpegBase64 = (source: ImageBitmap | HTMLImageElement, srcW: number, srcH: number): string => {
    let w = srcW, h = srcH;
    if (w > maxWidth || h > maxHeight) {
      const ratio = Math.min(maxWidth / w, maxHeight / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality).split(',')[1];
  };

  // Pre-step: If HEIC, reject early with a helpful message.
  // Chrome/Firefox cannot decode HEIC natively and JS decoders are unreliable.
  // Safari and iOS handle HEIC fine, so this only blocks desktop Chrome/Firefox users.
  if (isHeicFile(file)) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!isSafari) {
      throw new Error('This photo is in HEIC format, which Chrome cannot open. Quick fixes:\n\n• On your iPhone: Use the camera directly from this page (tap "Take Photo")\n• On Mac: Open the photo in Preview → File → Export as JPEG\n• On iPhone: Go to Settings → Camera → Formats → Most Compatible');
    }
    // Safari can decode HEIC natively, so continue with normal flow
  }

  const processFile: File | Blob = file;

  // Strategy 1: createImageBitmap from File/Blob (best — handles most formats natively)
  try {
    const bitmap = await createImageBitmap(processFile);
    const result = canvasToJpegBase64(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    if (result) return result;
  } catch (e) {
    console.warn('[Scanner] createImageBitmap(file) failed:', e);
  }

  // Strategy 2: createImageBitmap from re-fetched blob
  try {
    const blobUrl = URL.createObjectURL(processFile);
    const resp = await fetch(blobUrl);
    const blob = await resp.blob();
    URL.revokeObjectURL(blobUrl);
    const bitmap = await createImageBitmap(blob);
    const result = canvasToJpegBase64(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    if (result) return result;
  } catch (e) {
    console.warn('[Scanner] createImageBitmap(blob) failed:', e);
  }

  // Strategy 3: Image() with blob URL
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const blobUrl = URL.createObjectURL(processFile);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        try { resolve(canvasToJpegBase64(img, img.width, img.height)); }
        catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('blob URL load failed')); };
      img.src = blobUrl;
    });
    if (result) return result;
  } catch (e) {
    console.warn('[Scanner] Image(blobUrl) failed:', e);
  }

  // Strategy 4: Image() with the preview data URL
  if (previewDataUrl) {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try { resolve(canvasToJpegBase64(img, img.width, img.height)); }
          catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error('preview data URL load failed'));
        img.src = previewDataUrl;
      });
      if (result) return result;
    } catch (e) {
      console.warn('[Scanner] Image(previewDataUrl) failed:', e);
    }
  }

  // If we get here with a HEIC file, don't send raw HEIC — Anthropic can't process it
  if (isHeicFile(file)) {
    throw new Error('Could not convert this HEIC image. Please take a screenshot of the label and upload that instead.');
  }

  // Strategy 5: Last resort — extract base64 from preview data URL
  if (previewDataUrl && previewDataUrl.includes(',')) {
    console.warn('[Scanner] All conversion failed, sending raw preview base64');
    return previewDataUrl.split(',')[1];
  }

  throw new Error('Unable to process this image. Please try a JPEG or PNG photo.');
}

export default function EquipmentScanner({ onScanComplete, onClose }: EquipmentScannerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setError] = useState('');
  const [showScanFailurePopup, setShowScanFailurePopup] = useState(false);
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [equipmentName, setEquipmentName] = useState('');
  const [equipmentCategory, setEquipmentCategory] = useState<EquipmentCategory>('hvac');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual entry mode state
  const [manualMode, setManualMode] = useState(false);
  const [manualModel, setManualModel] = useState('');
  const [manualSerial, setManualSerial] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/') && !isHeicFile(file)) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    // Warn about HEIC on non-Safari browsers before user waits for a scan
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isHeicFile(file) && !isSafari) {
      setError('This photo is in HEIC format, which Chrome cannot process. Please use your camera to take a new photo from this page, or export the image as JPEG first.');
      return;
    }

    setSelectedFile(file);
    setError('');
    setScanned(false);

    // Create preview
    const reader = new FileReader();
    reader.onload = e => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = Colors.copperMuted;
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = 'transparent';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'transparent';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files?.length) {
      handleFileSelect(files[0]);
    }
  };

  const handleScan = async () => {
    if (!selectedFile || !preview) {
      setError('Please select an image first');
      return;
    }

    setScanning(true);
    setError('');
    setShowScanFailurePopup(false);

    try {
      // Compress, resize, and convert to JPEG for the API
      // Tries multiple strategies: createImageBitmap, blob URL, preview data URL
      const base64String = await compressImageFromFile(selectedFile, preview, 1024, 1024, 0.7);
      console.log('[Scanner] Compressed image size:', Math.round(base64String.length / 1024), 'KB');

      // Call AI service
      const result = await scanEquipmentLabel(base64String);
      console.log('[Scanner] Scan result:', JSON.stringify(result).slice(0, 500));

      // Check confidence level for scan quality
      if (result.confidence < 0.3) {
        setScanning(false);
        setShowScanFailurePopup(true);
        return;
      }

      // Determine equipment name from scan result or use default
      const name =
        result.make && result.model
          ? `${result.make} ${result.model}`
          : result.make || 'Scanned Equipment';

      setScanData(result);
      setEquipmentName(name);
      // Auto-set category from AI if detected
      if (result.category) {
        const validCategories = EQUIPMENT_CATEGORIES.map(c => c.value);
        if (validCategories.includes(result.category as EquipmentCategory)) {
          setEquipmentCategory(result.category as EquipmentCategory);
        }
      }
      setScanning(false);
      setScanned(true);
    } catch (err: any) {
      setScanning(false);
      const errorMsg = err?.message || 'Scan failed. Please try again.';
      setError(errorMsg);
      setShowScanFailurePopup(true);
      console.error('Scan error:', err);
    }
  };

  const handleAdd = () => {
    if (!scanData || !equipmentName.trim()) {
      setError('Please enter equipment name');
      return;
    }

    onScanComplete?.({
      ...scanData,
      name: equipmentName,
      category: equipmentCategory,
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview('');
    setScanning(false);
    setScanned(false);
    setScanData(null);
    setEquipmentName('');
    setEquipmentCategory('hvac');
    setError('');
    setShowScanFailurePopup(false);
    setManualMode(false);
    setManualModel('');
    setManualSerial('');
  };

  const handleTryAgain = () => {
    setShowScanFailurePopup(false);
    // Reset to the scan state so user can try again
    setScanned(false);
    setScanData(null);
  };

  const handleEnterManually = () => {
    setShowScanFailurePopup(false);
    setManualMode(true);
    setError('');
  };

  const handleManualLookup = async () => {
    if (!manualModel.trim() && !manualSerial.trim()) {
      setError('Please enter a model number or serial number');
      return;
    }

    setLookingUp(true);
    setError('');

    try {
      const result = await lookupByModelNumber(manualModel.trim(), manualSerial.trim() || undefined);
      console.log('[Scanner] Manual lookup result:', JSON.stringify(result).slice(0, 500));

      const name =
        result.make && result.model
          ? `${result.make} ${result.model}`
          : result.make || manualModel.trim() || 'Equipment';

      // Ensure model and serial from user input are preserved
      if (manualModel.trim()) result.model = manualModel.trim();
      if (manualSerial.trim()) result.serial_number = manualSerial.trim();

      setScanData(result);
      setEquipmentName(name);
      if (result.category) {
        const validCategories = EQUIPMENT_CATEGORIES.map(c => c.value);
        if (validCategories.includes(result.category as EquipmentCategory)) {
          setEquipmentCategory(result.category as EquipmentCategory);
        }
      }
      setScanned(true);
      setManualMode(false);
    } catch (err: any) {
      console.error('Manual lookup error:', err);
      // Even if AI lookup fails, let user proceed with what they typed
      const fallbackResult: ScanResult = {
        make: '',
        model: manualModel.trim(),
        serial_number: manualSerial.trim() || undefined,
        additional_info: {},
        confidence: 0.1,
      };
      setScanData(fallbackResult);
      setEquipmentName(manualModel.trim() || 'Equipment');
      setScanned(true);
      setManualMode(false);
    } finally {
      setLookingUp(false);
    }
  };

  const handleManualSkipLookup = () => {
    // Skip AI lookup — just create equipment with what user entered
    const fallbackResult: ScanResult = {
      make: '',
      model: manualModel.trim(),
      serial_number: manualSerial.trim() || undefined,
      additional_info: {},
      confidence: 0.1,
    };
    setScanData(fallbackResult);
    setEquipmentName(manualModel.trim() || 'Equipment');
    setScanned(true);
    setManualMode(false);
  };

  // Scan failure fallback popup
  const ScanFailurePopup = () => (
    showScanFailurePopup ? (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}
      >
        <div
          style={{
            backgroundColor: Colors.cardBackground,
            borderRadius: 16,
            padding: 24,
            maxWidth: 360,
            width: '100%',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: `${Colors.warning}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <span style={{ fontSize: 28, color: Colors.warning }}>⚠️</span>
          </div>

          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: Colors.charcoal,
              margin: '0 0 16px 0',
              textAlign: 'center',
            }}
          >
            Couldn't read this label
          </h3>

          {scanError && (
            <p
              style={{
                fontSize: 12,
                color: Colors.error,
                margin: '0 0 12px 0',
                lineHeight: '18px',
                padding: '8px 12px',
                backgroundColor: `${Colors.error}10`,
                borderRadius: 8,
              }}
            >
              {scanError}
            </p>
          )}

          <p
            style={{
              fontSize: 14,
              color: Colors.medGray,
              margin: '0 0 16px 0',
              lineHeight: '20px',
            }}
          >
            For best results, we need a clear photo of your equipment's nameplate or label showing:
          </p>

          <div
            style={{
              backgroundColor: Colors.cream,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            {['Make/Brand name', 'Model number', 'Serial number', 'Any efficiency ratings'].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: i < 3 ? 8 : 0,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: Colors.copper,
                  }}
                />
                <span style={{ fontSize: 14, color: Colors.charcoal }}>{item}</span>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: 14,
              color: Colors.medGray,
              margin: '0 0 24px 0',
              lineHeight: '20px',
            }}
          >
            Try scanning again with better lighting, or enter details manually.
          </p>

          <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
            <button
              className="btn btn-primary"
              onClick={handleTryAgain}
              style={{ width: '100%' }}
            >
              Try Again
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleEnterManually}
              style={{
                width: '100%',
                borderColor: Colors.copper,
                color: Colors.copper,
              }}
            >
              Enter Model/Serial Number
            </button>
          </div>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="equipment-scanner">
      <ScanFailurePopup />

      {manualMode ? (
        // Manual Entry Mode — model/serial number lookup
        <div>
          <div
            style={{
              marginBottom: 20,
              padding: 20,
              backgroundColor: Colors.copperMuted,
              borderRadius: 12,
              borderLeft: `4px solid ${Colors.copper}`,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: Colors.charcoal, margin: '0 0 8px 0' }}>
              Enter Model / Serial Number
            </h3>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, lineHeight: '19px' }}>
              Type the model number from your equipment label. Canopy's AI will identify the make, type, and specs automatically.
            </p>
          </div>

          <div className="form-group">
            <label>Model Number</label>
            <input
              className="form-input"
              value={manualModel}
              onChange={e => setManualModel(e.target.value)}
              placeholder="e.g., CAPF3743C6, TUH1B080A9H31A, GSS25GSHSS"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Serial Number <span style={{ color: Colors.medGray, fontWeight: 400 }}>(optional)</span></label>
            <input
              className="form-input"
              value={manualSerial}
              onChange={e => setManualSerial(e.target.value)}
              placeholder="e.g., 1911123456"
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              className="btn btn-ghost"
              onClick={() => { setManualMode(false); setManualModel(''); setManualSerial(''); setError(''); }}
              disabled={lookingUp}
            >
              Back to Scanner
            </button>
            <button
              className="btn btn-primary"
              onClick={handleManualLookup}
              disabled={lookingUp || (!manualModel.trim() && !manualSerial.trim())}
              style={{ flex: 1 }}
            >
              {lookingUp ? 'Looking up...' : 'Look Up Equipment'}
            </button>
          </div>

          {(manualModel.trim() || manualSerial.trim()) && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleManualSkipLookup}
                disabled={lookingUp}
                style={{ fontSize: 12, color: Colors.medGray }}
              >
                Skip lookup — just enter details myself
              </button>
            </div>
          )}
        </div>
      ) : !preview ? (
        // Upload Area
        <>
        <div
          className="scanner-upload-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowse}
          style={{
            border: `2px dashed ${Colors.copper}`,
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: Colors.copperMuted,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 16, color: Colors.copper }}>IMG</div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: Colors.charcoal }}>
            Upload equipment label photo
          </p>
          <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 16 }}>
            Take a photo or select from your device
          </p>
          <button
            className="btn btn-primary"
            onClick={e => {
              e.stopPropagation();
              handleBrowse();
            }}
          >
            Choose Photo
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setManualMode(true)}
            style={{ fontSize: 13, color: Colors.copper }}
          >
            Can't scan? Enter model number instead
          </button>
        </div>
        </>
      ) : !scanned ? (
        // Image Preview & Scan Button
        <div>
          <div
            style={{
              marginBottom: 20,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: Colors.lightGray,
              height: 'auto',
              maxHeight: 400,
            }}
          >
            <img
              src={preview}
              alt="Equipment label"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: 'cover',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button
              className="btn btn-ghost"
              onClick={handleReset}
              disabled={scanning}
            >
              Change Image
            </button>
            <button
              className="btn btn-primary"
              onClick={handleScan}
              disabled={scanning}
              style={{ flex: 1 }}
            >
              {scanning ? 'Scanning...' : 'Scan Label'}
            </button>
          </div>
        </div>
      ) : scanData ? (
        // Scanned Data & Editable Fields
        <div>
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              backgroundColor: Colors.copperMuted,
              borderRadius: 8,
              borderLeft: `4px solid ${Colors.copper}`,
            }}
          >
            <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 4 }}>
              Confidence: {Math.round(scanData.confidence * 100)}%
            </p>
            <p style={{ fontSize: 14, color: Colors.charcoal, fontWeight: 500 }}>
              {scanData.equipment_subtype || 'Equipment'} detected
            </p>
            {scanData.estimated_lifespan_years && (
              <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 4 }}>
                Typical lifespan: ~{scanData.estimated_lifespan_years} years
              </p>
            )}
          </div>

          {/* AI Alerts */}
          {scanData.alerts && Array.isArray(scanData.alerts) && scanData.alerts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {scanData.alerts.map((alert, i) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    backgroundColor: '#FFF3E0',
                    borderLeft: `4px solid ${Colors.warning}`,
                    borderRadius: 8,
                    marginBottom: 8,
                    fontSize: 13,
                    color: Colors.charcoal,
                    lineHeight: '18px',
                  }}
                >
                  {typeof alert === 'string' ? alert : JSON.stringify(alert)}
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label>Equipment Name *</label>
            <input
              className="form-input"
              value={equipmentName}
              onChange={e => setEquipmentName(e.target.value)}
              placeholder="e.g., Central AC Unit"
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Category</label>
              <select
                className="form-select"
                value={equipmentCategory}
                onChange={e =>
                  setEquipmentCategory(e.target.value as EquipmentCategory)
                }
              >
                {EQUIPMENT_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Confidence</label>
              <input
                className="form-input"
                type="text"
                value={`${Math.round(scanData.confidence * 100)}%`}
                disabled
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Make/Brand</label>
              <input
                className="form-input"
                value={scanData.make || ''}
                readOnly
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                className="form-input"
                value={scanData.model || ''}
                readOnly
              />
            </div>
          </div>

          {scanData.serial_number && (
            <div className="form-group">
              <label>Serial Number</label>
              <input
                className="form-input"
                value={scanData.serial_number}
                readOnly
              />
            </div>
          )}

          {scanData.capacity && (
            <div className="form-group">
              <label>Capacity</label>
              <input
                className="form-input"
                value={scanData.capacity}
                readOnly
              />
            </div>
          )}

          {scanData.fuel_type && (
            <div className="form-group">
              <label>Fuel Type</label>
              <input
                className="form-input"
                value={scanData.fuel_type}
                readOnly
              />
            </div>
          )}

          {Object.keys(scanData.additional_info || {}).length > 0 && (
            <div className="form-group">
              <label>Additional Information</label>
              <div
                style={{
                  padding: 12,
                  backgroundColor: Colors.cream,
                  borderRadius: 8,
                  fontSize: 14,
                  color: Colors.medGray,
                }}
              >
                {Object.entries(scanData.additional_info).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <strong>{key}:</strong> {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={handleReset}>
              Scan Different
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              style={{ flex: 1 }}
            >
              Add Equipment
            </button>
          </div>
        </div>
      ) : null}

      {scanError && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: '#FFEBEE',
            borderLeft: `4px solid ${Colors.error}`,
            borderRadius: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: Colors.error }}>
            {scanError}
          </p>
        </div>
      )}
    </div>
  );
}
