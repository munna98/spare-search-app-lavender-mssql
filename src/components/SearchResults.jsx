// src/components/SearchResults.jsx
import React, { useState } from "react";
import { 
  ClipboardDocumentIcon, 
  ClipboardDocumentCheckIcon,
  PrinterIcon
} from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';
import PrintDialog from './PrintDialog';

export default function SearchResults({ results }) {
  const [copiedId, setCopiedId] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [itemsToPrint, setItemsToPrint] = useState([]);

  const handleCopy = async (partNumber, id) => {
    try {
      await navigator.clipboard.writeText(partNumber);
      setCopiedId(id);
      toast.success(`Copied: ${partNumber}`, { autoClose: 2000 });
      
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(results.map(r => r.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handlePrintSingle = (item) => {
    setItemsToPrint([item]);
    setShowPrintDialog(true);
  };

  const handlePrintSelected = () => {
    if (selectedItems.length === 0) {
      toast.warning('Please select at least one item to print');
      return;
    }
    
    const items = results.filter(r => selectedItems.includes(r.id));
    setItemsToPrint(items);
    setShowPrintDialog(true);
  };

  if (!results.length) return null;

  const allSelected = results.length > 0 && selectedItems.length === results.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < results.length;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          Found {results.length} result{results.length !== 1 ? 's' : ''}
        </h2>
        
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

      <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="text-left bg-gray-100 text-sm font-semibold text-gray-700">
              <th className="p-3 border-b w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = someSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  title="Select all"
                />
              </th>
              <th className="p-3 border-b">Part Number</th>
              <th className="p-3 border-b">Brand</th>
              <th className="p-3 border-b">Description</th>
              <th className="p-3 border-b">Price</th>
              <th className="p-3 border-b w-12"></th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {results.map((row, idx) => (
              <tr 
                key={row.id} 
                className={`${
                  idx % 2 === 1 ? "bg-blue-50" : "bg-white"
                } ${
                  selectedItems.includes(row.id) ? "ring-2 ring-blue-400 ring-inset" : ""
                } hover:bg-blue-100 transition-colors`}
              >
                <td className="p-3 border-b">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(row.id)}
                    onChange={() => handleSelectItem(row.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{row.partNumber}</span>
                    <button
                      onClick={() => handleCopy(row.partNumber, row.id)}
                      className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Copy part number"
                    >
                      {copiedId === row.id ? (
                        <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
                      ) : (
                        <ClipboardDocumentIcon className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="p-3 border-b font-medium text-blue-600">{row.brand}</td>
                <td className="p-3 border-b text-gray-700">{row.description}</td>
                <td className="p-3 border-b text-lg font-bold text-gray-900">${row.price}</td>
                <td className="p-3 border-b">
                  <button
                    onClick={() => handlePrintSingle(row)}
                  >
                    <PrinterIcon className="h-5 w-5 text-gray-500 hover:text-gray-700"/>
                    {/* <PrinterIcon className="h-4 w-4" /> */}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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