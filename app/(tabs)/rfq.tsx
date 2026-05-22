import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Image } from 'react-native';
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

export default function RfqScreen() {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<any>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // My quotes view
  const [showMyQuotes, setShowMyQuotes] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await ApiService.get('/api/v1/vendor/rfq');
      if (data?.success) {
        setRfqs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch RFQs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (session?.vendorId) {
        setVendorId(session.vendorId);
        setUserId(session.user?.id);
        fetchData();
      }
    });
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleOpenQuoteModal = (rfq: any) => {
    if (rfq.hasSubmittedQuote) {
      return showAlert({ title: 'Déjà soumis', message: 'Vous avez déjà envoyé une proposition pour cette demande.', type: 'warning' });
    }
    setSelectedRfq(rfq);
    setQuotePrice(String(rfq.budget ? Number(rfq.budget) * 0.95 : ''));
    setQuoteNotes('');
    setIsModalVisible(true);
  };

  const handleSubmitQuote = async () => {
    if (!quotePrice || Number(quotePrice) <= 0) {
      return showAlert({ title: 'Erreur', message: 'Veuillez entrer un prix valide.', type: 'error' });
    }
    setSubmitting(true);
    try {
      const res = await ApiService.post('/api/v1/vendor/rfq', {
        rfqId: selectedRfq.id,
        price: Number(quotePrice),
        notes: quoteNotes || undefined,
      });
      if (res?.success) {
        setIsModalVisible(false);
        showAlert({ title: 'Proposition envoyée', message: 'Votre devis a été soumis avec succès.', type: 'success' });
        fetchData();
      } else {
        showAlert({ title: 'Erreur', message: res?.error || 'Échec de l\'envoi.', type: 'error' });
      }
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : "Erreur lors de l'envoi";
      showAlert({ title: 'Erreur', message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const myQuotes = rfqs.filter(r => r.hasSubmittedQuote);
  const openRfqs = rfqs.filter(r => !r.hasSubmittedQuote && !isExpired(r.expiresAt));
  const displayRfqs = showMyQuotes ? myQuotes : openRfqs;

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.title}>Demandes de devis</Text>
          <Text style={styles.headerSub}>{openRfqs.length} demande{openRfqs.length !== 1 ? 's' : ''} ouverte{openRfqs.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, !showMyQuotes && styles.tabActive]}
          onPress={() => setShowMyQuotes(false)}
        >
          <Text style={[styles.tabText, !showMyQuotes && styles.tabTextActive]}>Disponibles</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, showMyQuotes && styles.tabActive]}
          onPress={() => setShowMyQuotes(true)}
        >
          <Text style={[styles.tabText, showMyQuotes && styles.tabTextActive]}>Mes propositions ({myQuotes.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {displayRfqs.map((rfq) => {
          const expired = !showMyQuotes && isExpired(rfq.expiresAt);
          return (
            <TouchableOpacity
              key={rfq.id}
              style={[styles.rfqCard, expired && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={() => handleOpenQuoteModal(rfq)}
            >
              <View style={styles.rfqHeader}>
                <View style={styles.rfqStore}>
                  <FontAwesome name="building" size={14} color={C.textMuted} />
                  <Text style={styles.storeName}>{rfq.store?.name || 'Café inconnu'}</Text>
                </View>
                {rfq.hasSubmittedQuote && (
                  <View style={styles.badgeSubmitted}>
                    <FontAwesome name="check" size={10} color={C.success} />
                    <Text style={styles.badgeSubmittedText}>Proposé</Text>
                  </View>
                )}
                {expired && (
                  <View style={[styles.badgeSubmitted, { backgroundColor: 'rgba(100,100,100,0.15)', borderColor: C.textMuted }]}>
                    <Text style={[styles.badgeSubmittedText, { color: C.textMuted }]}>Expiré</Text>
                  </View>
                )}
              </View>

              <Text style={styles.rfqTitle}>{rfq.title}</Text>
              {rfq.description && (
                <Text style={styles.rfqDesc} numberOfLines={2}>{rfq.description}</Text>
              )}

              <View style={styles.rfqMeta}>
                {rfq.category && (
                  <View style={styles.metaItem}>
                    <FontAwesome name="tag" size={11} color={C.textMuted} />
                    <Text style={styles.metaText}>{rfq.category}</Text>
                  </View>
                )}
                {rfq.quantity && (
                  <View style={styles.metaItem}>
                    <FontAwesome name="shopping-cart" size={11} color={C.textMuted} />
                    <Text style={styles.metaText}>Qté: {rfq.quantity}</Text>
                  </View>
                )}
              </View>

              <View style={styles.rfqFooter}>
                <View style={styles.footerLeft}>
                  {rfq.budget && (
                    <Text style={styles.budgetText}>Budget: {Number(rfq.budget).toFixed(3)} DT</Text>
                  )}
                  {rfq.myQuote && (
                    <Text style={styles.myQuoteText}>Mon offre: {Number(rfq.myQuote.price).toFixed(3)} DT</Text>
                  )}
                </View>
                <Text style={styles.deadline}>
                  <FontAwesome name="clock-o" size={10} color={C.textMuted} /> {formatDate(rfq.expiresAt || rfq.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {displayRfqs.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome name="file-text" size={50} color="rgba(255,255,255,0.06)" />
            <Text style={styles.emptyText}>
              {showMyQuotes ? "Vous n'avez pas encore soumis de proposition" : "Aucune demande de devis pour le moment"}
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Quote Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>Soumettre un devis</Text>
                <Text style={styles.modalSub}>{selectedRfq?.title}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsModalVisible(false)}>
                <FontAwesome name="times" size={18} color={C.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              {selectedRfq?.description && (
                <View style={styles.rfqDetailCard}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailText}>{selectedRfq.description}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Budget indiqué</Text>
                  <Text style={styles.detailValue}>{selectedRfq?.budget ? `${Number(selectedRfq.budget).toFixed(3)} DT` : 'Non spécifié'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Quantité</Text>
                  <Text style={styles.detailValue}>{selectedRfq?.quantity || 'N/A'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Client</Text>
                  <Text style={styles.detailValue}>{selectedRfq?.store?.name || '—'}</Text>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Prix proposé (DT) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={quotePrice}
                  onChangeText={setQuotePrice}
                  keyboardType="numeric"
                  placeholder="0.000"
                  placeholderTextColor={C.textDim}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Notes / Délai de livraison</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={quoteNotes}
                  onChangeText={setQuoteNotes}
                  multiline
                  placeholder="Ajoutez des détails sur votre offre..."
                  placeholderTextColor={C.textDim}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmitQuote}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <FontAwesome name="send" size={18} color="#fff" style={{ marginRight: 10 }} />
                )}
                <Text style={styles.submitBtnText}>{submitting ? 'Envoi en cours...' : 'Envoyer la proposition'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: 'transparent' },
  title: { fontSize: 26, fontWeight: '900', color: C.white },
  headerSub: { color: C.textMuted, fontSize: 13, marginTop: 4, fontWeight: '500' },
  tabRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4, marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(230,69,69,0.15)' },
  tabText: { color: C.textDim, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: C.primary },
  scrollBody: { paddingBottom: 40 },
  rfqCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, marginBottom: 12,
  },
  rfqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent', marginBottom: 10 },
  rfqStore: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' },
  storeName: { color: C.textDim, fontSize: 12, fontWeight: '600' },
  badgeSubmitted: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,172,56,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(34,172,56,0.25)',
  },
  badgeSubmittedText: { color: C.success, fontSize: 10, fontWeight: '800' },
  rfqTitle: { color: C.white, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  rfqDesc: { color: C.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  rfqMeta: { flexDirection: 'row', gap: 14, backgroundColor: 'transparent', marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'transparent' },
  metaText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  rfqFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 12, backgroundColor: 'transparent' },
  footerLeft: { backgroundColor: 'transparent' },
  budgetText: { color: C.warning, fontSize: 14, fontWeight: '800' },
  myQuoteText: { color: C.success, fontSize: 12, fontWeight: '700', marginTop: 2 },
  deadline: { color: C.textMuted, fontSize: 11 },
  emptyState: { alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' },
  emptyText: { color: C.textMuted, fontSize: 15, marginTop: 16, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#0b1120', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    height: '85%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0),
  },
  modalHeader: {
    backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: C.white },
  modalSub: { color: C.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  rfqDetailCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 16,
  },
  detailRow: { flexDirection: 'row', gap: 10, backgroundColor: 'transparent', marginBottom: 20 },
  detailItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  detailLabel: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  detailText: { color: C.textDim, fontSize: 13, lineHeight: 18 },
  detailValue: { color: C.white, fontSize: 14, fontWeight: '700' },
  formSection: { marginBottom: 16, backgroundColor: 'transparent' },
  formLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 5 },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, height: 52, paddingHorizontal: 16,
    color: C.white, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  formInputMultiline: { height: 100, paddingTop: 14, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: C.primary, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', marginTop: 20, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
