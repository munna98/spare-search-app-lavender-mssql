import React, { useState, useEffect, useRef } from 'react';
import { ChevronUpDownIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Select option...',
    loading = false,
    className = '',
    disabled = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const listRef = useRef(null);
    const inputRef = useRef(null);

    // Get selected option label
    const selectedOption = options.find(opt => opt.value === value);

    // Filter options based on search
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handle click outside to close
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    // Handle initial search term reset and focus logic when opening
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');

            // Find currently selected value's index in the full options list
            // Since filtering is reset (searchTerm=''), filteredOptions === options
            let initialFocus = -1;
            if (value) {
                initialFocus = options.findIndex(opt => opt.value === value);
            }
            // If nothing selected or not found, focus first item if available
            if (initialFocus === -1 && options.length > 0) {
                initialFocus = 0;
            }

            setFocusedIndex(initialFocus);

            // Focus input when opened
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen, value, options]);

    // Update focused index when filtered options due to search
    useEffect(() => {
        // When searching, reset focus to the first result
        setFocusedIndex(0);
    }, [searchTerm]);

    // Scroll focused item into view
    useEffect(() => {
        if (isOpen && listRef.current && focusedIndex >= 0) {
            const list = listRef.current;
            const item = list.querySelector(`[data-index="${focusedIndex}"]`);
            if (item) {
                item.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    const handleKeyDown = (e) => {
        // If closed, open on specific keys
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault();
                !disabled && setIsOpen(true);
            }
            return;
        }

        // If open, handle navigation
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredOptions.length > 0 && focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
                    const option = filteredOptions[focusedIndex];
                    handleSelect(option);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            default:
                break;
        }
    };

    const handleSelect = (option) => {
        onChange(option.value);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div
            className={`relative ${className}`}
            ref={wrapperRef}
            onKeyDown={handleKeyDown}
        >
            <button
                type="button"
                className={`w-full bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-left cursor-default sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={`block truncate ${!selectedOption ? 'text-gray-500' : 'text-gray-900'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
            </button>

            {isOpen && (
                <div
                    className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
                    ref={listRef}
                >
                    {/* Search Input */}
                    <div className="sticky top-0 z-10 bg-white px-2 py-1.5 border-b border-gray-100">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-8 pr-3 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    {loading ? (
                        <div className="px-3 py-2 text-gray-500 text-center">Loading...</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="px-3 py-2 text-gray-500 text-center">No results found</div>
                    ) : (
                        filteredOptions.map((option, index) => (
                            <div
                                key={option.value}
                                data-index={index}
                                className={`cursor-pointer select-none relative py-2 pl-3 pr-9 ${index === focusedIndex ? 'bg-blue-100 text-blue-900' : 'text-gray-900 hover:bg-blue-50'
                                    } ${option.value === value ? 'font-semibold' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur
                                    handleSelect(option);
                                }}
                                onMouseEnter={() => setFocusedIndex(index)}
                            >
                                <span className="block truncate">
                                    {option.label}
                                </span>
                                {option.value === value && (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
