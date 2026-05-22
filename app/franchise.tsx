import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Platform, View, Text, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useAlert } from '@/components/AlertContext';

type PosStock = {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  price: number;
  quantity: number;
};

type PosLocation = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  stocks: PosStock[];
};

export default function FranchiseScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posList, setPosList] = useState<PosLocation[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [selectedPos, setSelectedPos] = useState<PosLocation | null>(null);
  
  // Modals visibility
  const [isAddPosModalVisible, setIsAddPosModalVisible] = useState(false);
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [isEditPosModalVisible, setIsEditPosModalVisible] = useState(false);

  // Form States for creating/updating POS
  const [posName, setPosName] = useState('');
  const [posAddress, setPosAddress] = useState('');
  const [posCity, setPosCity] = useState('');
  const [posPhone, setPosPhone] = useState('');

  // Form States for Stock Updates
  const [stockQuantities, setStockQuantities] = useState<Record<string, string>>({}); // productId -> string quantity

  const router = useRouter();
  const { showAlert } = useAlert();

  const fetchData = async () => {
    try {
      // 1. Fetch POS locations with stocks
      const posRes = await ApiService.get('/api/v1/vendor/franchise/pos');
      if (posRes && posRes.success) {
        setPosList(posRes.data || []);
        // Refresh selected POS details if open
        if (selectedPos) {
          const updated = posRes.data.find((p: any) => p.id === selectedPos.id);
          if (updated) setSelectedPos(updated);
        }
      }

      // 2. Fetch Catalog Products to allow inventory updates
      const productsRes = await ApiService.get('/api/v1/vendor/products');
      if (productsRes && productsRes.success) {
        setCatalogProducts(productsRes.data.products || []);
      }
    } catch (error) {
      console.error('Franchise POS fetch error:', error);
      showAlert({ title: 'Erreur', message: 'Impossible de récupérer les dépôts.', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAddPos = async () => {
    if (!posName.trim()) {
      return showAlert({ title: 'Erreur', message: 'Le nom du point de vente est requis.', type: 'error' });
    }

    try {
      const payload = {
        name: posName.trim(),
        address: posAddress.trim() || null,
        city: posCity.trim() || null,
        phone: posPhone.trim() || null,
      };

      const res = await ApiService.post('/api/v1/vendor/franchise/pos', payload);
      if (res && res.success) {
        Vibration.vibrate(15);
        showAlert({ title: 'Succès', message: 'Point de vente créé avec succès.', type: 'success' });
        setIsAddPosModalVisible(false);
        // Reset form
        setPosName('');
        setPosAddress('');
        setPosCity('');
        setPosPhone('');
        fetchData();
      }
    } catch (error) {
      showAlert({ title: 'Erreur', message: 'Impossible de créer le point de vente.', type: 'error' });
    }
  };

  const handleUpdatePosDetails = async () => {
    if (!selectedPos) return;
    if (!posName.trim()) {
      return showAlert({ title: 'Erreur', message: 'Le nom du point de vente est requis.', type: 'error' });
    }

    try {
      const payload = {
        posId: selectedPos.id,
        name: posName.trim(),
        address: posAddress.trim() || null,
        city: posCity.trim() || null,
        phone: posPhone.trim() || null,
      };

      const res = await ApiService.put('/api/v1/vendor/franchise/pos', payload);
      if (res && res.success) {
        Vibration.vibrate(15);
        showAlert({ title: 'Succès', message: 'Coordonnées du dépôt mises à jour.', type: 'success' });
        setIsEditPosModalVisible(false);
        fetchData();
      }
    } catch (error) {
      showAlert({ title: 'Erreur', message: 'Mise à jour impossible.', type: 'error' });
    }
  };

  const openStockModal = (pos: PosLocation) => {
    // Pre-populate existing stock quantities
    const initialQty: Record<string, string> = {};
    catalogProducts.forEach(prod => {
      const existing = pos.stocks.find(s => s.productId === prod.id);
      initialQty[prod.id] = existing ? String(existing.quantity) : '0';
    });
    setStockQuantities(initialQty);
    setIsStockModalVisible(true);
  };

  const handleSaveStockInventory = async () => {
    if (!selectedPos) return;

    try {
      const stockUpdates = Object.entries(stockQuantities).map(([productId, quantityStr]) => ({
        productId,
        quantity: Math.max(0, Number(quantityStr || 0)),
      }));

      const payload = {
        posId: selectedPos.id,
        stockUpdates,
      };

      const res = await ApiService.put('/api/v1/vendor/franchise/pos', payload);
      if (res && res.success) {
        Vibration.vibrate(15);
        showAlert({ title: 'Succès', message: 'Inventaire mis à jour avec succès !', type: 'success' });
        setIsStockModalVisible(false);
        fetchData();
      }
    } catch (error) {
      showAlert({ title: 'Erreur', message: "Échec de l'enregistrement de l'inventaire.", type: 'error' });
    }
  };

  const incrementProductQty = (productId: string) => {
    const current = Number(stockQuantities[productId] || 0);
    setStockQuantities({
      ...stockQuantities,
      [productId]: String(current + 1),
    });
    Vibration.vibrate(5);
  };

  const decrementProductQty = (productId: string) => {
    const current = Number(stockQuantities[productId] || 0);
    setStockQuantities({
      ...stockQuantities,
      [productId]: String(Math.max(0, current - 1)),
    });
    Vibration.vibrate(5);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Chargement de vos franchises...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Points de Vente & Dépôts</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => {
            setPosName('');
            setPosAddress('');
            setPosCity('');
            setPosPhone('');
            setIsAddPosModalVisible(true);
          }}
        >
          <FontAwesome name="plus-circle" size={24} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>{posList.length} Dépôt(s) actif(s)</Text>
          <Text style={styles.summarySub}>Gérez vos points de distribution B2B et stocks d'expédition</Text>
        </View>

        {posList.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome name="building-o" size={48} color="#475569" style={{ marginBottom: 15 }} />
            <Text style={styles.emptyText}>Aucun point de vente ou dépôt créé.</Text>
            <TouchableOpacity style={styles.createFirstBtn} onPress={() => setIsAddPosModalVisible(true)}>
              <Text style={styles.createFirstBtnText}>Créer votre premier dépôt</Text>
            </TouchableOpacity>
          </View>
        )}

        {posList.map((pos) => {
          const isSelected = selectedPos?.id === pos.id;
          return (
            <View key={pos.id} style={[styles.posCard, isSelected && styles.posCardActive]}>
              <TouchableOpacity 
                style={styles.posCardHeader}
                activeOpacity={0.8}
                onPress={() => setSelectedPos(isSelected ? null : pos)}
              >
                <View style={styles.posHeaderInfo}>
                  <View style={[styles.iconContainer, isSelected && styles.iconContainerActive]}>
                    <FontAwesome name="building" size={20} color={isSelected ? "#fff" : "#f59e0b"} />
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={styles.posName}>{pos.name}</Text>
                    <Text style={styles.posLoc}>{pos.city || 'Ville non renseignée'} — {pos.address || 'Sans adresse'}</Text>
                  </View>
                  <FontAwesome name={isSelected ? "chevron-up" : "chevron-down"} size={14} color="#64748b" />
                </View>
              </TouchableOpacity>

              {isSelected && (
                <View style={styles.posDetailsContainer}>
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailLabel}>📞 Téléphone :</Text>
                    <Text style={styles.detailValue}>{pos.phone || 'Non configuré'}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      style={styles.editBtnSmall}
                      onPress={() => {
                        setPosName(pos.name);
                        setPosAddress(pos.address || '');
                        setPosCity(pos.city || '');
                        setPosPhone(pos.phone || '');
                        setIsEditPosModalVisible(true);
                      }}
                    >
                      <FontAwesome name="edit" size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.actionBtnText}>Coordonnées</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.stockBtnSmall}
                      onPress={() => openStockModal(pos)}
                    >
                      <FontAwesome name="dropbox" size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.actionBtnText}>Ajuster le Stock</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Stock List */}
                  <Text style={styles.stockSectionTitle}>INVENTAIRE DU DÉPÔT</Text>
                  {pos.stocks.length === 0 ? (
                    <Text style={styles.noStockText}>Aucun produit en stock actuellement.</Text>
                  ) : (
                    pos.stocks.map((stock) => (
                      <View key={stock.id} style={styles.stockRow}>
                        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                          <Text style={styles.stockName}>{stock.productName}</Text>
                          <Text style={styles.stockPrice}>{stock.price.toFixed(3)} DT / {stock.unit}</Text>
                        </View>
                        <View style={[styles.qtyBadge, stock.quantity < 10 && styles.qtyBadgeWarning]}>
                          <Text style={styles.qtyText}>
                            {stock.quantity} {stock.unit}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* MODAL: ADD POS */}
      <Modal visible={isAddPosModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau Point de Vente / Dépôt</Text>
              <TouchableOpacity onPress={() => setIsAddPosModalVisible(false)}>
                <FontAwesome name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <Text style={styles.inputLabel}>Nom du Dépôt *</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posName} 
                onChangeText={setPosName} 
                placeholder="Ex: Dépôt Nord - Ariana..." 
                placeholderTextColor="#64748b" 
              />

              <Text style={styles.inputLabel}>Ville</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posCity} 
                onChangeText={setPosCity} 
                placeholder="Ex: Ariana, Tunis, Sfax..." 
                placeholderTextColor="#64748b" 
              />

              <Text style={styles.inputLabel}>Adresse Complète</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posAddress} 
                onChangeText={setPosAddress} 
                placeholder="Ex: Rte de la Soukra, Km 4..." 
                placeholderTextColor="#64748b" 
              />

              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posPhone} 
                onChangeText={setPosPhone} 
                keyboardType="phone-pad"
                placeholder="Ex: 71888999..." 
                placeholderTextColor="#64748b" 
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddPos}>
                <Text style={styles.submitBtnText}>Créer le Dépôt</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDIT POS */}
      <Modal visible={isEditPosModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le Dépôt</Text>
              <TouchableOpacity onPress={() => setIsEditPosModalVisible(false)}>
                <FontAwesome name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <Text style={styles.inputLabel}>Nom du Dépôt *</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posName} 
                onChangeText={setPosName} 
                placeholder="Ex: Dépôt Nord - Ariana..." 
                placeholderTextColor="#64748b" 
              />

              <Text style={styles.inputLabel}>Ville</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posCity} 
                onChangeText={setPosCity} 
                placeholder="Ex: Ariana..." 
                placeholderTextColor="#64748b" 
              />

              <Text style={styles.inputLabel}>Adresse Complète</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posAddress} 
                onChangeText={setPosAddress} 
                placeholder="Ex: Rte de la Soukra..." 
                placeholderTextColor="#64748b" 
              />

              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput 
                style={styles.modalInput} 
                value={posPhone} 
                onChangeText={setPosPhone} 
                keyboardType="phone-pad"
                placeholder="Ex: 71888999..." 
                placeholderTextColor="#64748b" 
              />

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#3b82f6' }]} onPress={handleUpdatePosDetails}>
                <Text style={styles.submitBtnText}>Enregistrer les Modifications</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: ADJUST STOCKS */}
      <Modal visible={isStockModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { height: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>Ajuster le Stock</Text>
                <Text style={styles.modalSubTitle}>{selectedPos?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsStockModalVisible(false)}>
                <FontAwesome name="times" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 60 }}>
              <Text style={styles.mgmtSectionTitle}>PRODUITS DU CATALOGUE</Text>
              
              {catalogProducts.length === 0 && (
                <Text style={styles.noStockText}>Aucun produit dans votre catalogue. Créez des produits dans l'onglet Catalogue d'abord.</Text>
              )}

              {catalogProducts.map((prod) => {
                const qtyVal = stockQuantities[prod.id] || '0';
                return (
                  <View key={prod.id} style={styles.inventoryRow}>
                    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                      <Text style={styles.invName}>{prod.name}</Text>
                      <Text style={styles.invPrice}>{Number(prod.price).toFixed(3)} DT — Unité: {prod.unit || 'unité'}</Text>
                    </View>

                    <View style={styles.qtyController}>
                      <TouchableOpacity 
                        style={styles.qtyControlBtn}
                        onPress={() => decrementProductQty(prod.id)}
                      >
                        <FontAwesome name="minus" size={12} color="#fff" />
                      </TouchableOpacity>
                      
                      <TextInput 
                        style={styles.qtyInput}
                        value={qtyVal}
                        keyboardType="numeric"
                        onChangeText={(val) => {
                          // Allow empty string temporarily, fallback to 0 on save
                          setStockQuantities({
                            ...stockQuantities,
                            [prod.id]: val,
                          });
                        }}
                      />

                      <TouchableOpacity 
                        style={styles.qtyControlBtn}
                        onPress={() => incrementProductQty(prod.id)}
                      >
                        <FontAwesome name="plus" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.saveStockBtn} onPress={handleSaveStockInventory}>
                <Text style={styles.saveStockBtnText}>Sauvegarder l'Inventaire</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#0a0f1e', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 15, fontSize: 16, fontWeight: '500' },
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  backBtn: { padding: 5 },
  addBtn: { padding: 5 },
  
  scrollBody: { padding: 20, paddingBottom: 120 },
  summaryBar: { marginBottom: 25 },
  summaryText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  summarySub: { color: '#64748b', fontSize: 12, marginTop: 4, lineHeight: 18 },
  
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyText: { color: '#475569', textAlign: 'center', fontSize: 14, fontStyle: 'italic', marginBottom: 20 },
  createFirstBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14,
  },
  createFirstBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // POS Cards
  posCard: {
    backgroundColor: 'rgba(16,20,35,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24, padding: 18, marginBottom: 15,
  },
  posCardActive: {
    borderColor: 'rgba(245,158,11,0.25)',
    backgroundColor: 'rgba(16,20,35,0.95)',
  },
  posCardHeader: { backgroundColor: 'transparent' },
  posHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'transparent' },
  iconContainer: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: '#f59e0b',
  },
  posName: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  posLoc: { color: '#64748b', fontSize: 11, marginTop: 3 },

  // POS Expanded Details
  posDetailsContainer: {
    marginTop: 18, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
  },
  detailsRow: { flexDirection: 'row', marginBottom: 12, backgroundColor: 'transparent' },
  detailLabel: { color: '#64748b', fontSize: 13, fontWeight: '700', width: 95 },
  detailValue: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', flex: 1 },

  // POS Actions
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20, backgroundColor: 'transparent' },
  editBtnSmall: {
    flex: 1, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  stockBtnSmall: {
    flex: 1, height: 40, borderRadius: 12,
    backgroundColor: '#f59e0b',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Stocks sublist
  stockSectionTitle: { color: '#f59e0b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  noStockText: { color: '#475569', fontSize: 12, fontStyle: 'italic', paddingVertical: 10 },
  stockRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
    backgroundColor: 'transparent',
  },
  stockName: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  stockPrice: { color: '#64748b', fontSize: 10, marginTop: 2 },
  qtyBadge: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  qtyBadgeWarning: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.2)',
  },
  qtyText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Modal Overlays & Sheets
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0a0f1e', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    height: '75%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)'
  },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  modalSubTitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  inputLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 5 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    height: 52, paddingHorizontal: 15, color: '#ffffff', fontSize: 15, marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#f59e0b', height: 55, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 15, marginBottom: 40,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  // Stock inventory Adjuster
  mgmtSectionTitle: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 20 },
  inventoryRow: {
    flexDirection: 'row', alignItems: 'center', padding: 15,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  invName: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  invPrice: { color: '#64748b', fontSize: 11, marginTop: 3 },
  qtyController: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' },
  qtyControlBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  qtyInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff',
    borderRadius: 8, width: 44, height: 32, textAlign: 'center',
    fontSize: 13, fontWeight: '700',
  },
  saveStockBtn: {
    backgroundColor: '#10b981', height: 55, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 25, marginBottom: 40,
  },
  saveStockBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
