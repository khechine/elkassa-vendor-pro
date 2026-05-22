import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlert } from '@/components/AlertContext';

const C = {
  bg: '#080d1a',
  card: 'rgba(18, 24, 45, 0.85)',
  border: 'rgba(255,255,255,0.06)',
  primary: '#e64545',
  success: '#22ac38',
  warning: '#ff9500',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  white: '#ffffff',
};

export default function MessagingScreen() {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [isChatModalVisible, setIsChatModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await ApiService.get('/api/v1/vendor/messages');
      if (data?.success) {
        setConversations(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AuthService.getSession().then(session => {
      const uid = session.user?.id;
      if (uid) {
        setUserId(uid);
        fetchConversations();
      }
    });
  }, [fetchConversations]);

  const fetchMessages = async (otherUserId: string) => {
    setLoadingMessages(true);
    try {
      const data = await ApiService.get(`/api/v1/vendor/messages?otherUserId=${otherUserId}`);
      if (data?.success) {
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleOpenChat = async (conv: any) => {
    setSelectedUser(conv.otherUser);
    setMessages([]);
    setIsChatModalVisible(true);
    if (conv.otherUser?.id) {
      fetchMessages(conv.otherUser.id);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser?.id) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    try {
      const res = await ApiService.post('/api/v1/vendor/messages', {
        receiverId: selectedUser.id,
        content,
      });
      if (res?.success) {
        setMessages(prev => [...prev, res.data]);
        fetchConversations();
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
      } else {
        showAlert({ title: 'Erreur', message: res?.error || 'Message non envoyé.', type: 'error' });
      }
    } catch (error) {
      showAlert({ title: 'Erreur', message: 'Échec de l\'envoi.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const isOwnMessage = (msg: any) => msg.senderId === userId;

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.headerSub}>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={conversations}
        keyExtractor={(item) => item.otherUser?.id || Math.random().toString()}
        contentContainerStyle={styles.listBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontAwesome name="envelope" size={50} color="rgba(255,255,255,0.06)" />
            <Text style={styles.emptyText}>Aucune conversation</Text>
            <Text style={styles.emptySubtext}>Les messages apparaîtront ici</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.convCard} activeOpacity={0.7} onPress={() => handleOpenChat(item)}>
            <View style={styles.avatar}>
              <FontAwesome name="user-circle" size={42} color={C.textMuted} />
            </View>
            <View style={styles.convInfo}>
              <View style={styles.convTop}>
                <Text style={styles.convName} numberOfLines={1}>{item.otherUser?.name || 'Client'}</Text>
                <Text style={styles.convTime}>{formatTime(item.lastMessage?.createdAt)}</Text>
              </View>
              <View style={styles.convBottom}>
                <Text style={styles.convLastMsg} numberOfLines={1}>
                  {item.lastMessage?.senderId === userId ? 'Vous: ' : ''}{item.lastMessage?.content || ''}
                </Text>
                {item.unread && <View style={styles.unreadDot} />}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Chat Modal */}
      <Modal visible={isChatModalVisible} animationType="slide" transparent>
        <View style={styles.chatOverlay}>
          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <View style={{ backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FontAwesome name="user-circle" size={32} color={C.textMuted} />
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={styles.chatTitle}>{selectedUser?.name || 'Client'}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsChatModalVisible(false)}>
                <FontAwesome name="times" size={18} color={C.textDim} />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              style={{ flex: 1, backgroundColor: 'transparent' }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={
                  loadingMessages ? (
                    <View style={{ padding: 40, alignItems: 'center', backgroundColor: 'transparent' }}>
                      <ActivityIndicator size="small" color={C.primary} />
                    </View>
                  ) : (
                    <View style={{ padding: 40, alignItems: 'center', backgroundColor: 'transparent' }}>
                      <Text style={{ color: C.textMuted, fontSize: 13 }}>Aucun message. Envoyez le premier message.</Text>
                    </View>
                  )
                }
                renderItem={({ item }) => {
                  const own = isOwnMessage(item);
                  return (
                    <View style={[styles.bubbleRow, own && styles.bubbleRowOwn]}>
                      <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                        {item.product && (
                          <View style={styles.bubbleProduct}>
                            <Text style={styles.bubbleProductText}>📦 {item.product.name}</Text>
                          </View>
                        )}
                        <Text style={[styles.bubbleText, own && { color: '#fff' }]}>
                          {item.isFiltered ? '📢 Message filtré (coordonnées masquées)' : item.filteredContent || item.content}
                        </Text>
                        <Text style={[styles.bubbleTime, own && { color: 'rgba(255,255,255,0.5)' }]}>
                          {formatTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />

              <View style={styles.inputBar}>
                <TextInput
                  style={styles.messageInput}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Votre message..."
                  placeholderTextColor={C.textDim}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!newMessage.trim() || sending) && { opacity: 0.5 }]}
                  onPress={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <FontAwesome name="send" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, backgroundColor: 'transparent' },
  title: { fontSize: 26, fontWeight: '900', color: C.white },
  headerSub: { color: C.textMuted, fontSize: 13, marginTop: 4, fontWeight: '500' },
  listBody: { paddingBottom: 100, flexGrow: 1 },
  convCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, marginBottom: 10,
  },
  avatar: { width: 44, alignItems: 'center' },
  convInfo: { flex: 1, marginLeft: 12, backgroundColor: 'transparent' },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 4 },
  convName: { color: C.white, fontSize: 15, fontWeight: '700', flex: 1 },
  convTime: { color: C.textMuted, fontSize: 11 },
  convBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
  convLastMsg: { color: C.textMuted, fontSize: 13, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginLeft: 8 },
  emptyState: { alignItems: 'center', marginTop: 100, backgroundColor: 'transparent' },
  emptyText: { color: C.textMuted, fontSize: 16, marginTop: 16, fontWeight: '600' },
  emptySubtext: { color: 'rgba(100,116,139,0.6)', fontSize: 13, marginTop: 4 },
  
  // Chat Modal
  chatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  chatContent: {
    backgroundColor: '#0b1120', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    height: '94%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0),
  },
  chatHeader: {
    backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  chatTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  chatList: { padding: 16, paddingBottom: 20 },
  bubbleRow: { flexDirection: 'row', marginBottom: 12, backgroundColor: 'transparent' },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%', padding: 12, borderRadius: 18,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderTopLeftRadius: 4,
  },
  bubbleOwn: {
    backgroundColor: C.primary, borderTopRightRadius: 4,
  },
  bubbleProduct: {
    backgroundColor: 'rgba(255,255,255,0.1)', padding: 6, borderRadius: 8, marginBottom: 6,
  },
  bubbleProductText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubbleText: { color: C.textDim, fontSize: 14, lineHeight: 20 },
  bubbleTime: { color: C.textMuted, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 20,
    backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  messageInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12, color: C.white, fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: C.primary, width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
});
