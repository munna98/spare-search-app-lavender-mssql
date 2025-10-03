import React from "react";
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';

export default function SearchResults({ results }) {
  const [copiedId, setCopiedId] = React.useState(null);

  const handleCopy = async (partNumber, id) => {
    try {
      await navigator.clipboard.writeText(partNumber);
      setCopiedId(id);
      toast.success(`Copied: ${partNumber}`, { autoClose: 2000 });
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!results.length) return null;

  return (
    <>
      <h2 className="mb-4 text-xl font-semibold text-gray-800">
        Found {results.length} results
      </h2>
      <table className="w-full table-auto border-t text-sm">
        <thead>
          <tr className="text-left bg-gray-100 text-sm font-semibold text-gray-700">
            <th className="p-3 border">Part Number</th>
            <th className="p-3 border">Brand</th>
            <th className="p-3 border">Description</th>
            <th className="p-3 border">Price</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row, idx) => (
            <tr key={idx} className={idx % 2 === 1 ? "bg-blue-50" : ""}>
              <td className="p-3 border">
                <div className="flex items-center justify-between">
                  <span>{row.partNumber}</span>
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
              <td className="p-3 border font-medium text-blue-600">{row.brand}</td>
              <td className="p-3 border">{row.description}</td>
              <td className="p-3 border text-lg font-bold">{row.price}</td>
            </tr>
          ))}
        </tbody> 
      </table>
    </>
  );
}