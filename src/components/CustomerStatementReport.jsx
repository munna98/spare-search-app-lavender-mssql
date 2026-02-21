import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, DocumentTextIcon, PlayIcon } from '@heroicons/react/24/outline';
import SearchableSelect from './SearchableSelect';
import { toast } from 'react-toastify';
import printHeader from '../assets/print-header.png';

export default function CustomerStatementReport({ onBack, drillDownParams }) {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedCustomerName, setSelectedCustomerName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [pendingInvoices, setPendingInvoices] = useState([]);
    const [paidInvoices, setPaidInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [activeTab, setActiveTab] = useState('statement'); // 'statement', 'pending', or 'paid'
    const [paidSearchMode, setPaidSearchMode] = useState('customer'); // 'customer' or 'invoice'
    const [invoiceSearchNo, setInvoiceSearchNo] = useState('');
    const [searchingInvoice, setSearchingInvoice] = useState(false);

    // Load customers on component mount
    useEffect(() => {
        loadCustomers();

        // Set default date range (today)
        const today = new Date();

        if (drillDownParams) {
            setStartDate(drillDownParams.startDate);
            setEndDate(drillDownParams.endDate);
            if (drillDownParams.reportType === 'net') {
                setActiveTab('pending');
            } else if (drillDownParams.reportType === 'gross') {
                setActiveTab('statement');
            }
        } else {
            setEndDate(today.toISOString().split('T')[0]);
            setStartDate(today.toISOString().split('T')[0]);
        }
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await window.electronAPI.getCustomerLedgers();

            if (response.success) {
                setCustomers(response.ledgers);

                // If drill-down params, auto-select customer and generate
                if (drillDownParams) {
                    const ledgerId = drillDownParams.ledgerId;
                    setSelectedCustomer(ledgerId);
                    setSelectedCustomerName(drillDownParams.ledgerName || '');

                    // Auto-generate after a brief delay to allow state to settle
                    setTimeout(() => {
                        autoGenerate(ledgerId, drillDownParams.startDate, drillDownParams.endDate);
                    }, 100);
                }
            } else {
                toast.error(`Failed to load customers: ${response.message}`);
            }
        } catch (error) {
            toast.error(`Error loading customers: ${error.message}`);
        } finally {
            setLoadingCustomers(false);
        }
    };

    // Auto-generate report (used by drill-down)
    const autoGenerate = async (ledgerId, start, end) => {
        setLoading(true);
        try {
            const statementResponse = await window.electronAPI.getCustomerStatement({
                ledgerId: parseInt(ledgerId),
                startDate: start,
                endDate: end
            });

            if (statementResponse.success) {
                setTransactions(statementResponse.transactions);
            } else {
                toast.error(`Failed to generate statement: ${statementResponse.message}`);
            }

            const pendingResponse = await window.electronAPI.getPendingInvoices({
                ledgerId: parseInt(ledgerId),
                startDate: start,
                endDate: end
            });

            if (pendingResponse.success) {
                setPendingInvoices(pendingResponse.invoices);
            } else {
                toast.error(`Failed to fetch pending invoices: ${pendingResponse.message}`);
            }

            const paidResponse = await window.electronAPI.getPaidInvoices({
                ledgerId: parseInt(ledgerId),
                startDate: start,
                endDate: end
            });

            if (paidResponse.success) {
                setPaidInvoices(paidResponse.invoices);
            } else {
                toast.error(`Failed to fetch paid invoices: ${paidResponse.message}`);
            }
        } catch (error) {
            toast.error(`Error generating report: ${error.message}`);
        } finally {
            setLoading(false);
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
            // Fetch Customer Statement
            const statementResponse = await window.electronAPI.getCustomerStatement({
                ledgerId: parseInt(selectedCustomer),
                startDate: startDate,
                endDate: endDate
            });

            if (statementResponse.success) {
                setTransactions(statementResponse.transactions);
                if (statementResponse.transactions.length === 0) {
                    toast.info('No statement transactions found');
                }
            } else {
                toast.error(`Failed to generate statement: ${statementResponse.message}`);
                setTransactions([]);
            }

            // Fetch Pending Invoices
            const pendingResponse = await window.electronAPI.getPendingInvoices({
                ledgerId: parseInt(selectedCustomer),
                startDate: startDate,
                endDate: endDate
            });

            if (pendingResponse.success) {
                setPendingInvoices(pendingResponse.invoices);
                if (pendingResponse.invoices.length === 0) {
                    // Only toast if specifically looking for pending invoices
                    if (activeTab === 'pending') {
                        toast.info('No pending invoices found');
                    }
                }
            } else {
                toast.error(`Failed to fetch pending invoices: ${pendingResponse.message}`);
                setPendingInvoices([]);
            }

            // Fetch Paid Invoices
            const paidResponse = await window.electronAPI.getPaidInvoices({
                ledgerId: parseInt(selectedCustomer),
                startDate: startDate,
                endDate: endDate
            });

            if (paidResponse.success) {
                setPaidInvoices(paidResponse.invoices);
                if (paidResponse.invoices.length === 0) {
                    // Only toast if specifically looking for paid invoices
                    if (activeTab === 'paid') {
                        toast.info('No paid invoices found');
                    }
                }
            } else {
                toast.error(`Failed to fetch paid invoices: ${paidResponse.message}`);
                setPaidInvoices([]);
            }

            if (statementResponse.success || pendingResponse.success || paidResponse.success) {
                toast.success('Report updated successfully');
            }
        } catch (error) {
            toast.error(`Error generating report: ${error.message}`);
            setTransactions([]);
            setPendingInvoices([]);
            setPaidInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    // Handle search by invoice number
    const handleInvoiceSearch = async () => {
        if (!invoiceSearchNo) {
            toast.error('Please enter an invoice number');
            return;
        }

        setSearchingInvoice(true);
        try {
            const response = await window.electronAPI.searchPaidInvoiceByNumber(parseInt(invoiceSearchNo));
            if (response.success) {
                setPaidInvoices(response.invoices);
                if (response.invoices.length === 0) {
                    toast.info('No payment records found for this invoice');
                }
            } else {
                toast.error(`Search failed: ${response.message}`);
                setPaidInvoices([]);
            }
        } catch (error) {
            toast.error(`Error searching invoice: ${error.message}`);
            setPaidInvoices([]);
        } finally {
            setSearchingInvoice(false);
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

    return (
        <div className="p-6 max-w-4xl mx-auto print:p-0 print:max-w-none">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 print:hidden">
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

                {(transactions.length > 0 || pendingInvoices.length > 0) && (
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
            <div className="bg-white rounded-lg shadow-md p-6 mb-2 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Customer Dropdown */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Customer
                        </label>
                        <SearchableSelect
                            options={React.useMemo(() =>
                                customers.map(c => ({ value: c.ledgerId, label: c.ledgerName })),
                                [customers]
                            )}
                            value={selectedCustomer}
                            onChange={(val) => {
                                setSelectedCustomer(val);
                                const customer = customers.find(c => c.ledgerId === val);
                                setSelectedCustomerName(customer ? customer.ledgerName : '');
                            }}
                            placeholder={loadingCustomers ? 'Loading...' : 'Select Customer'}
                            loading={loadingCustomers}
                            disabled={loadingCustomers}
                        />
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

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 print:hidden">
                <button
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'statement'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    onClick={() => setActiveTab('statement')}
                >
                    Customer Statement
                </button>
                <button
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'pending'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    onClick={() => setActiveTab('pending')}
                >
                    Pending Invoices
                </button>
                <button
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'paid'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    onClick={() => setActiveTab('paid')}
                >
                    Paid Invoices
                </button>
            </div>

            {/* Report Header for Print */}
            {(activeTab === 'statement' ? transactions.length > 0 : activeTab === 'pending' ? pendingInvoices.length > 0 : paidInvoices.length > 0) && (
                <div className="hidden print:block mb-6">
                    {/* Main Banner Image */}
                    <img
                        src={printHeader}
                        alt="Header"
                        className="w-full h-auto mb-4"
                        onError={(e) => e.target.style.display = 'none'}
                    />

                    {/* Report Information Section */}
                    <div className="flex justify-between items-end mb-4 border-b-2 border-gray-800 pb-2">
                        <div className="text-left">
                            <p className="text-sm text-gray-600 font-medium">Prepared for:</p>
                            <p className="text-xl font-bold uppercase tracking-wide">{selectedCustomerName}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold mb-1">
                                {activeTab === 'statement' ? 'CUSTOMER STATEMENT' : activeTab === 'pending' ? 'PENDING INVOICES' : 'PAID INVOICES'}
                            </h2>
                            <p className="text-sm font-medium">
                                <span className="text-gray-600">Period:</span> {formatDate(startDate)} - {formatDate(endDate)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Table */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : activeTab === 'statement' ? (
                transactions.length > 0 ? (
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
                                            Particulars
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            V No
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            Debit
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
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
                                                {transaction.vNo} {transaction.relatedVNo ? <span className="text-xs">({transaction.relatedVNo})</span> : ''}
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
                            </table>
                        </div>

                        {/* Totals Section - Outside table to appear only on last page */}
                        <div className="bg-gray-100 font-bold border-t-2 border-gray-300 print:bg-transparent">
                            <div className="flex justify-end px-4 py-3">
                                <div className="flex items-center gap-8">
                                    <div className="text-sm text-gray-900">
                                        Total:
                                    </div>
                                    <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                        {formatCurrency(totalDebit)}
                                    </div>
                                    <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                        {formatCurrency(totalCredit)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end px-4 py-3 border-t border-gray-200 print:border-gray-300">
                                <div className="flex items-center gap-8">
                                    <div className="text-sm text-gray-900">
                                        Balance:
                                    </div>
                                    <div className={`text-sm text-right min-w-[208px] ${totalDebit - totalCredit >= 0 ? 'text-green-600 print:text-gray-900' : 'text-red-600 print:text-gray-900'
                                        }`}>
                                        {formatCurrency(Math.abs(totalDebit - totalCredit))} {totalDebit - totalCredit >= 0 ? 'Dr' : 'Cr'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center print:shadow-none">
                        <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500 text-lg">Select a customer and date range to generate the statement</p>
                    </div>
                )
            ) : activeTab === 'pending' ? (
                pendingInvoices.length > 0 ? (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden print:shadow-none print:rounded-none">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 print:bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            S No
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            Invoice No
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            Amount
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            Paid
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            Returns
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                            Balance
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {pendingInvoices.map((invoice, index) => (
                                        <tr key={invoice.transMasterId} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {index + 1}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {invoice.invoiceNo}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {formatDate(invoice.invoiceDate)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                {formatCurrency(invoice.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                {formatCurrency(invoice.paid)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                {invoice.returns && invoice.returns.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {invoice.returns.map((ret, idx) => (
                                                            <div key={idx} className="text-gray-900">
                                                                {formatCurrency(ret.returnAmount)} <span className="text-xs">({ret.returnVoucherNo})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-red-600 text-right print:text-gray-900">
                                                {formatCurrency(invoice.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals Section - Outside table to appear only on last page */}
                        <div className="bg-gray-100 font-bold border-t-2 border-gray-300 print:bg-transparent">
                            <div className="flex justify-end px-4 py-3">
                                <div className="flex items-center gap-8">
                                    <div className="text-sm text-gray-900">
                                        Total Pending:
                                    </div>
                                    <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                        {formatCurrency(pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0))}
                                    </div>
                                    <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                        {formatCurrency(pendingInvoices.reduce((sum, inv) => sum + inv.paid, 0))}
                                    </div>
                                    <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                        {/* Empty cell for Returns column */}
                                    </div>
                                    <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                        {formatCurrency(pendingInvoices.reduce((sum, inv) => sum + inv.balance, 0))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center print:shadow-none">
                        <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500 text-lg">Select a customer and date range to show pending invoices</p>
                    </div>
                )
            ) : (
                <>
                    {/* Search Mode Toggle */}
                    <div className="bg-white rounded-lg shadow-md p-4 mb-4 print:hidden">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Search by:</label>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${paidSearchMode === 'customer'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                        onClick={() => setPaidSearchMode('customer')}
                                    >
                                        Customer & Date
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${paidSearchMode === 'invoice'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                        onClick={() => setPaidSearchMode('invoice')}
                                    >
                                        Invoice No
                                    </button>
                                </div>
                            </div>
                            {paidSearchMode === 'invoice' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={invoiceSearchNo}
                                        onChange={(e) => setInvoiceSearchNo(e.target.value)}
                                        placeholder="Enter Invoice Number"
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && invoiceSearchNo) {
                                                handleInvoiceSearch();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleInvoiceSearch}
                                        disabled={!invoiceSearchNo || searchingInvoice}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {searchingInvoice ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    {paidInvoices.length > 0 ? (
                        <div className="bg-white rounded-lg shadow-md overflow-hidden print:shadow-none print:rounded-none">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 print:bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                                S No
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                                Invoice No
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                                Invoice Amount
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                                Paid Amount
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-gray-700">
                                                Closing Voucher
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paidInvoices.map((invoice, index) => (
                                            <tr key={`${invoice.transMasterId}-${invoice.closingVoucherNo}-${index}`} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {invoice.invoiceNo}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {formatDate(invoice.transDate)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                    {formatCurrency(invoice.invoiceAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                                    {formatCurrency(invoice.paidAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {invoice.closingVoucherNo ? `${invoice.closingVoucherNo}-${invoice.voucherName}` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals Section */}
                            <div className="bg-gray-100 font-bold border-t-2 border-gray-300 print:bg-transparent">
                                <div className="flex justify-end px-4 py-3">
                                    <div className="flex items-center gap-8">
                                        <div className="text-sm text-gray-900">
                                            Total:
                                        </div>
                                        <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                            {formatCurrency(paidInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0))}
                                        </div>
                                        <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                            {formatCurrency(paidInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0))}
                                        </div>
                                        <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                            {/* Empty cells for Closing Voucher and Voucher Name columns */}
                                        </div>
                                        <div className="text-sm text-gray-900 text-right min-w-[100px]">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-md p-12 text-center print:shadow-none">
                            <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-500 text-lg">
                                {paidSearchMode === 'invoice'
                                    ? 'Enter an invoice number and click Search'
                                    : 'Select a customer and date range to show paid invoices'}
                            </p>
                        </div>
                    )}
                </>
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
