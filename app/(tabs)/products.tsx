import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Platform, Image, View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams } from 'expo-router';
import { useAlert } from '@/components/AlertContext';
import { useTheme } from '@/components/useTheme';

const C = Colors;

const STOCK_OPTIONS = [
  { value: 'IN_STOCK', label: 'En Stock', color: '#22ac38' },
  { value: 'LOW_STOCK', label: 'Stock Faible', color: '#ff9500' },
  { value: 'OUT_OF_STOCK', label: 'Rupture', color: '#e64545' },
];

export default function ProductsScreen() {
  const T = useTheme();
  const styles = createStyles(T);
  const { tab } = useLocalSearchParams();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'PROMOTIONS'>((tab as any) || 'CATALOG');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // CRUD States
  const [isItemModalVisible, setIsItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  
  // Form States
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('0.000');
  const [formDiscountPrice, setFormDiscountPrice] = useState('');
  const [formMinQty, setFormMinQty] = useState('1');
  const [formStock, setFormStock] = useState('IN_STOCK');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formFlash, setFormFlash] = useState(false);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async (vid: string) => {
    try {
      const data = await ApiService.get(`/management/marketplace/products?vendorId=${vid}`);
      setProducts(data || []);
    } catch (error) {
      console.error("Failed to fetch vendor products:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (session?.user?.vendorId) {
        setVendorId(session.user.vendorId);
        fetchData(session.user.vendorId);
      }
    });
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    if (vendorId) {
      setRefreshing(true);
      fetchData(vendorId);
    }
  }, [vendorId, fetchData]);

  const handleOpenItemModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormName(item.productStandard?.name || item.name || '');
      setFormDescription(item.description || '');
      setFormPrice(String(item.price || '0.000'));
      setFormDiscountPrice(item.discountPrice ? String(item.discountPrice) : '');
      setFormMinQty(String(item.minOrderQty || '1'));
      setFormStock(item.stockStatus || 'IN_STOCK');
      setFormFeatured(item.isFeatured || false);
      setFormFlash(item.isFlashSale || false);
      setFormImages(item.images || []);
      setFormCategory(item.category || '');
    } else {
      setEditingItem(null);
      setFormName('');
      setFormDescription('');
      setFormPrice('0.000');
      setFormDiscountPrice('');
      setFormMinQty('1');
      setFormStock('IN_STOCK');
      setFormFeatured(false);
      setFormFlash(false);
      setFormImages([]);
      setFormCategory('');
    }
    setIsItemModalVisible(true);
  };

  const handleSaveItem = async () => {
    if (!formName) return showAlert({ title: "Erreur", message: "Le nom est requis.", type: 'error' });
    try {
      const payload: Record<string, any> = {
        name: formName,
        description: formDescription,
        price: Number(formPrice),
        minOrderQty: Number(formMinQty),
        stockStatus: formStock,
        isFeatured: formFeatured,
        isFlashSale: formFlash,
        images: formImages,
        vendorId,
      };
      if (formDiscountPrice) payload.discountPrice = Number(formDiscountPrice);
      if (formCategory) payload.category = formCategory;

      let savedProduct;
      if (editingItem) {
        const res = await ApiService.put(`/management/marketplace/products/${editingItem.id}`, payload);
        savedProduct = res && res.data ? res.data : editingItem;
      } else {
        const res = await ApiService.post('/management/marketplace/products', payload);
        savedProduct = res && res.data;
      }

      if (savedProduct && savedProduct.id && formImages.length > 0) {
        try {
          await ApiService.post('/api/v1/vendor/products/upload', {
            productId: savedProduct.id,
            mainImage: formImages[0],
            secondaryImages: formImages.slice(1)
          });
        } catch (uploadErr) {
          console.warn("Failed to sync secondary/main images with upload API:", uploadErr);
        }
      }
      
      setIsItemModalVisible(false);
      onRefresh();
      showAlert({ title: "Succès", message: editingItem ? "Produit mis à jour." : "Produit créé.", type: 'success' });
    } catch (error) {
      showAlert({ title: "Erreur", message: "Sauvegarde impossible.", type: 'error' });
    }
  };

  const handleDeleteItem = (item: any) => {
    showAlert({
      title: "Supprimer",
      message: `Supprimer "${item.productStandard?.name || item.name}" ?`,
      type: 'warning',
      buttons: [
        { text: "Annuler", style: 'cancel' },
        {
          text: "Supprimer",
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await ApiService.delete(`/management/marketplace/products/${item.id}`);
              onRefresh();
              showAlert({ title: "Supprimé", message: "Produit supprimé.", type: 'success' });
            } catch {
              showAlert({ title: "Erreur", message: "Échec de la suppression.", type: 'error' });
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    });
  };

  const addImage = () => {
    if (newImageUrl) {
      setFormImages([...formImages, newImageUrl]);
      setNewImageUrl('');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({ title: "Accès refusé", message: "Nous avons besoin de l'accès à vos photos.", type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadFile(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert({ title: "Erreur", message: "Accès caméra refusé.", type: 'error' });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadFile(result.assets[0].uri);
    }
  };

  const uploadFile = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, filename);
      } else {
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: filename,
          type: type
        } as any);
      }

      const res = await ApiService.upload('/management/upload', formData);
      if (res && res.url) {
        setFormImages([...formImages, res.url]);
      } else {
        throw new Error('No URL returned');
      }
    } catch (error) {
      console.error("Upload error details:", error);
      showAlert({ title: "Erreur", message: "Échec de l'upload. Vérifiez votre connexion.", type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormImages(formImages.filter((_, i) => i !== index));
  };

  const filteredProducts = products.filter(p => {
    const productName = p.productStandard?.name || p.name || '';
    const matchesSearch = productName.toLowerCase().includes(search.toLowerCase());
    if (activeTab === 'PROMOTIONS') return matchesSearch && (p.isFeatured || p.isFlashSale);
    return matchesSearch;
  });

  const renderStockBadge = (status: string) => {
    const opt = STOCK_OPTIONT.find(s => s.value === status);
    if (!opt) return null;
    return (
      <View style={[styles.stockBadge, { borderColor: opt.color }]}>
        <View style={[styles.stockDot, { backgroundColor: opt.color }]} />
        <Text style={[styles.stockText, { color: opt.color }]}>{opt.label}</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.sectionTitle}>Mon Catalogue</Text>
          <Text style={styles.headerSub}>{filteredProducts.length} produit{filteredProducts.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenItemModal()}>
          <FontAwesome name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}> Ajouter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'CATALOG' && styles.activeTab]} onPress={() => setActiveTab('CATALOG')}>
          <FontAwesome name="th-large" size={14} color={activeTab === 'CATALOG' ? C.warning : T.textDim} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'CATALOG' && styles.activeTabText]}>Catalogue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'PROMOTIONS' && styles.activeTab]} onPress={() => setActiveTab('PROMOTIONS')}>
          <FontAwesome name="bolt" size={14} color={activeTab === 'PROMOTIONS' ? C.warning : T.textDim} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'PROMOTIONS' && styles.activeTabText]}>Promotions</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <FontAwesome name="search" size={16} color={T.textDim} style={{ marginRight: 10 }} />
        <TextInput 
          placeholder="Chercher un produit..." 
          placeholderTextColor={T.textDim}
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <FontAwesome name="times-circle" size={18} color={T.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.warning} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredProducts.map((p, idx) => (
          <TouchableOpacity
            key={p.id || idx}
            style={styles.itemCard}
            activeOpacity={0.7}
            onPress={() => handleOpenItemModal(p)}
          >
            {p.images?.length > 0 ? (
              <Image source={{ uri: ApiService.getFileUrl(p.images[0]) || undefined }} style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                <FontAwesome name="cube" size={24} color={T.textMuted} />
              </View>
            )}
            
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{p.productStandard?.name || p.name}</Text>
              
              <View style={styles.itemPriceRow}>
                <Text style={styles.itemPrice}>{Number(p.price).toFixed(3)} DT</Text>
                {p.discountPrice && (
                  <Text style={styles.itemDiscount}>{Number(p.discountPrice).toFixed(3)} DT</Text>
                )}
              </View>
              
              <Text style={styles.itemMeta}>Min: {p.minOrderQty} • {p.images?.length || 0} photo{p.images?.length !== 1 ? 's' : ''}</Text>
              
              <View style={styles.itemTags}>
                {renderStockBadge(p.stockStatus)}
                {p.isFeatured && (
                  <View style={[styles.tag, styles.tagFeatured]}>
                    <FontAwesome name="star" size={9} color={C.warning} style={{ marginRight: 3 }} />
                    <Text style={[styles.tagText, { color: C.warning }]}>En avant</Text>
                  </View>
                )}
                {p.isFlashSale && (
                  <View style={[styles.tag, styles.tagFlash]}>
                    <FontAwesome name="bolt" size={9} color={C.primary} style={{ marginRight: 3 }} />
                    <Text style={[styles.tagText, { color: C.primary }]}>Flash</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteItem(p)}
              >
                {deletingId === p.id ? (
                  <ActivityIndicator size="small" color={C.primary} />
                ) : (
                  <FontAwesome name="trash" size={16} color="rgba(239,68,68,0.5)" />
                )}
              </TouchableOpacity>
              <FontAwesome name="chevron-right" size={14} color={T.textMuted} style={{ marginTop: 8 }} />
            </View>
          </TouchableOpacity>
        ))}

        {filteredProducts.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FontAwesome name={activeTab === 'PROMOTIONS' ? 'bolt' : 'cube'} size={40} color={T.cardBorder} />
            </View>
            <Text style={styles.emptyText}>
              {activeTab === 'PROMOTIONS'
                ? 'Aucune promotion pour le moment'
                : search
                  ? 'Aucun produit trouvé'
                  : 'Commencez par ajouter un produit'}
            </Text>
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Product Form Modal */}
      <Modal visible={isItemModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>{editingItem ? 'Modifier' : 'Nouveau'} Produit</Text>
                <Text style={styles.modalSub}>{editingItem ? 'Modifiez les détails du produit' : 'Remplissez les informations'}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsItemModalVisible(false)}>
                <FontAwesome name="times" size={18} color={T.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Section: Informations de base */}
              <Text style={styles.formSectionTitle}>Informations générales</Text>

              <Text style={styles.inputLabel}>Nom du produit *</Text>
              <TextInput
                style={styles.modalInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="Ex: Café Latte Bio"
                placeholderTextColor={T.textDim}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Description du produit..."
                placeholderTextColor={T.textDim}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Catégorie</Text>
              <TextInput
                style={styles.modalInput}
                value={formCategory}
                onChangeText={setFormCategory}
                placeholder="Ex: Boissons, Pâtisseries..."
                placeholderTextColor={T.textDim}
              />

              {/* Section: Prix et Quantité */}
              <Text style={styles.formSectionTitle}>Prix et commande</Text>

              <View style={styles.formRow}>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <Text style={styles.inputLabel}>Prix de vente (DT)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    keyboardType="numeric"
                    placeholder="0.000"
                    placeholderTextColor={T.textDim}
                  />
                </View>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <Text style={styles.inputLabel}>Prix promo (DT)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formDiscountPrice}
                    onChangeText={setFormDiscountPrice}
                    keyboardType="numeric"
                    placeholder="Optionnel"
                    placeholderTextColor={T.textDim}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <Text style={styles.inputLabel}>Quantité min.</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formMinQty}
                    onChangeText={setFormMinQty}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={T.textDim}
                  />
                </View>
              </View>

              {/* Section: Stock */}
              <Text style={styles.formSectionTitle}>Gestion du stock</Text>

              <View style={styles.stockGrid}>
                {STOCK_OPTIONT.map(s => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.stockCard, formStock === s.value && { borderColor: s.color, backgroundColor: s.color + '18' }]}
                    onPress={() => setFormStock(s.value)}
                  >
                    <View style={[styles.stockRadio, formStock === s.value && { backgroundColor: s.color, borderColor: s.color }]}>
                      {formStock === s.value && <FontAwesome name="check" size={10} color="#fff" />}
                    </View>
                    <Text style={[styles.stockLabel, formStock === s.value && { color: s.color }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Section: Images */}
              <Text style={styles.formSectionTitle}>Photos</Text>

              <View style={styles.imageActions}>
                <TouchableOpacity style={[styles.imageActionBtn, { backgroundColor: C.glass.green }]} onPress={pickImage}>
                  <FontAwesome name="photo" size={18} color={C.success} />
                  <Text style={[styles.imageActionText, { color: C.success }]}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imageActionBtn, { backgroundColor: C.glass.blue }]} onPress={takePhoto}>
                  <FontAwesome name="camera" size={18} color={C.info} />
                  <Text style={[styles.imageActionText, { color: C.info }]}>Caméra</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.imageUrlRow}>
                <TextInput
                  style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                  value={newImageUrl}
                  onChangeText={setNewImageUrl}
                  placeholder="Ou collez une URL d'image..."
                  placeholderTextColor={T.textDim}
                />
                <TouchableOpacity style={styles.imageUrlAddBtn} onPress={addImage}>
                  <FontAwesome name="plus" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {uploading && (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color={C.warning} />
                  <Text style={{ color: C.warning, fontSize: 13 }}>Chargement de l'image...</Text>
                </View>
              )}

              {formImages.length > 0 && (
                <ScrollView horizontal style={styles.imagePreviewRow} showsHorizontalScrollIndicator={false}>
                  {formImages.map((img, idx) => (
                    <View key={idx} style={styles.imagePreviewWrapper}>
                      <Image source={{ uri: ApiService.getFileUrl(img) || undefined }} style={styles.imagePreview} />
                      <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(idx)}>
                        <FontAwesome name="times-circle" size={22} color={C.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Section: Upselling / Mise en avant */}
              <Text style={styles.formSectionTitle}>Mise en avant & promotions</Text>

              <View style={styles.upsellGrid}>
                <TouchableOpacity
                  style={[styles.upsellCard, formFeatured && { borderColor: C.warning, backgroundColor: T.glassAmber }]}
                  onPress={() => setFormFeatured(!formFeatured)}
                >
                  <FontAwesome name="star" size={24} color={formFeatured ? C.warning : T.textMuted} />
                  <Text style={[styles.upsellLabel, formFeatured && { color: C.warning }]}>En avant</Text>
                  <Text style={styles.upsellDesc}>Met ce produit en vedette</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.upsellCard, formFlash && { borderColor: C.primary, backgroundColor: T.glassRed }]}
                  onPress={() => setFormFlash(!formFlash)}
                >
                  <FontAwesome name="bolt" size={24} color={formFlash ? C.primary : T.textMuted} />
                  <Text style={[styles.upsellLabel, formFlash && { color: C.primary }]}>Flash Sale</Text>
                  <Text style={styles.upsellDesc}>Active le mode flash</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveItem}>
                <FontAwesome name="check" size={18} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.saveBtnText}>
                  {editingItem ? 'Mettre à jour' : 'Publier le produit'}
                </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    color: T.white,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: T.textMuted,
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  addBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addBtnText: {
    color: T.white,
    fontWeight: '800',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: T.sectionBg,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: T.tabActiveBg,
  },
  tabText: {
    color: T.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: C.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.inputBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  searchInput: {
    flex: 1,
    color: T.white,
    fontSize: 15,
  },
  scrollBody: {
    paddingBottom: 40,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 16,
  },
  itemImagePlaceholder: {
    backgroundColor: T.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
    backgroundColor: 'transparent',
  },
  itemName: {
    color: T.white,
    fontSize: 16,
    fontWeight: '700',
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
  itemPrice: {
    color: C.warning,
    fontSize: 15,
    fontWeight: '800',
  },
  itemDiscount: {
    color: C.danger,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  itemMeta: {
    color: T.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  itemTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    backgroundColor: 'transparent',
    flexWrap: 'wrap',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagFeatured: {
    backgroundColor: T.glassOrange,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  tagFlash: {
    backgroundColor: T.glassRed,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemActions: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: 'transparent',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: T.glassRed,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    backgroundColor: 'transparent',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.sectionBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: T.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: T.modalOverlay,
  },
  modalSheet: {
    backgroundColor: T.modalBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '94%',
    paddingBottom: 20,
    marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0),
    borderTopWidth: 1,
    borderColor: T.cardBorder,
  },
  modalHeader: {
    backgroundColor: T.modalHeaderBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
  },
  modalTitle: {
    color: T.white,
    fontSize: 20,
    fontWeight: '900',
  },
  modalSub: {
    color: T.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSectionTitle: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 14,
  },
  inputLabel: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 5,
  },
  modalInput: {
    backgroundColor: T.inputBg,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    color: T.white,
    fontSize: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  modalInputMultiline: {
    height: 80,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  // Stock
  stockGrid: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  stockCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.sectionBg,
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  stockRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: T.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockLabel: {
    color: T.textDim,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  // Images
  imageActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  imageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
  },
  imageActionText: {
    fontWeight: '700',
    fontSize: 13,
  },
  imageUrlRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  imageUrlAddBtn: {
    backgroundColor: C.primary,
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingRow: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  imagePreviewRow: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 14,
    backgroundColor: 'transparent',
  },
  imagePreview: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'transparent',
  },
  // Upselling
  upsellGrid: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  upsellCard: {
    flex: 1,
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    backgroundColor: T.sectionBg,
    borderWidth: 1,
    borderColor: T.inputBorder,
    gap: 8,
  },
  upsellLabel: {
    color: T.textDim,
    fontSize: 14,
    fontWeight: '800',
  },
  upsellDesc: {
    color: T.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: C.primary,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 40,
    flexDirection: 'row',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: {
    color: T.white,
    fontSize: 16,
    fontWeight: '900',
  },
});
}
