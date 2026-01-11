import React, { useState, useEffect } from 'react';
import { XMarkIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function ProductEditModal({ isOpen, onClose, product, onUpdateSuccess }) {
    const [loading, setLoading] = useState(false);
    const [brands, setBrands] = useState([]);
    const [formData, setFormData] = useState({
        brandId: '',
        remarks: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadBrands();
            if (product) {
                setFormData({
                    brandId: '',
                    remarks: product.remarks || ''
                });
            }
        }
    }, [isOpen, product]);

    const loadBrands = async () => {
        try {
            const result = await window.electronAPI.getBrands();
            if (result.success) {
                setBrands(result.brands);
                if (product && product.brandName) {
                    const matchingBrand = result.brands.find(b => b.name === product.brandName);
                    if (matchingBrand) {
                        setFormData(prev => ({ ...prev, brandId: matchingBrand.id }));
                    }
                }
            } else {
                toast.error('Failed to load brands');
            }
        } catch (error) {
            console.error('Error loading brands:', error);
            toast.error('Error loading brands');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await window.electronAPI.updateProduct({
                productId: product.productId,
                brandId: formData.brandId || null,
                remarks: formData.remarks
            });

            if (result.success) {
                toast.success('Product updated successfully');
                onUpdateSuccess();
                onClose();
            } else {
                toast.error(result.message || 'Failed to update product');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            toast.error('An error occurred while updating');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <PencilSquareIcon className="h-7 w-7 text-blue-200" />
                            <div>
                                <h2 className="text-xl font-bold">Edit Product Details</h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    Part Number: <span className="font-semibold">{product?.partNumber}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p><span className="font-semibold text-gray-700">Description:</span> {product?.description}</p>
                    </div>

                    <form id="edit-product-form" onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="brand" className="block text-sm font-semibold text-gray-700 mb-1">
                                Rack
                            </label>
                            <select
                                id="brand"
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm py-2.5"
                                value={formData.brandId}
                                onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                            >
                                <option value="">Select a rack...</option>
                                {brands.map(brand => (
                                    <option key={brand.id} value={brand.id}>
                                        {brand.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="remarks" className="block text-sm font-semibold text-gray-700 mb-1">
                                Order No
                            </label>
                            <textarea
                                id="remarks"
                                rows={4}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                placeholder="Add compatible parts or notes here..."
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="edit-product-form"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
