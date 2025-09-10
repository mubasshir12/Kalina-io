import { useState, useMemo, useCallback, useEffect } from 'react';
import { Conversation, ChatMessage as ChatMessageType } from '../types';

export const useConversations = () => {
    const [conversations, setConversations] = useState<Conversation[]>(() => {
        try {
            const storedConvos = localStorage.getItem('kalina_conversations');
            if (storedConvos) {
                const parsedConvos: Conversation[] = JSON.parse(storedConvos);
                // Migration: Add createdAt if missing
                return parsedConvos.map(convo => ({
                    ...convo,
                    createdAt: convo.createdAt || new Date().toISOString()
                }));
            }
            return [];
        } catch (e) {
            console.error("Failed to parse conversations from localStorage", e);
            return [];
        }
    });

    const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
        try {
            const storedActiveId = localStorage.getItem('kalina_active_conversation_id');
            const convosString = localStorage.getItem('kalina_conversations'); // Need to read it again
            if (storedActiveId && convosString) {
                const convos: Conversation[] = JSON.parse(convosString);
                if (convos.some(c => c.id === storedActiveId)) {
                    return storedActiveId;
                }
            }
            return null;
        } catch (e) {
            console.error("Failed to parse active conversation ID from localStorage", e);
            return null;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('kalina_conversations', JSON.stringify(conversations));
        } catch (e) {
            console.error("Failed to save conversations to localStorage", e);
        }
    }, [conversations]);

    useEffect(() => {
        try {
            if (activeConversationId) {
                localStorage.setItem('kalina_active_conversation_id', activeConversationId);
            } else {
                localStorage.removeItem('kalina_active_conversation_id');
            }
        } catch (e) {
            console.error("Failed to save active conversation ID to localStorage", e);
        }
    }, [activeConversationId]);

    const activeConversation = useMemo(() =>
        conversations.find(c => c.id === activeConversationId),
        [conversations, activeConversationId]
    );

    const sortedConversations = useMemo(() => {
        return [...conversations].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            // If pinning is the same, sort by creation date, newest first
            if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return 0;
        });
    }, [conversations]);

    const updateConversation = useCallback((conversationId: string, updater: (convo: Conversation) => Conversation) => {
        setConversations(prev =>
            prev.map(c =>
                c.id === conversationId ? updater(c) : c
            )
        );
    }, []);

    const updateConversationMessages = useCallback((conversationId: string, updater: (messages: ChatMessageType[]) => ChatMessageType[]) => {
        updateConversation(conversationId, c => ({ ...c, messages: updater(c.messages) }));
    }, [updateConversation]);
    
    const handleNewChat = useCallback(() => {
        const newConversationId = crypto.randomUUID();
        const newConversation: Conversation = {
            id: newConversationId,
            title: "New Chat",
            messages: [],
            createdAt: new Date().toISOString(),
        };

        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversationId);
    }, []);

    const handleSelectConversation = useCallback((id: string) => {
        setActiveConversationId(id);
    }, []);

    const handleRenameConversation = useCallback((id: string, newTitle: string) => {
        updateConversation(id, c => ({ ...c, title: newTitle }));
    }, [updateConversation]);

    const handleDeleteConversation = useCallback((id: string) => {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
            setActiveConversationId(conversations.length > 1 ? (sortedConversations.find(c => c.id !== id)?.id ?? null) : null);
        }
    }, [activeConversationId, conversations.length, sortedConversations]);

    const handleDeleteMultipleConversations = useCallback((ids: string[]) => {
        setConversations(prev => prev.filter(c => !ids.includes(c.id)));
        if (activeConversationId && ids.includes(activeConversationId)) {
            // Find a new conversation to make active
            const remainingConversations = conversations.filter(c => !ids.includes(c.id));
            const newActiveId = remainingConversations.length > 0 ? remainingConversations[0].id : null;
            setActiveConversationId(newActiveId);
        }
    }, [activeConversationId, conversations]);

    const handlePinConversation = useCallback((id: string) => {
        updateConversation(id, c => ({ ...c, isPinned: !c.isPinned }));
    }, [updateConversation]);

    // Deletes multiple messages from a single conversation based on their IDs, unified for both user and model roles.
    const handleDeleteMultipleMessages = useCallback((conversationId: string, messageIds: string[]) => {
        updateConversationMessages(conversationId, prevMessages =>
            // The filter is role-agnostic; it removes any message whose ID is in the list.
            prevMessages.filter(msg => !messageIds.includes(msg.id))
        );
    }, [updateConversationMessages]);

    return {
        conversations,
        setConversations,
        activeConversationId,
        setActiveConversationId,
        activeConversation,
        sortedConversations,
        updateConversation,
        updateConversationMessages,
        handleNewChat,
        handleSelectConversation,
        handleRenameConversation,
        handleDeleteConversation,
        handleDeleteMultipleConversations,
        handleDeleteMultipleMessages,
        handlePinConversation
    };
};