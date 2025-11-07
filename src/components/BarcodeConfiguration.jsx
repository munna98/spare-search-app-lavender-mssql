// src/components/BarcodeConfiguration.jsx
import React, { useState, useEffect } from 'react';
import { 
  QrCodeIcon, 
  XMarkIcon, 
  PlusIcon, 
  TrashIcon,
  EyeIcon,
  Cog6ToothIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function BarcodeConfiguration({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    barcodeType: 'CODE128',
    labelSize: '50x30',
    customWidth: 50,
    customHeight: 30,
    fields: [
      { id: 1, type: 'brand', label: 'Brand', x: 5, y: 3, fontSize: 8, enabled: true },
      { id: 2, type: 'barcode', label: 'Barcode', x: 5, y: 10, width: 40, height: 10, enabled: true },
      { id: 3, type: 'partNumber', label: 'Part Number', x: 5, y: 21, fontSize: 7, enabled: true },
      { id: 4, type: 'description', label: 'Description', x: 5, y: 25, fontSize: 6, enabled: true },
      { id: 5, type: 'price', label: 'Price', x: 35, y: 3, fontSize: 9, enabled: true }
    ]
  });

  const [selectedField, setSelectedField] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [previewData, setPreviewData] = useState({
    partNumber: '1K1819669',
    brand: 'VW/AUDI',
    description: 'Od. filter',
    price: '170.47'
  });

  const barcodeTypes = [
    { value: 'CODE128', label: 'Code 128 (Recommended - Alphanumeric)' },
    { value: 'CODE128A', label: 'Code 128A (Uppercase + Control)' },
    { value: 'CODE128B', label: 'Code 128B (ASCII Characters)' },
    { value: 'CODE128C', label: 'Code 128C (Numeric Only)' },
    { value: 'CODE39', label: 'Code 39 (Legacy Systems)' },
    { value: 'EAN13', label: 'EAN-13 (13 Digits Only)' },
    { value: 'EAN8', label: 'EAN-8 (8 Digits Only)' },
    { value: 'UPC', label: 'UPC-A (12 Digits Only)' }
  ];

  const labelSizes = [
    { value: '40x25', label: '40mm × 25mm (Small)', width: 40, height: 25 },
    { value: '50x30', label: '50mm × 30mm (Medium)', width: 50, height: 30 },
    { value: '60x40', label: '60mm × 40mm (Large)', width: 60, height: 40 },
    { value: '70x50', label: '70mm × 50mm (Extra Large)', width: 70, height: 50 },
    { value: 'custom', label: 'Custom Size', width: 0, height: 0 }
  ];

  const fieldTypes = [
    { value: 'brand', label: 'Brand' },
    { value: 'partNumber', label: 'Part Number' },
    { value: 'description', label: 'Description' },
    { value: 'price', label: 'Price' },
    { value: 'barcode', label: 'Barcode' },
    { value: 'text', label: 'Custom Text' }
  ];

  useEffect(() => {
    // Load saved config from localStorage
    const saved = localStorage.getItem('barcodeConfig');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading barcode config:', error);
      }
    }
  }, [isOpen]);

  const saveConfig = () => {
    try {
      localStorage.setItem('barcodeConfig', JSON.stringify(config));
      toast.success('Barcode configuration saved successfully!');
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error('Error saving config:', error);
    }
  };

  const handleLabelSizeChange = (value) => {
    const size = labelSizes.find(s => s.value === value);
    setConfig(prev => ({
      ...prev,
      labelSize: value,
      customWidth: size.width || prev.customWidth,
      customHeight: size.height || prev.customHeight
    }));
  };

  const addField = () => {
    const newField = {
      id: Date.now(),
      type: 'text',
      label: 'New Field',
      x: 10,
      y: 10,
      fontSize: 10,
      enabled: true
    };
    setConfig(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    toast.success('Field added');
  };

  const removeField = (id) => {
    if (config.fields.length <= 1) {
      toast.warning('At least one field is required');
      return;
    }
    setConfig(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id)
    }));
    setSelectedField(null);
    toast.info('Field removed');
  };

  const updateField = (id, updates) => {
    setConfig(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const handleMouseDown = (e, field) => {
    e.stopPropagation();
    setSelectedField(field.id);
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedField) return;
    
    const canvas = document.getElementById('label-canvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = config.customWidth / rect.width;
    const scaleY = config.customHeight / rect.height;
    
    const x = Math.max(0, Math.min((e.clientX - rect.left - dragOffset.x) * scaleX, config.customWidth - 5));
    const y = Math.max(0, Math.min((e.clientY - rect.top - dragOffset.y) * scaleY, config.customHeight - 5));
    
    updateField(selectedField, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderFieldPreview = (field) => {
    if (!field.enabled) return null;

    const scaleX = 400 / config.customWidth;
    const scaleY = 300 / config.customHeight;

    if (field.type === 'barcode') {
      return (
        <div
          key={field.id}
          style={{
            position: 'absolute',
            left: `${field.x * scaleX}px`,
            top: `${field.y * scaleY}px`,
            width: `${(field.width || 40) * scaleX}px`,
            height: `${(field.height || 10) * scaleY}px`,
            cursor: 'move',
            border: selectedField === field.id ? '2px solid #3B82F6' : '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selectedField === field.id ? '#EFF6FF' : 'transparent'
          }}
          onMouseDown={(e) => handleMouseDown(e, field)}
          className="hover:border-blue-400 transition-colors"
        >
          <div style={{
            background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)',
            width: '90%',
            height: '60%'
          }}></div>
          <div style={{ fontSize: '6px', marginTop: '2px' }}>{previewData.partNumber}</div>
        </div>
      );
    }

    let content = '';
    switch (field.type) {
      case 'brand': content = previewData.brand; break;
      case 'partNumber': content = previewData.partNumber; break;
      case 'description': content = previewData.description; break;
      case 'price': content = `$${previewData.price}`; break;
      default: content = field.label;
    }

    return (
      <div
        key={field.id}
        style={{
          position: 'absolute',
          left: `${field.x * scaleX}px`,
          top: `${field.y * scaleY}px`,
          fontSize: `${field.fontSize * scaleX / 3.5}px`,
          fontWeight: field.type === 'price' || field.type === 'partNumber' ? 'bold' : 'normal',
          cursor: 'move',
          border: selectedField === field.id ? '2px solid #3B82F6' : '1px dashed #CBD5E1',
          padding: '2px 4px',
          backgroundColor: selectedField === field.id ? '#EFF6FF' : 'transparent',
          whiteSpace: 'nowrap',
          maxWidth: `${(config.customWidth - field.x - 2) * scaleX}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        onMouseDown={(e) => handleMouseDown(e, field)}
        className="hover:border-blue-400 transition-colors"
      >
        {content}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center">
            <QrCodeIcon className="h-6 w-6 mr-2" />
            <h2 className="text-xl font-semibold">Barcode Label Configuration</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-700 rounded-md transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left Panel - Settings */}
            <div className="space-y-6">
              <div>
                {/* <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <Cog6ToothIcon className="h-5 w-5 mr-2" />
                  Label Settings
                </h3> */}
                
                {/* Barcode Type */}
                {/* <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Barcode Type
                  </label>
                  <select
                    value={config.barcodeType}
                    onChange={(e) => setConfig(prev => ({ ...prev, barcodeType: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {barcodeTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div> */}

                {/* Label Size */}
                {/* <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Label Size
                  </label>
                  <select
                    value={config.labelSize}
                    onChange={(e) => handleLabelSizeChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {labelSizes.map(size => (
                      <option key={size.value} value={size.value}>{size.label}</option>
                    ))}
                  </select>
                </div> */}

                {/* Custom Size Inputs */}
                {/* {config.labelSize === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Width (mm)
                      </label>
                      <input
                        type="number"
                        value={config.customWidth}
                        onChange={(e) => setConfig(prev => ({ ...prev, customWidth: parseInt(e.target.value) || 50 }))}
                        className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                        min="20"
                        max="200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Height (mm)
                      </label>
                      <input
                        type="number"
                        value={config.customHeight}
                        onChange={(e) => setConfig(prev => ({ ...prev, customHeight: parseInt(e.target.value) || 30 }))}
                        className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                        min="15"
                        max="150"
                      />
                    </div>
                  </div>
                )} */}
              </div>

              {/* Fields List */}
              {/* <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <ArrowsPointingOutIcon className="h-5 w-5 mr-2" />
                    Label Fields
                  </h3>
                  <button
                    onClick={addField}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center transition-colors"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {config.fields.map(field => (
                    <div
                      key={field.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedField === field.id 
                          ? 'border-blue-500 bg-blue-50 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedField(field.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center flex-1">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateField(field.id, { enabled: e.target.checked });
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">{field.label}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(field.id);
                          }}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {selectedField === field.id && (
                        <div className="mt-2 space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(field.id, { type: e.target.value })}
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                          >
                            {fieldTypes.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">X Position (mm)</label>
                              <input
                                type="number"
                                step="0.5"
                                value={field.x}
                                onChange={(e) => updateField(field.id, { x: parseFloat(e.target.value) || 0 })}
                                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Y Position (mm)</label>
                              <input
                                type="number"
                                step="0.5"
                                value={field.y}
                                onChange={(e) => updateField(field.id, { y: parseFloat(e.target.value) || 0 })}
                                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {field.type !== 'barcode' && (
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Font Size (pt)</label>
                              <input
                                type="number"
                                value={field.fontSize}
                                onChange={(e) => updateField(field.id, { fontSize: parseInt(e.target.value) || 10 })}
                                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                min="4"
                                max="24"
                              />
                            </div>
                          )}

                          {field.type === 'barcode' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Width (mm)</label>
                                <input
                                  type="number"
                                  value={field.width || 40}
                                  onChange={(e) => updateField(field.id, { width: parseInt(e.target.value) || 40 })}
                                  className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                  min="20"
                                  max="100"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Height (mm)</label>
                                <input
                                  type="number"
                                  value={field.height || 10}
                                  onChange={(e) => updateField(field.id, { height: parseInt(e.target.value) || 10 })}
                                  className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                  min="5"
                                  max="30"
                                />
                              </div>
                            </div>
                          )}

                          {field.type === 'text' && (
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Custom Text</label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div> */}
            </div>

            {/* Middle Panel - Canvas Preview */}
            <div className="lg:col-span-2">
              {/* <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <EyeIcon className="h-5 w-5 mr-2" />
                Label Preview
              </h3> */}
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                <EyeIcon className="h-5 w-5 mr-2" />
                Barcode feature coming soon...
              </h3>
              
              {/* <div className="bg-gray-100 p-6 rounded-lg border-2 border-gray-300">
                <div className="bg-white mx-auto shadow-lg" style={{ width: '400px', height: '300px' }}>
                  <div
                    id="label-canvas"
                    className="relative w-full h-full border-2 border-dashed border-gray-400"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: isDragging ? 'grabbing' : 'default' }}
                  >
                    {config.fields.map(renderFieldPreview)}
                    
                    {config.fields.filter(f => f.enabled).length === 0 && (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-center">
                          <QrCodeIcon className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-sm">No fields enabled</p>
                          <p className="text-xs">Enable fields or add new ones</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 text-sm text-gray-600 text-center space-y-1">
                  <p className="font-medium">Actual size: {config.customWidth}mm × {config.customHeight}mm</p>
                  <p className="text-xs">💡 Click a field to select • Drag to move • Edit properties in left panel</p>
                </div>
              </div> */}

              {/* Preview Data Editor */}
              {/* <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center">
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Test Preview Data
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Part Number</label>
                    <input
                      placeholder="Part Number"
                      value={previewData.partNumber}
                      onChange={(e) => setPreviewData(prev => ({ ...prev, partNumber: e.target.value }))}
                      className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Brand</label>
                    <input
                      placeholder="Brand"
                      value={previewData.brand}
                      onChange={(e) => setPreviewData(prev => ({ ...prev, brand: e.target.value }))}
                      className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Description</label>
                    <input
                      placeholder="Description"
                      value={previewData.description}
                      onChange={(e) => setPreviewData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Price</label>
                    <input
                      placeholder="Price"
                      value={previewData.price}
                      onChange={(e) => setPreviewData(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div> */}

              {/* Help Section */}
              {/* <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">Quick Guide:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Select barcode type and label size from left panel</li>
                  <li>• Click on any field in the preview to select it</li>
                  <li>• Drag selected fields to reposition them</li>
                  <li>• Use the left panel to adjust position, size, and properties</li>
                  <li>• Add custom text fields for static labels</li>
                  <li>• Save configuration before printing labels</li>
                </ul>
              </div> */}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              saveConfig();
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center transition-colors"
          >
            <Cog6ToothIcon className="h-4 w-4 mr-2" />
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}