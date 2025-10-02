// File: src/components/SearchResults.jsx
import React from "react";

export default function SearchResults({ results }) {
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
              <td className="p-3 border">{row.partNumber}</td>
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