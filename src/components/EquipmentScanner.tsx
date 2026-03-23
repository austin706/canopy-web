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

export default function EquipmentScanner({ onScanComplete, onClose }: EquipmentScannerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setError] = useState('');
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

    try {
      // Convert image to base64
      const base64String = preview.split(',')[1];

      // Call AI service
      const result = await scanEquipmentLabel(base64String);

      // Determine equipment name from scan result or use default
      const name =
        result.make && result.model
          ? `${result.make} ${result.model}`
          : result.make || 'Scanned Equipment';

      setScanData(result);
      setEquipmentName(name);
      setScanned(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to scan equipment label. Please try again.'
      );
    } finally {
      setScanning(false);
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
  };

  return (
    <div className="equipment-scanner">
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
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
              Equipment detected
            </p>
          </div>

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
