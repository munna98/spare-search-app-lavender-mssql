// File: src/components/RecentSearches.jsx

import { ClockIcon } from "@heroicons/react/24/outline";

export default function RecentSearches({ items, onSelect }) {
  if (!items.length) return null;

  return (
    <div className="mb-2">
      <div className="mb-2 flex items-center text-sm text-gray-600">
        <ClockIcon className="mr-1 h-4 w-4" />
        Recent searches:
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <button
            key={index}
            className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}