import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Linking, FlatList, KeyboardAvoidingView, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlert } from '@/components/AlertContext';

const S = {
  bg: '#080d1a', card: 'rgba(18, 24, 45, 0.85)', border: 'rgba(255,255,255,0.06)',
  primary: '#e64545', success: '#22ac38', warning: '#ff9500', info: '#1470cc',
  textMuted: '#64748b', textDim: '#94a3b8', white: '#ffffff',
};

type SubTab = 'commandes' | 'devis' | 'messages';

export default function VentesScreen() {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('commandes');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [orderTab, setOrderTab] = useState('PENDING');

  // RFQ state
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loadingRfqs, setLoadingRfqs] = useState(true);
  const [showMyQuotes, setShowMyQuotes] = useState(false);
  const [rfqModalVisible, setRfqModalVisible] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<any>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // Messages state
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [msgModalVisible, setMsgModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMsgHistory, setLoadingMsgHistory] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchClientInfo = async (orderId: string) => {
    setLoadingClient(true);
    try {
      const res = await ApiService.get(`/api/v1/vendor/orders/${orderId}/client`);
      if (res?.success) setClientInfo(res.data);
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('404') || msg.includes('Cannot GET')) {
        console.info('Client info not yet available for order:', orderId);
      } else console.warn('Failed to fetch client reveal info:', msg);
    } finally { setLoadingClient(false); }
  };

  // Fetch all data
  const fetchOrders = useCallback(async (vid: string) => {
    try {
      const data = await ApiService.get(`/management/vendor/orders/${vid}`);
      setOrders(data || []);
    } catch (error) { console.error('Failed to fetch orders:', error); }
    finally { setLoadingOrders(false); }
  }, []);

  const fetchRfqs = useCallback(async () => {
    try {
      const data = await ApiService.get('/api/v1/vendor/rfq');
      if (data?.success) setRfqs(data.data || []);
    } catch (error) { console.error('Failed to fetch RFQs:', error); }
    finally { setLoadingRfqs(false); }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await ApiService.get('/api/v1/vendor/messages');
      if (data?.success) setConversations(data.data || []);
    } catch (error) { console.error('Failed to fetch conversations:', error); }
    finally { setLoadingMessages(false); }
  }, []);

  const fetchAll = useCallback(async (vid: string) => {
    setRefreshing(true);
    await Promise.all([fetchOrders(vid), fetchRfqs(), fetchConversations()]);
    setRefreshing(false);
  }, [fetchOrders, fetchRfqs, fetchConversations]);

  useEffect(() => {
    AuthService.getSession().then(session => {
      const vid = session?.vendorId;
      if (vid) {
        setVendorId(vid);
        setUserId(session.user?.id);
        fetchAll(vid);
      }
    });
  }, [fetchAll]);

  // Orders handlers
  const handleOrderStatus = async (orderId: string, status: string) => {
    try {
      await ApiService.put(`/management/vendor/orders/${orderId}/status`, { status });
      if (vendorId) fetchOrders(vendorId);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
        fetchClientInfo(orderId);
      }
      showAlert({ title: 'Succès', message: 'Statut mis à jour.', type: 'success' });
    } catch { showAlert({ title: 'Erreur', message: 'Mise à jour impossible.', type: 'error' }); }
  };

  const confirmOrderAction = (orderId: string, newStatus: string, message: string) => {
    showAlert({ title: 'Confirmation', message, type: 'warning', buttons: [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', style: 'default', onPress: () => handleOrderStatus(orderId, newStatus) }
    ]});
  };

  // RFQ handlers
  const openRfqModal = (rfq: any) => {
    if (rfq.hasSubmittedQuote) return showAlert({ title: 'Déjà soumis', message: 'Proposition déjà envoyée.', type: 'warning' });
    setSelectedRfq(rfq);
    setQuotePrice(String(rfq.budget ? Number(rfq.budget) * 0.95 : ''));
    setQuoteNotes('');
    setRfqModalVisible(true);
  };

  const submitQuote = async () => {
    if (!quotePrice || Number(quotePrice) <= 0) return showAlert({ title: 'Erreur', message: 'Prix invalide.', type: 'error' });
    setSubmittingQuote(true);
    try {
      const res = await ApiService.post('/api/v1/vendor/rfq', { rfqId: selectedRfq.id, price: Number(quotePrice), notes: quoteNotes || undefined });
      if (res?.success) {
        setRfqModalVisible(false);
        showAlert({ title: 'Envoyé', message: 'Devis soumis avec succès.', type: 'success' });
        fetchRfqs();
      } else showAlert({ title: 'Erreur', message: res?.error || 'Échec.', type: 'error' });
    } catch { showAlert({ title: 'Erreur', message: 'Échec de l\'envoi.', type: 'error' }); }
    finally { setSubmittingQuote(false); }
  };

  // Message handlers
  const openChat = async (conv: any) => {
    setSelectedUser(conv.otherUser);
    setMessages([]);
    setMsgModalVisible(true);
    setLoadingMsgHistory(true);
    try {
      const data = await ApiService.get(`/api/v1/vendor/messages?otherUserId=${conv.otherUser.id}`);
      if (data?.success) setMessages(data.data || []);
    } catch (error) { console.error('Failed to fetch messages:', error); }
    finally { setLoadingMsgHistory(false); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser?.id) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSendingMsg(true);
    try {
      const res = await ApiService.post('/api/v1/vendor/messages', { receiverId: selectedUser.id, content });
      if (res?.success) {
        setMessages(prev => [...prev, res.data]);
        fetchConversations();
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
      }
    } catch { showAlert({ title: 'Erreur', message: 'Message non envoyé.', type: 'error' }); }
    finally { setSendingMsg(false); }
  };

  const formatTime = (d: string) => {
    const date = new Date(d); const now = new Date();
    if (now.getTime() - date.getTime() < 86400000) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const isOwnMessage = (msg: any) => msg.senderId === userId;

  const ORDER_TABS = [
    { key: 'PENDING', label: 'Nouvelles', icon: 'clock-o', color: S.warning },
    { key: 'CONFIRMED', label: 'Acceptées', icon: 'check-circle', color: '#1470cc' },
    { key: 'SHIPPED', label: 'Expédiées', icon: 'truck', color: S.info },
    { key: 'DELIVERED', label: 'Livrées', icon: 'history', color: S.success },
    { key: 'CANCELLED', label: 'Annulées', icon: 'times-circle', color: S.primary },
  ] as const;

  const orderStatusColor = (status: string) => {
    const tab = ORDER_TABS.find(t => t.key === status);
    return tab?.color || S.textMuted;
  };

  const filteredOrders = orders.filter(o => {
    if (orderTab === 'DELIVERED') return o.status === 'DELIVERED' || o.status === 'STOCKED';
    return o.status === orderTab;
  });

  const myQuotes = rfqs.filter(r => r.hasSubmittedQuote);
  const openRfqs = rfqs.filter(r => !r.hasSubmittedQuote && new Date(r.expiresAt || r.createdAt) > new Date());
  const displayRfqs = showMyQuotes ? myQuotes : openRfqs;

  const STATUS_LABELS: Record<string, string> = {
    PENDING: 'En attente', CONFIRMED: 'Acceptée', SHIPPED: 'Expédiée',
    DELIVERED: 'Livrée', CANCELLED: 'Annulée', STOCKED: 'Finalisée',
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Ventes</Text>
      </View>

      <View style={styles.subTabRow}>
        {(['commandes', 'devis', 'messages'] as SubTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.subTab, activeSubTab === tab && styles.subTabActive]}
            onPress={() => setActiveSubTab(tab)}
          >
            <FontAwesome
              name={tab === 'commandes' ? 'truck' : tab === 'devis' ? 'file-text' : 'envelope'}
              size={12} color={activeSubTab === tab ? S.primary : S.textDim} style={{ marginRight: 4 }}
            />
            <Text style={[styles.subTabText, activeSubTab === tab && styles.subTabTextActive]}>
              {tab === 'commandes' ? 'Commandes' : tab === 'devis' ? 'Devis' : 'Messages'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => vendorId && fetchAll(vendorId)} tintColor={S.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Orders sub-tab */}
        {activeSubTab === 'commandes' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
              {ORDER_TABS.map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.orderTab, orderTab === tab.key && { backgroundColor: `${tab.color}22`, borderColor: tab.color }]}
                  onPress={() => setOrderTab(tab.key)}
                >
                  <FontAwesome name={tab.icon as any} size={11} color={orderTab === tab.key ? tab.color : S.textMuted} />
                  <Text style={[styles.orderTabText, orderTab === tab.key && { color: tab.color }]}>{tab.label}</Text>
                  {(() => {
                    const count = tab.key === 'DELIVERED'
                      ? orders.filter(o => o.status === 'DELIVERED' || o.status === 'STOCKED').length
                      : orders.filter(o => o.status === tab.key).length;
                    if (!count) return null;
                    return <View style={[styles.orderBadge, { backgroundColor: tab.color }]}><Text style={styles.orderBadgeText}>{count}</Text></View>;
                  })()}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loadingOrders ? (
              <ActivityIndicator size="large" color={S.primary} style={{ marginTop: 40 }} />
            ) : (
              filteredOrders.map(order => (
                <TouchableOpacity key={order.id} style={styles.orderCard} onPress={() => { setSelectedOrder(order); fetchClientInfo(order.id); }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 12 }}>
                    <View style={{ backgroundColor: 'transparent', flex: 1 }}>
                      <Text style={styles.orderStore}>{order.store?.name || 'Café'}</Text>
                      <Text style={styles.orderRef}>#{order.id?.slice(-6).toUpperCase()} — {formatDate(order.createdAt)}</Text>
                    </View>
                    <Text style={[styles.orderTotal, { color: orderStatusColor(order.status) }]}>{Number(order.total || 0).toFixed(3)} DT</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' }}>
                    <Text style={{ color: S.textDim, fontSize: 12 }}>{order.items?.length || 0} article(s)</Text>
                    <FontAwesome name="chevron-right" size={12} color={S.textMuted} />
                  </View>
                  {order.status === 'PENDING' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, backgroundColor: 'transparent' }}>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(230,69,69,0.1)', borderColor: S.primary }]} onPress={() => confirmOrderAction(order.id, 'CANCELLED', 'Refuser ?')}>
                        <Text style={[styles.actionBtnText, { color: S.primary }]}>Refuser</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(20,112,204,0.1)', borderColor: '#1470cc', flex: 2 }]} onPress={() => confirmOrderAction(order.id, 'CONFIRMED', 'Accepter ?')}>
                        <Text style={[styles.actionBtnText, { color: '#1470cc' }]}>Accepter</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* RFQ sub-tab */}
        {activeSubTab === 'devis' && (
          <>
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 3, marginBottom: 16 }}>
              <TouchableOpacity style={[styles.rfqTab, !showMyQuotes && styles.rfqTabActive]} onPress={() => setShowMyQuotes(false)}>
                <Text style={[styles.rfqTabText, !showMyQuotes && { color: S.primary }]}>Disponibles ({openRfqs.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rfqTab, showMyQuotes && styles.rfqTabActive]} onPress={() => setShowMyQuotes(true)}>
                <Text style={[styles.rfqTabText, showMyQuotes && { color: S.primary }]}>Mes propositions ({myQuotes.length})</Text>
              </TouchableOpacity>
            </View>

            {loadingRfqs ? (
              <ActivityIndicator size="large" color={S.primary} style={{ marginTop: 40 }} />
            ) : (
              displayRfqs.map(rfq => (
                <TouchableOpacity key={rfq.id} style={styles.rfqCard} onPress={() => openRfqModal(rfq)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' }}>
                      <FontAwesome name="building" size={12} color={S.textMuted} />
                      <Text style={{ color: S.textDim, fontSize: 11 }}>{rfq.store?.name || 'Café'}</Text>
                    </View>
                    {rfq.hasSubmittedQuote && <Text style={{ color: S.success, fontSize: 10, fontWeight: '800' }}>Proposé ✓</Text>}
                  </View>
                  <Text style={{ color: S.white, fontSize: 16, fontWeight: '800', marginBottom: 4 }}>{rfq.title}</Text>
                  {rfq.description && <Text style={{ color: S.textMuted, fontSize: 12, marginBottom: 8 }} numberOfLines={2}>{rfq.description}</Text>}
                  <View style={{ flexDirection: 'row', gap: 16, backgroundColor: 'transparent', marginBottom: 8 }}>
                    {rfq.budget && <Text style={{ color: S.warning, fontSize: 13, fontWeight: '800' }}>Budget: {Number(rfq.budget).toFixed(3)} DT</Text>}
                    {rfq.quantity && <Text style={{ color: S.textMuted, fontSize: 12 }}>Qté: {rfq.quantity}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent' }}>
                    {rfq.myQuote && <Text style={{ color: S.success, fontSize: 12, fontWeight: '700' }}>Mon offre: {Number(rfq.myQuote.price).toFixed(3)} DT</Text>}
                    <Text style={{ color: S.textMuted, fontSize: 10 }}>Limite: {formatDate(rfq.expiresAt)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* Messages sub-tab */}
        {activeSubTab === 'messages' && (
          <>
            {loadingMessages ? (
              <ActivityIndicator size="large" color={S.primary} style={{ marginTop: 40 }} />
            ) : (
              conversations.map(conv => (
                <TouchableOpacity key={conv.otherUser?.id} style={styles.msgCard} onPress={() => openChat(conv)}>
                  <FontAwesome name="user-circle" size={40} color={S.textMuted} />
                  <View style={{ flex: 1, marginLeft: 12, backgroundColor: 'transparent' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent' }}>
                      <Text style={{ color: S.white, fontWeight: '700', fontSize: 15 }}>{conv.otherUser?.name || 'Client'}</Text>
                      <Text style={{ color: S.textMuted, fontSize: 11 }}>{formatTime(conv.lastMessage?.createdAt)}</Text>
                    </View>
                    <Text style={{ color: S.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                      {conv.lastMessage?.senderId === userId ? 'Vous: ' : ''}{conv.lastMessage?.content || ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
            {!loadingMessages && conversations.length === 0 && (
              <View style={{ alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' }}>
                <FontAwesome name="envelope" size={40} color="rgba(255,255,255,0.06)" />
                <Text style={{ color: S.textMuted, fontSize: 15, marginTop: 16 }}>Aucune conversation</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal visible={!!selectedOrder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>Commande #{selectedOrder?.id?.slice(-6).toUpperCase()}</Text>
                <Text style={{ color: S.textMuted, fontSize: 12 }}>{selectedOrder?.store?.name}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setSelectedOrder(null); setClientInfo(null); }}><FontAwesome name="times" size={18} color={S.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ color: S.textMuted, fontWeight: '700', fontSize: 13 }}>Statut</Text>
                <View style={[styles.statusBadge, { backgroundColor: orderStatusColor(selectedOrder?.status) + '22' }]}>
                  <Text style={{ color: orderStatusColor(selectedOrder?.status), fontWeight: '900', fontSize: 12 }}>{STATUS_LABELS[selectedOrder?.status] || selectedOrder?.status}</Text>
                </View>
              </View>

              {/* Client info (Vault) */}
              {loadingClient ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: 'transparent' }}>
                  <ActivityIndicator size="small" color={S.primary} />
                  <Text style={{ color: S.textDim, fontSize: 12, marginTop: 8 }}>Déchiffrement...</Text>
                </View>
              ) : clientInfo ? (
                <View style={[styles.vaultCard, { borderColor: clientInfo.contactUnlocked ? 'rgba(34,172,56,0.25)' : 'rgba(255,149,0,0.25)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, backgroundColor: 'transparent' }}>
                    <FontAwesome name={clientInfo.contactUnlocked ? 'unlock' : 'lock'} size={14} color={clientInfo.contactUnlocked ? S.success : S.warning} />
                    <Text style={{ color: clientInfo.contactUnlocked ? S.success : S.warning, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                      VAULT — {clientInfo.contactUnlocked ? 'DÉVERROUILLÉ' : 'ANONYMISÉ'}
                    </Text>
                  </View>
                  <Text style={{ color: S.white, fontSize: 17, fontWeight: '900', marginBottom: 12 }}>{clientInfo.clientName}</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: S.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Ville</Text><Text style={{ color: S.textDim, fontSize: 12 }}>{clientInfo.city}</Text></View>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: S.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Adresse</Text><Text style={{ color: S.textDim, fontSize: 12 }}>{clientInfo.address}</Text></View>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: S.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Tél.</Text><Text style={{ color: S.textDim, fontSize: 12 }}>{clientInfo.phone}</Text></View>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: S.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Email</Text><Text style={{ color: S.textDim, fontSize: 12 }}>{clientInfo.email}</Text></View>
                  {clientInfo.contactUnlocked ? (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, backgroundColor: 'transparent' }}>
                      <TouchableOpacity style={[styles.vaultBtn, { backgroundColor: S.success }]} onPress={() => clientInfo.phone && Linking.openURL(`tel:${clientInfo.phone}`)}><FontAwesome name="phone" size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}> Appeler</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.vaultBtn, { backgroundColor: S.info }]} onPress={() => clientInfo.email && Linking.openURL(`mailto:${clientInfo.email}`)}><FontAwesome name="envelope" size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}> Email</Text></TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={{ color: S.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 10, textAlign: 'center' }}>
                      Acceptez la commande pour débloquer les coordonnées.
                    </Text>
                  )}
                </View>
              ) : null}

              <Text style={{ color: S.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 }}>ARTICLES</Text>
              {selectedOrder?.items?.map((item: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: 'transparent' }}>
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={{ color: S.white, fontWeight: '700', fontSize: 14 }}>{item.name || item.stockItem?.name || 'Produit'}</Text>
                    <Text style={{ color: S.textDim, fontSize: 11 }}>{Number(item.quantity)} x {Number(item.price || 0).toFixed(3)} DT</Text>
                  </View>
                  <Text style={{ color: S.primary, fontWeight: '900', fontSize: 14 }}>{(Number(item.quantity) * Number(item.price || 0)).toFixed(3)} DT</Text>
                </View>
              ))}

              <View style={{ marginTop: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 8 }}>
                  <Text style={{ color: S.textDim, fontWeight: '700', fontSize: 13 }}>Total</Text>
                  <Text style={{ color: S.white, fontWeight: '800', fontSize: 13 }}>{Number(selectedOrder?.total || 0).toFixed(3)} DT</Text>
                </View>
                {selectedOrder?.settlement && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 10 }}>
                    <Text style={{ color: S.primary, fontWeight: '700', fontSize: 13 }}>Commission</Text>
                    <Text style={{ color: S.primary, fontWeight: '800', fontSize: 13 }}>-{Number(selectedOrder.settlement.commissionAmount).toFixed(3)} DT</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'transparent' }}>
                  <Text style={{ color: S.white, fontSize: 16, fontWeight: '900' }}>Net</Text>
                  <Text style={{ color: S.warning, fontSize: 17, fontWeight: '900' }}>
                    {selectedOrder?.settlement
                      ? (Number(selectedOrder.total) - Number(selectedOrder.settlement.commissionAmount)).toFixed(3)
                      : Number(selectedOrder?.total || 0).toFixed(3)} DT
                  </Text>
                </View>
              </View>

              {selectedOrder?.status === 'PENDING' && (
                <View style={{ gap: 12, marginTop: 24 }}>
                  <TouchableOpacity style={[styles.orderPrimaryBtn, { backgroundColor: '#1470cc' }]} onPress={() => confirmOrderAction(selectedOrder.id, 'CONFIRMED', 'Accepter ?')}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Accepter la commande</Text></TouchableOpacity>
                  <TouchableOpacity style={{ alignItems: 'center', padding: 12 }} onPress={() => confirmOrderAction(selectedOrder.id, 'CANCELLED', 'Refuser ?')}><Text style={{ color: S.primary, fontWeight: '700', fontSize: 14 }}>Refuser</Text></TouchableOpacity>
                </View>
              )}
              {selectedOrder?.status === 'CONFIRMED' && (
                <TouchableOpacity style={[styles.orderPrimaryBtn, { backgroundColor: S.info, marginTop: 24 }]} onPress={() => confirmOrderAction(selectedOrder.id, 'SHIPPED', 'Expédier ?')}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Expédier</Text></TouchableOpacity>
              )}
              {selectedOrder?.status === 'SHIPPED' && (
                <TouchableOpacity style={[styles.orderPrimaryBtn, { backgroundColor: S.success, marginTop: 24 }]} onPress={() => confirmOrderAction(selectedOrder.id, 'DELIVERED', 'Confirmer livraison ?')}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Confirmer la livraison</Text></TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* RFQ Quote Modal */}
      <Modal visible={rfqModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>Soumettre un devis</Text>
                <Text style={{ color: S.textMuted, fontSize: 12 }}>{selectedRfq?.title}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRfqModalVisible(false)}><FontAwesome name="times" size={18} color={S.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ color: S.textDim, fontSize: 13 }}>{selectedRfq?.description}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, backgroundColor: 'transparent' }}>
                  {selectedRfq?.budget && <Text style={{ color: S.warning, fontWeight: '800' }}>Budget: {Number(selectedRfq.budget).toFixed(3)} DT</Text>}
                  {selectedRfq?.quantity && <Text style={{ color: S.textMuted }}>Qté: {selectedRfq.quantity}</Text>}
                </View>
              </View>
              <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 5 }}>Prix proposé (DT) *</Text>
              <TextInput style={styles.inputField} value={quotePrice} onChangeText={setQuotePrice} keyboardType="numeric" placeholder="0.000" placeholderTextColor={S.textDim} />
              <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 5 }}>Notes</Text>
              <TextInput style={[styles.inputField, { height: 80 }]} value={quoteNotes} onChangeText={setQuoteNotes} multiline placeholder="Délais, conditions..." placeholderTextColor={S.textDim} />
              <TouchableOpacity style={styles.saveBtn} onPress={submitQuote} disabled={submittingQuote}>
                {submittingQuote ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Envoyer la proposition</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={msgModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FontAwesome name="user-circle" size={28} color={S.textMuted} />
                <Text style={styles.modalTitle}>{selectedUser?.name || 'Client'}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMsgModalVisible(false)}><FontAwesome name="times" size={18} color={S.textDim} /></TouchableOpacity>
            </View>
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: 'transparent' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={loadingMsgHistory ? <ActivityIndicator style={{ padding: 40 }} /> : <Text style={{ color: S.textMuted, textAlign: 'center', padding: 40 }}>Aucun message</Text>}
                renderItem={({ item }) => {
                  const own = isOwnMessage(item);
                  return (
                    <View style={{ flexDirection: 'row', marginBottom: 12, backgroundColor: 'transparent', justifyContent: own ? 'flex-end' : 'flex-start' }}>
                      <View style={{ maxWidth: '80%', padding: 12, borderRadius: 18, backgroundColor: own ? S.primary : 'rgba(255,255,255,0.06)', borderTopLeftRadius: own ? 18 : 4, borderTopRightRadius: own ? 4 : 18 }}>
                        {item.product && <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 6, borderRadius: 8, marginBottom: 6 }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>📦 {item.product.name}</Text></View>}
                        <Text style={{ color: own ? '#fff' : S.textDim, fontSize: 14 }}>
                          {item.isFiltered ? '📢 Message filtré (coordonnées masquées)' : item.filteredContent || item.content}
                        </Text>
                        <Text style={{ color: own ? 'rgba(255,255,255,0.5)' : S.textMuted, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' }}>{formatTime(item.createdAt)}</Text>
                      </View>
                    </View>
                  );
                }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 20, backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', gap: 10 }}>
                <TextInput
                  style={[styles.inputField, { flex: 1, marginBottom: 0, height: undefined, paddingVertical: 12, maxHeight: 100 }]}
                  value={newMessage} onChangeText={setNewMessage}
                  placeholder="Votre message..." placeholderTextColor={S.textDim} multiline
                />
                <TouchableOpacity style={[styles.sendBtn, (!newMessage.trim() || sendingMsg) && { opacity: 0.5 }]} onPress={sendMessage} disabled={!newMessage.trim() || sendingMsg}>
                  {sendingMsg ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome name="send" size={16} color="#fff" />}
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
  container: { flex: 1, backgroundColor: S.bg, padding: 20 },
  header: { marginBottom: 16, backgroundColor: 'transparent' },
  title: { fontSize: 26, fontWeight: '900', color: S.white },
  subTabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  subTabActive: { backgroundColor: 'rgba(230,69,69,0.15)' },
  subTabText: { color: S.textDim, fontSize: 12, fontWeight: '600' },
  subTabTextActive: { color: S.primary },
  scrollBody: { paddingBottom: 40 },
  // Orders
  orderTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'transparent' },
  orderTabText: { color: S.textMuted, fontSize: 11, fontWeight: '800' },
  orderBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  orderBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  orderCard: { backgroundColor: S.card, borderWidth: 1, borderColor: S.border, borderRadius: 20, padding: 16, marginBottom: 10 },
  orderStore: { color: S.white, fontSize: 15, fontWeight: '800' },
  orderRef: { color: S.textMuted, fontSize: 11, marginTop: 2 },
  orderTotal: { fontSize: 16, fontWeight: '900' },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  vaultCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 20 },
  vaultBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12 },
  orderPrimaryBtn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // RFQ
  rfqTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  rfqTabActive: { backgroundColor: 'rgba(230,69,69,0.15)' },
  rfqTabText: { color: S.textDim, fontSize: 12, fontWeight: '700' },
  rfqCard: { backgroundColor: S.card, borderWidth: 1, borderColor: S.border, borderRadius: 18, padding: 14, marginBottom: 10 },
  // Messages
  msgCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: S.card, borderWidth: 1, borderColor: S.border, borderRadius: 18, marginBottom: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0b1120', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '92%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0) },
  modalHeader: { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  modalTitle: { color: S.white, fontSize: 16, fontWeight: '900' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  inputField: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, height: 50, paddingHorizontal: 16, color: S.white, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  saveBtn: { backgroundColor: S.primary, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 16, shadowColor: S.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  sendBtn: { backgroundColor: S.primary, width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: S.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
});
