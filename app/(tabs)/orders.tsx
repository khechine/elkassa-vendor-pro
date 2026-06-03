import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Platform, View, Text, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlert } from '@/components/AlertContext';
import { useTheme } from '@/components/useTheme';
import { useT } from '@/constants/translations';

type OrderTab = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export default function OrdersScreen() {
  const T = useTheme();
  const styles = createStyles(T);
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const t = useT();

  // Progressive Reveal Supplier Vault states
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const fetchClientInfo = async (orderId: string) => {
    setLoadingClient(true);
    try {
      const res = await ApiService.get(`/management/vendor/orders/${orderId}/client`);
      if (res && res.success) {
        setClientInfo(res.data);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('404') || msg.includes('Cannot GET')) {
        console.info('Client info not yet available for order:', orderId);
      } else {
        console.warn('Failed to fetch client reveal info:', msg);
      }
    } finally {
      setLoadingClient(false);
    }
  };

  useEffect(() => {
    if (selectedOrder) {
      fetchClientInfo(selectedOrder.id);
    } else {
      setClientInfo(null);
    }
  }, [selectedOrder]);

  const fetchData = async (vid: string) => {
    try {
      const data = await ApiService.get(`/management/vendor/orders/${vid}`);
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to fetch vendor orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (session?.user?.vendorId) {
        setVendorId(session.user.vendorId);
        fetchData(session.user.vendorId);
      }
    });
  }, []);

  const onRefresh = () => {
    if (vendorId) { setRefreshing(true); fetchData(vendorId); }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await ApiService.put(`/management/vendor/orders/${orderId}/status`, { status: newStatus });
      onRefresh();
      // Keep modal open and refresh progressive reveal client details!
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
        fetchClientInfo(orderId);
      }
    } catch (error) {
      showAlert({ title: t('general.error'), message: t('orders.updateFailed'), type: 'error' });
    }
  };

  const confirmAction = (orderId: string, newStatus: string, message: string) => {
    showAlert({
      title: t('ventes.confirmation'),
      message,
      type: 'warning',
      buttons: [
        { text: t('actions.cancel'), style: 'cancel' },
        { text: t('actions.confirm'), style: 'default', onPress: () => handleUpdateStatus(orderId, newStatus) }
      ]
    });
  };

  const TABS: { key: OrderTab; label: string; icon: string; color: string }[] = [
    { key: 'PENDING',   label: t('orders.new'),   icon: 'clock-o',        color: '#ff9500' },
    { key: 'CONFIRMED', label: t('orders.accepted'),   icon: 'check-circle',   color: '#1470cc' },
    { key: 'SHIPPED',   label: t('orders.shipped'),   icon: 'truck',          color: '#1470cc' },
    { key: 'DELIVERED', label: t('orders.delivered'), icon: 'history',        color: '#22ac38' },
    { key: 'CANCELLED', label: t('orders.cancelled'),    icon: 'times-circle',   color: '#e64545' },
  ];

  const STATUS_LABELS: Record<string, string> = {
    PENDING:   `🕐 ${t('orders.pending')}`,
    CONFIRMED: `✅ ${t('orders.confirmed')}`,
    SHIPPED:   `🚚 ${t('orders.shipped')}`,
    DELIVERED: `📦 ${t('orders.delivered')}`,
    CANCELLED: `❌ ${t('orders.cancelled')}`,
    STOCKED:   `✔ ${t('orders.stocked')}`,
  };

  const getItemName = (item: any) =>
    item.name || item.stockItem?.name || t('orders.unknownProduct');

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'DELIVERED') return o.status === 'DELIVERED' || o.status === 'STOCKED';
    return o.status === activeTab;
  });

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff9500" />
      </View>
    );
  }

  const activeTabMeta = TABS.find(t => t.key === activeTab)!;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <Text style={styles.sectionTitle}>{t('orders.title')}</Text>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { backgroundColor: `${tab.color}22`, borderColor: tab.color }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <FontAwesome name={tab.icon as any} size={12} color={activeTab === tab.key ? tab.color : '#475569'} />
            <Text style={[styles.tabText, activeTab === tab.key && { color: tab.color }]}>{tab.label}</Text>
            {(() => {
              const count = tab.key === 'DELIVERED' 
                ? orders.filter(o => o.status === 'DELIVERED' || o.status === 'STOCKED').length
                : orders.filter(o => o.status === tab.key).length;
              
              if (count === 0) return null;
              return (
                <View style={[styles.tabBadge, { backgroundColor: tab.color }]}>
                  <Text style={styles.tabBadgeText}>{count}</Text>
                </View>
              );
            })()}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff9500" />}
      >
        {filteredOrders.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome name={activeTabMeta.icon as any} size={40} color="#1e293b" style={{ marginBottom: 15 }} />
            <Text style={styles.emptyText}>
               {activeTab === 'PENDING' ? t('orders.noNewOrders') : `${t('orders.noOrders')} ${activeTabMeta.label.toLowerCase()}`}
            </Text>
          </View>
        )}
        {filteredOrders.map((order, idx) => (
          <TouchableOpacity key={idx} style={styles.orderCard} onPress={() => setSelectedOrder(order)}>
            <View style={styles.cardTop}>
              <View style={{ backgroundColor: 'transparent', flex: 1 }}>
                <Text style={styles.storeName}>{order.store?.name || t('orders.unknownStore')}</Text>
                <Text style={styles.orderDate}>
                  #{(order.id || '').slice(-6).toUpperCase()} — {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', backgroundColor: 'transparent' }}>
                <Text style={[styles.orderTotal, { color: activeTabMeta.color }]}>
                  {Number(order.total || 0).toFixed(3)} DT
                </Text>
                {order.settlement && (
                  <Text style={{ color: '#e64545', fontSize: 10, fontWeight: '800' }}>
                    -{Number(order.settlement.commissionAmount).toFixed(3)} DT
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.itemCount}>{order.items?.length || 0} {t('orders.itemCount')}</Text>
              <FontAwesome name="chevron-right" size={12} color="#475569" />
            </View>

            {/* Quick action for PENDING */}
            {order.status === 'PENDING' && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.quickBtn, { backgroundColor: 'rgba(230,69,69,0.1)', borderColor: '#e64545' }]}
                  onPress={() => confirmAction(order.id, 'CANCELLED', t('orders.confirmRefuse'))}
                >
                  <FontAwesome name="times" size={12} color="#e64545" />
                  <Text style={[styles.quickBtnText, { color: '#e64545' }]}>{t('orders.refuse')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickBtn, { backgroundColor: 'rgba(20,112,204,0.1)', borderColor: '#1470cc', flex: 2 }]}
                  onPress={() => confirmAction(order.id, 'CONFIRMED', t('orders.confirmAccept'))}
                >
                  <FontAwesome name="check" size={12} color="#1470cc" />
                  <Text style={[styles.quickBtnText, { color: '#1470cc' }]}>{t('orders.accept')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal visible={!!selectedOrder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>{t('orders.orderId')}{selectedOrder?.id?.slice(-6).toUpperCase()}</Text>
                <Text style={styles.modalSub}>{selectedOrder?.store?.name} — {selectedOrder?.store?.city}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <FontAwesome name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Status badge */}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>{t('orders.currentStatus')}</Text>
                <View style={[styles.statusBadge, {
                  backgroundColor: selectedOrder?.status === 'PENDING' ? 'rgba(255,149,0,0.15)' :
                    selectedOrder?.status === 'CONFIRMED' ? 'rgba(20,112,204,0.15)' :
                    selectedOrder?.status === 'SHIPPED' ? 'rgba(59,130,246,0.15)' :
                    selectedOrder?.status === 'DELIVERED' ? 'rgba(34,172,56,0.15)' :
                    'rgba(239,68,68,0.15)'
                }]}>
                  <Text style={[styles.statusText, {
                    color: selectedOrder?.status === 'PENDING' ? '#ff9500' :
                      selectedOrder?.status === 'CONFIRMED' ? '#1470cc' :
                      selectedOrder?.status === 'SHIPPED' ? '#1470cc' :
                      selectedOrder?.status === 'DELIVERED' ? '#22ac38' :
                      '#e64545'
                  }]}>
                    {STATUS_LABELS[selectedOrder?.status] || selectedOrder?.status}
                  </Text>
                </View>
              </View>

              {/* Progressive Reveal Client Card (Supplier Vault Section 4) */}
              {loadingClient ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: 'transparent' }}>
                  <ActivityIndicator size="small" color="#ff9500" />
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{t('orders.decrypting')}</Text>
                </View>
              ) : clientInfo ? (
                <View style={[styles.vaultCard, clientInfo.contactUnlocked ? styles.vaultUnlocked : styles.vaultLocked]}>
                  <View style={styles.vaultTitleRow}>
                    <FontAwesome 
                      name={clientInfo.contactUnlocked ? "unlock" : "lock"} 
                      size={16} 
                      color={clientInfo.contactUnlocked ? "#22ac38" : "#ff9500"} 
                    />
                    <Text style={[styles.vaultTitle, { color: clientInfo.contactUnlocked ? "#22ac38" : "#ff9500" }]}>
                      {clientInfo.contactUnlocked ? t('orders.vaultStage3') : t('orders.vaultStage1')}
                    </Text>
                  </View>
                  
                  <Text style={styles.vaultClientName}>{clientInfo.clientName}</Text>
                  
                  <View style={styles.vaultInfoRow}>
                    <Text style={styles.vaultInfoLabel}>{t('orders.contactName')}</Text>
                    <Text style={styles.vaultInfoValue}>{clientInfo.ownerName}</Text>
                  </View>

                  <View style={styles.vaultInfoRow}>
                    <Text style={styles.vaultInfoLabel}>{t('orders.contactCity')}</Text>
                    <Text style={styles.vaultInfoValue}>{clientInfo.city}</Text>
                  </View>

                  <View style={styles.vaultInfoRow}>
                    <Text style={styles.vaultInfoLabel}>{t('orders.contactAddress')}</Text>
                    <Text style={styles.vaultInfoValue}>{clientInfo.address}</Text>
                  </View>

                  <View style={styles.vaultInfoRow}>
                    <Text style={styles.vaultInfoLabel}>{t('orders.contactPhone')}</Text>
                    <Text style={styles.vaultInfoValue}>{clientInfo.phone}</Text>
                  </View>

                  <View style={styles.vaultInfoRow}>
                    <Text style={styles.vaultInfoLabel}>{t('orders.contactEmail')}</Text>
                    <Text style={styles.vaultInfoValue}>{clientInfo.email}</Text>
                  </View>

                  {clientInfo.contactUnlocked ? (
                    <View style={styles.vaultActions}>
                      <TouchableOpacity 
                        style={styles.vaultPhoneBtn} 
                        onPress={() => {
                          if (clientInfo.phone && clientInfo.phone !== 'Téléphone masqué' && clientInfo.phone !== 'Non renseigné') {
                            Linking.openURL(`tel:${clientInfo.phone}`);
                          }
                        }}
                      >
                        <FontAwesome name="phone" size={14} color="#fff" />
                        <Text style={styles.vaultBtnText}>{t('orders.call')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.vaultEmailBtn} 
                        onPress={() => {
                          if (clientInfo.email && clientInfo.email !== 'Email masqué' && clientInfo.email !== 'Non renseigné') {
                            Linking.openURL(`mailto:${clientInfo.email}`);
                          }
                        }}
                      >
                        <FontAwesome name="envelope" size={14} color="#fff" />
                        <Text style={styles.vaultBtnText}>{t('orders.email')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.vaultNotice}>
                      {t('orders.vaultLockedNotice')}
                    </Text>
                  )}
                </View>
              ) : null}

              {/* Items */}
              <Text style={styles.sectionLabel}>{t('orders.itemsLabel')}</Text>
              {selectedOrder?.items?.map((item: any, i: number) => (
                <View key={i} style={styles.itemRow}>
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={styles.itemName}>{getItemName(item)}</Text>
                    <Text style={styles.itemSub}>{Number(item.quantity)} x {Number(item.price || 0).toFixed(3)} DT</Text>
                  </View>
                  <Text style={styles.itemTotal}>{(Number(item.quantity) * Number(item.price || 0)).toFixed(3)} DT</Text>
                </View>
              ))}

              {/* Total and Commission breakdown */}
              <View style={{ marginTop: 25, padding: 15, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, backgroundColor: 'transparent' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700' }}>{t('orders.totalBrut')}</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{Number(selectedOrder?.total || 0).toFixed(3)} DT</Text>
                </View>
                
                {selectedOrder?.settlement && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, backgroundColor: 'transparent' }}>
                    <Text style={{ color: '#e64545', fontSize: 13, fontWeight: '700' }}>{t('orders.commission')}</Text>
                    <Text style={{ color: '#e64545', fontSize: 13, fontWeight: '800' }}>-{Number(selectedOrder.settlement.commissionAmount).toFixed(3)} DT</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: 'transparent' }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{t('orders.totalNet')}</Text>
                  <Text style={{ color: '#ff9500', fontSize: 18, fontWeight: '900' }}>
                    {selectedOrder?.settlement 
                      ? (Number(selectedOrder.total) - Number(selectedOrder.settlement.commissionAmount)).toFixed(3)
                      : Number(selectedOrder?.total || 0).toFixed(3)
                    } DT
                  </Text>
                </View>
              </View>

              {/* Action buttons based on status */}
              {selectedOrder?.status === 'PENDING' && (
                <View style={{ gap: 12, marginTop: 25 }}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => confirmAction(selectedOrder.id, 'CONFIRMED', t('orders.confirmAccept'))}>
                    <FontAwesome name="check-circle" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>{t('orders.confirmAcceptOrder')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => confirmAction(selectedOrder.id, 'CANCELLED', t('orders.confirmRefuseOrder'))}>
                    <Text style={styles.cancelBtnText}>{t('orders.refuseOrder')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedOrder?.status === 'CONFIRMED' && (
                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 25, backgroundColor: '#1470cc' }]} onPress={() => confirmAction(selectedOrder.id, 'SHIPPED', t('orders.confirmShip'))}>
                  <FontAwesome name="truck" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>{t('orders.shipOrder')}</Text>
                </TouchableOpacity>
              )}

              {selectedOrder?.status === 'SHIPPED' && (
                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 25, backgroundColor: '#22ac38' }]} onPress={() => confirmAction(selectedOrder.id, 'DELIVERED', t('orders.confirmDeliver'))}>
                  <FontAwesome name="cube" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>{t('orders.deliverConfirm')}</Text>
                </TouchableOpacity>
              )}

              {selectedOrder?.status === 'DELIVERED' && (
                <View style={[styles.infoBox, { backgroundColor: 'rgba(34,172,56,0.1)', borderColor: 'rgba(34,172,56,0.2)' }]}>
                  <FontAwesome name="info-circle" size={16} color="#22ac38" />
                  <Text style={{ color: '#22ac38', fontSize: 12, fontWeight: '700', flex: 1 }}>
                    {t('orders.deliveryPending')}
                  </Text>
                </View>
              )}

              {selectedOrder?.status === 'STOCKED' && (
                <View style={[styles.infoBox, { backgroundColor: 'rgba(20,112,204,0.1)', borderColor: 'rgba(99,102,241,0.2)' }]}>
                  <FontAwesome name="check-square-o" size={16} color="#1470cc" />
                  <Text style={{ color: '#1470cc', fontSize: 12, fontWeight: '700', flex: 1 }}>
                    {t('orders.orderFinalized')}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(T: ThemeColors) {
return StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: T.statusBarBg, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: T.statusBarBg, padding: 20 },
  sectionTitle: { color: T.text, fontSize: 22, fontWeight: '900', marginBottom: 20, letterSpacing: 0.5 },
  scrollBody: { paddingBottom: 100 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 44, borderRadius: 14,
    backgroundColor: T.inputBg, position: 'relative',
    borderWidth: 1, borderColor: 'transparent'
  },
  tabText: { color: T.textDim, fontSize: 12, fontWeight: '800' },
  tabBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', zIndex: 10
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: T.textDim, textAlign: 'center', fontSize: 14, fontStyle: 'italic' },
  orderCard: {
    backgroundColor: T.glassCard, borderWidth: 1, borderColor: T.glassBorder,
    borderRadius: 24, padding: 20, marginBottom: 15
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginBottom: 15 },
  storeName: { color: T.text, fontSize: 16, fontWeight: '800' },
  orderDate: { color: T.textMuted, fontSize: 11, marginTop: 4 },
  orderTotal: { fontSize: 18, fontWeight: '900' },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'transparent', paddingTop: 15, borderTopWidth: 1, borderTopColor: T.divider
  },
  itemCount: { color: T.textDim, fontSize: 13, fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1
  },
  quickBtnText: { fontSize: 12, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: T.modalOverlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: T.statusBarBg, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    height: '85%', borderTopWidth: 1, borderColor: T.glassBorder
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: T.divider
  },
  modalTitle: { color: T.text, fontSize: 18, fontWeight: '800' },
  modalSub: { color: T.textMuted, fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusLabel: { color: T.textMuted, fontSize: 13, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '900' },
  sectionLabel: { color: T.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: T.divider, backgroundColor: 'transparent'
  },
  itemName: { color: T.text, fontSize: 14, fontWeight: '700' },
  itemSub: { color: T.textDim, fontSize: 11, marginTop: 2 },
  itemTotal: { color: T.warning, fontSize: 14, fontWeight: '900' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20, padding: 18, backgroundColor: T.sectionBg, borderRadius: 16
  },
  totalLabel: { color: T.textDim, fontSize: 14, fontWeight: '700' },
  totalValue: { color: T.warning, fontSize: 24, fontWeight: '900' },
  primaryBtn: {
    backgroundColor: T.info, height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  cancelBtnText: { color: T.primary, fontSize: 14, fontWeight: '700' },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginTop: 25, padding: 16, borderRadius: 16, borderWidth: 1
  },
  vaultCard: {
    backgroundColor: T.sectionBg,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 25,
  },
  vaultLocked: {
    borderColor: 'rgba(255, 149, 0, 0.25)',
    backgroundColor: 'rgba(255, 149, 0, 0.03)',
  },
  vaultUnlocked: {
    borderColor: 'rgba(34, 172, 56, 0.25)',
    backgroundColor: 'rgba(34, 172, 56, 0.03)',
  },
  vaultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  vaultTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  vaultClientName: {
    fontSize: 18,
    fontWeight: '900',
    color: T.text,
    marginBottom: 14,
  },
  vaultInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 5,
    backgroundColor: 'transparent',
  },
  vaultInfoLabel: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: '800',
    width: 100,
  },
  vaultInfoValue: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  vaultNotice: {
    fontSize: 11,
    color: T.textDim,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  vaultActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    backgroundColor: 'transparent',
  },
  vaultPhoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#22ac38',
  },
  vaultEmailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1470cc',
  },
  vaultBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
}
