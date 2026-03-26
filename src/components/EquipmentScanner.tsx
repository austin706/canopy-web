import { useState, useRef } from 'react';
import { scanEquipmentLabel, type ScanResult } from '@/services/ai';
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
 * Compress and resize an image to stay within Anthropic's processing limits.
 * Returns a base64 string (without data URL prefix) of the compressed JPEG.
 */
function compressImage(dataUrl: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG with compression
      const compressed = canvas.toDataURL('image/jpeg', quality);
      const base64 = compressed.split(',')[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
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

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
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
      // Compress and resize image to stay within API limits
      // Raw camera photos can be 4-8MB base64; compress to ~200-400KB
      const base64String = await compressImage(preview, 1024, 1024, 0.7);

      // Call AI service
      const result = await scanEquipmentLabel(base64String);

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
    setScanned(false);
    setScanData(null);
    setEquipmentName('');
    setEquipmentCategory('hvac');
    setError('');
    setShowScanFailurePopup(false);
  };

  const handleTryAgain = () => {
    setShowScanFailurePopup(false);
    // Reset to the scan state so user can try again
    setScanned(false);
    setScanData(null);
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
              onClick={() => setShowScanFailurePopup(false)}
              style={{
                width: '100%',
                borderColor: Colors.copper,
                color: Colors.copper,
              }}
            >
              Enter Manually
            </button>
          </div>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="equipment-scanner">
      <ScanFailurePopup />

      {!preview ? (
        // Upload Area
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
            Drag and drop an image or click to browse
          </p>
          <button
            className="btn btn-secondary"
            onClick={e => {
              e.stopPropagation();
              handleBrowse();
            }}
          >
            Select Image
          </button>
        </div>
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
          {scanData.alerts && scanData.alerts.length > 0 && (
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
                  {alert}
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
                    <strong>{key}:</strong> {value}
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
