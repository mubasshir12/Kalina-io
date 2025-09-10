import React from 'react';
import { Trash2, X } from 'lucide-react';

interface MessageSelectionToolbarProps {
    selectedCount: number;
    onCancel: () => void;
    onDelete: () => void;
}

const MessageSelectionToolbar: React.FC<MessageSelectionToolbarProps> = ({ selectedCount, onCancel, onDelete }) => {
    return (
        <div className="w-full bg-white/80 dark:bg-[#1e1f22]/80 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-neutral-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-gray-700 transition-colors" aria-label="Cancel selection">
                        <X className="h-6 w-6 text-neutral-700 dark:text-gray-300" />
                    </button>
                    <span className="font-semibold text-lg text-neutral-800 dark:text-gray-200">{selectedCount} Selected</span>
                </div>
                <button
                    onClick={onDelete}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Delete selected messages"
                >
                    <Trash2 className="h-5 w-5" />
                    Delete
                </button>
            </div>
        </div>
    );
};

export default MessageSelectionToolbar;
