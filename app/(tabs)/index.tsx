import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Modal, BackHandler, Alert, View, Text } from 'react-native';
import { Colors } from '@/constants/Colors';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAlert } from '@/components/AlertContext';
import { useTheme, ThemeColors } from '@/components/useTheme';

export default function DashboardScreen() {
  const T = useTheme();
  const styles = createStyles(T);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [lastOrderCount, setLastOrderCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const router = useRouter();
  const { showAlert } = useAlert();

  // Load the real vendorId from secure storage
  useEffect(() => {
    AuthService.getSession().then(session => {
      if (session?.user?.vendorId) setVendorId(session.user.vendorId);
      if (session?.user) setUser(session.user);
    });
  }, []);

  // Handle Android Back Button
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'web') return;

      const onBackPress = () => {
        Alert.alert('Quitter l\'application', 'Voulez-vous vraiment quitter Rachma Vendor ?', [
          { text: 'Annuler', style: 'cancel', onPress: () => {} },
          { text: 'Quitter', style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true; // prevent default
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Voulez-vous vraiment vous déconnecter ?')) {
        AuthService.clearSession().then(() => {
          router.replace('/login');
        });
      }
      return;
    }

    showAlert({
      title: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      type: 'warning',
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            await AuthService.clearSession();
            router.replace('/login');
          },
        },
      ]
    });
  };

  const fetchData = async (vid: string) => {
    try {
      const summary = await ApiService.get(`/management/vendor/summary/${vid}`);
      
      try {
        const notifs = await ApiService.get(`/management/vendor/notifications/${vid}`);
        const storedKeys = await AsyncStorage.getItem(`readNotifications_${vid}`);
        const parsedKeys = storedKeys ? JSON.parse(storedKeys) : [];
        setReadNotifIds(parsedKeys);
        setNotifications(notifs || []);
      } catch(e) { console.warn("Failed to fetch notifications:", e); }
      
      // Check for new orders
      if (lastOrderCount > 0 && summary.orderCount > lastOrderCount) {
        showAlert({
          title: "🛒 Nouvelle Commande !",
          message: "Vous avez reçu une nouvelle commande sur la Marketplace.",
          type: 'success'
        });
      }
      
      setLastOrderCount(summary.orderCount);
      setData(summary);
      
      if (summary.isHidden) {
        // Optional: notification toast
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      // If vid is correct but fetch fails, it's often a network/CORS issue
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      fetchData(vendorId);
      // Auto-refresh every 30s for notifications
      const interval = setInterval(() => fetchData(vendorId), 30000);
      return () => clearInterval(interval);
    }
  }, [vendorId]);

  const onRefresh = () => {
    if (vendorId) {
      setRefreshing(true);
      fetchData(vendorId);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.warning} />
        <Text style={styles.loadingText}>Chargement de votre espace vendeur...</Text>
      </View>
    );
  }

  const stats = data || { totalRevenue: 0, pendingOrders: 0, activeProducts: 0, walletBalance: 0, orderCount: 0, topClients: [] };

  const fmtMoney = (v: any) => (v != null && !isNaN(Number(v)) ? Number(v).toLocaleString('fr-TN', { minimumFractionDigits: 2 }) : '0.000');
  const fmtInt = (v: any) => (v != null ? Number(v) : 0);

  const handleMarkAllAsRead = async () => {
    if (!vendorId) return;
    const allIds = notifications.map(n => n.id);
    await AsyncStorage.setItem(`readNotifications_${vendorId}`, JSON.stringify(allIds));
    setReadNotifIds(allIds);
  };
  const unreadCount = notifications.filter(n => !readNotifIds.includes(n.id)).length;

  return (
    <View style={styles.outerContainer}>
      <ScrollView 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.warning} />
        }
        contentContainerStyle={styles.container}
      >
        {/* Suspension Alert */}
        {data?.isHidden && (
          <View style={styles.alertBanner}>
            <View style={styles.alertIconContainer}>
              <FontAwesome name="exclamation-triangle" size={24} color="#fff" />
            </View>
            <View style={styles.alertTextContainer}>
              <Text style={styles.alertTitle}>Produits Invisibles</Text>
              <Text style={styles.alertSub}>{data.suspensionReason || "Votre compte nécessite une régularisation."}</Text>
            </View>
            <TouchableOpacity style={styles.alertActionBtn} onPress={() => router.push('/wallet')}>
              <Text style={styles.alertActionText}>Payer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeTitle}>Espace Vendeur 👋</Text>
            <Text style={styles.subtitle}>{user?.vendorName || 'Votre Entreprise'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', gap: 15 }}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifications(true)}>
              <FontAwesome name="bell" size={22} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={handleLogout}>
              <FontAwesome name="sign-out" size={24} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI Section - Finance */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.glassCard, { borderLeftColor: Colors.warning, borderLeftWidth: 4 }]}>
            <View style={[styles.iconBox, { backgroundColor: Colors.glass.orange }]}>
              <FontAwesome name="money" size={18} color={Colors.warning} />
            </View>
            <Text style={styles.kpiLabel}>CA Total</Text>
            <Text style={styles.kpiValue}>{fmtMoney(stats.totalRevenue)} <Text style={{fontSize:12, opacity:0.6}}>DT</Text></Text>
            <Text style={[styles.kpiTrend, { color: Colors.warning }]}>Chiffre cumulé</Text>
          </View>

          <View style={[styles.kpiCard, styles.glassCard, { borderLeftColor: Colors.secondary, borderLeftWidth: 4 }]}>
            <View style={[styles.iconBox, { backgroundColor: Colors.glass.blue }]}>
              <FontAwesome name="credit-card" size={18} color={Colors.secondary} />
            </View>
            <Text style={styles.kpiLabel}>Wallet</Text>
            <Text style={[styles.kpiValue, { color: Colors.secondary }]}>{fmtMoney(stats.walletBalance)} <Text style={{fontSize:12, opacity:0.6}}>DT</Text></Text>
            <Text style={[styles.kpiTrend, { color: Colors.secondary }]}>Solde disponible</Text>
          </View>
        </View>

        {/* ── SECTION: ANALYSE DÉTAILLÉE ───────────────────────── */}
        <View style={{ marginTop: 10, marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>Analyse de Performance</Text>
          
          <View style={[styles.profitBanner, { backgroundColor: 'rgba(34,172,56,0.05)', borderColor: 'rgba(34,172,56,0.15)' }]}>
            <View style={{ backgroundColor: 'transparent' }}>
              <Text style={styles.profitLabel}>Volume des Ventes</Text>
              <Text style={[styles.profitValue, { color: Colors.success }]}>{fmtInt(stats.orderCount)}</Text>
              <Text style={[styles.profitSub, { color: '#94a3b8' }]}>Commandes traitées sur le marché</Text>
            </View>
            <FontAwesome name="line-chart" size={32} color={Colors.success} style={{ opacity: 0.5 }} />
          </View>

          <View style={{ gap: 15 }}>
              {stats.topClients?.length > 0 && (
                <View style={[styles.analyticsCard, styles.glassCard]}>
                  <View style={styles.analyticsHeader}>
                    <Text style={styles.analyticsTitle}>Meilleurs Clients (Magasins)</Text>
                  </View>
                  {stats.topClients.slice(0, 3).map((c: any, i: number) => (
                    <View key={i} style={[styles.rankRow, i === 2 && { borderBottomWidth: 0 }]}>
                      <Text style={styles.rankNum}>{i + 1}</Text>
                      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                        <Text style={styles.rankName}>{c.name}</Text>
                        <Text style={styles.rankSub}>Total achats: {fmtMoney(c.total)} DT</Text>
                      </View>
                      <View style={[styles.rankBadge, { backgroundColor: Colors.glass.blue }]}>
                        <Text style={[styles.rankBadgeText, { color: Colors.secondary }]}>Top Client</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
          </View>
        </View>

        {/* Actionable KPIs - Operations */}
        <View style={styles.kpiGrid}>
          <TouchableOpacity 
            style={[styles.kpiCard, styles.actionCard]} 
            onPress={() => router.push('/(tabs)/ventes')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.glass.blue }]}>
              <FontAwesome name="truck" size={18} color={Colors.secondary} />
            </View>
            <Text style={styles.kpiLabel}>Commandes</Text>
            <Text style={[styles.kpiValue, { color: Colors.secondary }]}>{fmtInt(stats.pendingOrders)}</Text>
            <View style={{flexDirection:'row', alignItems:'center', backgroundColor: 'transparent'}}>
                <Text style={[styles.kpiTrend, { color: Colors.secondary, marginRight: 4 }]}>En attente</Text>
                <FontAwesome name="chevron-right" size={10} color={Colors.secondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.kpiCard, styles.actionCard]} 
            onPress={() => router.push('/(tabs)/catalogue')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.glass.green }]}>
              <FontAwesome name="cubes" size={18} color={Colors.success} />
            </View>
            <Text style={styles.kpiLabel}>Produits</Text>
            <Text style={[styles.kpiValue, { color: Colors.success }]}>{fmtInt(stats.activeProducts)}</Text>
            <View style={{flexDirection:'row', alignItems:'center', backgroundColor: 'transparent'}}>
                <Text style={[styles.kpiTrend, { color: Colors.success, marginRight: 4 }]}>Gérer le stock</Text>
                <FontAwesome name="chevron-right" size={10} color={Colors.success} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Access Row */}
        <View style={styles.qaRow}>
          {[
            { icon: 'archive', label: 'Catalogue', route: '/(tabs)/catalogue', color: Colors.success },
            { icon: 'shopping-cart', label: 'Ventes', route: '/(tabs)/ventes', color: Colors.secondary },
            { icon: 'file-text', label: 'Devis', route: '/(tabs)/ventes', color: Colors.warning },
            { icon: 'credit-card', label: 'Wallet', route: '/(tabs)/wallet', color: '#f472b6' },
            { icon: 'cubes', label: 'Stock', route: '/(tabs)/catalogue', color: '#a78bfa' },
            { icon: 'users', label: 'Profil', route: '/(tabs)/profile', color: '#64748b' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.qaBtn} onPress={() => router.push(item.route as any)}>
              <View style={[styles.qaIconCircle, { backgroundColor: item.color + '22' }]}>
                <FontAwesome name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={styles.qaLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Notifications</Text>
                    <TouchableOpacity onPress={() => setShowNotifications(false)}>
                        <FontAwesome name="times" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity style={styles.markAllReadBtn} onPress={handleMarkAllAsRead}>
                        <FontAwesome name="check-square-o" size={14} color={Colors.primary} />
                        <Text style={styles.markAllReadText}>Tout marquer comme lu</Text>
                    </TouchableOpacity>
                )}
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    {notifications.length === 0 ? (
                        <Text style={{color: '#94a3b8', textAlign: 'center', marginTop: 30}}>Aucune notification.</Text>
                    ) : (
                        notifications.map((n, idx) => {
                            const isRead = readNotifIds.includes(n.id);
                            return (
                                <TouchableOpacity 
                                    key={idx} 
                                    style={[styles.notifItem, isRead && { opacity: 0.6 }]}
                                    onPress={() => {
                                        if (!isRead) {
                                            const newIds = [...readNotifIds, n.id];
                                            setReadNotifIds(newIds);
                                            AsyncStorage.setItem('@notifications_read', JSON.stringify(newIds)).catch(() => {});
                                        }
                                        setShowNotifications(false);
                                        if (n.type === 'ORDER' || n.title.toLowerCase().includes('commande') || n.title.toLowerCase().includes('réception') || n.type === 'SUCCESS') {
                                            router.push('/(tabs)/ventes');
                                        } else if (n.title.toLowerCase().includes('solde') || n.title.toLowerCase().includes('wallet')) {
                                            router.push('/(tabs)/wallet');
                                        }
                                    }}
                                >
                                    <View style={[styles.notifIconBox, n.type === 'STOCK' ? {backgroundColor:'rgba(239, 68, 68, 0.15)'} : n.type === 'SUCCESS' ? {backgroundColor:'rgba(16, 185, 129, 0.15)'} : {backgroundColor:'rgba(59, 130, 246, 0.15)'}]}>
                                        <FontAwesome name={n.type === 'STOCK' ? 'warning' : n.type === 'SUCCESS' ? 'check' : 'shopping-cart'} size={16} color={n.type === 'STOCK' ? '#ef4444' : n.type === 'SUCCESS' ? '#10b981' : '#3b82f6'} />
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                                        <Text style={[styles.notifTitle, !isRead && { fontWeight: '800', color: '#fff' }]}>{n.title}</Text>
                                        <Text style={styles.notifMessage}>{n.message}</Text>
                                        <Text style={styles.notifDate}>{new Date(n.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                                    </View>
                                    {!isRead && <View style={styles.unreadDot} />}
                                </TouchableOpacity>
                            );
                        })
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
  loadingContainer: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: T.textMuted,
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  outerContainer: {
    flex: 1,
    backgroundColor: T.bg,
  },
  alertBanner: {
    margin: 20,
    backgroundColor: T.danger,
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: T.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  alertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  alertTextContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  alertTitle: {
    color: T.white,
    fontSize: 16,
    fontWeight: '800',
  },
  alertSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  alertActionBtn: {
    backgroundColor: T.white,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  alertActionText: {
    color: T.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  container: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    backgroundColor: 'transparent',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: T.textMuted,
    marginTop: 4,
  },
  profileBtn: {
    padding: 8,
    backgroundColor: T.sectionBg,
    borderRadius: 50,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  kpiCard: {
    flex: 1,
    padding: 16,
    borderRadius: 24,
  },
  glassCard: {
    backgroundColor: T.sectionBg,
    borderWidth: 1,
    borderColor: T.glassBorder,
  },
  actionCard: {
    backgroundColor: T.sectionBg,
    borderWidth: 1,
    borderColor: T.glassBorder,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiLabel: {
    fontSize: 13,
    color: T.textMuted,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: T.text,
    marginVertical: 4,
  },
  kpiTrend: {
    fontSize: 11,
    fontWeight: '700',
    color: T.success,
  },
  featuredCard: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 25,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  featuredTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: T.text,
  },
  seeMore: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
  },
  statLabel: {
    fontSize: 12,
    color: T.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: T.text,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: T.glassBorder,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.text,
    marginBottom: 15,
  },
  actionScroll: {
    backgroundColor: 'transparent',
  },
  actionBtn: {
    width: 100,
    height: 90,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    color: T.text,
    fontWeight: '600',
    marginTop: 8,
  },

  // Management Grid Styles
  mgmtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginTop: 10,
    backgroundColor: 'transparent',
  },
  mgmtCard: {
    width: '47%',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  mgmtIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  mgmtCardTitle: {
    color: T.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  mgmtCardSub: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: T.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: T.modalBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '92%',
    paddingTop: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
  },
  modalTitle: {
    color: T.text,
    fontSize: 20,
    fontWeight: '900',
  },
  modalBody: {
    padding: 20,
  },
  crudPlaceholder: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.sectionBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  addItemBtnFull: {
    backgroundColor: Colors.primary,
    marginTop: 30,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 18,
    width: '100%',
    alignItems: 'center',
  },

  // ── Analytics (Owner) ──────────────────────────────────────────
  profitBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 18,
    marginTop: 10,
  },
  profitLabel: {
    color: T.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 26,
    fontWeight: '900',
  },
  profitSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  analyticsCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  analyticsHeader: {
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  analyticsTitle: {
    color: T.text,
    fontSize: 16,
    fontWeight: '900',
  },
  topVendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  topVendorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: T.sectionBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  topVendorName: {
    color: T.text,
    fontSize: 18,
    fontWeight: '900',
  },
  topVendorRevenue: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  crownBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
    backgroundColor: 'transparent',
  },
  rankNum: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '800',
    width: 30,
  },
  rankName: {
    color: T.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rankSub: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  rankBadge: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rankBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  notifBtn: {
    position: 'relative',
    padding: 5,
  },
  notifBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: T.danger,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.bg,
  },
  notifBadgeText: {
    color: T.white,
    fontSize: 9,
    fontWeight: '900',
  },
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
    gap: 8,
  },
  markAllReadText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  notifItem: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 16,
    backgroundColor: T.sectionBg,
    marginBottom: 10,
    alignItems: 'center',
  },
  notifIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  notifTitle: {
    color: T.textDim,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  notifMessage: {
    color: T.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  notifDate: {
    color: T.textMuted,
    fontSize: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.danger,
    marginLeft: 10,
  },
  qaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  qaBtn: {
    width: '31%',
    backgroundColor: T.glassCard,
    borderWidth: 1,
    borderColor: T.glassBorder,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
  },
  qaIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaLabel: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
});
}

