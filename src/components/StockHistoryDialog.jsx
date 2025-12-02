import React, { useState, useEffect, useMemo } from 'react';
import {
    XMarkIcon,
    CubeIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ChevronDownIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function StockHistoryDialog({ isOpen, onClose, partNumber, productId }) {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [filter, setFilter] = useState('all');
    const [visibleCount, setVisibleCount] = useState(20);

    useEffect(() => {
        if (isOpen && productId) {
            loadStockHistory();
            setFilter('all');
            setVisibleCount(20);
        }
    }, [isOpen, productId]);

    const loadStockHistory = async () => {
        setLoading(true);
        try {
            const response = await window.electronAPI.getStockHistory({
                productId,
                limit: 1000
            });

            if (response.success) {
                const sortedHistory = (response.history || []).sort((a, b) =>
                    new Date(b.transDate) - new Date(a.transDate)
                );
                setHistory(sortedHistory);
            } else {
                toast.error(`Failed to load: ${response.message}`);
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const summary = useMemo(() => {
        return history.reduce((acc, item) => {
            const stockIn = Number(item.stockIn) || 0;
            const stockOut = Number(item.stockOut) || 0;
            acc.totalIn += stockIn;
            acc.totalOut += stockOut;
            return acc;
        }, { totalIn: 0, totalOut: 0 });
    }, [history]);

    const currentStock = useMemo(() => {
        return history.reduce((balance, item) => {
            const stockIn = Number(item.stockIn) || 0;
            const stockOut = Number(item.stockOut) || 0;
            return balance + (stockIn - stockOut);
        }, 0);
    }, [history]);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit', month: '2-digit', year: '2-digit'
        });
    };

    const filteredHistory = history.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'in') return item.stockIn > 0;
        if (filter === 'out') return item.stockOut > 0;
        return true;
    });

    const visibleHistory = filteredHistory.slice(0, visibleCount);
    const hasMore = visibleCount < filteredHistory.length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header - Following DBConfig Style */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <CubeIcon className="h-7 w-7 text-blue-200" />
                            <div>
                                <h2 className="text-xl font-bold">Stock Movement History</h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    Part Number: <span className="font-semibold">{partNumber}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6">
                            <div className=" flex items-center text-right gap-2">
                                <p className="text-blue-100 text-sm font-medium">Current Stock:</p>
                                <p className="text-2xl font-bold">{currentStock}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">

                        {/* Filter Buttons */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <FunnelIcon className="h-4 w-4 inline mr-2" />
                                Filter Transactions
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'all', label: 'All Transactions' },
                                    { value: 'in', label: 'Stock In' },
                                    { value: 'out', label: 'Stock Out' }
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setFilter(option.value)}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === option.value
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Transaction Table */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        <tr>
                                            <th className="p-3 border-b border-gray-200">
                                                Date
                                            </th>
                                            <th className="p-3 border-b border-gray-200">Type</th>
                                            <th className="p-3 border-b border-gray-200">
                                                V No
                                            </th>
                                            <th className="p-3 border-b border-gray-200">
                                                Party Name
                                            </th>
                                            <th className="p-3 border-b border-gray-200 text-right">
                                                Rate
                                            </th>
                                            <th className="p-3 border-b border-gray-200 text-right">Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="py-20 text-center text-gray-500">
                                                    <div className="flex flex-col items-center">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                                                        <p className="font-medium">Loading transaction history...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : visibleHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="py-20 text-center">
                                                    <FunnelIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                                    <p className="text-gray-500 font-medium">No transactions found</p>
                                                    <p className="text-xs text-gray-400 mt-1">Try adjusting your filter</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            visibleHistory.map((item, index) => {
                                                const isIn = item.stockIn > 0;
                                                return (
                                                    <tr
                                                        key={index}
                                                        className={`transition-colors hover:bg-blue-50 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                                                            }`}
                                                    >
                                                        <td className="p-3 whitespace-nowrap text-gray-600 font-mono text-xs">
                                                            {formatDate(item.transDate)}
                                                        </td>
                                                        <td className="p-3 whitespace-nowrap">
                                                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isIn
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                {item.transactionType || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 whitespace-nowrap text-gray-700 font-medium">
                                                            {item.voucherNo || '-'}
                                                        </td>
                                                        <td className="p-3 text-gray-900 max-w-xs truncate" title={item.partyName}>
                                                            {item.partyName || '-'}
                                                        </td>
                                                        <td className="p-3 whitespace-nowrap text-right text-gray-700 font-mono">
                                                            ₹{(isIn ? item.pRate : item.sRate)?.toFixed(2) || '0.00'}
                                                        </td>
                                                        <td className={`p-3 whitespace-nowrap text-right font-bold font-mono text-base ${isIn ? 'text-green-700' : 'text-red-700'
                                                            }`}>
                                                            {isIn ? `+${item.stockIn}` : `-${item.stockOut}`}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Load More */}
                            {hasMore && !loading && (
                                <div className="p-3 text-center border-t bg-gray-50">
                                    <button
                                        onClick={() => setVisibleCount(prev => prev + 20)}
                                        className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 mx-auto px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <ChevronDownIcon className="h-4 w-4" />
                                        Load More ({filteredHistory.length - visibleCount} remaining)
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer Info */}
                        <div className="text-xs text-gray-500 text-center">
                            Displaying {Math.min(visibleCount, filteredHistory.length)} of {filteredHistory.length} transactions
                            {filter !== 'all' && ' (filtered)'}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}