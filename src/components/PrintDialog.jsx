// src/components/PrintDialog.jsx
import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  PrinterIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

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

    // Generate barcode scripts with error handling
    const barcodeScripts = [];
    items.forEach(item => {
      for (let i = 0; i < quantity; i++) {
        const barcodeFields = config.fields.filter(f => f.enabled && f.type === 'barcode');
        barcodeFields.forEach((field, fieldIdx) => {
          // Sanitize part number and determine best format
          const partNumber = (item.partNumber || '').toString().trim();
          const barcodeId = `barcode-${item.id}-${i}-${fieldIdx}`;
          
          barcodeScripts.push(`
            try {
              var partNum = "${partNumber}";
              var format = "${config.barcodeType}";
              var elem = document.getElementById("${barcodeId}");
              
              if (!elem) {
                console.error("Element not found: ${barcodeId}");
              } else if (!partNum) {
                console.error("Empty part number for ${barcodeId}");
              } else {
                // Try to generate barcode with error handling
                try {
                  JsBarcode("#${barcodeId}", partNum, {
                    format: format,
                    width: 2,
                    height: ${Math.round(field.height * 3.779527559)},
                    displayValue: false,
                    margin: 0,
                    valid: function(valid) {
                      if (!valid) {
                        console.warn("Invalid barcode format for: " + partNum + " with format: " + format);
                      }
                    }
                  });
                } catch (formatError) {
                  console.warn("Format error with ${config.barcodeType}, trying CODE128:", formatError);
                  // Fallback to CODE128 which is most flexible
                  JsBarcode("#${barcodeId}", partNum, {
                    format: "CODE128",
                    width: 2,
                    height: ${Math.round(field.height * 3.779527559)},
                    displayValue: false,
                    margin: 0
                  });
                }
              }
            } catch (err) {
              console.error("Barcode generation error for ${barcodeId}:", err.message);
            }
          `);
        });
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${previewOnly ? 'Print Preview' : 'Print Labels'}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page { 
              margin: 10mm;
              size: auto;
            }
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              background: ${previewOnly ? '#f3f4f6' : 'white'};
            }
            .label-container {
              display: flex;
              flex-wrap: wrap;
              gap: ${previewOnly ? '10mm' : '5mm'};
            }
            .label {
              width: ${config.customWidth}mm;
              height: ${config.customHeight}mm;
              border: ${previewOnly ? '2px solid #ccc' : '1px dashed #ddd'};
              position: relative;
              page-break-inside: avoid;
              background: white;
              box-shadow: ${previewOnly ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'};
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
              body { 
                padding: 0;
                background: white;
              }
              .label { 
                border: none;
                box-shadow: none;
                margin: 0;
              }
              .label-container {
                gap: 2mm;
              }
              .preview-header {
                display: none;
              }
              @page {
                margin: 5mm;
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
              <p style="color: #ef4444; font-size: 12px; margin-top: 10px;">
                ⚠️ Wait for barcodes to load before printing (1-2 seconds)
              </p>
              <button class="print-button" onclick="window.print()">
                🖨️ Print Labels
              </button>
            </div>
          ` : ''}
          <div class="label-container">
            ${labelsHtml}
          </div>
          <script>
            function generateBarcodes() {
              var successCount = 0;
              var errorCount = 0;
              
              try {
                ${barcodeScripts.join('\n                ')}
                
                // Count generated barcodes
                var barcodes = document.querySelectorAll('svg[id^="barcode-"]');
                barcodes.forEach(function(svg) {
                  if (svg.querySelector('rect') || svg.querySelector('path')) {
                    successCount++;
                  } else {
                    errorCount++;
                  }
                });
                
                console.log('Barcodes generated: ' + successCount + ' successful, ' + errorCount + ' failed');
                
                if (successCount === 0 && errorCount > 0) {
                  alert('Failed to generate barcodes. This might be due to:\\n\\n' +
                        '1. Part number format incompatible with ${config.barcodeType}\\n' +
                        '2. Internet connection issue\\n' +
                        '3. Invalid characters in part number\\n\\n' +
                        'Try changing barcode type to CODE128 in settings.');
                }
              } catch (error) {
                console.error('Error generating barcodes:', error);
                alert('Error: ' + error.message);
              }
            }

            // Wait for JsBarcode to load, then generate barcodes
            function initBarcodes() {
              if (typeof JsBarcode !== 'undefined') {
                console.log('JsBarcode loaded, generating barcodes...');
                generateBarcodes();
                ${!previewOnly ? 'setTimeout(function() { window.print(); }, 1500);' : ''}
              } else {
                console.log('JsBarcode not loaded yet, waiting...');
                setTimeout(initBarcodes, 200);
              }
            }

            // Start initialization
            if (document.readyState === 'complete') {
              initBarcodes();
            } else {
              window.addEventListener('load', initBarcodes);
            }
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const generateLabelHTML = (item, config, uniqueId) => {
    const fields = config.fields
      .filter(f => f.enabled)
      .map((field, fieldIdx) => {
        let content = '';
        let style = `left: ${field.x}mm; top: ${field.y}mm;`;
        let className = 'field';

        switch (field.type) {
          case 'brand':
            content = item.brand || '';
            style += ` font-size: ${field.fontSize}pt;`;
            break;
          case 'partNumber':
            content = item.partNumber || '';
            style += ` font-size: ${field.fontSize}pt; font-weight: bold;`;
            break;
          case 'description':
            content = item.description || '';
            style += ` font-size: ${field.fontSize}pt; max-width: ${config.customWidth - field.x - 2}mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
            break;
          case 'price':
            content = `${item.price || '0.00'}`;
            style += ` font-size: ${field.fontSize}pt; font-weight: bold;`;
            break;
          case 'barcode':
            className += ' barcode-field';
            style = `left: ${field.x}mm; top: ${field.y}mm; width: ${field.width}mm; height: ${field.height + 3}mm;`;
            return `
              <div class="${className}" style="${style}">
                <svg id="barcode-${uniqueId}-${fieldIdx}"></svg>
              </div>
            `;
          case 'text':
            content = field.label;
            style += ` font-size: ${field.fontSize}pt;`;
            break;
          default:
            content = '';
        }

        return `<div class="${className}" style="${style}">${content}</div>`;
      })
      .join('');

    return `<div class="label">${fields}</div>`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <PrinterIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold">Print Labels</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              {isBulk 
                ? `Printing ${items.length} selected item${items.length > 1 ? 's' : ''}` 
                : 'Printing single label'}
            </p>
            
            <div className="max-h-48 overflow-y-auto space-y-2">
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