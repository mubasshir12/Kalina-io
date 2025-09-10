import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const NetworkStatusIndicator: React.FC = () => {
    const isOnline = useNetworkStatus();
    const [wasOffline, setWasOffline] = useState(!isOnline);
    const [showStatus, setShowStatus] = useState(false);

    useEffect(() => {
        if (!isOnline) {
            setWasOffline(true);
            setShowStatus(true);
        } else {
            if (wasOffline) {
                // We just came back online
                setShowStatus(true);
                const timer = setTimeout(() => {
                    setShowStatus(false);
                    setWasOffline(false);
                }, 4000); // Hide after 4 seconds
                return () => clearTimeout(timer);
            }
        }
    }, [isOnline, wasOffline]);

    if (!showStatus) {
        return null;
    }

    const isRestored = isOnline && wasOffline;
    const bgColor = isRestored ? 'bg-green-600' : 'bg-red-600';
    const Icon = isRestored ? Wifi : WifiOff;
    const message = isRestored ? 'Back online! Connection restored.' : 'You are offline. Please check your connection.';

    return (
        <div 
            className={`fixed top-4 left-1/2 -translate-x-1/2 w-auto min-w-[280px] max-w-[90%] z-[9999] px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-white font-semibold transition-all duration-300 ease-in-out ${bgColor} ${showStatus ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'}`}
            role="status"
        >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{message}</span>
        </div>
    );
};

export default NetworkStatusIndicator;
