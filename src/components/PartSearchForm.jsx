import React, { useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function PartSearchForm({ onSearch }) {
  const [input, setInput] = useState("");
  const [searchMode, setSearchMode] = useState("contains");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) onSearch(input.trim(), searchMode);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-4 bg-white shadow-sm border-2 border-gray-100 rounded-xl mb-4"
    >
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Part Number 
          </label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-4 py-2 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter part number"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md flex hover:bg-blue-700 shadow"
        >
          <MagnifyingGlassIcon className="h-5 w-5 mr-2 text-white" />
          Search
        </button>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="text-gray-700">Search mode:</div>
        <label className="flex items-center">
          <input
            type="radio"
            name="searchMode"
            value="contains"
            checked={searchMode === "contains"}
            onChange={() => setSearchMode("contains")}
            className="mr-1"
          />
          Contains
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="searchMode"
            value="startsWith"
            checked={searchMode === "startsWith"}
            onChange={() => setSearchMode("startsWith")}
            className="mr-1"
          />
          Starts with
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="searchMode"
            value="endsWith"
            checked={searchMode === "endsWith"}
            onChange={() => setSearchMode("endsWith")}
            className="mr-1"
          />
          Ends with
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="searchMode"
            value="exact"
            checked={searchMode === "exact"}
            onChange={() => setSearchMode("exact")}
            className="mr-1"
          />
          Exact match
        </label>
      </div>
    </form>
  );
}