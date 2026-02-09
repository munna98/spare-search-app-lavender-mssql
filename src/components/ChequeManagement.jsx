import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeftIcon,
    PlusIcon,
    MinusIcon,
    PencilIcon,
    TrashIcon,
    FunnelIcon,
    XMarkIcon,
    ChevronDownIcon,
    CalendarIcon
} from '@heroicons/react/24/outline';
import SearchableSelect from './SearchableSelect';
import { toast } from 'react-toastify';

const STATUS_OPTIONS = [
    { value: 'Pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'Deposited', label: 'Deposited', color: 'bg-purple-100 text-purple-800' },
    { value: 'Bounced', label: 'Bounced', color: 'bg-red-100 text-red-800' },
    { value: 'Cleared', label: 'Cleared', color: 'bg-teal-100 text-teal-800' }
];

const TRANSACTION_TYPES = [
    { value: 'Received', label: 'Received (From Customer)', color: 'text-teal-600' },
    { value: 'Given', label: 'Given (To Supplier)', color: 'text-purple-600' }
];

export default function ChequeManagement({ onBack }) {
    const [cheques, setCheques] = useState([]);
    const [parties, setParties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingParties, setLoadingParties] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [activeFilterColumn, setActiveFilterColumn] = useState(null);
    const [editingCheque, setEditingCheque] = useState(null);
    const partyFilterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (partyFilterRef.current && !partyFilterRef.current.contains(event.target)) {
                setActiveFilterColumn(null);
            }
        };

        if (activeFilterColumn === 'party') {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeFilterColumn]);
    const [filters, setFilters] = useState({
        status: '',
        transactionType: '',
        partyLedgerId: '',
        startDate: '',
        endDate: ''
    });

    // Form state
    const [formData, setFormData] = useState({
        chequeNo: '',
        transactionType: 'Received',
        transactionDate: '',
        partyLedgerId: '',
        partyName: '',
        chequeAmount: '',
        chequeDate: '',
        status: 'Pending',
        remarks: ''
    });

    useEffect(() => {
        loadParties();
        loadCheques();
    }, []);

    const loadParties = async () => {
        try {
            const response = await window.electronAPI.getAllParties();
            if (response.success) {
                setParties(response.parties);
            } else {
                toast.error(`Failed to load parties: ${response.message}`);
            }
        } catch (error) {
            toast.error(`Error loading parties: ${error.message}`);
        } finally {
            setLoadingParties(false);
        }
    };

    const loadCheques = async (appliedFilters = filters) => {
        setLoading(true);
        try {
            const response = await window.electronAPI.getCheques(appliedFilters);
            if (response.success) {
                setCheques(response.cheques);
            } else {
                toast.error(`Failed to load cheques: ${response.message}`);
            }
        } catch (error) {
            toast.error(`Error loading cheques: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.chequeNo || !formData.transactionDate || !formData.partyLedgerId ||
            !formData.chequeAmount || !formData.chequeDate) {
            console.log(formData);
            toast.warning('Please fill in all required fields');
            return;
        }

        try {
            const response = editingCheque
                ? await window.electronAPI.updateCheque(editingCheque.id, formData)
                : await window.electronAPI.createCheque(formData);

            if (response.success) {
                toast.success(response.message);
                resetForm();
                loadCheques();
            } else {
                toast.error(response.message);
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        }
    };

    const handleEdit = (cheque) => {
        setEditingCheque(cheque);
        setFormData({
            chequeNo: cheque.chequeNo,
            transactionType: cheque.transactionType,
            transactionDate: cheque.transactionDate ? new Date(cheque.transactionDate).toISOString().split('T')[0] : '',
            partyLedgerId: cheque.partyLedgerId,
            partyName: cheque.partyName,
            chequeAmount: cheque.chequeAmount,
            chequeDate: cheque.chequeDate ? new Date(cheque.chequeDate).toISOString().split('T')[0] : '',
            status: cheque.status,
            remarks: cheque.remarks || ''
        });
        setShowForm(true);
    };

    const handleDelete = async (chequeId) => {
        if (!window.confirm('Are you sure you want to delete this cheque?')) return;

        try {
            const response = await window.electronAPI.deleteCheque(chequeId);
            if (response.success) {
                toast.success(response.message);
                loadCheques();
            } else {
                toast.error(response.message);
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        }
    };

    const resetForm = () => {
        setFormData({
            chequeNo: '',
            transactionType: 'Received',
            transactionDate: '',
            partyLedgerId: '',
            partyName: '',
            chequeAmount: '',
            chequeDate: '',
            status: 'Pending',
            remarks: ''
        });
        setEditingCheque(null);
        setShowForm(false);
    };

    const applyFilters = () => {
        loadCheques(filters);
    };

    const clearFilters = () => {
        const emptyFilters = {
            status: '',
            transactionType: '',
            partyLedgerId: '',
            startDate: '',
            endDate: ''
        };
        setFilters(emptyFilters);
        loadCheques(emptyFilters);
    };

    const formatCurrency = (amount) => {
        return parseFloat(amount).toFixed(2);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-IN');
    };

    const getStatusBadge = (status) => {
        const statusOption = STATUS_OPTIONS.find(s => s.value === status);
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusOption?.color || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        );
    };

    const calculateRemainingDays = (chequeDate) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(chequeDate);
        target.setHours(0, 0, 0, 0);
        const diffTime = target - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getRemainingDaysBadge = (chequeDate, status) => {
        if (status !== 'Pending') return null;

        const days = calculateRemainingDays(chequeDate);

        let colorClass, text;
        if (days < 0) {
            colorClass = 'bg-red-100 text-red-800';
            text = `Overdue by ${Math.abs(days)} days`;
        } else if (days === 0) {
            colorClass = 'bg-red-100 text-red-800';
            text = 'Today';
        } else if (days === 1) {
            colorClass = 'bg-orange-100 text-orange-800';
            text = 'Tomorrow';
        } else if (days <= 2) {
            colorClass = 'bg-orange-100 text-orange-800';
            text = `${days} days`;
        } else if (days <= 7) {
            colorClass = 'bg-yellow-100 text-yellow-800';
            text = `${days} days`;
        } else {
            colorClass = 'bg-green-100 text-green-800';
            text = `${days} days`;
        }

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                {text}
            </span>
        );
    };


    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="Back"
                    >
                        <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Cheque Management</h1>
                </div>

                <div className="flex gap-2">
                    {Object.values(filters).some(v => v !== '') && (
                        <button
                            onClick={clearFilters}
                            className="px-4 py-2 text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1 text-sm font-medium"
                        >
                            <XMarkIcon className="h-4 w-4" />
                            Clear All Filters
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                        {showForm ? <MinusIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                        {showForm ? 'Hide Form' : 'New Cheque'}
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">
                        {editingCheque ? 'Edit Cheque' : 'Create New Cheque'}
                    </h2>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Transaction Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Transaction Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.transactionType}
                                    onChange={(e) => setFormData({ ...formData, transactionType: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                >
                                    {TRANSACTION_TYPES.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Party Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Party Name <span className="text-red-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={parties.map(p => ({
                                        value: p.ledgerId,
                                        label: p.ledgerName
                                    }))}
                                    value={formData.partyLedgerId}
                                    onChange={(val) => {
                                        const party = parties.find(p => p.ledgerId === val);
                                        setFormData({
                                            ...formData,
                                            partyLedgerId: val,
                                            partyName: party?.ledgerName || ''
                                        });
                                    }}
                                    placeholder={loadingParties ? 'Loading...' : 'Select Party'}
                                    loading={loadingParties}
                                    disabled={loadingParties}
                                />
                            </div>

                            {/* Cheque No */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cheque No <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.chequeNo}
                                    onChange={(e) => setFormData({ ...formData, chequeNo: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            {/* Cheque Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cheque Amount <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.chequeAmount}
                                    onChange={(e) => setFormData({ ...formData, chequeAmount: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            {/* Transaction Date (Received/Given) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {formData.transactionType === 'Received' ? 'Received Date' : 'Given Date'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.transactionDate}
                                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            {/* Cheque Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cheque Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.chequeDate}
                                    onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    {STATUS_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Remarks
                                </label>
                                <textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    rows="1"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex gap-3 mt-6">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                            >
                                {editingCheque ? 'Update Cheque' : 'Create Cheque'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}


            {/* Cheques List */}
            <div className="bg-white">
                <div className="flex items-center mb-3">
                    <div className="h-5 w-5 text-purple-600 mr-2 flex items-center justify-center border-2 border-purple-600 rounded-full font-bold text-xs" >
                        £
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">
                        Cheque Records ({cheques.length})
                    </h3>
                </div>

                <div className="overflow-x-auto shadow-sm border-2 border-purple-200 rounded-lg bg-purple-50">
                    <table className="min-w-full divide-y divide-purple-200">
                        <thead className="bg-purple-100">
                            <tr>
                                <th className="px-4 py-3 text-left">
                                    <select
                                        value={filters.transactionType}
                                        onChange={(e) => {
                                            const newFilters = { ...filters, transactionType: e.target.value };
                                            setFilters(newFilters);
                                            loadCheques(newFilters);
                                        }}
                                        className="bg-transparent border-none text-xs font-semibold text-gray-700 uppercase focus:ring-0 cursor-pointer hover:text-purple-600 transition-colors p-0 w-full"
                                    >
                                        <option value="" className="hidden">Type</option>
                                        <option value="">All Types</option>
                                        {TRANSACTION_TYPES.map(option => (
                                            <option key={option.value} value={option.value}>{option.value}</option>
                                        ))}
                                    </select>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cheque No</th>
                                <th className="px-4 py-3 text-left">
                                    <div className="text-xs normal-case font-normal min-w-[160px]">
                                        <SearchableSelect
                                            options={[{ value: '', label: 'All Parties' }, ...parties.map(p => ({ value: p.ledgerId, label: p.ledgerName }))]}
                                            value={filters.partyLedgerId}
                                            onChange={(val) => {
                                                const newFilters = { ...filters, partyLedgerId: val };
                                                setFilters(newFilters);
                                                loadCheques(newFilters);
                                            }}
                                            placeholder="Party"
                                            className="text-xs"
                                            buttonClassName="bg-transparent border-none shadow-none p-0 text-xs font-semibold text-gray-700 uppercase focus:ring-0"
                                        />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cheque Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Remaining</th>
                                <th className="px-4 py-3 text-left">
                                    <select
                                        value={filters.status}
                                        onChange={(e) => {
                                            const newFilters = { ...filters, status: e.target.value };
                                            setFilters(newFilters);
                                            loadCheques(newFilters);
                                        }}
                                        className="bg-transparent border-none text-xs font-semibold text-gray-700 uppercase focus:ring-0 cursor-pointer hover:text-purple-600 transition-colors p-0 w-full"
                                    >
                                        <option value="" className="hidden">Status</option>
                                        <option value="">All Statuses</option>
                                        {STATUS_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-purple-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-12 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : cheques.length > 0 ? (
                                <>
                                    {cheques.map((cheque, idx) => (
                                        <tr key={cheque.id} className={`group hover:bg-purple-100 transition-colors ${idx % 2 === 1 ? "bg-purple-50" : "bg-white"}`}>
                                            <td className="px-4 py-3 text-sm border-b border-purple-100 font-medium text-gray-600">
                                                {cheque.transactionType === 'Received' ? 'Received' : 'Given'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium border-b border-purple-100">{cheque.chequeNo}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 border-b border-purple-100 relative group/cell">
                                                <span className="block pr-16">{cheque.partyName}</span>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded px-1 py-0.5 shadow-sm border border-purple-200">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(cheque); }}
                                                        className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(cheque.id); }}
                                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-semibold border-b border-purple-100">₹{formatCurrency(cheque.chequeAmount)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 border-b border-purple-100">{formatDate(cheque.chequeDate)}</td>
                                            <td className="px-4 py-3 text-sm border-b border-purple-100">
                                                {getRemainingDaysBadge(cheque.chequeDate, cheque.status)}
                                            </td>
                                            <td className="px-4 py-3 text-sm border-b border-purple-100">{getStatusBadge(cheque.status)}</td>
                                        </tr>
                                    ))}
                                </>
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                                        No cheques found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {cheques.length > 0 && !loading && (
                            <tfoot className="bg-purple-100 font-bold text-gray-900">
                                <tr>
                                    <td className="px-4 py-3 text-sm border-t-2 border-purple-200" colSpan="3">Total</td>
                                    <td className={`px-4 py-3 text-sm border-t-2 border-purple-200 ${cheques.reduce((sum, c) => {
                                        const amount = parseFloat(c.chequeAmount) || 0;
                                        return c.transactionType === 'Given' ? sum - amount : sum + amount;
                                    }, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        ₹{formatCurrency(Math.abs(cheques.reduce((sum, c) => {
                                            const amount = parseFloat(c.chequeAmount) || 0;
                                            return c.transactionType === 'Given' ? sum - amount : sum + amount;
                                        }, 0)))}
                                    </td>
                                    <td className="px-4 py-3 border-t-2 border-purple-200" colSpan="3"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
