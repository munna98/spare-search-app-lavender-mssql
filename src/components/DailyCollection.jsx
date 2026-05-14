import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  PlusIcon,
  MinusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import SearchableSelect from './SearchableSelect';
import { toast } from 'react-toastify';

const PAYMENT_MODES = ['Cash', 'Card', 'Cheque'];

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending', color: 'bg-orange-100 text-orange-900' },
  { value: 'Posted', label: 'Posted', color: 'bg-green-100 text-green-800' },
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export default function DailyCollection() {
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [collections, setCollections] = useState([]);
  const [partyByInvoice, setPartyByInvoice] = useState({});
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [filters, setFilters] = useState({
    startDate: todayISO(),
    endDate: todayISO(),
    staffLedgerId: '',
    customerLedgerId: '',
    paymentMode: '',
    status: '',
    searchText: '',
  });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const [formData, setFormData] = useState({
    collectionDate: todayISO(),
    staffLedgerId: '',
    staffName: '',
    customerLedgerId: '',
    customerName: '',
    paymentMode: 'Card',
    invoiceNo: '',
    amount: '',
    status: 'Pending',
  });

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const res = await window.electronAPI.getCustomerLedgers();
      if (res.success) {
        setCustomers(res.ledgers || []);
      } else {
        toast.error(res.message || 'Failed to load customers');
        setCustomers([]);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await window.electronAPI.getStaffLedgers();
      if (res.success) {
        setStaff(res.ledgers || []);
        if (!res.ledgers?.length) {
          toast.info('No staff ledgers found. Check stock database connection and ParentID = 120.');
        }
      } else {
        toast.error(res.message || 'Failed to load staff');
        setStaff([]);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load staff');
      setStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  const buildFilterPayload = (f) => {
    const payload = {};
    if (f.startDate) payload.startDate = f.startDate;
    if (f.endDate) payload.endDate = f.endDate;
    if (f.staffLedgerId !== '' && f.staffLedgerId != null) {
      payload.staffLedgerId = f.staffLedgerId;
    }
    if (f.customerLedgerId !== '' && f.customerLedgerId != null) {
      payload.customerLedgerId = f.customerLedgerId;
    }
    if (f.paymentMode) payload.paymentMode = f.paymentMode;
    if (f.status) payload.status = f.status;
    const t = (f.searchText || '').trim();
    if (t) payload.searchText = t;
    return payload;
  };

  const loadCollections = useCallback(async (filterSource) => {
    const f = filterSource || filtersRef.current;
    setLoading(true);
    try {
      const res = await window.electronAPI.getCollections(buildFilterPayload(f));
      if (res.success) {
        setCollections(res.collections || []);
      } else {
        toast.error(res.message || 'Failed to load collections');
        setCollections([]);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load collections');
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadCustomers();
  }, [loadStaff, loadCustomers]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const staffOptions = useMemo(() => staff.map((s) => ({ value: String(s.ledgerId), label: s.ledgerName })), [staff]);
  const staffFilterOptions = useMemo(() => [{ value: '', label: 'All Staff' }, ...staffOptions], [staffOptions]);

  const customerOptions = useMemo(() => customers.map((c) => ({ value: String(c.ledgerId), label: c.ledgerName })), [customers]);
  const customerFilterOptions = useMemo(() => [{ value: '', label: 'All Customers' }, ...customerOptions], [customerOptions]);

  useEffect(() => {
    if (!collections.length) {
      setPartyByInvoice({});
      return;
    }
    const needsLookup = collections.filter(
      (c) => !String(c.customerName || '').trim() && String(c.invoiceNo || '').trim()
    );
    if (!needsLookup.length) {
      setPartyByInvoice({});
      return;
    }
    let cancelled = false;
    const nos = [...new Set(needsLookup.map((c) => String(c.invoiceNo).trim()))];
    window.electronAPI.getSalesPartiesByInvoiceNos(nos).then((res) => {
      if (!cancelled && res.success) {
        setPartyByInvoice(res.partyByInvoice || {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [collections]);

  const resetForm = () => {
    setFormData({
      collectionDate: todayISO(),
      staffLedgerId: '',
      staffName: '',
      customerLedgerId: '',
      customerName: '',
      paymentMode: 'Card',
      invoiceNo: '',
      amount: '',
      status: 'Pending',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.collectionDate || !formData.staffLedgerId || !formData.staffName) {
      toast.warning('Please select collection date and staff');
      return;
    }
    if (
      formData.customerLedgerId === '' ||
      formData.customerLedgerId == null ||
      !formData.customerName?.trim()
    ) {
      toast.warning('Please select a customer');
      return;
    }
    if (!formData.invoiceNo.trim()) {
      toast.warning('Please enter invoice number');
      return;
    }
    const amt = parseFloat(formData.amount);
    if (Number.isNaN(amt) || amt < 0) {
      toast.warning('Please enter a valid amount');
      return;
    }

    const payload = {
      collectionDate: formData.collectionDate,
      staffLedgerId: formData.staffLedgerId,
      staffName: formData.staffName,
      customerLedgerId: formData.customerLedgerId,
      customerName: formData.customerName,
      paymentMode: formData.paymentMode,
      invoiceNo: formData.invoiceNo.trim(),
      amount: amt,
      status: formData.status || 'Pending',
    };

    try {
      const res = editingId
        ? await window.electronAPI.updateCollection(editingId, payload)
        : await window.electronAPI.createCollection(payload);

      if (res.success) {
        toast.success(res.message);
        resetForm();
        loadCollections();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setFormData({
      collectionDate: row.collectionDate
        ? new Date(row.collectionDate).toISOString().split('T')[0]
        : todayISO(),
      staffLedgerId: row.staffLedgerId != null ? String(row.staffLedgerId) : '',
      staffName: row.staffName,
      customerLedgerId: row.customerLedgerId != null ? String(row.customerLedgerId) : '',
      customerName: row.customerName ?? '',
      paymentMode: row.paymentMode,
      invoiceNo: String(row.invoiceNo ?? ''),
      amount: String(row.amount ?? ''),
      status: row.status || 'Pending',
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setTimeout(async () => {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      const confirmed = window.confirm('Delete this collection?');
      setTimeout(() => window.focus(), 50);
      if (!confirmed) return;
      try {
        const res = await window.electronAPI.deleteCollection(id);
        if (res.success) {
          toast.success(res.message);
          if (editingId === id) {
            resetForm();
          }
          loadCollections();
        } else {
          toast.error(res.message);
        }
      } catch (err) {
        toast.error(err.message);
      }
    }, 10);
  };

  const handlePost = (id) => {
    setTimeout(async () => {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      const confirmed = window.confirm('Mark this collection as posted?');
      setTimeout(() => window.focus(), 50);
      if (!confirmed) return;
      try {
        const res = await window.electronAPI.setCollectionPosted(id);
        if (res.success) {
          toast.success(res.message);
          loadCollections();
        } else {
          toast.error(res.message);
        }
      } catch (err) {
        toast.error(err.message);
      }
    }, 10);
  };

  const applyFilters = () => {
    loadCollections();
  };

  const clearFilters = () => {
    const cleared = {
      startDate: todayISO(),
      endDate: todayISO(),
      staffLedgerId: '',
      customerLedgerId: '',
      paymentMode: '',
      status: '',
      searchText: '',
    };
    setFilters(cleared);
    loadCollections(cleared);
  };

  const formatCurrency = (amount) => {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return '0.00';
    return n.toFixed(2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const summary = useMemo(() => {
    let cash = 0;
    let card = 0;
    let cheque = 0;
    collections.forEach((c) => {
      const a = parseFloat(c.amount) || 0;
      if (c.paymentMode === 'Cash') cash += a;
      else if (c.paymentMode === 'Card') card += a;
      else if (c.paymentMode === 'Cheque') cheque += a;
    });
    cash = round2(cash);
    card = round2(card);
    cheque = round2(cheque);
    const cardFee = round2(card * 0.017);
    const totalCollection = round2(cash + cheque + (card - cardFee));
    return { cash, card, cheque, cardFee, totalCollection };
  }, [collections]);

  const filterActive = useMemo(() => {
    const d = todayISO();
    return (
      filters.searchText.trim() !== '' ||
      filters.staffLedgerId !== '' ||
      filters.customerLedgerId !== '' ||
      filters.paymentMode !== '' ||
      filters.status !== '' ||
      filters.startDate !== d ||
      filters.endDate !== d
    );
  }, [filters]);

  const tableContent = useMemo(() => (
    <div className="overflow-x-auto shadow-sm border border-orange-200 rounded-lg bg-orange-50/50">
      <table className="min-w-full divide-y divide-orange-200">
        <thead className="bg-orange-100/90">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Sl</th>
            <th className="px-3 py-3 text-left">
              <div className="text-xs normal-case font-normal min-w-[160px]">
                <SearchableSelect
                  options={customerFilterOptions}
                  value={filters.customerLedgerId}
                  onChange={(val) => {
                    const newFilters = { ...filtersRef.current, customerLedgerId: val };
                    setFilters(newFilters);
                    loadCollections(newFilters);
                  }}
                  placeholder="Customer"
                  loading={loadingCustomers}
                  disabled={loadingCustomers}
                  className="text-xs"
                  buttonClassName="bg-transparent border-none shadow-none p-0 text-xs font-semibold text-slate-700 uppercase focus:ring-0"
                />
              </div>
            </th>
            <th className="px-3 py-3 text-left">
              <div className="text-xs normal-case font-normal min-w-[160px]">
                <SearchableSelect
                  options={staffFilterOptions}
                  value={filters.staffLedgerId}
                  onChange={(val) => {
                    const newFilters = { ...filtersRef.current, staffLedgerId: val };
                    setFilters(newFilters);
                    loadCollections(newFilters);
                  }}
                  placeholder="Collected"
                  loading={loadingStaff}
                  disabled={loadingStaff}
                  className="text-xs"
                  buttonClassName="bg-transparent border-none shadow-none p-0 text-xs font-semibold text-slate-700 uppercase focus:ring-0"
                />
              </div>
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Cash</th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Card</th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Cheque</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Invoice</th>
            <th className="px-3 py-3 text-left w-24">
              <select
                value={filters.status}
                onChange={(e) => {
                  const newFilters = { ...filtersRef.current, status: e.target.value };
                  setFilters(newFilters);
                  loadCollections(newFilters);
                }}
                className="bg-transparent border-none text-xs font-semibold text-slate-700 uppercase focus:ring-0 cursor-pointer hover:text-orange-700 transition-colors p-0 w-full"
              >
                <option value="" className="hidden">
                  Status
                </option>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-orange-100">
          {loading ? (
            <tr>
              <td colSpan="9" className="px-4 py-12 text-center">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                </div>
              </td>
            </tr>
          ) : collections.length > 0 ? (
            collections.map((row, idx) => {
              const invKey = String(row.invoiceNo ?? '').trim();
              const customer =
                String(row.customerName || '').trim() ||
                partyByInvoice[invKey] ||
                '—';
              const amt = formatCurrency(row.amount);
              return (
                <tr
                  key={row.id}
                  className={`hover:bg-orange-50/90 ${idx % 2 === 1 ? 'bg-orange-50/70' : ''}`}
                >
                  <td className="px-3 py-2 text-sm text-slate-700">{idx + 1}</td>
                  <td className="px-3 py-2 text-sm text-slate-900">{customer}</td>
                  <td className="px-3 py-2 text-sm text-slate-900">{row.staffName}</td>
                  <td className="px-3 py-2 text-sm text-right tabular-nums">
                    {row.paymentMode === 'Cash' ? amt : ''}
                  </td>
                  <td className="px-3 py-2 text-sm text-right tabular-nums">
                    {row.paymentMode === 'Card' ? amt : ''}
                  </td>
                  <td className="px-3 py-2 text-sm text-right tabular-nums">
                    {row.paymentMode === 'Cheque' ? amt : ''}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-slate-900">{row.invoiceNo}</td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_OPTIONS.find((s) => s.value === row.status)?.color ||
                        'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded z-20 relative"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                        {openMenuId === row.id && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-slate-200 z-30 py-1 text-left">
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); handleEdit(row); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <PencilIcon className="h-4 w-4" /> Edit
                            </button>
                            {row.status === 'Pending' && (
                              <button
                                type="button"
                                onClick={() => { setOpenMenuId(null); handlePost(row.id); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                              >
                                <CheckCircleIcon className="h-4 w-4" /> Post
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); handleDelete(row.id); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <TrashIcon className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="9" className="px-4 py-12 text-center text-slate-500">
                No records for these filters.
              </td>
            </tr>
          )}
        </tbody>
        {collections.length > 0 && !loading && (
          <tfoot className="bg-orange-50/90 border-t border-orange-200">
            <tr>
              <td className="px-3 py-2 text-sm" />
              <td className="px-3 py-2 text-sm font-semibold text-slate-800" colSpan={2}>
                Sub total
              </td>
              <td className="px-3 py-2 text-sm text-right tabular-nums font-medium text-slate-900">
                {formatCurrency(summary.cash)}
              </td>
              <td className="px-3 py-2 text-sm text-right tabular-nums font-medium text-slate-900">
                <span>{formatCurrency(summary.card)}</span>{' '}
                <span className="text-red-700">−{formatCurrency(summary.cardFee)}</span>
              </td>
              <td className="px-3 py-2 text-sm text-right tabular-nums font-medium text-slate-900">
                {formatCurrency(summary.cheque)}
              </td>
              <td className="px-3 py-2 text-sm" />
              <td className="px-3 py-2 text-sm" />
              <td className="px-3 py-2" />
            </tr>
            <tr className="border-t border-orange-300 bg-orange-100/80">
              <td className="px-3 py-2.5 text-sm" />
              <td className="px-3 py-2.5 text-sm font-bold text-slate-900" colSpan={5}>
                Total collection
              </td>
              <td className="px-3 py-2.5 text-sm text-right font-bold text-slate-900 tabular-nums" colSpan={3}>
                {formatCurrency(summary.totalCollection)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  ), [
    collections,
    loading,
    loadingCustomers,
    loadingStaff,
    filters,
    openMenuId,
    editingId,
    partyByInvoice,
    summary,
    customerFilterOptions,
    staffFilterOptions
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Daily Collection</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center gap-2"
          >
            {showForm ? <MinusIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
            {showForm ? 'Hide Form' : 'New Collection'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            {editingId ? 'Edit collection (pending)' : 'New collection'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-row flex-nowrap items-end gap-3 overflow-x-auto pb-1">
              <div className="flex-shrink-0 w-[150px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.collectionDate}
                  onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              <div className="min-w-[180px] max-w-[260px] flex-shrink-0">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Collected by (staff) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={staffOptions}
                  value={formData.staffLedgerId}
                  onChange={(val) => {
                    const row = staff.find((s) => String(s.ledgerId) === String(val));
                    setFormData({
                      ...formData,
                      staffLedgerId: val,
                      staffName: row?.ledgerName || '',
                    });
                  }}
                  placeholder={loadingStaff ? 'Loading…' : 'Select staff'}
                  loading={loadingStaff}
                  disabled={loadingStaff}
                />
              </div>
              <div className="min-w-[200px] flex-1 max-w-md">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={customerOptions}
                  value={formData.customerLedgerId}
                  onChange={(val) => {
                    const row = customers.find((c) => String(c.ledgerId) === String(val));
                    setFormData({
                      ...formData,
                      customerLedgerId: val,
                      customerName: row?.ledgerName || '',
                    });
                  }}
                  placeholder={loadingCustomers ? 'Loading…' : 'Select customer'}
                  loading={loadingCustomers}
                  disabled={loadingCustomers}
                />
              </div>
              <div className="flex-shrink-0 w-[132px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-row flex-nowrap items-end gap-3 overflow-x-auto pb-1 mt-4">
              <div className="min-w-[140px] w-48 flex-shrink-0">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Invoice no. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              <div className="flex-shrink-0 w-[120px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              {editingId && (
                <div className="flex-shrink-0 w-[120px]">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {STATUS_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-end gap-3 flex-shrink-0 ml-auto">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors whitespace-nowrap"
                >
                  {editingId ? 'Save changes' : 'Save collection'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-row flex-nowrap items-end gap-3 overflow-x-auto pb-1">
          <div className="flex-shrink-0 w-[150px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="flex-shrink-0 w-[150px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="flex-shrink-0 w-[128px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
            <select
              value={filters.paymentMode}
              onChange={(e) => setFilters({ ...filters, paymentMode: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px] w-48 flex-shrink-0">
            <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
            <input
              type="text"
              value={filters.searchText}
              onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
              placeholder="Invoice no…"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-slate-600 mb-1 invisible" aria-hidden="true">
              Actions
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={applyFilters}
                className="px-4 py-2 bg-slate-800 text-white text-sm rounded-md hover:bg-slate-900 whitespace-nowrap"
              >
                Apply filters
              </button>
              {filterActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  title="Clear filters"
                  className="p-2 rounded-md text-slate-600 hover:text-orange-700 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">
          Records ({collections.length})
        </h3>

        {tableContent}
      </div>
    </div>
  );
}
