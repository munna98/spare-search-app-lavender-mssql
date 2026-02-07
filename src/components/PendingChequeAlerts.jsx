import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function PendingChequeAlerts() {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        loadAlerts();
        const interval = setInterval(loadAlerts, 300000); // 5 minutes
        return () => clearInterval(interval);
    }, []);

    const loadAlerts = async () => {
        try {
            if (window.electronAPI?.getPendingChequeAlerts) {
                const response = await window.electronAPI.getPendingChequeAlerts();
                if (response.success) {
                    setAlerts(response.alerts);
                }
            }
        } catch (error) {
            console.error('Error loading pending cheque alerts:', error);
        }
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

    if (alerts.length === 0) return null;

    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-md shadow-sm">
            <div className="flex">
                <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                </div>
                <div className="ml-3 w-full">
                    <h3 className="text-sm font-medium text-yellow-800">
                        Pending Cheques Attention Required ({alerts.length})
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                        <div className="flex flex-col gap-1">
                            {alerts.map((alert) => {
                                const days = calculateRemainingDays(alert.chequeDate);
                                let timeText = '';
                                let timeColor = '';

                                if (days < 0) {
                                    timeText = 'Overdue';
                                    timeColor = 'text-red-700 font-bold';
                                } else if (days === 0) {
                                    timeText = 'Today';
                                    timeColor = 'text-red-700 font-bold';
                                } else if (days === 1) {
                                    timeText = 'Tomorrow';
                                    timeColor = 'text-orange-700 font-bold';
                                } else {
                                    timeText = `${days} days left`;
                                    timeColor = 'text-yellow-700';
                                }

                                return (
                                    <div key={alert.id} className="flex justify-between items-center border-b border-yellow-200 pb-1 last:border-0 last:pb-0">
                                        <span className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${alert.transactionType === 'Received' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>
                                                {alert.transactionType === 'Received' ? 'IN' : 'OUT'}
                                            </span>
                                            <span className="font-medium">{alert.chequeNo}</span>
                                            <span>- {alert.partyName}</span>
                                        </span>
                                        <div className="flex items-center gap-4">
                                            <span className="font-medium">₹{alert.chequeAmount.toFixed(2)}</span>
                                            <span className={timeColor}>{timeText}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
