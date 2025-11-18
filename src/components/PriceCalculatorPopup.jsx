// src/components/PriceCalculatorPopup.jsx

import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function PriceCalculatorPopup({ isOpen, onClose, basePrice, onCalculate, position }) {
  const [percentage, setPercentage] = useState(25);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const popupRef = useRef(null);

  useEffect(() => {
    if (isOpen && basePrice) {
      calculatePrice(percentage);
    }
  }, [isOpen, basePrice, percentage]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const calculatePrice = (percent) => {
    const increase = (basePrice * percent) / 100;
    const total = basePrice + increase;
    setCalculatedPrice(total);
  };

  const handlePercentageChange = (value) => {
    const newPercentage = Math.max(0, Math.min(100, value));
    setPercentage(newPercentage);
    calculatePrice(newPercentage);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="absolute z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-400 p-3 w-64"
      style={{
        top: position.top,
        left: position.left,
        animation: 'slideIn 0.15s ease-out'
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2  p-0.5 hover:bg-gray-100 rounded transition-colors"
      >
        <XMarkIcon className="h-5 w-5 text-gray-400" />
      </button>

      {/* Price Display */}
      <div className="space-y-2 mt-5 mb-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Base:</span>
          <span className="font-semibold text-gray-900">${basePrice?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Markup:</span>
          <span className="font-semibold text-blue-600">+{percentage}%</span>
        </div>
        <div className="h-px bg-gray-200"></div>
        <div className="flex justify-between">
          <span className="text-gray-700 font-medium">Final:</span>
          <span className="font-bold text-lg text-blue-600">${calculatedPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* Percentage Input */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2 w-full">
          <button
            onClick={() => handlePercentageChange(percentage - 1)}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors"
          >
            <MinusIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center justify-center flex-1 relative">
            <input
              type="number"
              value={percentage}
              onChange={(e) => handlePercentageChange(parseFloat(e.target.value) || 0)}
              className="w-full h-10 px-2 py-1 pr-7 text-center text-lg font-bold border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max="100"
              step="1"
            />
            <span className="absolute right-2 text-lg font-bold text-gray-500 pointer-events-none">%</span>
          </div>
          <button
            onClick={() => handlePercentageChange(percentage + 1)}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="mb-3">
        <div className="grid grid-cols-5 gap-1">
          {[20, 25, 27, 30, 50].map((percent) => (
            <button
              key={percent}
              onClick={() => handlePercentageChange(percent)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${percentage === percent
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}