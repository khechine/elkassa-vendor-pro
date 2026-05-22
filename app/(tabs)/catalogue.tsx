import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Platform, Image, View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlert } from '@/components/AlertContext';

const S = {
  bg: '#080d1a',
  card: 'rgba(18, 24, 45, 0.85)',
  border: 'rgba(255,255,255,0.06)',
  primary: '#e64545',
  warning: '#ff9500',
  success: '#22ac38',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  white: '#ffffff',
};

export default function CatalogueScreen() {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [activeSubTab, setActiveSubTab] = useState<'produits' | 'packs'>('produits');
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState('');

  // Bundles state
  const [bundles, setBundles] = useState<any[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Product modal state
  const [prodModalVisible, setProdModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('0.000');
  const [pDiscount, setPDiscount] = useState('');
  const [pMinQty, setPMinQty] = useState('1');
  const [pStock, setPStock] = useState('IN_STOCK');
  const [pFeatured, setPFeatured] = useState(false);
  const [pFlash, setPFlash] = useState(false);
  const [pImages, setPImages] = useState<string[]>([]);
  const [pNewImgUrl, setPNewImgUrl] = useState('');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Bundle modal state
  const [bundleModalVisible, setBundleModalVisible] = useState(false);
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const [bName, setBName] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [bPrice, setBPrice] = useState('0.000');
  const [bItems, setBItems] = useState<{ vendorProductId: string; quantity: number }[]>([]);
  const [bImages, setBImages] = useState<string[]>([]);
  const [bNewImgUrl, setBNewImgUrl] = useState('');
  const [bFeatured, setBFeatured] = useState(false);
  const [bProductSearch, setBProductSearch] = useState('');
  const [deletingBundleId, setDeletingBundleId] = useState<string | null>(null);

  const fetchProducts = useCallback(async (vid: string) => {
    try {
      const data = await ApiService.get(`/management/marketplace/products?vendorId=${vid}`);
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchBundles = useCallback(async (vid: string) => {
    try {
      const data = await ApiService.get(`/management/vendor/bundles/${vid}`);
      setBundles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch bundles:', error);
    } finally {
      setLoadingBundles(false);
    }
  }, []);

  const fetchAll = useCallback(async (vid: string) => {
    setRefreshing(true);
    await Promise.all([fetchProducts(vid), fetchBundles(vid)]);
    setRefreshing(false);
  }, [fetchProducts, fetchBundles]);

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (session?.vendorId) {
        setVendorId(session.vendorId);
        fetchProducts(session.vendorId);
        fetchBundles(session.vendorId);
      }
    });
  }, [fetchProducts, fetchBundles]);

  // --- Product Handlers ---
  const resetProductForm = () => {
    setEditingProduct(null);
    setPName(''); setPDesc(''); setPPrice('0.000'); setPDiscount('');
    setPMinQty('1'); setPStock('IN_STOCK'); setPFeatured(false); setPFlash(false);
    setPImages([]); setPNewImgUrl('');
  };

  const openProductModal = (item?: any) => {
    if (item) {
      setEditingProduct(item);
      setPName(item.productStandard?.name || item.name || '');
      setPDesc(item.description || '');
      setPPrice(String(item.price || '0.000'));
      setPDiscount(item.discountPrice ? String(item.discountPrice) : '');
      setPMinQty(String(item.minOrderQty || '1'));
      setPStock(item.stockStatus || 'IN_STOCK');
      setPFeatured(item.isFeatured || false);
      setPFlash(item.isFlashSale || false);
      setPImages(item.images || []);
    } else resetProductForm();
    setProdModalVisible(true);
  };

  const saveProduct = async () => {
    if (!pName) return showAlert({ title: 'Erreur', message: 'Le nom est requis.', type: 'error' });
    try {
      const payload: any = {
        name: pName, description: pDesc, price: Number(pPrice), minOrderQty: Number(pMinQty),
        stockStatus: pStock, isFeatured: pFeatured, isFlashSale: pFlash, images: pImages, vendorId,
      };
      if (pDiscount) payload.discountPrice = Number(pDiscount);

      if (editingProduct) {
        await ApiService.put(`/management/marketplace/products/${editingProduct.id}`, payload);
      } else {
        await ApiService.post('/management/marketplace/products', payload);
      }
      setProdModalVisible(false);
      if (vendorId) fetchProducts(vendorId);
      showAlert({ title: 'Succès', message: editingProduct ? 'Produit mis à jour.' : 'Produit créé.', type: 'success' });
    } catch {
      showAlert({ title: 'Erreur', message: 'Sauvegarde impossible.', type: 'error' });
    }
  };

  const deleteProduct = (item: any) => {
    showAlert({
      title: 'Supprimer', message: `Supprimer "${item.productStandard?.name || item.name}" ?`, type: 'warning',
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeletingProductId(item.id);
          try {
            await ApiService.delete(`/management/marketplace/products/${item.id}`);
            if (vendorId) fetchProducts(vendorId);
            showAlert({ title: 'Supprimé', message: 'Produit supprimé.', type: 'success' });
          } catch {
            showAlert({ title: 'Erreur', message: 'Échec de la suppression.', type: 'error' });
          } finally { setDeletingProductId(null); }
        }}
      ]
    });
  };

  // --- Bundle Handlers ---
  const resetBundleForm = () => {
    setEditingBundle(null);
    setBName(''); setBDesc(''); setBPrice('0.000'); setBItems([]);
    setBImages([]); setBNewImgUrl(''); setBFeatured(false); setBProductSearch('');
  };

  const openBundleModal = (bundle?: any) => {
    if (bundle) {
      setEditingBundle(bundle);
      setBName(bundle.name); setBDesc(bundle.description || ''); setBPrice(String(bundle.price));
      setBFeatured(bundle.isFeatured || false);
      setBItems(bundle.items?.map((it: any) => ({ vendorProductId: it.vendorProductId, quantity: Number(it.quantity) })) || []);
      setBImages(bundle.images || []);
    } else resetBundleForm();
    setBundleModalVisible(true);
  };

  const saveBundle = async () => {
    if (!bName) return showAlert({ title: 'Erreur', message: 'Le nom du pack est requis.', type: 'error' });
    if (bItems.length === 0) return showAlert({ title: 'Erreur', message: 'Ajoutez au moins un produit.', type: 'error' });
    try {
      const payload = { name: bName, description: bDesc, price: Number(bPrice), items: bItems, images: bImages, isActive: true, isFeatured: bFeatured };
      if (editingBundle) {
        await ApiService.put(`/management/vendor/bundles/${editingBundle.id}`, payload);
      } else {
        await ApiService.post(`/management/vendor/bundles/${vendorId}`, payload);
      }
      setBundleModalVisible(false);
      if (vendorId) fetchBundles(vendorId);
      showAlert({ title: 'Succès', message: editingBundle ? 'Pack mis à jour.' : 'Pack créé.', type: 'success' });
    } catch {
      showAlert({ title: 'Erreur', message: 'Sauvegarde impossible.', type: 'error' });
    }
  };

  const deleteBundle = (bundle: any) => {
    showAlert({
      title: 'Supprimer', message: `Supprimer "${bundle.name}" ?`, type: 'warning',
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeletingBundleId(bundle.id);
          try {
            await ApiService.delete(`/management/vendor/bundles/${bundle.id}`);
            if (vendorId) fetchBundles(vendorId);
            showAlert({ title: 'Supprimé', message: 'Pack supprimé.', type: 'success' });
          } catch {
            showAlert({ title: 'Erreur', message: 'Échec de la suppression.', type: 'error' });
          } finally { setDeletingBundleId(null); }
        }}
      ]
    });
  };

  const pickImage = async (cb: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return showAlert({ title: 'Accès refusé', message: 'Accès photos requis.', type: 'warning' });
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (!result.canceled) uploadFile(result.assets[0].uri, cb);
  };

  const takePhoto = async (cb: (uri: string) => void) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return showAlert({ title: 'Erreur', message: 'Accès caméra refusé.', type: 'error' });
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled) uploadFile(result.assets[0].uri, cb);
  };

  const uploadFile = async (uri: string, cb: (uri: string) => void) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      } as any);
      const res = await ApiService.upload('/management/upload', formData);
      if (res?.url) cb(res.url);
      else throw new Error('No URL');
    } catch {
      showAlert({ title: 'Erreur', message: 'Échec de l\'upload.', type: 'error' });
    } finally { setUploading(false); }
  };

  const STOCK_OPTIONS = [
    { value: 'IN_STOCK', label: 'En Stock', color: '#22ac38' },
    { value: 'LOW_STOCK', label: 'Stock Faible', color: '#ff9500' },
    { value: 'OUT_OF_STOCK', label: 'Rupture', color: '#e64545' },
  ];

  const filteredProducts = products.filter(p => {
    const name = p.productStandard?.name || p.name || '';
    return name.toLowerCase().includes(productSearch.toLowerCase());
  });

  const getProductName = (pid: string) => {
    const prod = products.find(p => p.id === pid);
    return prod?.productStandard?.name || prod?.name || 'Inconnu';
  };

  const filteredVendorProducts = products.filter(p => !bItems.find(it => it.vendorProductId === p.id) && (p.productStandard?.name || p.name || '').toLowerCase().includes(bProductSearch.toLowerCase()));

  const renderProductItem = (p: any) => (
    <TouchableOpacity key={p.id} style={styles.itemCard} activeOpacity={0.7} onPress={() => openProductModal(p)}>
      {p.images?.length > 0 ? (
        <Image source={{ uri: ApiService.getFileUrl(p.images[0]) || undefined }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="cube" size={22} color={S.textMuted} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{p.productStandard?.name || p.name}</Text>
        <Text style={styles.itemPrice}>{Number(p.price).toFixed(3)} DT</Text>
        <View style={styles.itemTags}>
          {STOCK_OPTIONS.filter(s => s.value === p.stockStatus).map(s => (
            <View key={s.value} style={[styles.tag, { borderColor: s.color }]}>
              <Text style={{ color: s.color, fontSize: 9, fontWeight: '800' }}>{s.label}</Text>
            </View>
          ))}
          {p.isFeatured && <View style={[styles.tag, { borderColor: S.warning }]}><Text style={{ color: S.warning, fontSize: 9, fontWeight: '800' }}>En avant</Text></View>}
          {p.isFlashSale && <View style={[styles.tag, { borderColor: S.primary }]}><Text style={{ color: S.primary, fontSize: 9, fontWeight: '800' }}>Flash</Text></View>}
        </View>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(p)}>
        {deletingProductId === p.id ? <ActivityIndicator size="small" color={S.primary} /> : <FontAwesome name="trash" size={14} color="rgba(230,69,69,0.5)" />}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderBundleItem = (b: any) => (
    <TouchableOpacity key={b.id} style={styles.itemCard} activeOpacity={0.7} onPress={() => openBundleModal(b)}>
      {b.images?.length > 0 ? (
        <Image source={{ uri: ApiService.getFileUrl(b.images[0]) || undefined }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="gift" size={22} color={S.textMuted} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{b.name}</Text>
        <Text style={styles.itemPrice}>{Number(b.price).toFixed(3)} DT</Text>
        <Text style={styles.itemMeta}>{b.items?.length || 0} produit{(b.items?.length || 0) !== 1 ? 's' : ''}</Text>
        {b.isFeatured && <View style={[styles.tag, { borderColor: S.primary, alignSelf: 'flex-start', marginTop: 4 }]}><Text style={{ color: S.primary, fontSize: 9, fontWeight: '800' }}>En avant</Text></View>}
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteBundle(b)}>
        {deletingBundleId === b.id ? <ActivityIndicator size="small" color={S.primary} /> : <FontAwesome name="trash" size={14} color="rgba(230,69,69,0.5)" />}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}>
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.title}>Catalogue</Text>
          <Text style={styles.headerSub}>
            {activeSubTab === 'produits' ? `${filteredProducts.length} produit${filteredProducts.length !== 1 ? 's' : ''}` : `${bundles.length} pack${bundles.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => activeSubTab === 'produits' ? openProductModal() : openBundleModal()}>
          <FontAwesome name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}> {activeSubTab === 'produits' ? 'Produit' : 'Pack'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subTabRow}>
        <TouchableOpacity style={[styles.subTab, activeSubTab === 'produits' && styles.subTabActive]} onPress={() => setActiveSubTab('produits')}>
          <FontAwesome name="cube" size={13} color={activeSubTab === 'produits' ? S.primary : S.textDim} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, activeSubTab === 'produits' && styles.subTabTextActive]}>Produits</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, activeSubTab === 'packs' && styles.subTabActive]} onPress={() => setActiveSubTab('packs')}>
          <FontAwesome name="gift" size={13} color={activeSubTab === 'packs' ? S.primary : S.textDim} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, activeSubTab === 'packs' && styles.subTabTextActive]}>Packs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => vendorId && fetchAll(vendorId)} tintColor={S.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {activeSubTab === 'produits' && (
          <>
            <View style={styles.searchBar}>
              <FontAwesome name="search" size={14} color={S.textDim} />
              <TextInput style={styles.searchInput} value={productSearch} onChangeText={setProductSearch} placeholder="Chercher un produit..." placeholderTextColor={S.textDim} />
              {productSearch ? <TouchableOpacity onPress={() => setProductSearch('')}><FontAwesome name="times-circle" size={16} color={S.textMuted} /></TouchableOpacity> : null}
            </View>
            {loadingProducts ? (
              <ActivityIndicator size="large" color={S.primary} style={{ marginTop: 40 }} />
            ) : (
              filteredProducts.map(renderProductItem)
            )}
            {!loadingProducts && filteredProducts.length === 0 && (
              <View style={styles.emptyState}>
                <FontAwesome name="cube" size={40} color="rgba(255,255,255,0.06)" />
                <Text style={styles.emptyText}>{productSearch ? 'Aucun produit trouvé' : 'Ajoutez votre premier produit'}</Text>
              </View>
            )}
          </>
        )}

        {activeSubTab === 'packs' && (
          <>
            {loadingBundles ? (
              <ActivityIndicator size="large" color={S.primary} style={{ marginTop: 40 }} />
            ) : (
              bundles.map(renderBundleItem)
            )}
            {!loadingBundles && bundles.length === 0 && (
              <View style={styles.emptyState}>
                <FontAwesome name="gift" size={40} color="rgba(255,255,255,0.06)" />
                <Text style={styles.emptyText}>Aucun pack créé</Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Product Modal */}
      <Modal visible={prodModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>{editingProduct ? 'Modifier' : 'Nouveau'} Produit</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setProdModalVisible(false)}><FontAwesome name="times" size={18} color={S.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formSection}>Informations</Text>
              <TextInput style={styles.input} value={pName} onChangeText={setPName} placeholder="Nom du produit *" placeholderTextColor={S.textDim} />
              <TextInput style={[styles.input, { height: 80 }]} value={pDesc} onChangeText={setPDesc} multiline placeholder="Description..." placeholderTextColor={S.textDim} />
              <View style={{ flexDirection: 'row', gap: 12, backgroundColor: 'transparent' }}>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <TextInput style={styles.input} value={pPrice} onChangeText={setPPrice} keyboardType="numeric" placeholder="Prix (DT)" placeholderTextColor={S.textDim} />
                </View>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <TextInput style={styles.input} value={pDiscount} onChangeText={setPDiscount} keyboardType="numeric" placeholder="Prix promo" placeholderTextColor={S.textDim} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, backgroundColor: 'transparent' }}>
                {STOCK_OPTIONS.map(s => (
                  <TouchableOpacity key={s.value} style={[styles.stockChip, pStock === s.value && { borderColor: s.color, backgroundColor: s.color + '18' }]} onPress={() => setPStock(s.value)}>
                    <Text style={[styles.stockChipText, pStock === s.value && { color: s.color }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.formSection, { marginTop: 20 }]}>Photos</Text>
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent', marginBottom: 10 }}>
                <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(34,172,56,0.1)' }]} onPress={() => pickImage((uri) => setPImages([...pImages, uri]))}>
                  <FontAwesome name="photo" size={16} color={S.success} /><Text style={{ color: S.success, fontSize: 12, fontWeight: '700' }}> Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(20,112,204,0.1)' }]} onPress={() => takePhoto((uri) => setPImages([...pImages, uri]))}>
                  <FontAwesome name="camera" size={16} color="#1470cc" /><Text style={{ color: '#1470cc', fontSize: 12, fontWeight: '700' }}> Caméra</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.formSection, { marginTop: 20 }]}>Mise en avant</Text>
              <View style={{ flexDirection: 'row', gap: 12, backgroundColor: 'transparent' }}>
                <TouchableOpacity style={[styles.upsellCard, pFeatured && { borderColor: S.warning }]} onPress={() => setPFeatured(!pFeatured)}>
                  <FontAwesome name="star" size={20} color={pFeatured ? S.warning : S.textMuted} />
                  <Text style={{ color: pFeatured ? S.warning : S.textDim, fontWeight: '700', fontSize: 12 }}>En avant</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.upsellCard, pFlash && { borderColor: S.primary }]} onPress={() => setPFlash(!pFlash)}>
                  <FontAwesome name="bolt" size={20} color={pFlash ? S.primary : S.textMuted} />
                  <Text style={{ color: pFlash ? S.primary : S.textDim, fontWeight: '700', fontSize: 12 }}>Flash</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProduct}>
                <Text style={styles.saveBtnText}>{editingProduct ? 'Mettre à jour' : 'Ajouter le produit'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bundle Modal */}
      <Modal visible={bundleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>{editingBundle ? 'Modifier' : 'Nouveau'} Pack</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setBundleModalVisible(false)}><FontAwesome name="times" size={18} color={S.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formSection}>Informations</Text>
              <TextInput style={styles.input} value={bName} onChangeText={setBName} placeholder="Nom du pack *" placeholderTextColor={S.textDim} />
              <TextInput style={[styles.input, { height: 80 }]} value={bDesc} onChangeText={setBDesc} multiline placeholder="Description..." placeholderTextColor={S.textDim} />
              <TextInput style={styles.input} value={bPrice} onChangeText={setBPrice} keyboardType="numeric" placeholder="Prix de vente (DT)" placeholderTextColor={S.textDim} />
              
              <Text style={styles.formSection}>Produits inclus ({bItems.length})</Text>
              {bItems.map((item, idx) => (
                <View key={idx} style={styles.bundleItemRow}>
                  <Text style={{ flex: 1, color: S.white, fontWeight: '600' }} numberOfLines={1}>{getProductName(item.vendorProductId)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                    <TouchableOpacity onPress={() => setBItems(bItems.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}>
                      <FontAwesome name="minus-circle" size={22} color={S.textDim} />
                    </TouchableOpacity>
                    <Text style={{ color: S.white, fontWeight: '800', minWidth: 20, textAlign: 'center' }}>{item.quantity}</Text>
                    <TouchableOpacity onPress={() => setBItems(bItems.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}>
                      <FontAwesome name="plus-circle" size={22} color={S.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => setBItems(bItems.filter((_, i) => i !== idx))} style={{ marginLeft: 8 }}>
                    <FontAwesome name="trash" size={16} color="rgba(230,69,69,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
              
              <Text style={styles.formSection}>Ajouter un produit</Text>
              <View style={styles.searchBar}>
                <FontAwesome name="search" size={14} color={S.textDim} />
                <TextInput style={styles.searchInput} value={bProductSearch} onChangeText={setBProductSearch} placeholder="Chercher..." placeholderTextColor={S.textDim} />
              </View>
              {filteredVendorProducts.slice(0, 10).map(prod => (
                <TouchableOpacity key={prod.id} style={styles.pickerItem} onPress={() => { setBItems([...bItems, { vendorProductId: prod.id, quantity: 1 }]); setBProductSearch(''); }}>
                  <Text style={{ flex: 1, color: S.textDim }}>{prod.productStandard?.name || prod.name}</Text>
                  <FontAwesome name="plus-circle" size={18} color={S.primary} />
                </TouchableOpacity>
              ))}

              <Text style={[styles.formSection, { marginTop: 24 }]}>Mise en avant</Text>
              <TouchableOpacity style={[styles.upsellCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setBFeatured(!bFeatured)}>
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={{ color: S.white, fontWeight: '700', fontSize: 14 }}>En vedette</Text>
                  <Text style={{ color: S.textMuted, fontSize: 11 }}>Afficher ce pack en premier</Text>
                </View>
                <FontAwesome name={bFeatured ? 'toggle-on' : 'toggle-off'} size={36} color={bFeatured ? S.primary : S.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={saveBundle}>
                <Text style={styles.saveBtnText}>{editingBundle ? 'Mettre à jour' : 'Créer le pack'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: S.bg, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: 'transparent' },
  title: { fontSize: 26, fontWeight: '900', color: S.white },
  headerSub: { color: S.textMuted, fontSize: 13, marginTop: 4, fontWeight: '500' },
  addBtn: { backgroundColor: S.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', shadowColor: S.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  subTabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  subTabActive: { backgroundColor: 'rgba(230,69,69,0.15)' },
  subTabText: { color: S.textDim, fontSize: 13, fontWeight: '600' },
  subTabTextActive: { color: S.primary },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingHorizontal: 14, height: 44, marginBottom: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  searchInput: { flex: 1, color: S.white, fontSize: 14 },
  scrollBody: { paddingBottom: 40 },
  itemCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 10, backgroundColor: S.card, borderWidth: 1, borderColor: S.border },
  itemImage: { width: 56, height: 56, borderRadius: 14 },
  itemInfo: { flex: 1, marginLeft: 12, backgroundColor: 'transparent' },
  itemName: { color: S.white, fontSize: 15, fontWeight: '700' },
  itemPrice: { color: S.primary, fontSize: 14, fontWeight: '800', marginTop: 2 },
  itemMeta: { color: S.textMuted, fontSize: 11, marginTop: 1 },
  itemTags: { flexDirection: 'row', gap: 4, marginTop: 4, backgroundColor: 'transparent', flexWrap: 'wrap' },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  deleteBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(230,69,69,0.08)', marginLeft: 8 },
  emptyState: { alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' },
  emptyText: { color: S.textMuted, fontSize: 15, marginTop: 16, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0b1120', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '92%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0) },
  modalHeader: { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  modalTitle: { color: S.white, fontSize: 18, fontWeight: '900' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  formSection: { color: S.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, height: 50, paddingHorizontal: 16, color: S.white, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  stockChip: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' },
  stockChipText: { color: S.textDim, fontSize: 11, fontWeight: '700' },
  imgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },
  upsellCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 8 },
  saveBtn: { backgroundColor: S.primary, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 24, shadowColor: S.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  bundleItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
});
