import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function CustomerStatementReport({ onBack }) {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(true);

    // Load customers on component mount
    useEffect(() => {
        loadCustomers();

        // Set default date range (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        setEndDate(today.toISOString().split('T')[0]);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await window.electronAPI.getCustomerLedgers();

            if (response.success) {
                setCustomers(response.ledgers);
            } else {
                toast.error(`Failed to load customers: ${response.message}`);
            }
        } catch (error) {
            toast.error(`Error loading customers: ${error.message}`);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!selectedCustomer) {
            toast.warning('Please select a customer');
            return;
        }

        if (!startDate || !endDate) {
            toast.warning('Please select start and end dates');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            toast.warning('Start date must be before end date');
            return;
        }

        setLoading(true);
        try {
            const response = await window.electronAPI.getCustomerStatement({
                ledgerId: parseInt(selectedCustomer),
                startDate: startDate,
                endDate: endDate
            });

            if (response.success) {
                setTransactions(response.transactions);
                if (response.transactions.length === 0) {
                    toast.info('No transactions found for the selected date range');
                } else {
                    toast.success(response.message);
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

    const calculateTotals = () => {
        const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
        const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
        return { totalDebit, totalCredit };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN');
    };

    const formatCurrency = (amount) => {
        return amount.toFixed(2);
    };

    const { totalDebit, totalCredit } = calculateTotals();
    const selectedCustomerName = customers.find(c => c.ledgerId === parseInt(selectedCustomer))?.ledgerName || '';

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                            title="Back"
                        >
                            <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
                        </button>
                        <h1 className="text-3xl font-bold text-gray-900">Customer Statement Report</h1>
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
                <div className="bg-white rounded-lg shadow-md p-6 mb-6 print:hidden">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800">Report Filters</h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Customer Dropdown */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Customer
                            </label>
                            <select
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={loadingCustomers}
                            >
                                <option value="">
                                    {loadingCustomers ? 'Loading...' : 'Select Customer'}
                                </option>
                                {customers.map((customer) => (
                                    <option key={customer.ledgerId} value={customer.ledgerId}>
                                        {customer.ledgerName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Date
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
                                End Date
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
                                disabled={loading || loadingCustomers}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Report Header for Print */}
                {transactions.length > 0 && (
                    <div className="hidden print:block mb-6">
                        <h1 className="text-2xl font-bold text-center mb-2">Customer Statement Report</h1>
                        <div className="text-center text-sm mb-4">
                            <p><strong>Customer:</strong> {selectedCustomerName}</p>
                            <p><strong>Period:</strong> {formatDate(startDate)} to {formatDate(endDate)}</p>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : transactions.length > 0 ? (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            S.No
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Particulars
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            V Type
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            V No
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Debit
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Credit
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {transactions.map((transaction) => (
                                        <tr key={transaction.sNo} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {transaction.sNo}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {formatDate(transaction.date)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {transaction.particulars}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.vType === 'Sales'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {transaction.vType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {transaction.vNo} {transaction.relatedVNo ? `(${transaction.relatedVNo})` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold">
                                    <tr>
                                        <td colSpan="5" className="px-4 py-3 text-sm text-gray-900 text-right">
                                            Total:
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                            {formatCurrency(totalDebit)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                            {formatCurrency(totalCredit)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan="5" className="px-4 py-3 text-sm text-gray-900 text-right">
                                            Balance:
                                        </td>
                                        <td colSpan="2" className={`px-4 py-3 text-sm text-right ${totalDebit - totalCredit >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {formatCurrency(Math.abs(totalDebit - totalCredit))} {totalDebit - totalCredit >= 0 ? 'Dr' : 'Cr'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500 text-lg">Select a customer and date range to generate the report</p>
                    </div>
                )}
            </div>

            <style jsx>{`
        @media print {
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
