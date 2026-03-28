import React, { useState } from 'react';
import { DocumentTextIcon, PlayIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import printHeader from '../assets/print-header.png';

export default function DailyTransactionsReport() {
    const today = new Date().toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [type, setType] = useState('sale'); // 'sale' or 'purchase'
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            toast.warning('Please select start and end dates');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            toast.warning('Start date must be before or equal to end date');
            return;
        }

        setLoading(true);
        setHasGenerated(true);
        try {
            const response = await window.electronAPI.getDailyTransactions({
                startDate,
                endDate,
                type
            });

            if (response.success) {
                setTransactions(response.transactions);
                if (response.transactions.length === 0) {
                    toast.info('No transactions found for the selected period');
                } else {
                    toast.success(`Found ${response.transactions.length} transaction(s)`);
                }
            } else {
                toast.error(`Failed to generate report: ${response.message}`);
                setTransactions([]);
            }
        } catch (error) {
            toast.error(`Error generating report: ${error.message}`);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN');
    };

    const formatCurrency = (amount) => {
        return amount.toFixed(2);
    };

    // Calculate summary stats
    const summary = transactions.reduce(
        (acc, t) => {
            if (t.isReturn) {
                acc.returnCount++;
                acc.returnTotal += t.grandTotal;
            } else {
                acc.mainCount++;
                acc.mainTotal += t.grandTotal;
            }
            return acc;
        },
        { mainCount: 0, mainTotal: 0, returnCount: 0, returnTotal: 0 }
    );

    const mainLabel = type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice';
    const returnLabel = type === 'sale' ? 'Sales Return' : 'Purchase Return';
    const reportTitle = type === 'sale' ? 'Daily Sales Report' : 'Daily Purchase Report';

    return (
        <div className="p-6 max-w-5xl mx-auto print:p-0 print:max-w-none">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 print:hidden">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-gray-900">Daily Transactions</h1>
                </div>

                {transactions.length > 0 && (
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <DocumentTextIcon className="h-5 w-5" />
                        Print
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-4 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Type Select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Transaction Type
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="sale">Sale</option>
                            <option value="purchase">Purchase</option>
                        </select>
                    </div>

                    {/* Start Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            From Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            To Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Generate Button */}
                    <div className="flex items-end">
                        <button
                            onClick={handleGenerateReport}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Generating...' : (
                                <div className="flex items-center justify-center gap-2">
                                    <PlayIcon className="h-5 w-5" />
                                    <span>Generate</span>
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {hasGenerated && !loading && transactions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 print:hidden">
                    <div className="bg-white rounded-lg shadow-md p-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{mainLabel}</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.mainTotal)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{summary.mainCount} invoice(s)</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{returnLabel}</p>
                        <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(summary.returnTotal)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{summary.returnCount} return(s)</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(summary.mainTotal - summary.returnTotal)}</p>
                    </div>
                </div>
            )}

            {/* Print Header */}
            {transactions.length > 0 && (
                <div className="hidden print:block mb-6">
                    <img
                        src={printHeader}
                        alt="Header"
                        className="w-full h-auto mb-4"
                        onError={(e) => e.target.style.display = 'none'}
                    />
                    <div className="flex justify-between items-end mb-4 border-b-2 border-gray-800 pb-2">
                        <div className="text-left">
                            <p className="text-sm text-gray-600 font-medium">Report Type:</p>
                            <p className="text-xl font-bold uppercase tracking-wide">{reportTitle}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold mb-1">DAILY TRANSACTIONS</h2>
                            <p className="text-sm font-medium">
                                <span className="text-gray-600">Period:</span> {formatDate(startDate)} - {formatDate(endDate)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Results */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : transactions.length > 0 ? (
                <div className="bg-white rounded-lg shadow-md overflow-hidden print:shadow-none print:rounded-none">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 print:bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                        S.No
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                        Voucher No
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                        Party Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                        Type
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                        Items
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {transactions.map((transaction) => (
                                    <tr key={transaction.transMasterId} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {transaction.sNo}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {formatDate(transaction.transDate)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                            {transaction.voucherNo}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {transaction.partyName}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                            {transaction.voucherType}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 text-center">
                                            {transaction.itemCount}
                                        </td>
                                        <td className={`px-4 py-3 text-sm font-medium text-right ${
                                            transaction.isReturn ? 'text-red-600' : 'text-gray-900'
                                        }`}>
                                            {transaction.isReturn ? '-' : ''}{formatCurrency(transaction.grandTotal)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Footer */}
                    <div className="bg-gray-100 font-bold border-t-2 border-gray-300 print:bg-transparent">
                        <div className="flex justify-end px-4 py-3">
                            <div className="flex items-center gap-8">
                                <div className="text-sm text-gray-900">
                                    {mainLabel} Total:
                                </div>
                                <div className="text-sm text-green-700 text-right min-w-[120px]">
                                    {formatCurrency(summary.mainTotal)}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end px-4 py-3 border-t border-gray-200 print:border-gray-300">
                            <div className="flex items-center gap-8">
                                <div className="text-sm text-gray-900">
                                    {returnLabel} Total:
                                </div>
                                <div className="text-sm text-red-600 text-right min-w-[120px]">
                                    {formatCurrency(summary.returnTotal)}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end px-4 py-3 border-t-2 border-gray-400 print:border-gray-600">
                            <div className="flex items-center gap-8">
                                <div className="text-sm text-gray-900">
                                    Net Total:
                                </div>
                                <div className="text-sm text-blue-700 text-right min-w-[120px]">
                                    {formatCurrency(summary.mainTotal - summary.returnTotal)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : hasGenerated ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center print:shadow-none">
                    <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg">No transactions found for the selected period</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center print:shadow-none">
                    <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg">Select a date range and type, then click Generate</p>
                </div>
            )}

            <style jsx>{`
                @media print {
                    @page {
                        margin: 10mm 15mm 10mm 15mm;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:block {
                        display: block !important;
                    }
                    .print\\:shadow-none {
                        box-shadow: none !important;
                        filter: none !important;
                    }
                    .print\\:p-0 {
                        padding: 0 !important;
                    }
                    table {
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                }
            `}</style>
        </div>
    );
}
