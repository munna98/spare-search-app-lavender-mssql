import React, { useState } from 'react';
import { ArrowLeftIcon, DocumentTextIcon, PlayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function OutstandingSummaryReport({ onBack, onDrillDown }) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [reportType, setReportType] = useState('net'); // 'gross' or 'net'
    const [clickedCell, setClickedCell] = useState(null); // { ledgerId, month }

    // Generate year options (last 3 years)
    const yearOptions = [];
    for (let y = currentYear; y >= currentYear - 2; y--) {
        yearOptions.push(y);
    }

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const response = await window.electronAPI.getOutstandingSummary({ year: selectedYear, type: reportType });

            if (response.success) {
                setData(response.data);
                setGenerated(true);
                if (response.data.length === 0) {
                    toast.info('No outstanding balances found for this year');
                } else {
                    toast.success(`Found outstanding data for ${response.data.length} customer(s)`);
                }
            } else {
                toast.error(`Failed to generate report: ${response.message}`);
                setData([]);
            }
        } catch (error) {
            toast.error(`Error generating report: ${error.message}`);
            setData([]);
        } finally {
            setLoading(false);
        }
    };


    const handleCellClick = (customer, month) => {
        const amount = customer.months[month];
        if (!amount) return;

        setClickedCell({ ledgerId: customer.ledgerId, month });

        // Calculate start and end date for the clicked month
        const startDate = `${selectedYear}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, month, 0).getDate();
        const endDate = `${selectedYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Navigate to customer statement report with pre-filled parameters
        if (onDrillDown) {
            onDrillDown({
                ledgerId: customer.ledgerId,
                ledgerName: customer.ledgerName,
                startDate,
                endDate,
                reportType
            });
        }
    };

    const formatCurrency = (amount) => {
        if (!amount || Math.abs(amount) < 0.01) return '';
        return amount.toFixed(2);
    };

    // Calculate monthly totals
    const monthlyTotals = {};
    let grandTotal = 0;
    for (let m = 1; m <= 12; m++) {
        monthlyTotals[m] = data.reduce((sum, c) => sum + (c.months[m] || 0), 0);
    }
    grandTotal = data.reduce((sum, c) => sum + c.total, 0);

    return (
        <div className="p-6 max-w-[1400px] mx-auto print:p-0 print:max-w-none">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="Back"
                    >
                        <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Outstanding Balance Summary</h1>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-2">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Year Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Year
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                        >
                            {yearOptions.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Report Type Toggle */}
                    <div className="flex items-center space-x-2 bg-gray-100 p-2 rounded-md border border-gray-200">
                        <span className={`text-sm font-medium ${reportType === 'gross' ? 'text-blue-600' : 'text-gray-500'}`}>
                            Gross
                        </span>
                        <button
                            onClick={() => setReportType(prev => prev === 'gross' ? 'net' : 'gross')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${reportType === 'net' ? 'bg-blue-600' : 'bg-gray-300'}`}
                            title="Toggle Report Type"
                        >
                            <span
                                className={`${reportType === 'net' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                        <span className={`text-sm font-medium ${reportType === 'net' ? 'text-blue-600' : 'text-gray-500'}`}>
                            Pending Only
                        </span>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
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


            {/* Results */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : data.length > 0 ? (
                <div className="shadow-sm border-2 border-blue-200 rounded-lg bg-blue-50 mt-4 overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-220px)]">
                        <table className="min-w-full divide-y divide-blue-200 border-separate border-spacing-0">
                            <thead className="bg-blue-100 sticky top-0 z-20">
                                <tr className="text-left text-sm font-semibold text-gray-700">
                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-blue-200 sticky left-0 top-0 bg-blue-100 z-30 w-[300px] min-w-[300px] max-w-[300px] truncate">
                                        Customer Name
                                    </th>
                                    {MONTH_NAMES.map((name, i) => (
                                        <th key={i} className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-blue-200 min-w-[60px]">
                                            {name}
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider bg-blue-200 border-b border-blue-300 min-w-[100px] sticky right-0 top-0 z-30">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-blue-100">
                                {data.map((customer, idx) => (
                                    <tr
                                        key={customer.ledgerId}
                                        className={`${idx % 2 === 1 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors group`}
                                    >
                                        <td
                                            className={`px-3 py-2 text-sm text-gray-900 font-semibold whitespace-nowrap sticky left-0 z-10 ${idx % 2 === 1 ? "bg-blue-50" : "bg-white"} group-hover:bg-blue-100 transition-colors border-b border-blue-100 w-[300px] min-w-[300px] max-w-[300px] truncate`}
                                            title={customer.ledgerName}
                                        >
                                            {customer.ledgerName}
                                        </td>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                                            const amount = customer.months[month];
                                            const hasValue = amount && Math.abs(amount) > 0.01;
                                            const isClicked = clickedCell?.ledgerId === customer.ledgerId && clickedCell?.month === month;
                                            return (
                                                <td
                                                    key={month}
                                                    className={`px-3 py-2 text-sm text-right whitespace-nowrap border-b border-blue-100 ${hasValue
                                                        ? 'cursor-pointer hover:bg-blue-200 hover:text-blue-800 font-medium'
                                                        : 'text-gray-400'
                                                        } ${amount && amount < 0 ? 'text-red-600' : 'text-blue-600'} ${isClicked ? 'bg-blue-200 text-blue-800 font-medium ring-2 ring-blue-400 z-10 relative' : ''}`}
                                                    onClick={() => hasValue && handleCellClick(customer, month)}
                                                    title={hasValue ? `Click to view ${customer.ledgerName}'s ${MONTH_NAMES[month - 1]} ${selectedYear} transactions` : ''}
                                                >
                                                    {hasValue ? formatCurrency(amount) : '-'}
                                                </td>
                                            );
                                        })}
                                        <td className={`px-3 py-2 text-sm text-right font-bold whitespace-nowrap bg-blue-50 group-hover:bg-blue-100 border-b border-blue-100 sticky right-0 z-10 ${customer.total < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                                            {formatCurrency(customer.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Monthly Totals Footer */}
                            <tfoot className="sticky bottom-0 z-20">
                                <tr className="bg-blue-200 font-bold border-t-2 border-blue-300">
                                    <td className="px-3 py-3 text-sm text-gray-900 sticky left-0 bottom-0 bg-blue-200 z-30 w-[300px] min-w-[300px] max-w-[300px] truncate">
                                        Monthly Total
                                    </td>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                        <td
                                            key={month}
                                            className={`px-3 py-3 text-sm text-right whitespace-nowrap ${monthlyTotals[month] < 0 ? 'text-red-700' : 'text-blue-800'}`}
                                        >
                                            {Math.abs(monthlyTotals[month]) > 0.01 ? formatCurrency(monthlyTotals[month]) : '-'}
                                        </td>
                                    ))}
                                    <td className={`px-3 py-3 text-sm text-right font-bold whitespace-nowrap bg-blue-300 sticky right-0 bottom-0 z-30 ${grandTotal < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                                        {formatCurrency(grandTotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : generated ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center mt-4">
                    <MagnifyingGlassIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg">No outstanding balances found for {selectedYear}</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center mt-4">
                    <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg">Select a year and click Generate to view the outstanding summary</p>
                </div>
            )}

        </div>
    );
}
