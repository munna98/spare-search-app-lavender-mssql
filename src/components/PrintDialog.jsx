// src/components/PrintDialog.jsx
import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  PrinterIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import JsBarcode from 'jsbarcode';

export default function PrintDialog({ isOpen, onClose, items, isBulk = false }) {
  const [quantity, setQuantity] = useState(1);
  const [config, setConfig] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('barcodeConfig');
      if (saved) {
        try {
          setConfig(JSON.parse(saved));
        } catch (error) {
          console.error('Error loading config:', error);
        }
      }
    }
  }, [isOpen]);

  const handlePrintPreview = () => {
    if (!config) {
      toast.error('Please configure barcode labels in settings first!');
      return;
    }

    // Generate print preview
    generatePrintWindow(true);
  };

  const handlePrint = () => {
    if (!config) {
      toast.error('Please configure barcode labels in settings first!');
      return;
    }

    generatePrintWindow(false);
    toast.success(`Printing ${items.length * quantity} label(s)`);
    onClose();
  };

  const generatePrintWindow = (previewOnly = false) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    
    // Generate labels HTML
    let labelsHtml = '';
    items.forEach(item => {
      for (let i = 0; i < quantity; i++) {
        labelsHtml += generateLabelHTML(item, config, `${item.id}-${i}`);
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${previewOnly ? 'Print Preview' : 'Print Labels'}</title>
          <style>
            @page { 
              size: ${config.customWidth}mm ${config.customHeight}mm;
              margin: 0;
            }
            body { 
              margin: 0; 
              padding: ${previewOnly ? '20px' : '0'}; 
              font-family: Arial, sans-serif;
              background: ${previewOnly ? '#f3f4f6' : 'white'};
            }
            .label-container {
              display: ${previewOnly ? 'flex' : 'block'};
              flex-wrap: wrap;
              gap: ${previewOnly ? '10mm' : '0'};
            }
            .label {
              width: ${config.customWidth}mm;
              height: ${config.customHeight}mm;
              border: ${previewOnly ? '2px solid #ccc' : 'none'};
              position: relative;
              page-break-inside: avoid;
              page-break-after: ${previewOnly ? 'auto' : 'always'};
              background: white;
              box-shadow: ${previewOnly ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'};
              overflow: hidden;
              box-sizing: border-box;
            }
            .field { 
              position: absolute;
              line-height: 1.2;
            }
            .barcode-field {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .barcode-field svg {
              max-width: 100%;
              height: auto;
            }
            .barcode-text {
              font-size: 7pt;
              margin-top: 1mm;
              text-align: center;
            }
            ${previewOnly ? `
              .preview-header {
                text-align: center;
                padding: 20px;
                background: white;
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .preview-header h1 {
                margin: 0 0 10px 0;
                color: #1f2937;
              }
              .print-button {
                background: #2563eb;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 15px;
              }
              .print-button:hover {
                background: #1d4ed8;
              }
            ` : ''}
            @media print {
              @page {
                size: ${config.customWidth}mm ${config.customHeight}mm;
                margin: 0;
              }
              body { 
                padding: 0;
                margin: 0;
                background: white;
              }
              .label-container {
                display: block;
                gap: 0;
                margin: 0;
                padding: 0;
              }
              .label { 
                border: none;
                box-shadow: none;
                margin: 0;
                page-break-after: always;
                page-break-inside: avoid;
              }
              .preview-header {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          ${previewOnly ? `
            <div class="preview-header">
              <h1>Print Preview</h1>
              <p style="color: #6b7280; margin: 5px 0;">
                ${items.length} item(s) × ${quantity} label(s) = ${items.length * quantity} total labels
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                Label size: ${config.customWidth}mm × ${config.customHeight}mm
              </p>
              <button class="print-button" onclick="window.print()">
                🖨️ Print Labels
              </button>
            </div>
          ` : ''}
          <div class="label-container">
            ${labelsHtml}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Generate barcodes immediately using local JsBarcode module
    let successCount = 0;
    let errorCount = 0;
    const barcodeFields = config.fields.filter(f => f.enabled && f.type === 'barcode');

    items.forEach(item => {
      for (let i = 0; i < quantity; i++) {
        barcodeFields.forEach((field, fieldIdx) => {
          const barcodeId = `barcode-${item.id}-${i}-${fieldIdx}`;
          const elem = printWindow.document.getElementById(barcodeId);
          if (elem) {
            const partNumber = (item.partNumber || '').toString().trim();
            if (partNumber) {
              try {
                JsBarcode(elem, partNumber, {
                  format: config.barcodeType,
                  width: 2,
                  height: Math.round(field.height * 3.779527559),
                  displayValue: false,
                  margin: 0
                });
                successCount++;
              } catch (formatError) {
                console.warn(`Format error with ${config.barcodeType}, trying CODE128:`, formatError);
                try {
                  JsBarcode(elem, partNumber, {
                    format: "CODE128",
                    width: 2,
                    height: Math.round(field.height * 3.779527559),
                    displayValue: false,
                    margin: 0
                  });
                  successCount++;
                } catch (fallbackError) {
                  console.error("Barcode generation failed completely:", fallbackError);
                  errorCount++;
                }
              }
            } else {
              errorCount++;
            }
          } else {
            errorCount++;
          }
        });
      }
    });

    console.log(`Barcodes generated: ${successCount} successful, ${errorCount} failed`);

    if (successCount === 0 && errorCount > 0) {
      toast.error(`Failed to generate barcodes. Check character compatibility for ${config.barcodeType}`);
    }

    if (!previewOnly) {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const generateLabelHTML = (item, config, uniqueId) => {
    const fields = config.fields
      .filter(f => f.enabled)
      .map((field, fieldIdx) => {
        let content = '';
        const alignment = field.alignment || 'center';
        let transformStyle = '';
        if (alignment === 'center') {
          transformStyle = 'transform: translateX(-50%);';
        } else if (alignment === 'right') {
          transformStyle = 'transform: translateX(-100%);';
        }

        let style = `left: ${field.x}mm; top: ${field.y}mm; ${transformStyle} text-align: ${alignment};`;
        let className = 'field';

        switch (field.type) {
          case 'brand':
            content = item.brand || '';
            style += ` font-size: ${field.fontSize}pt; white-space: nowrap;`;
            break;
          case 'partNumber':
            content = item.partNumber || '';
            style += ` font-size: ${field.fontSize}pt; font-weight: bold; white-space: nowrap;`;
            break;
          case 'description':
            content = item.description || '';
            style += ` font-size: ${field.fontSize}pt; max-width: ${config.customWidth - 4}mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
            break;
          case 'price':
            content = `${item.price || '0.00'}`;
            style += ` font-size: ${field.fontSize}pt; font-weight: bold; white-space: nowrap;`;
            break;
          case 'barcode':
            className += ' barcode-field';
            style += ` width: ${field.width || 40}mm; height: ${(field.height || 10) + 3}mm;`;
            return `
              <div class="${className}" style="${style}">
                <svg id="barcode-${uniqueId}-${fieldIdx}"></svg>
              </div>
            `;
          case 'text':
            content = field.label;
            style += ` font-size: ${field.fontSize}pt; white-space: nowrap;`;
            break;
          default:
            content = '';
        }

        return `<div class="${className}" style="${style}">${content}</div>`;
      })
      .join('');

    return `<div class="label">${fields}</div>`;
  };

  const renderLivePreview = () => {
    if (!config || !items.length) return null;
    const item = items[0];
    const width = config.customWidth || 50;
    const height = config.customHeight || 30;
    const scale = 240 / width;
    const previewHeight = height * scale;

    return (
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
          Live Label Preview ({width}mm × {height}mm)
        </label>
        <div className="flex justify-center bg-gray-100 p-3 rounded-lg border">
          <div 
            className="bg-white border border-gray-300 relative shadow-sm overflow-hidden rounded" 
            style={{ width: '240px', height: `${previewHeight}px` }}
          >
            {config.fields.filter(f => f.enabled).map((field, fieldIdx) => {
              const alignment = field.alignment || 'center';
              const transform = alignment === 'center' ? 'translateX(-50%)' : alignment === 'right' ? 'translateX(-100%)' : 'none';
              let content = '';

              switch (field.type) {
                case 'brand': content = item.brand || ''; break;
                case 'partNumber': content = item.partNumber || ''; break;
                case 'description': content = item.description || ''; break;
                case 'price': content = `$${item.price || '0.00'}`; break;
                case 'text': content = field.label; break;
                case 'barcode':
                  return (
                    <div
                      key={fieldIdx}
                      style={{
                        position: 'absolute',
                        left: `${field.x * scale}px`,
                        top: `${field.y * scale}px`,
                        width: `${(field.width || 40) * scale}px`,
                        height: `${(field.height || 10) * scale}px`,
                        transform,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{
                        background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)',
                        width: '90%',
                        height: '60%',
                        flexShrink: 0
                      }}></div>
                      <span style={{ fontSize: '7px', marginTop: '1px', flexShrink: 0 }}>{item.partNumber}</span>
                    </div>
                  );
                default: content = '';
              }

              return (
                <div
                  key={fieldIdx}
                  style={{
                    position: 'absolute',
                    left: `${field.x * scale}px`,
                    top: `${field.y * scale}px`,
                    fontSize: `${(field.fontSize || 8) * scale / 3.5}px`,
                    fontWeight: field.type === 'price' || field.type === 'partNumber' ? 'bold' : 'normal',
                    transform,
                    textAlign: alignment,
                    whiteSpace: 'nowrap',
                    maxWidth: `${(width - 4) * scale}px`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <PrinterIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold">Print Labels</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {renderLivePreview()}

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              {isBulk 
                ? `Printing ${items.length} selected item${items.length > 1 ? 's' : ''}` 
                : 'Printing single label'}
            </p>
            
            <div className="max-h-36 overflow-y-auto space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{item.partNumber}</span>
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="font-medium text-blue-600">{item.brand}</span>
                        <span className="mx-1">•</span>
                        <span>{item.description}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">${item.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity per item
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Total labels: <span className="font-semibold text-gray-700">{items.length * quantity}</span>
              </p>
              {config && (
                <p className="text-xs text-gray-500">
                  Size: <span className="font-semibold text-gray-700">{config.customWidth}×{config.customHeight}mm</span>
                </p>
              )}
            </div>
          </div>

          {!config ? (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex">
                <svg className="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-yellow-800">Configuration Required</h3>
                  <p className="text-xs text-yellow-700 mt-1">
                    Please configure barcode labels in settings before printing.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-green-800">
                  Configuration loaded • Barcode: {config.barcodeType}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrintPreview}
            disabled={!config}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            <EyeIcon className="h-4 w-4 mr-2" />
            Preview
          </button>
          <button
            onClick={handlePrint}
            disabled={!config}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            <PrinterIcon className="h-4 w-4 mr-2" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}