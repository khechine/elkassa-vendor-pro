import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Platform, Modal, View, Text, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, ThemeColors } from '@/components/useTheme';

export default function WalletScreen() {
  const T = useTheme();
  const styles = createStyles(T);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositProof, setDepositProof] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async (vid: string) => {
    try {
      const data = await ApiService.get(`/management/vendor/wallet/${vid}`);
      setWallet(data);
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
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
    if (vendorId) {
      setRefreshing(true);
      fetchData(vendorId);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setDepositProof(result.assets[0]);
    }
  };

  const handleDepositSubmit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount))) {
      Alert.alert("Erreur", "Veuillez entrer un montant valide.");
      return;
    }
    if (!depositProof) {
      Alert.alert("Erreur", "Veuillez joindre une preuve de paiement (Reçu, Capture d'écran, etc.)");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload proof
      const formData = new FormData();
      const filename = depositProof.uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('file', {
        uri: depositProof.uri,
        name: filename,
        type,
      } as any);

      const uploadResp = await ApiService.upload('/management/upload', formData);

      // 2. Submit request
      await ApiService.post('/management/vendor/deposit-request', {
        vendorId,
        amount: Number(depositAmount),
        proofImage: uploadResp.url
      });

      Alert.alert("Succès", "Votre demande de dépôt a été transmise. Elle sera validée par l'administration après vérification.");
      setDepositModalOpen(false);
      setDepositAmount('');
      setDepositProof(null);
    } catch (e) {
      console.error(e);
      Alert.alert("Erreur", "Impossible de soumettre la demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.warning} />
      </View>
    );
  }

  const transactions = wallet?.transactions || [];

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <Text style={styles.sectionTitle}>Espace Finance</Text>

      <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.warning} />}>
        <View style={[styles.balanceCard, styles.glassCard]}>
            <Text style={styles.balanceLabel}>Solde Disponible</Text>
            <Text style={styles.balanceValue}>{Number(wallet?.balance || 0).toFixed(3)} DT</Text>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => setDepositModalOpen(true)}>
                <Text style={styles.withdrawBtnText}>Déposer de l'argent</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Transactions Récentes</Text>
        {transactions.map((tx: any, idx: number) => (
          <View key={idx} style={[styles.transactionRow, styles.glassCard]}>
            <View style={[styles.iconBox, { backgroundColor: tx.amount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                <FontAwesome name={tx.amount > 0 ? 'arrow-up' : 'arrow-down'} size={14} color={tx.amount > 0 ? '#10b981' : '#ef4444'} />
            </View>
            <View style={{ flex: 1, backgroundColor: 'transparent', marginLeft: 12 }}>
                <Text style={styles.txTitle}>{tx.description || tx.type}</Text>
                <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString('fr-FR')} — {new Date(tx.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#10b981' : '#ef4444' }]}>
                {tx.amount > 0 ? '+' : ''}{Number(tx.amount).toFixed(3)} DT
            </Text>
          </View>
        ))}
        {transactions.length === 0 && <Text style={styles.emptyText}>Aucune transaction répertoriée.</Text>}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Deposit Modal */}
      <Modal visible={depositModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.glassCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau Dépôt</Text>
              <TouchableOpacity onPress={() => setDepositModalOpen(false)}>
                <FontAwesome name="close" size={24} color={T.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.inputLabel}>Montant à déposer (DT)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.000"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                value={depositAmount}
                onChangeText={setDepositAmount}
              />

              <Text style={styles.inputLabel}>Preuve de paiement</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {depositProof ? (
                  <View style={{ position: 'relative' }}>
                    <FontAwesome name="check-circle" size={48} color="#10b981" />
                    <Text style={{ color: T.white, marginTop: 10, fontSize: 12 }}>Preuve sélectionnée</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <FontAwesome name="camera" size={32} color={T.textMuted} />
                    <Text style={{ color: T.textMuted, marginTop: 10 }}>Sélectionner une image</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <FontAwesome name="info-circle" size={16} color={Colors.warning} />
                <Text style={styles.infoText}>
                  Veuillez effectuer un virement ou un dépôt sur le compte de l'administration et joindre le reçu ici.
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
                onPress={handleDepositSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={T.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Soumettre pour validation</Text>
                )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: T.bg,
    padding: 20,
  },
  sectionTitle: {
    color: T.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  scrollBody: {
    paddingBottom: 100,
  },
  balanceCard: {
    padding: 25,
    borderRadius: 32,
    alignItems: 'center',
    marginBottom: 30,
  },
  glassCard: {
    backgroundColor: T.glassCard,
    borderWidth: 1,
    borderColor: T.glassBorder,
  },
  balanceLabel: {
    color: T.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  balanceValue: {
    color: Colors.warning,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  withdrawBtn: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 20,
  },
  withdrawBtnText: {
    color: T.white,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: T.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 15,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 20,
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: '700',
  },
  txDate: {
    color: T.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: T.textDim,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: T.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    color: T.white,
    fontSize: 20,
    fontWeight: '900',
  },
  inputLabel: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 15,
  },
  textInput: {
    backgroundColor: T.inputBg,
    borderRadius: 16,
    padding: 18,
    color: T.text,
    fontSize: 18,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: T.glassBorder,
  },
  imagePicker: {
    height: 150,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: T.glassBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.sectionBg,
    marginTop: 5,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.glass.orange,
    padding: 15,
    borderRadius: 16,
    marginTop: 25,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: Colors.warning,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  submitBtnText: {
    color: T.white,
    fontSize: 16,
    fontWeight: '900',
  },
});
}

