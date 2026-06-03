import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useT } from '@/constants/translations';
import { useAlert } from '@/components/AlertContext';
import { useTheme } from '@/components/useTheme';

export default function RfqScreen() {
  const T = useTheme();
  const styles = createStyles(T);
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

  // RFQ tabs
  const [activeRfqTab, setActiveRfqTab] = useState<'disponibles' | 'propositions' | 'acceptees'>('disponibles');
  const [myRfqs, setMyRfqs] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [openRes, myRes] = await Promise.all([
        ApiService.get('/management/vendor/rfq'),
        ApiService.get('/management/vendor/rfq?type=my'),
      ]);
      if (openRes?.success) setRfqs(openRes.data || []);
      if (myRes?.success) setMyRfqs(myRes.data || []);
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

  const t = useT();

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleOpenQuoteModal = (rfq: any) => {
    if (rfq.hasSubmittedQuote) {
      return showAlert({ title: t('general.info'), message: t('rfq.alreadySubmitted'), type: 'warning' });
    }
    setSelectedRfq(rfq);
    setQuotePrice(String(rfq.budget ? Number(rfq.budget) * 0.95 : ''));
    setQuoteNotes('');
    setIsModalVisible(true);
  };

  const handleSubmitQuote = async () => {
    if (!quotePrice || Number(quotePrice) <= 0) {
      return showAlert({ title: t('general.error'), message: t('rfq.invalidPrice'), type: 'error' });
    }
    setSubmitting(true);
    try {
      const res = await ApiService.post('/management/vendor/rfq', {
        rfqId: selectedRfq.id,
        price: Number(quotePrice),
        notes: quoteNotes || undefined,
      });
      if (res?.success) {
        setIsModalVisible(false);
        showAlert({ title: t('rfq.proposalSent'), message: t('rfq.proposalSuccess'), type: 'success' });
        fetchData();
      } else {
        showAlert({ title: t('general.error'), message: res?.error || t('rfq.sendFailed'), type: 'error' });
      }
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : t('rfq.sendError');
      showAlert({ title: t('general.error'), message: msg, type: 'error' });
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

  const openRfqs = rfqs.filter(r => !r.hasSubmittedQuote && !isExpired(r.expiresAt));
  const myQuotes = myRfqs.filter(r => r.hasSubmittedQuote);
  const acceptedQuotes = myRfqs.filter(r => r.myQuote?.status === 'ACCEPTED');
  const displayRfqs = activeRfqTab === 'disponibles' ? openRfqs : activeRfqTab === 'acceptees' ? acceptedQuotes : myQuotes;

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={T.primary} /></View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.title}>{t('rfq.title')}</Text>
          <Text style={styles.headerSub}>{openRfqs.length} {t('rfq.openRequests')}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeRfqTab === 'disponibles' && styles.tabActive]}
          onPress={() => setActiveRfqTab('disponibles')}
        >
          <Text style={[styles.tabText, activeRfqTab === 'disponibles' && styles.tabTextActive]}>{t('rfq.available')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeRfqTab === 'propositions' && styles.tabActive]}
          onPress={() => setActiveRfqTab('propositions')}
        >
          <Text style={[styles.tabText, activeRfqTab === 'propositions' && styles.tabTextActive]}>{t('rfq.proposals')} ({myQuotes.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeRfqTab === 'acceptees' && styles.tabActive]}
          onPress={() => setActiveRfqTab('acceptees')}
        >
          <Text style={[styles.tabText, activeRfqTab === 'acceptees' && styles.tabTextActive]}>{t('rfq.accepted')} ({acceptedQuotes.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {displayRfqs.map((rfq) => {
          const expired = activeRfqTab === 'disponibles' && isExpired(rfq.expiresAt);
          const quoteStatus = rfq.myQuote?.status;
          return (
            <TouchableOpacity
              key={rfq.id}
              style={[styles.rfqCard, expired && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={() => handleOpenQuoteModal(rfq)}
            >
              <View style={styles.rfqHeader}>
                <View style={styles.rfqStore}>
                  <FontAwesome name="building" size={14} color={T.textMuted} />
                  <Text style={styles.storeName}>{rfq.store?.name || t('rfq.unknownStore')}</Text>
                </View>
                {quoteStatus === 'ACCEPTED' && (
                  <View style={[styles.badgeSubmitted, { backgroundColor: 'rgba(34,172,56,0.15)', borderColor: 'rgba(34,172,56,0.3)' }]}>
                    <FontAwesome name="check-circle" size={10} color={T.success} />
                    <Text style={[styles.badgeSubmittedText, { color: T.success }]}>{t('rfq.accepted')}</Text>
                  </View>
                )}
                {quoteStatus === 'REJECTED' && (
                  <View style={[styles.badgeSubmitted, { backgroundColor: 'rgba(230,69,69,0.1)', borderColor: 'rgba(230,69,69,0.25)' }]}>
                    <FontAwesome name="times-circle" size={10} color={T.primary} />
                    <Text style={[styles.badgeSubmittedText, { color: T.primary }]}>{t('rfq.rejected')}</Text>
                  </View>
                )}
                {quoteStatus === 'PENDING' && rfq.hasSubmittedQuote && (
                  <View style={[styles.badgeSubmitted, { backgroundColor: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.25)' }]}>
                    <FontAwesome name="clock-o" size={10} color={T.warning} />
                    <Text style={[styles.badgeSubmittedText, { color: T.warning }]}>{t('rfq.pending')}</Text>
                  </View>
                )}
                {!rfq.hasSubmittedQuote && expired && (
                  <View style={[styles.badgeSubmitted, { backgroundColor: 'rgba(100,100,100,0.15)', borderColor: T.textMuted }]}>
                    <Text style={[styles.badgeSubmittedText, { color: T.textMuted }]}>{t('rfq.expired')}</Text>
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
                    <FontAwesome name="tag" size={11} color={T.textMuted} />
                    <Text style={styles.metaText}>{rfq.category}</Text>
                  </View>
                )}
                {rfq.quantity && (
                  <View style={styles.metaItem}>
                    <FontAwesome name="shopping-cart" size={11} color={T.textMuted} />
                    <Text style={styles.metaText}>{t('rfq.qty')}: {rfq.quantity}</Text>
                  </View>
                )}
              </View>

              <View style={styles.rfqFooter}>
                <View style={styles.footerLeft}>
                  {rfq.budget && (
                    <Text style={styles.budgetText}>{t('rfq.budget')}: {Number(rfq.budget).toFixed(3)} DT</Text>
                  )}
                  {rfq.myQuote && (
                    <Text style={styles.myQuoteText}>{t('rfq.myOffer')}: {Number(rfq.myQuote.price).toFixed(3)} DT</Text>
                  )}
                </View>
                <Text style={styles.deadline}>
                  <FontAwesome name="clock-o" size={10} color={T.textMuted} /> {formatDate(rfq.expiresAt || rfq.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {displayRfqs.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome name="file-text" size={50} color="rgba(255,255,255,0.06)" />
            <Text style={styles.emptyText}>
              {activeRfqTab === 'disponibles' ? t('rfq.emptyAvailable') : activeRfqTab === 'acceptees' ? t('rfq.emptyAccepted') : t('rfq.emptyMyProposals')}
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
                <Text style={styles.modalTitle}>{t('rfq.submitQuote')}</Text>
                <Text style={styles.modalSub}>{selectedRfq?.title}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsModalVisible(false)}>
                <FontAwesome name="times" size={18} color={T.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              {selectedRfq?.description && (
                <View style={styles.rfqDetailCard}>
                  <Text style={styles.detailLabel}>{t('catalog.description')}</Text>
                  <Text style={styles.detailText}>{selectedRfq.description}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>{t('rfq.budgetLabel')}</Text>
                  <Text style={styles.detailValue}>{selectedRfq?.budget ? `${Number(selectedRfq.budget).toFixed(3)} DT` : t('rfq.notSpecified')}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>{t('rfq.quantity')}</Text>
                  <Text style={styles.detailValue}>{selectedRfq?.quantity || 'N/A'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>{t('rfq.client')}</Text>
                  <Text style={styles.detailValue}>{selectedRfq?.store?.name || '—'}</Text>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>{t('rfq.proposedPrice')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={quotePrice}
                  onChangeText={setQuotePrice}
                  keyboardType="numeric"
                  placeholder="0.000"
                  placeholderTextColor={T.textDim}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>{t('rfq.notes')}</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={quoteNotes}
                  onChangeText={setQuoteNotes}
                  multiline
                  placeholder={t('rfq.notesPlaceholder')}
                  placeholderTextColor={T.textDim}
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
                <Text style={styles.submitBtnText}>{submitting ? t('rfq.sending') : t('rfq.sendProposal')}</Text>
              </TouchableOpacity>
            </ScrollView>
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
  scrollBody: { paddingBottom: 40 },
  rfqTabRow: { flexDirection: 'row', backgroundColor: T.sectionBg, borderRadius: 12, padding: 3, marginBottom: 16 },
  rfqTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  rfqTabActive: { backgroundColor: T.tabActiveBg },
  rfqTabText: { color: T.textMuted, fontSize: 12, fontWeight: '700' },
  rfqCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.cardBorder, borderRadius: 18, padding: 14, marginBottom: 10 },
  emptyState: { alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' },
  emptyText: { color: T.textMuted, fontSize: 15, marginTop: 16, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: T.modalOverlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: T.modalBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '92%', borderTopWidth: 1, borderColor: T.cardBorder, marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0) },
  modalHeader: { backgroundColor: T.modalHeaderBg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomWidth: 1, borderBottomColor: T.divider },
  modalTitle: { color: T.white, fontSize: 16, fontWeight: '900' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.sectionBg, alignItems: 'center', justifyContent: 'center' },
  inputField: { backgroundColor: T.inputBg, borderRadius: 14, height: 50, paddingHorizontal: 16, color: T.white, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: T.inputBorder },
  saveBtn: { backgroundColor: T.primary, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 16, shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
}
