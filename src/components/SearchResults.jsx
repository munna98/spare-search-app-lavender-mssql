// src/components/SearchResults.jsx
import React, { useState } from "react";
import { 
  ClipboardDocumentIcon, 
  ClipboardDocumentCheckIcon,
  PrinterIcon,
  CubeIcon,
  MagnifyingGlassCircleIcon,
  ServerIcon,
  DocumentIcon
} from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';
import PrintDialog from './PrintDialog';

export default function SearchResults({ results, query }) {
  const [copiedId, setCopiedId] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [itemsToPrint, setItemsToPrint] = useState([]);

  // Separate results by source
  const cerobizResults = results?.cerobiz || [];
  const fileResults = results?.files || [];
  const totalResults = cerobizResults.length + fileResults.length;

  const handleCopy = async (partNumber, id) => {
    try {
      await navigator.clipboard.writeText(partNumber);
      setCopiedId(id);
      // toast.success(`Copied: ${partNumber}`, { autoClose: 2000 });
      
      // setTimeout(() => {
      //   setCopiedId(null);
      // }, 2000);
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
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(i => i !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handlePrintSingle = (item, source) => {
    // Format item for printing
    const printItem = {
      ...item,
      price: source === 'cerobiz' ? item.cost : item.price,
      brand: source === 'cerobiz' ? 'Cerobiz' : item.brand
    };
    setItemsToPrint([printItem]);
    setShowPrintDialog(true);
  };

  const handlePrintSelected = () => {
    if (selectedItems.length === 0) {
      toast.warning('Please select at least one item to print');
      return;
    }
    
    const items = [];
    
    // Add selected Cerobiz items
    selectedItems.forEach(itemId => {
      if (itemId.startsWith('cerobiz-')) {
        const id = parseInt(itemId.replace('cerobiz-', ''));
        const item = cerobizResults.find(r => r.id === id);
        if (item) {
          items.push({
            ...item,
            price: item.cost,
            brand: 'Cerobiz'
          });
        }
      } else if (itemId.startsWith('files-')) {
        const id = parseInt(itemId.replace('files-', ''));
        const item = fileResults.find(r => r.id === id);
        if (item) {
          items.push(item);
        }
      }
    });
    
    setItemsToPrint(items);
    setShowPrintDialog(true);
  };

  // Show "No results found" message if query exists but no results
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
        <p className="text-sm text-gray-500">
          Try searching with a different part number or check if the stock database is connected
        </p>
      </div>
    );
  }

  // Don't show anything if no query has been entered yet
  if (totalResults === 0) return null;

  const renderCopyButton = (partNumber, id, source) => (
    <button
      onClick={() => handleCopy(partNumber, `${source}-${id}`)}
      className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
      title="Copy part number"
    >
      {copiedId === `${source}-${id}` ? (
        <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
      ) : (
        <ClipboardDocumentIcon className="h-5 w-5 text-gray-500 hover:text-gray-700" />
      )}
    </button>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        {selectedItems.length > 0 && (
          <button
            onClick={handlePrintSelected}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm font-medium shadow-sm transition-colors"
          >
            <PrinterIcon className="h-5 w-5 mr-2" />
            Print Selected ({selectedItems.length})
          </button>
        )}
      </div>

      {/* Cerobiz Results */}
      {cerobizResults.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <ServerIcon className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">
              Results from Cerobiz ({cerobizResults.length})
            </h3>
          </div>
          
          <div className="overflow-x-auto shadow-sm border-2 border-green-200 rounded-lg bg-green-50">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left bg-green-100 text-sm font-semibold text-gray-700">
                  <th className="p-3 border-b border-green-200 w-10">
                    <input
                      type="checkbox"
                      checked={cerobizResults.length > 0 && cerobizResults.every(r => selectedItems.includes(`cerobiz-${r.id}`))}
                      onChange={(e) => handleSelectAll(e, 'cerobiz')}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      title="Select all"
                    />
                  </th>
                  <th className="p-3 border-b border-green-200">Part Number</th>
                  <th className="p-3 border-b border-green-200">Description</th>
                  <th className="p-3 border-b border-green-200">Stock</th>
                  <th className="p-3 border-b border-green-200">Cost</th>
                  <th className="p-3 border-b border-green-200 w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {cerobizResults.map((row, idx) => (
                  <tr 
                    key={`cerobiz-${row.id}`}
                    className={`${
                      idx % 2 === 1 ? "bg-green-50" : "bg-white"
                    } ${
                      selectedItems.includes(`cerobiz-${row.id}`) ? "ring-2 ring-green-400 ring-inset" : ""
                    } hover:bg-green-100 transition-colors`}
                  >
                    <td className="p-3 border-b border-green-100">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(`cerobiz-${row.id}`)}
                        onChange={() => handleSelectItem('cerobiz', row.id)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </td>
                    <td className="p-3 border-b border-green-100">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{row.partNumber}</span>
                        {renderCopyButton(row.partNumber, row.id, 'cerobiz')}
                      </div>
                    </td>
                    <td className="p-3 border-b border-green-100 text-gray-700">{row.description}</td>
                    <td className="p-3 border-b border-green-100">
                      <span className={`text-sm flex items-center font-semibold ${
                        row.stockQty > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <CubeIcon className="h-4 w-4 mr-1" />
                        {row.stockQty}
                      </span>
                    </td>
                    <td className="p-3 border-b border-green-100 text-lg font-bold text-gray-900">
                      ${row.cost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="p-3 border-b border-green-100">
                      <button
                        onClick={() => handlePrintSingle(row, 'cerobiz')}
                        className="p-1 hover:bg-green-200 rounded transition-colors"
                        title="Print label"
                      >
                        <PrinterIcon className="h-5 w-5 text-gray-500 hover:text-gray-700"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* File Results */}
      {fileResults.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <DocumentIcon className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">
              Results from Files ({fileResults.length})
            </h3>
          </div>
          
          <div className="overflow-x-auto shadow-sm border-2 border-blue-200 rounded-lg bg-blue-50">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left bg-blue-100 text-sm font-semibold text-gray-700">
                  <th className="p-3 border-b border-blue-200 w-10">
                    <input
                      type="checkbox"
                      checked={fileResults.length > 0 && fileResults.every(r => selectedItems.includes(`files-${r.id}`))}
                      onChange={(e) => handleSelectAll(e, 'files')}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      title="Select all"
                    />
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
                  <tr 
                    key={`files-${row.id}`}
                    className={`${
                      idx % 2 === 1 ? "bg-blue-50" : "bg-white"
                    } ${
                      selectedItems.includes(`files-${row.id}`) ? "ring-2 ring-blue-400 ring-inset" : ""
                    } hover:bg-blue-100 transition-colors`}
                  >
                    <td className="p-3 border-b border-blue-100">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(`files-${row.id}`)}
                        onChange={() => handleSelectItem('files', row.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-3 border-b border-blue-100">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{row.partNumber}</span>
                        {renderCopyButton(row.partNumber, row.id, 'files')}
                      </div>
                    </td>
                    <td className="p-3 border-b border-blue-100 font-medium text-blue-600">{row.brand}</td>
                    <td className="p-3 border-b border-blue-100 text-gray-700">{row.description}</td>
                    <td className="p-3 border-b border-blue-100 text-lg font-bold text-gray-900">
                      ${row.price?.toFixed(2) || '0.00'}
                    </td>
                    <td className="p-3 border-b border-blue-100">
                      <button
                        onClick={() => handlePrintSingle(row, 'files')}
                        className="p-1 hover:bg-blue-200 rounded transition-colors"
                        title="Print label"
                      >
                        <PrinterIcon className="h-5 w-5 text-gray-500 hover:text-gray-700"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Dialog */}
      <PrintDialog
        isOpen={showPrintDialog}
        onClose={() => {
          setShowPrintDialog(false);
          setItemsToPrint([]);
        }}
        items={itemsToPrint}
        isBulk={itemsToPrint.length > 1}
      />
    </>
  );
}