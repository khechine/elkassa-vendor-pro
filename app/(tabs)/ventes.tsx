import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Linking, FlatList, KeyboardAvoidingView, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlert } from '@/components/AlertContext';
import { useTheme } from '@/components/useTheme';

type SubTab = 'commandes' | 'devis' | 'messages';

export default function VentesScreen() {
  const T = useTheme();
  const styles = createStyles(T);
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
  const [myRfqs, setMyRfqs] = useState<any[]>([]);
  const [loadingRfqs, setLoadingRfqs] = useState(true);
  const [activeRfqTab, setActiveRfqTab] = useState<'disponibles' | 'propositions' | 'acceptees'>('disponibles');
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
      const res = await ApiService.get(`/management/vendor/orders/${orderId}/client`);
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
      const [openRes, myRes] = await Promise.all([
        ApiService.get('/management/vendor/rfq'),
        ApiService.get('/management/vendor/rfq?type=my'),
      ]);
      if (openRes?.success) setRfqs(openRes.data || []);
      if (myRes?.success) setMyRfqs(myRes.data || []);
    } catch (error) { console.error('Failed to fetch RFQs:', error); }
    finally { setLoadingRfqs(false); }
  }, []);

const fetchConversations = useCallback(async () => {
  try {
    const data = await ApiService.get('/management/vendor/messages');
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
    if (rfq.hasSubmittedQuote) {
      const statusMsg = rfq.myQuote?.status === 'ACCEPTED' ? 'Votre proposition a été acceptée.' : rfq.myQuote?.status === 'REJECTED' ? 'Votre proposition a été refusée.' : 'Proposition déjà envoyée, en attente de réponse.';
      return showAlert({ title: 'Proposition', message: `${statusMsg} Prix: ${Number(rfq.myQuote?.price || 0).toFixed(3)} DT`, type: 'info' });
    }
    setSelectedRfq(rfq);
    setQuotePrice(String(rfq.budget ? Number(rfq.budget) * 0.95 : ''));
    setQuoteNotes('');
    setRfqModalVisible(true);
  };

  const submitQuote = async () => {
    if (!quotePrice || Number(quotePrice) <= 0) return showAlert({ title: 'Erreur', message: 'Prix invalide.', type: 'error' });
    setSubmittingQuote(true);
    try {
      const res = await ApiService.post('/management/vendor/rfq', { rfqId: selectedRfq.id, price: Number(quotePrice), notes: quoteNotes || undefined });
      if (res?.success) {
        setRfqModalVisible(false);
        showAlert({ title: 'Envoyé', message: 'Devis soumis avec succès.', type: 'success' });
        fetchRfqs();
      } else showAlert({ title: 'Erreur', message: res?.error || 'Échec.', type: 'error' });
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Échec de l\'envoi.';
      showAlert({ title: 'Erreur', message: msg, type: 'error' });
    } finally { setSubmittingQuote(false); }
  };

  // Message handlers
  const openChat = async (conv: any) => {
    setSelectedUser(conv.otherUser);
    setMessages([]);
    setMsgModalVisible(true);
    setLoadingMsgHistory(true);
    try {
      const data = await ApiService.get(`/management/vendor/messages?otherUserId=${conv.otherUser.id}`);
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
      const res = await ApiService.post('/management/vendor/messages', { receiverId: selectedUser.id, content });
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
    { key: 'PENDING', label: 'Nouvelles', icon: 'clock-o', color: T.warning },
    { key: 'CONFIRMED', label: 'Acceptées', icon: 'check-circle', color: '#1470cc' },
    { key: 'SHIPPED', label: 'Expédiées', icon: 'truck', color: T.info },
    { key: 'DELIVERED', label: 'Livrées', icon: 'history', color: T.success },
    { key: 'CANCELLED', label: 'Annulées', icon: 'times-circle', color: T.primary },
  ] as const;

  const orderStatusColor = (status: string) => {
    const tab = ORDER_TABS.find(t => t.key === status);
    return tab?.color || T.textMuted;
  };

  const filteredOrders = orders.filter(o => {
    if (orderTab === 'DELIVERED') return o.status === 'DELIVERED' || o.status === 'STOCKED';
    return o.status === orderTab;
  });

  const openRfqs = rfqs.filter(r => !r.hasSubmittedQuote && new Date(r.expiresAt || r.createdAt) > new Date());
  const myQuotes = myRfqs.filter(r => r.hasSubmittedQuote);
  const acceptedQuotes = myRfqs.filter(r => r.myQuote?.status === 'ACCEPTED');
  const displayRfqs = activeRfqTab === 'disponibles' ? openRfqs : activeRfqTab === 'acceptees' ? acceptedQuotes : myQuotes;

  const STATUS_LABELS: Record<string, string> = {
    PENDING: 'En attente', CONFIRMED: 'Acceptée', SHIPPED: 'Expédiée',
    DELIVERED: 'Livrée', CANCELLED: 'Annulée', STOCKED: 'Finalisée',
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
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
              size={12} color={activeSubTab === tab ? T.primary : T.textDim} style={{ marginRight: 4 }}
            />
            <Text style={[styles.subTabText, activeSubTab === tab && styles.subTabTextActive]}>
              {tab === 'commandes' ? 'Commandes' : tab === 'devis' ? 'Devis' : 'Messages'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => vendorId && fetchAll(vendorId)} tintColor={T.primary} />}
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
                  <FontAwesome name={tab.icon as any} size={11} color={orderTab === tab.key ? tab.color : T.textMuted} />
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
              <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />
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
                    <Text style={{ color: T.textDim, fontSize: 12 }}>{order.items?.length || 0} article(s)</Text>
                    <FontAwesome name="chevron-right" size={12} color={T.textMuted} />
                  </View>
                  {order.status === 'PENDING' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, backgroundColor: 'transparent' }}>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(230,69,69,0.1)', borderColor: T.primary }]} onPress={() => confirmOrderAction(order.id, 'CANCELLED', 'Refuser ?')}>
                        <Text style={[styles.actionBtnText, { color: T.primary }]}>Refuser</Text>
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
              <TouchableOpacity style={[styles.rfqTab, activeRfqTab === 'disponibles' && styles.rfqTabActive]} onPress={() => setActiveRfqTab('disponibles')}>
                <Text style={[styles.rfqTabText, activeRfqTab === 'disponibles' && { color: T.primary }]}>Disponibles</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rfqTab, activeRfqTab === 'propositions' && styles.rfqTabActive]} onPress={() => setActiveRfqTab('propositions')}>
                <Text style={[styles.rfqTabText, activeRfqTab === 'propositions' && { color: T.primary }]}>Propositions ({myQuotes.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rfqTab, activeRfqTab === 'acceptees' && styles.rfqTabActive]} onPress={() => setActiveRfqTab('acceptees')}>
                <Text style={[styles.rfqTabText, activeRfqTab === 'acceptees' && { color: T.primary }]}>Acceptées ({acceptedQuotes.length})</Text>
              </TouchableOpacity>
            </View>

            {loadingRfqs ? (
              <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />
            ) : displayRfqs.length === 0 ? null : (
              displayRfqs.map((rfq: any) => {
                const qs = rfq.myQuote?.status;
                let badge: any = null;
                if (rfq.hasSubmittedQuote) {
                  if (qs === 'ACCEPTED') badge = { label: 'Acceptée ✓', color: T.success };
                  else if (qs === 'REJECTED') badge = { label: 'Refusée ✗', color: T.primary };
                  else badge = { label: 'En attente', color: T.warning };
                }
                return (
                <TouchableOpacity key={rfq.id} style={styles.rfqCard} onPress={() => openRfqModal(rfq)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' }}>
                      <FontAwesome name="building" size={12} color={T.textMuted} />
                      <Text style={{ color: T.textDim, fontSize: 11 }}>{rfq.store?.name || 'Café'}</Text>
                    </View>
                    {badge && <Text style={{ color: badge.color, fontSize: 10, fontWeight: '800' }}>{badge.label}</Text>}
                  </View>
                  <Text style={{ color: T.white, fontSize: 16, fontWeight: '800', marginBottom: 4 }}>{rfq.title}</Text>
                  {rfq.description && <Text style={{ color: T.textMuted, fontSize: 12, marginBottom: 8 }} numberOfLines={2}>{rfq.description}</Text>}
                  <View style={{ flexDirection: 'row', gap: 16, backgroundColor: 'transparent', marginBottom: 8 }}>
                    {rfq.budget && <Text style={{ color: T.warning, fontSize: 13, fontWeight: '800' }}>Budget: {Number(rfq.budget).toFixed(3)} DT</Text>}
                    {rfq.quantity && <Text style={{ color: T.textMuted, fontSize: 12 }}>Qté: {rfq.quantity}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent' }}>
                    {rfq.myQuote && <Text style={{ color: T.success, fontSize: 12, fontWeight: '700' }}>Mon offre: {Number(rfq.myQuote.price).toFixed(3)} DT</Text>}
                    <Text style={{ color: T.textMuted, fontSize: 10 }}>Limite: {formatDate(rfq.expiresAt)}</Text>
                  </View>
                </TouchableOpacity>
                );
              })
            )}
            {!loadingRfqs && displayRfqs.length === 0 && (
              <View style={{ alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' }}>
                <FontAwesome name="file-text" size={50} color="rgba(255,255,255,0.06)" />
                <Text style={{ color: T.textMuted, fontSize: 15, marginTop: 16, textAlign: 'center' }}>
                  {activeRfqTab === 'disponibles' ? "Aucune demande de devis pour le moment" : activeRfqTab === 'acceptees' ? "Aucune proposition acceptée" : "Vous n'avez pas encore soumis de proposition"}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Messages sub-tab */}
        {activeSubTab === 'messages' && (
          <>
            {loadingMessages ? (
              <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />
            ) : (
              conversations.map(conv => (
                <TouchableOpacity key={conv.otherUser?.id} style={styles.msgCard} onPress={() => openChat(conv)}>
                  <FontAwesome name="user-circle" size={40} color={T.textMuted} />
                  <View style={{ flex: 1, marginLeft: 12, backgroundColor: 'transparent' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent' }}>
                      <Text style={{ color: T.white, fontWeight: '700', fontSize: 15 }}>{conv.otherUser?.name || 'Client'}</Text>
                      <Text style={{ color: T.textMuted, fontSize: 11 }}>{formatTime(conv.lastMessage?.createdAt)}</Text>
                    </View>
                    <Text style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                      {conv.lastMessage?.senderId === userId ? 'Vous: ' : ''}{conv.lastMessage?.content || ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
            {!loadingMessages && conversations.length === 0 && (
              <View style={{ alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' }}>
                <FontAwesome name="envelope" size={40} color="rgba(255,255,255,0.06)" />
                <Text style={{ color: T.textMuted, fontSize: 15, marginTop: 16 }}>Aucune conversation</Text>
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
                <Text style={{ color: T.textMuted, fontSize: 12 }}>{selectedOrder?.store?.name}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setSelectedOrder(null); setClientInfo(null); }}><FontAwesome name="times" size={18} color={T.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ color: T.textMuted, fontWeight: '700', fontSize: 13 }}>Statut</Text>
                <View style={[styles.statusBadge, { backgroundColor: orderStatusColor(selectedOrder?.status) + '22' }]}>
                  <Text style={{ color: orderStatusColor(selectedOrder?.status), fontWeight: '900', fontSize: 12 }}>{STATUS_LABELS[selectedOrder?.status] || selectedOrder?.status}</Text>
                </View>
              </View>

              {/* Client info (Vault) */}
              {loadingClient ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: 'transparent' }}>
                  <ActivityIndicator size="small" color={T.primary} />
                  <Text style={{ color: T.textDim, fontSize: 12, marginTop: 8 }}>Déchiffrement...</Text>
                </View>
              ) : clientInfo ? (
                <View style={[styles.vaultCard, { borderColor: clientInfo.contactUnlocked ? 'rgba(34,172,56,0.25)' : 'rgba(255,149,0,0.25)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, backgroundColor: 'transparent' }}>
                    <FontAwesome name={clientInfo.contactUnlocked ? 'unlock' : 'lock'} size={14} color={clientInfo.contactUnlocked ? T.success : T.warning} />
                    <Text style={{ color: clientInfo.contactUnlocked ? T.success : T.warning, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                      VAULT — {clientInfo.contactUnlocked ? 'DÉVERROUILLÉ' : 'ANONYMISÉ'}
                    </Text>
                  </View>
                  <Text style={{ color: T.white, fontSize: 17, fontWeight: '900', marginBottom: 12 }}>{clientInfo.clientName}</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: T.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Ville</Text><Text style={{ color: T.textDim, fontSize: 12 }}>{clientInfo.city}</Text></View>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: T.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Adresse</Text><Text style={{ color: T.textDim, fontSize: 12 }}>{clientInfo.address}</Text></View>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: T.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Tél.</Text><Text style={{ color: T.textDim, fontSize: 12 }}>{clientInfo.phone}</Text></View>
                  <View style={{ flexDirection: 'row', marginBottom: 4, backgroundColor: 'transparent' }}><Text style={{ color: T.textMuted, width: 90, fontSize: 12, fontWeight: '800' }}>Email</Text><Text style={{ color: T.textDim, fontSize: 12 }}>{clientInfo.email}</Text></View>
                  {clientInfo.contactUnlocked ? (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, backgroundColor: 'transparent' }}>
                      <TouchableOpacity style={[styles.vaultBtn, { backgroundColor: T.success }]} onPress={() => clientInfo.phone && Linking.openURL(`tel:${clientInfo.phone}`)}><FontAwesome name="phone" size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}> Appeler</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.vaultBtn, { backgroundColor: T.info }]} onPress={() => clientInfo.email && Linking.openURL(`mailto:${clientInfo.email}`)}><FontAwesome name="envelope" size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}> Email</Text></TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={{ color: T.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 10, textAlign: 'center' }}>
                      Acceptez la commande pour débloquer les coordonnées.
                    </Text>
                  )}
                </View>
              ) : null}

              <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 }}>ARTICLES</Text>
              {selectedOrder?.items?.map((item: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: 'transparent' }}>
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={{ color: T.white, fontWeight: '700', fontSize: 14 }}>{item.name || item.stockItem?.name || 'Produit'}</Text>
                    <Text style={{ color: T.textDim, fontSize: 11 }}>{Number(item.quantity)} x {Number(item.price || 0).toFixed(3)} DT</Text>
                  </View>
                  <Text style={{ color: T.primary, fontWeight: '900', fontSize: 14 }}>{(Number(item.quantity) * Number(item.price || 0)).toFixed(3)} DT</Text>
                </View>
              ))}

              <View style={{ marginTop: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 8 }}>
                  <Text style={{ color: T.textDim, fontWeight: '700', fontSize: 13 }}>Total</Text>
                  <Text style={{ color: T.white, fontWeight: '800', fontSize: 13 }}>{Number(selectedOrder?.total || 0).toFixed(3)} DT</Text>
                </View>
                {selectedOrder?.settlement && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 10 }}>
                    <Text style={{ color: T.primary, fontWeight: '700', fontSize: 13 }}>Commission</Text>
                    <Text style={{ color: T.primary, fontWeight: '800', fontSize: 13 }}>-{Number(selectedOrder.settlement.commissionAmount).toFixed(3)} DT</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'transparent' }}>
                  <Text style={{ color: T.white, fontSize: 16, fontWeight: '900' }}>Net</Text>
                  <Text style={{ color: T.warning, fontSize: 17, fontWeight: '900' }}>
                    {selectedOrder?.settlement
                      ? (Number(selectedOrder.total) - Number(selectedOrder.settlement.commissionAmount)).toFixed(3)
                      : Number(selectedOrder?.total || 0).toFixed(3)} DT
                  </Text>
                </View>
              </View>

              {selectedOrder?.status === 'PENDING' && (
                <View style={{ gap: 12, marginTop: 24 }}>
                  <TouchableOpacity style={[styles.orderPrimaryBtn, { backgroundColor: '#1470cc' }]} onPress={() => confirmOrderAction(selectedOrder.id, 'CONFIRMED', 'Accepter ?')}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Accepter la commande</Text></TouchableOpacity>
                  <TouchableOpacity style={{ alignItems: 'center', padding: 12 }} onPress={() => confirmOrderAction(selectedOrder.id, 'CANCELLED', 'Refuser ?')}><Text style={{ color: T.primary, fontWeight: '700', fontSize: 14 }}>Refuser</Text></TouchableOpacity>
                </View>
              )}
              {selectedOrder?.status === 'CONFIRMED' && (
                <TouchableOpacity style={[styles.orderPrimaryBtn, { backgroundColor: T.info, marginTop: 24 }]} onPress={() => confirmOrderAction(selectedOrder.id, 'SHIPPED', 'Expédier ?')}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Expédier</Text></TouchableOpacity>
              )}
              {selectedOrder?.status === 'SHIPPED' && (
                <TouchableOpacity style={[styles.orderPrimaryBtn, { backgroundColor: T.success, marginTop: 24 }]} onPress={() => confirmOrderAction(selectedOrder.id, 'DELIVERED', 'Confirmer livraison ?')}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Confirmer la livraison</Text></TouchableOpacity>
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
                <Text style={{ color: T.textMuted, fontSize: 12 }}>{selectedRfq?.title}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRfqModalVisible(false)}><FontAwesome name="times" size={18} color={T.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ color: T.textDim, fontSize: 13 }}>{selectedRfq?.description}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, backgroundColor: 'transparent' }}>
                  {selectedRfq?.budget && <Text style={{ color: T.warning, fontWeight: '800' }}>Budget: {Number(selectedRfq.budget).toFixed(3)} DT</Text>}
                  {selectedRfq?.quantity && <Text style={{ color: T.textMuted }}>Qté: {selectedRfq.quantity}</Text>}
                </View>
              </View>
              <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 5 }}>Prix proposé (DT) *</Text>
              <TextInput style={styles.inputField} value={quotePrice} onChangeText={setQuotePrice} keyboardType="numeric" placeholder="0.000" placeholderTextColor={T.textDim} />
              <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 5 }}>Notes</Text>
              <TextInput style={[styles.inputField, { height: 80 }]} value={quoteNotes} onChangeText={setQuoteNotes} multiline placeholder="Délais, conditions..." placeholderTextColor={T.textDim} />
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
                <FontAwesome name="user-circle" size={28} color={T.textMuted} />
                <Text style={styles.modalTitle}>{selectedUser?.name || 'Client'}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMsgModalVisible(false)}><FontAwesome name="times" size={18} color={T.textDim} /></TouchableOpacity>
            </View>
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: 'transparent' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={loadingMsgHistory ? <ActivityIndicator style={{ padding: 40 }} /> : <Text style={{ color: T.textMuted, textAlign: 'center', padding: 40 }}>Aucun message</Text>}
                renderItem={({ item }) => {
                  const own = isOwnMessage(item);
                  return (
                    <View style={{ flexDirection: 'row', marginBottom: 12, backgroundColor: 'transparent', justifyContent: own ? 'flex-end' : 'flex-start' }}>
                      <View style={{ maxWidth: '80%', padding: 12, borderRadius: 18, backgroundColor: own ? T.primary : 'rgba(255,255,255,0.06)', borderTopLeftRadius: own ? 18 : 4, borderTopRightRadius: own ? 4 : 18 }}>
                        {item.product && <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 6, borderRadius: 8, marginBottom: 6 }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>📦 {item.product.name}</Text></View>}
                        <Text style={{ color: own ? '#fff' : T.textDim, fontSize: 14 }}>
                          {item.isFiltered ? '📢 Message filtré (coordonnées masquées)' : item.filteredContent || item.content}
                        </Text>
                        <Text style={{ color: own ? 'rgba(255,255,255,0.5)' : T.textMuted, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' }}>{formatTime(item.createdAt)}</Text>
                      </View>
                    </View>
                  );
                }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 20, backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', gap: 10 }}>
                <TextInput
                  style={[styles.inputField, { flex: 1, marginBottom: 0, height: undefined, paddingVertical: 12, maxHeight: 100 }]}
                  value={newMessage} onChangeText={setNewMessage}
                  placeholder="Votre message..." placeholderTextColor={T.textDim} multiline
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

function createStyles(T: ThemeColors) {
return StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg, padding: 20 },
  header: { marginBottom: 16, backgroundColor: 'transparent' },
  title: { fontSize: 26, fontWeight: '900', color: T.white },
  subTabRow: { flexDirection: 'row', backgroundColor: T.sectionBg, borderRadius: 14, padding: 4, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  subTabActive: { backgroundColor: T.tabActiveBg },
  subTabText: { color: T.textDim, fontSize: 12, fontWeight: '600' },
  subTabTextActive: { color: T.primary },
  scrollBody: { paddingBottom: 40 },
  // Orders
  orderTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 38, borderRadius: 12, backgroundColor: T.sectionBg, borderWidth: 1, borderColor: 'transparent' },
  orderTabText: { color: T.textMuted, fontSize: 11, fontWeight: '800' },
  orderBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  orderBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  orderCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.cardBorder, borderRadius: 20, padding: 16, marginBottom: 10 },
  orderStore: { color: T.white, fontSize: 15, fontWeight: '800' },
  orderRef: { color: T.textMuted, fontSize: 11, marginTop: 2 },
  orderTotal: { fontSize: 16, fontWeight: '900' },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  vaultCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 20 },
  vaultBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12 },
  orderPrimaryBtn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // RFQ
  rfqTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  rfqTabActive: { backgroundColor: T.tabActiveBg },
  rfqTabText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  rfqCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.cardBorder, borderRadius: 18, padding: 14, marginBottom: 10 },
  // Messages
  msgCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: T.card, borderWidth: 1, borderColor: T.cardBorder, borderRadius: 18, marginBottom: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: T.modalOverlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: T.modalBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '92%', borderTopWidth: 1, borderColor: T.cardBorder, marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0) },
  modalHeader: { backgroundColor: T.modalHeaderBg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomWidth: 1, borderBottomColor: T.divider },
  modalTitle: { color: T.white, fontSize: 16, fontWeight: '900' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.sectionBg, alignItems: 'center', justifyContent: 'center' },
  inputField: { backgroundColor: T.inputBg, borderRadius: 14, height: 50, paddingHorizontal: 16, color: T.white, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: T.inputBorder },
  saveBtn: { backgroundColor: T.primary, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 16, shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  sendBtn: { backgroundColor: T.primary, width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: T.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
});
}
