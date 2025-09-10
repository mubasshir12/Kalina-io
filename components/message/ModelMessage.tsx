import React from 'react';
import { ChatMessage as ChatMessageType } from '../../types';
import MessageContent from './MessageContent';
import MessageToolbar from './MessageToolbar';
import MessageMetadata from './MessageMetadata';
import { Square, CheckSquare } from 'lucide-react';

interface ModelMessageProps extends ChatMessageType {
    setModalImage: (url: string | null) => void;
    isStreaming?: boolean;
    isThinking?: boolean;
    isSearchingWeb?: boolean;
    onRetry?: () => void;
    index: number;
    onUpdateMessageContent: (messageId: string, newContent: string) => void;
    setCodeForPreview: (data: { code: string; language: string; } | null) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelection?: (messageId: string) => void;
}

const ModelMessage: React.FC<ModelMessageProps> = (props) => {
    const { id, isStreaming, content, isSelectionMode, isSelected, onToggleSelection } = props;
    
    const showToolbar = !isStreaming && content && !isSelectionMode;
    const showMetadata = !isStreaming && !isSelectionMode && (props.modelUsed || typeof props.inputTokens === 'number' || typeof props.outputTokens === 'number' || (props.generationTime && props.generationTime > 0));

    const handleMessageClick = (e: React.MouseEvent) => {
        if (isSelectionMode && onToggleSelection) {
            e.stopPropagation();
            onToggleSelection(id);
        }
    };

    return (
        <div 
            id={`message-${props.index}`} 
            className={`flex items-start gap-3 transition-colors duration-200 p-2 -m-2 rounded-lg ${isSelectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-amber-500/10' : ''}`}
            onClick={handleMessageClick}
        >
            {isSelectionMode && (
                <div className="flex-shrink-0 pt-1">
                    {isSelected ? <CheckSquare className="h-5 w-5 text-amber-600" /> : <Square className="h-5 w-5 text-neutral-400 dark:text-gray-500" />}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <MessageContent {...props} />
                {showToolbar && <MessageToolbar {...props} />}
                {showMetadata && <MessageMetadata {...props} />}
            </div>
        </div>
    );
};

export default ModelMessage;