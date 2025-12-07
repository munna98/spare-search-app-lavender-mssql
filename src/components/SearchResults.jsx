// src/components/SearchResults.jsx - Amber styling for compatible parts
import React, { useState } from "react";
import {
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  PrinterIcon,
  CubeIcon,
  MagnifyingGlassCircleIcon,
  ServerIcon,
  DocumentIcon,
  LinkIcon
} from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';
import PrintDialog from './PrintDialog';
import PriceCalculatorPopup from './PriceCalculatorPopup';
import StockHistoryDialog from './StockHistoryDialog';

export default function SearchResults({ results, query }) {
  const [copiedId, setCopiedId] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [itemsToPrint, setItemsToPrint] = useState([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [calculatorPosition, setCalculatorPosition] = useState({ top: 0, left: 0 });
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [activeTab, setActiveTab] = useState('direct');

  const handlePriceClick = (event, price) => {
    const rect = event.target.getBoundingClientRect();
    setCalculatorPosition({
      top: rect.top - 210,
      left: Math.max(10, rect.left - 100)
    });
    setSelectedPrice(price);
    setShowCalculator(true);
  };

  const handleStockClick = (partNumber, productId, stockQty) => {
    setSelectedStockItem({ partNumber, productId, stockQty });
    setShowStockHistory(true);
  };

  const handleCalculate = (calculatedPrice, percentage) => {
    toast.success(`Calculated price: $${calculatedPrice.toFixed(2)} (${percentage}% markup)`, {
      autoClose: 3000
    });
  };

  const cerobizResults = results?.cerobiz || [];
  const fileResults = results?.files || [];
  const totalResults = cerobizResults.length + fileResults.length;

  const directMatches = cerobizResults.filter(r => !r.isCompatible);
  const compatibleMatches = cerobizResults.filter(r => r.isCompatible);

  // Set default active tab based on available results
  React.useEffect(() => {
    if (directMatches.length > 0) setActiveTab('direct');
    else if (compatibleMatches.length > 0) setActiveTab('compatible');
    else if (fileResults.length > 0) setActiveTab('files');
  }, [directMatches.length, compatibleMatches.length, fileResults.length]);

  const handleCopy = async (partNumber, id) => {
    try {
      await navigator.clipboard.writeText(partNumber);
      setCopiedId(id);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSelectAll = (e, source) => {
    const sourceResults = source === 'cerobiz' ? cerobizResults : fileResults;
    const sourceIds = sourceResults.map(r => `${source}-${r.id}`);

    if (e.target.checked) {
      setSelectedItems(prev => [...new Set([...prev, ...sourceIds])]);
    } else {
      setSelectedItems(prev => prev.filter(id => !sourceIds.includes(id)));
    }
  };

  const handleSelectItem = (source, id) => {
    const itemId = `${source}-${id}`;
    setSelectedItems(prev => prev.includes(itemId) ? prev.filter(i => i !== itemId) : [...prev, itemId]);
  };

  const handlePrintSingle = (item, source) => {
    setItemsToPrint([{
      ...item,
      price: source === 'cerobiz' ? item.cost : item.price,
      brand: source === 'cerobiz' ? 'Cerobiz' : item.brand
    }]);
    setShowPrintDialog(true);
  };

  const handlePrintSelected = () => {
    if (selectedItems.length === 0) {
      toast.warning('Please select at least one item to print');
      return;
    }

    const items = selectedItems.map(itemId => {
      if (itemId.startsWith('cerobiz-')) {
        const item = cerobizResults.find(r => r.id === parseInt(itemId.replace('cerobiz-', '')));
        return item ? { ...item, price: item.cost, brand: 'Cerobiz' } : null;
      } else {
        return fileResults.find(r => r.id === parseInt(itemId.replace('files-', '')));
      }
    }).filter(Boolean);

    setItemsToPrint(items);
    setShowPrintDialog(true);
  };

  if (query && totalResults === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-gray-100 rounded-full p-6 mb-4">
          <MagnifyingGlassCircleIcon className="h-16 w-16 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No results found</h3>
        <p className="text-gray-600 text-center max-w-md mb-4">
          We couldn't find any parts matching "<span className="font-medium text-gray-900">{query}</span>"
        </p>
        <p className="text-sm text-gray-500">Try searching with a different part number or check if the stock database is connected</p>
      </div>
    );
  }

  if (totalResults === 0) return null;

  const renderCopyButton = (partNumber, id, source) => (
    <button onClick={() => handleCopy(partNumber, `${source}-${id}`)} className="p-1 hover:bg-gray-200 rounded transition-colors" title="Copy part number">
      {copiedId === `${source}-${id}` ? <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" /> : <ClipboardDocumentIcon className="h-5 w-5 text-gray-500 hover:text-gray-700" />}
    </button>
  );

  const renderCerobizTable = (items, isCompatible = false) => {
    const colors = isCompatible
      ? { border: 'border-amber-200', bg: 'bg-amber-50', header: 'bg-amber-100', hover: 'hover:bg-amber-100', ring: 'ring-amber-400', checkbox: 'text-amber-600 focus:ring-amber-500', btn: 'hover:bg-amber-200 hover:text-amber-600' }
      : { border: 'border-green-200', bg: 'bg-green-50', header: 'bg-green-100', hover: 'hover:bg-green-100', ring: 'ring-green-400', checkbox: 'text-green-600 focus:ring-green-500', btn: 'hover:bg-green-200 hover:text-green-600' };

    return (
      <div className={`overflow-x-auto shadow-sm border-2 ${colors.border} rounded-lg ${colors.bg}`}>
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className={`text-left ${colors.header} text-sm font-semibold text-gray-700`}>
              <th className={`p-3 border-b ${colors.border} w-10`}>
                <input type="checkbox" checked={items.length > 0 && items.every(r => selectedItems.includes(`cerobiz-${r.id}`))} onChange={(e) => {
                  const itemIds = items.map(r => `cerobiz-${r.id}`);
                  setSelectedItems(prev => e.target.checked ? [...new Set([...prev, ...itemIds])] : prev.filter(id => !itemIds.includes(id)));
                }} className={`w-4 h-4 rounded border-gray-300 ${colors.checkbox}`} title="Select all" />
              </th>
              <th className={`p-3 border-b ${colors.border}`}>Part Number</th>
              <th className={`p-3 border-b ${colors.border}`}>Description</th>
              <th className={`p-3 border-b ${colors.border}`}>Stock</th>
              <th className={`p-3 border-b ${colors.border}`}>Cost</th>
              <th className={`p-3 border-b ${colors.border} w-12`}></th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {items.map((row, idx) => (
              <tr key={`cerobiz-${row.id}`} className={`${idx % 2 === 1 ? colors.bg : "bg-white"} ${selectedItems.includes(`cerobiz-${row.id}`) ? `ring-2 ${colors.ring} ring-inset` : ""} ${colors.hover} transition-colors`}>
                <td className={`p-3 border-b ${colors.border}`}>
                  <input type="checkbox" checked={selectedItems.includes(`cerobiz-${row.id}`)} onChange={() => handleSelectItem('cerobiz', row.id)} className={`w-4 h-4 rounded border-gray-300 ${colors.checkbox}`} />
                </td>
                <td className={`p-3 border-b ${colors.border}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.partNumber}</span>
                      {isCompatible && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300" title="Compatible part - found in remarks"><LinkIcon className="h-3 w-3" />Replacement</span>}
                    </div>
                    {renderCopyButton(row.partNumber, row.id, 'cerobiz')}
                  </div>
                </td>
                <td className={`p-3 border-b ${colors.border} text-gray-700`}>{row.description}</td>
                <td className={`p-3 border-b ${colors.border}`}>
                  <button onClick={() => handleStockClick(row.partNumber, row.productId, row.stockQty)} className={`text-sm flex items-center font-semibold px-2 py-1 rounded ${colors.btn} transition-colors ${row.stockQty > 0 ? 'text-green-600' : 'text-red-600'}`} title="Click to view stock history">
                    <CubeIcon className="h-4 w-4" />{row.stockQty}
                  </button>
                </td>
                <td className={`p-3 border-b ${colors.border}`}>
                  <button onClick={(e) => handlePriceClick(e, row.cost)} className={`text-lg font-bold text-gray-900 rounded px-2 ${colors.btn}`}>
                    ${row.cost?.toFixed(2) || '0.00'}
                  </button>
                </td>
                <td className={`p-3 border-b ${colors.border}`}>
                  <button onClick={() => handlePrintSingle(row, 'cerobiz')} className={`p-1 ${colors.btn} rounded transition-colors`} title="Print label">
                    <PrinterIcon className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        {selectedItems.length > 0 && (
          <button onClick={handlePrintSelected} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm font-medium shadow-sm transition-colors">
            <PrinterIcon className="h-5 w-5 mr-2" />Print Selected ({selectedItems.length})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
        {directMatches.length > 0 && (
          <button onClick={() => setActiveTab('direct')} className={`px-6 py-3 font-semibold transition-all ${activeTab === 'direct' ? 'border-b-4 border-green-500 text-green-700 -mb-0.5' : 'text-gray-600 hover:text-gray-800'}`}>
            <div className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5" />
              Cerobiz ({directMatches.length})
            </div>
          </button>
        )}
        {compatibleMatches.length > 0 && (
          <button onClick={() => setActiveTab('compatible')} className={`px-6 py-3 font-semibold transition-all ${activeTab === 'compatible' ? 'border-b-4 border-amber-500 text-amber-700 -mb-0.5' : 'text-gray-600 hover:text-gray-800'}`}>
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Replacement ({compatibleMatches.length})
            </div>
          </button>
        )}
        {fileResults.length > 0 && (
          <button onClick={() => setActiveTab('files')} className={`px-6 py-3 font-semibold transition-all ${activeTab === 'files' ? 'border-b-4 border-blue-500 text-blue-700 -mb-0.5' : 'text-gray-600 hover:text-gray-800'}`}>
            <div className="flex items-center gap-2">
              <DocumentIcon className="h-5 w-5" />
              Files ({fileResults.length})
            </div>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'direct' && directMatches.length > 0 && renderCerobizTable(directMatches, false)}
      {activeTab === 'compatible' && compatibleMatches.length > 0 && renderCerobizTable(compatibleMatches, true)}
      {activeTab === 'files' && fileResults.length > 0 && (
        <div className="overflow-x-auto shadow-sm border-2 border-blue-200 rounded-lg bg-blue-50">
          <table className="w-full table-auto text-sm">
            <thead>
              <tr className="text-left bg-blue-100 text-sm font-semibold text-gray-700">
                <th className="p-3 border-b border-blue-200 w-10">
                  <input type="checkbox" checked={fileResults.length > 0 && fileResults.every(r => selectedItems.includes(`files-${r.id}`))} onChange={(e) => handleSelectAll(e, 'files')} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" title="Select all" />
                </th>
                <th className="p-3 border-b border-blue-200">Part Number</th>
                <th className="p-3 border-b border-blue-200">Brand</th>
                <th className="p-3 border-b border-blue-200">Description</th>
                <th className="p-3 border-b border-blue-200">Price</th>
                <th className="p-3 border-b border-blue-200 w-12"></th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {fileResults.map((row, idx) => (
                <tr key={`files-${row.id}`} className={`${idx % 2 === 1 ? "bg-blue-50" : "bg-white"} ${selectedItems.includes(`files-${row.id}`) ? "ring-2 ring-blue-400 ring-inset" : ""} hover:bg-blue-100 transition-colors`}>
                  <td className="p-3 border-b border-blue-100">
                    <input type="checkbox" checked={selectedItems.includes(`files-${row.id}`)} onChange={() => handleSelectItem('files', row.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </td>
                  <td className="p-3 border-b border-blue-100">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{row.partNumber}</span>
                      {renderCopyButton(row.partNumber, row.id, 'files')}
                    </div>
                  </td>
                  <td className="p-3 border-b border-blue-100 font-medium text-blue-600">{row.brand}</td>
                  <td className="p-3 border-b border-blue-100 text-gray-700">{row.description}</td>
                  <td className="p-3 border-b border-blue-100">
                    <button onClick={(e) => handlePriceClick(e, row.price)} className="text-lg font-bold text-gray-900 rounded px-2 hover:text-blue-600 hover:bg-blue-200">
                      ${row.price?.toFixed(2) || '0.00'}
                    </button>
                  </td>
                  <td className="p-3 border-b border-blue-100">
                    <button onClick={() => handlePrintSingle(row, 'files')} className="p-1 hover:bg-blue-200 rounded transition-colors" title="Print label">
                      <PrinterIcon className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PrintDialog isOpen={showPrintDialog} onClose={() => { setShowPrintDialog(false); setItemsToPrint([]); }} items={itemsToPrint} isBulk={itemsToPrint.length > 1} />
      <PriceCalculatorPopup isOpen={showCalculator} onClose={() => setShowCalculator(false)} basePrice={selectedPrice} onCalculate={handleCalculate} position={calculatorPosition} />
      <StockHistoryDialog isOpen={showStockHistory} onClose={() => { setShowStockHistory(false); setSelectedStockItem(null); }} partNumber={selectedStockItem?.partNumber} productId={selectedStockItem?.productId} />
    </>
  );
}