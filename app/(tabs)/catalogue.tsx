import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Platform, Image, View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlert } from '@/components/AlertContext';
import { useTheme } from '@/components/useTheme';
import { useT } from '@/constants/translations';

export default function CatalogueScreen() {
  const T = useTheme();
  const styles = createStyles(T);
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [activeSubTab, setActiveSubTab] = useState<'produits' | 'packs'>('produits');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const t = useT();

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

  // Upsell state
  const [pUpsells, setPUpsells] = useState<any[]>([]);
  const [loadingUpsells, setLoadingUpsells] = useState(false);
  const [showUpsellForm, setShowUpsellForm] = useState(false);
  const [upsellTargetSearch, setUpsellTargetSearch] = useState('');
  const [upsellTargetId, setUpsellTargetId] = useState<string | null>(null);
  const [upsellQty, setUpsellQty] = useState('1');
  const [upsellDiscount, setUpsellDiscount] = useState('');
  const [upsellText, setUpsellText] = useState('');
  const [deletingUpsellId, setDeletingUpsellId] = useState<string | null>(null);

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

  const fetchUpsells = useCallback(async (productId: string) => {
    setLoadingUpsells(true);
    try {
      const data = await ApiService.get(`/management/marketplace/products/${productId}/upsells`);
      setPUpsells(data || []);
    } catch (error) {
      console.error('Failed to fetch upsells:', error);
      setPUpsells([]);
    } finally {
      setLoadingUpsells(false);
    }
  }, []);

  const addUpsell = async () => {
    if (!upsellTargetId || !editingProduct) return;
    try {
      await ApiService.post('/management/vendor/upsells', {
        sourceProductId: editingProduct.id,
        targetProductId: upsellTargetId,
        quantity: upsellQty ? Number(upsellQty) : undefined,
        discountPercent: upsellDiscount ? Number(upsellDiscount) : undefined,
        text: upsellText || undefined,
      });
      setShowUpsellForm(false);
      setUpsellTargetId(null);
      setUpsellQty('1');
      setUpsellDiscount('');
      setUpsellText('');
      setUpsellTargetSearch('');
      await fetchUpsells(editingProduct.id);
      showAlert({ title: t('general.success'), message: t('catalog.upsellAdded'), type: 'success' });
    } catch {
      showAlert({ title: t('general.error'), message: t('catalog.upsellError'), type: 'error' });
    }
  };

  const deleteUpsell = async (upsellId: string) => {
    setDeletingUpsellId(upsellId);
    try {
      await ApiService.delete(`/management/vendor/upsells/${upsellId}`);
      if (editingProduct) await fetchUpsells(editingProduct.id);
      showAlert({ title: t('general.success'), message: t('catalog.upsellDeleted'), type: 'success' });
    } catch {
      showAlert({ title: t('general.error'), message: t('catalog.deleteError'), type: 'error' });
    } finally {
      setDeletingUpsellId(null);
    }
  };

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
      setPImages(item.images?.length > 0 ? item.images : (item.image ? [item.image] : []));
      fetchUpsells(item.id);
    } else {
      resetProductForm();
      setPUpsells([]);
    }
    setShowUpsellForm(false);
    setUpsellTargetId(null);
    setUpsellTargetSearch('');
    setProdModalVisible(true);
  };

  const saveProduct = async () => {
    if (!pName) return showAlert({ title: t('general.error'), message: t('catalog.nameRequired'), type: 'error' });
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
      showAlert({ title: t('general.success'), message: editingProduct ? t('catalog.productUpdated') : t('catalog.productCreated'), type: 'success' });
    } catch {
      showAlert({ title: t('general.error'), message: t('catalog.saveError'), type: 'error' });
    }
  };

  const deleteProduct = (item: any) => {
    showAlert({
      title: t('catalog.delete'), message: `${t('catalog.delete')} "${item.productStandard?.name || item.name}" ?`, type: 'warning',
      buttons: [
        { text: t('catalog.cancel'), style: 'cancel' },
        { text: t('catalog.delete'), style: 'destructive', onPress: async () => {
          setDeletingProductId(item.id);
          try {
            await ApiService.delete(`/management/marketplace/products/${item.id}`);
            if (vendorId) fetchProducts(vendorId);
            showAlert({ title: t('general.success'), message: t('catalog.productDeleted'), type: 'success' });
          } catch {
            showAlert({ title: t('general.error'), message: t('catalog.deleteError'), type: 'error' });
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
      setBImages(bundle.images?.length > 0 ? bundle.images : (bundle.image ? [bundle.image] : []));
    } else resetBundleForm();
    setBundleModalVisible(true);
  };

  const saveBundle = async () => {
    if (!bName) return showAlert({ title: t('general.error'), message: t('catalog.bundleNameRequired'), type: 'error' });
    if (bItems.length === 0) return showAlert({ title: t('general.error'), message: t('catalog.addProductRequired'), type: 'error' });
    try {
      const payload = { name: bName, description: bDesc, price: Number(bPrice), items: bItems, images: bImages, isActive: true, isFeatured: bFeatured };
      if (editingBundle) {
        await ApiService.put(`/management/vendor/bundles/${editingBundle.id}`, payload);
      } else {
        await ApiService.post(`/management/vendor/bundles/${vendorId}`, payload);
      }
      setBundleModalVisible(false);
      if (vendorId) fetchBundles(vendorId);
      showAlert({ title: t('general.success'), message: editingBundle ? t('catalog.bundleUpdated') : t('catalog.bundleCreated'), type: 'success' });
    } catch {
      showAlert({ title: t('general.error'), message: t('catalog.saveError'), type: 'error' });
    }
  };

  const deleteBundle = (bundle: any) => {
    showAlert({
      title: t('catalog.delete'), message: `${t('catalog.delete')} "${bundle.name}" ?`, type: 'warning',
      buttons: [
        { text: t('catalog.cancel'), style: 'cancel' },
        { text: t('catalog.delete'), style: 'destructive', onPress: async () => {
          setDeletingBundleId(bundle.id);
          try {
            await ApiService.delete(`/management/vendor/bundles/${bundle.id}`);
            if (vendorId) fetchBundles(vendorId);
            showAlert({ title: t('general.success'), message: t('catalog.bundleDeleted'), type: 'success' });
          } catch {
            showAlert({ title: t('general.error'), message: t('catalog.deleteError'), type: 'error' });
          } finally { setDeletingBundleId(null); }
        }}
      ]
    });
  };

  const pickImage = async (cb: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return showAlert({ title: t('general.accessDenied'), message: t('catalog.photosRequired'), type: 'warning' });
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (!result.canceled) uploadFile(result.assets[0].uri, cb);
  };

  const takePhoto = async (cb: (uri: string) => void) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return showAlert({ title: t('general.error'), message: t('catalog.cameraDenied'), type: 'error' });
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
      const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', new File([blob], filename, { type: mime }));
      } else {
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: filename,
          type: mime,
        } as any);
      }
      const res = await ApiService.upload('/management/upload', formData);
      if (res?.url) cb(res.url);
      else throw new Error('No URL');
    } catch {
      showAlert({ title: t('general.error'), message: t('catalog.uploadError'), type: 'error' });
    } finally { setUploading(false); }
  };

  const STOCK_OPTIONS = [
    { value: 'IN_STOCK', label: t('catalog.inStock'), color: '#22ac38' },
    { value: 'LOW_STOCK', label: t('catalog.lowStock'), color: '#ff9500' },
    { value: 'OUT_OF_STOCK', label: t('catalog.outOfStock'), color: '#e64545' },
  ];

  const filteredProducts = products.filter(p => {
    const name = p.productStandard?.name || p.name || '';
    return name.toLowerCase().includes(productSearch.toLowerCase());
  });

  const getProductName = (pid: string) => {
    const prod = products.find(p => p.id === pid);
    return prod?.productStandard?.name || prod?.name || t('catalog.unknown');
  };

  const filteredVendorProducts = products.filter(p => !bItems.find(it => it.vendorProductId === p.id) && (p.productStandard?.name || p.name || '').toLowerCase().includes(bProductSearch.toLowerCase()));

  const renderProductItem = (p: any) => {
    const imgUri = p.images?.length > 0 ? p.images[0] : p.image || null;
    return (
    <TouchableOpacity key={p.id} style={styles.itemCard} activeOpacity={0.7} onPress={() => openProductModal(p)}>
      {imgUri ? (
        <Image source={{ uri: ApiService.getFileUrl(imgUri) || undefined }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="cube" size={22} color={T.textMuted} />
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
          {p.isFeatured && <View style={[styles.tag, { borderColor: T.warning }]}><Text style={{ color: T.warning, fontSize: 9, fontWeight: '800' }}>{t('catalog.featured')}</Text></View>}
          {p.isFlashSale && <View style={[styles.tag, { borderColor: T.primary }]}><Text style={{ color: T.primary, fontSize: 9, fontWeight: '800' }}>{t('catalog.flash')}</Text></View>}
        </View>

      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(p)}>
        {deletingProductId === p.id ? <ActivityIndicator size="small" color={T.primary} /> : <FontAwesome name="trash" size={14} color="rgba(230,69,69,0.5)" />}
      </TouchableOpacity>
    </TouchableOpacity>
  );
  };

  const renderUpsellItem = (u: any) => (
    <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,172,56,0.06)', padding: 10, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(34,172,56,0.12)' }}>
      <FontAwesome name="arrow-up" size={12} color={T.success} style={{ marginRight: 8 }} />
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <Text style={{ color: T.white, fontWeight: '700', fontSize: 12 }}>{u.targetProduct?.name || getProductName(u.targetProductId)}</Text>
        <Text style={{ color: T.textMuted, fontSize: 10 }}>
          {t('catalog.qty')}: {u.quantity || 1}{u.discountPercent ? ` | -${u.discountPercent}%` : ''}{u.text ? ` | "${u.text}"` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={() => deleteUpsell(u.id)} style={{ padding: 4 }}>
        {deletingUpsellId === u.id ? <ActivityIndicator size="small" color={T.primary} /> : <FontAwesome name="trash" size={14} color="rgba(230,69,69,0.5)" />}
      </TouchableOpacity>
    </View>
  );

  const renderBundleItem = (b: any) => {
    const imgUri = b.images?.length > 0 ? b.images[0] : b.image || null;
    return (
    <TouchableOpacity key={b.id} style={styles.itemCard} activeOpacity={0.7} onPress={() => openBundleModal(b)}>
      {imgUri ? (
        <Image source={{ uri: ApiService.getFileUrl(imgUri) || undefined }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="gift" size={22} color={T.textMuted} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{b.name}</Text>
        <Text style={styles.itemPrice}>{Number(b.price).toFixed(3)} DT</Text>
        <Text style={styles.itemMeta}>{b.items?.length || 0} {b.items?.length !== 1 ? t('catalog.products').toLowerCase() : t('catalog.product_singular')}</Text>
        {b.isFeatured && <View style={[styles.tag, { borderColor: T.primary, alignSelf: 'flex-start', marginTop: 4 }]}><Text style={{ color: T.primary, fontSize: 9, fontWeight: '800' }}>{t('catalog.featured')}</Text></View>}
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteBundle(b)}>
        {deletingBundleId === b.id ? <ActivityIndicator size="small" color={T.primary} /> : <FontAwesome name="trash" size={14} color="rgba(230,69,69,0.5)" />}
      </TouchableOpacity>
    </TouchableOpacity>
  );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.title}>{t('tabs.catalogue')}</Text>
          <Text style={styles.headerSub}>
            {activeSubTab === 'produits' ? `${filteredProducts.length} ${filteredProducts.length !== 1 ? t('catalog.products').toLowerCase() : t('catalog.product_singular')}` : `${bundles.length} ${bundles.length !== 1 ? t('catalog.bundles').toLowerCase() : t('catalog.bundle_singular')}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => activeSubTab === 'produits' ? openProductModal() : openBundleModal()}>
          <FontAwesome name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}> {activeSubTab === 'produits' ? t('catalog.product_singular') : t('catalog.bundle_singular')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.subTabRow}>
        <TouchableOpacity style={[styles.subTab, activeSubTab === 'produits' && styles.subTabActive]} onPress={() => setActiveSubTab('produits')}>
          <FontAwesome name="cube" size={13} color={activeSubTab === 'produits' ? T.primary : T.textDim} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, activeSubTab === 'produits' && styles.subTabTextActive]}>{t('catalog.products')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, activeSubTab === 'packs' && styles.subTabActive]} onPress={() => setActiveSubTab('packs')}>
          <FontAwesome name="gift" size={13} color={activeSubTab === 'packs' ? T.primary : T.textDim} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, activeSubTab === 'packs' && styles.subTabTextActive]}>{t('catalog.bundles')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => vendorId && fetchAll(vendorId)} tintColor={T.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {activeSubTab === 'produits' && (
          <>
            <View style={styles.searchBar}>
              <FontAwesome name="search" size={14} color={T.textDim} />
              <TextInput style={styles.searchInput} value={productSearch} onChangeText={setProductSearch} placeholder={t('catalog.search')} placeholderTextColor={T.textDim} />
              {productSearch ? <TouchableOpacity onPress={() => setProductSearch('')}><FontAwesome name="times-circle" size={16} color={T.textMuted} /></TouchableOpacity> : null}
            </View>
            {loadingProducts ? (
              <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />
            ) : (
              filteredProducts.map(renderProductItem)
            )}
            {!loadingProducts && filteredProducts.length === 0 && (
              <View style={styles.emptyState}>
                <FontAwesome name="cube" size={40} color="rgba(255,255,255,0.06)" />
                <Text style={styles.emptyText}>{productSearch ? t('catalog.noProducts') : t('catalog.addFirstProduct')}</Text>
              </View>
            )}
          </>
        )}

        {activeSubTab === 'packs' && (
          <>
            {loadingBundles ? (
              <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />
            ) : (
              bundles.map(renderBundleItem)
            )}
            {!loadingBundles && bundles.length === 0 && (
              <View style={styles.emptyState}>
                <FontAwesome name="gift" size={40} color="rgba(255,255,255,0.06)" />
                <Text style={styles.emptyText}>{t('catalog.noBundles')}</Text>
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
                <Text style={styles.modalTitle}>{editingProduct ? t('catalog.edit') : t('catalog.newProduct')} {t('catalog.product_singular')}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setProdModalVisible(false)}><FontAwesome name="times" size={18} color={T.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formSection}>{t('catalog.productInfo')}</Text>
              <TextInput style={styles.input} value={pName} onChangeText={setPName} placeholder={t('catalog.productName') + ' *'} placeholderTextColor={T.textDim} />
              <TextInput style={[styles.input, { height: 80 }]} value={pDesc} onChangeText={setPDesc} multiline placeholder={t('catalog.description') + '...'} placeholderTextColor={T.textDim} />
              <View style={{ flexDirection: 'row', gap: 12, backgroundColor: 'transparent' }}>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <TextInput style={styles.input} value={pPrice} onChangeText={setPPrice} keyboardType="numeric" placeholder={t('catalog.price')} placeholderTextColor={T.textDim} />
                </View>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <TextInput style={styles.input} value={pDiscount} onChangeText={setPDiscount} keyboardType="numeric" placeholder={t('catalog.promoPrice')} placeholderTextColor={T.textDim} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, backgroundColor: 'transparent' }}>
                {STOCK_OPTIONS.map(s => (
                  <TouchableOpacity key={s.value} style={[styles.stockChip, pStock === s.value && { borderColor: s.color, backgroundColor: s.color + '18' }]} onPress={() => setPStock(s.value)}>
                    <Text style={[styles.stockChipText, pStock === s.value && { color: s.color }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.formSection, { marginTop: 20 }]}>{t('catalog.photos')}</Text>
              {pImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8, backgroundColor: 'transparent' }}>
                    {pImages.map((img, idx) => (
                      <View key={idx} style={{ position: 'relative' }}>
                        <Image source={{ uri: ApiService.getFileUrl(img) || undefined }} style={{ width: 72, height: 72, borderRadius: 12 }} />
                        <TouchableOpacity
                          style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(230,69,69,0.9)', alignItems: 'center', justifyContent: 'center' }}
                          onPress={() => setPImages(pImages.filter((_, i) => i !== idx))}
                        >
                          <FontAwesome name="times" size={11} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent', marginBottom: 10 }}>
                <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(34,172,56,0.1)' }]} onPress={() => pickImage((uri) => setPImages([...pImages, uri]))}>
                  <FontAwesome name="photo" size={16} color={T.success} /><Text style={{ color: T.success, fontSize: 12, fontWeight: '700' }}> {t('catalog.gallery')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(20,112,204,0.1)' }]} onPress={() => takePhoto((uri) => setPImages([...pImages, uri]))}>
                  <FontAwesome name="camera" size={16} color="#1470cc" /><Text style={{ color: '#1470cc', fontSize: 12, fontWeight: '700' }}> {t('catalog.camera')}</Text>
                </TouchableOpacity>
                {pImages.length > 0 && (
                  <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(230,69,69,0.1)' }]} onPress={() => setPImages([])}>
                    <FontAwesome name="trash" size={16} color={T.primary} /><Text style={{ color: T.primary, fontSize: 12, fontWeight: '700' }}> {t('catalog.clearAll')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.formSection, { marginTop: 20 }]}>{t('catalog.marketing')}</Text>
              <View style={{ flexDirection: 'row', gap: 12, backgroundColor: 'transparent' }}>
                <TouchableOpacity style={[styles.upsellCard, pFeatured && { borderColor: T.warning }]} onPress={() => setPFeatured(!pFeatured)}>
                  <FontAwesome name="star" size={20} color={pFeatured ? T.warning : T.textMuted} />
                  <Text style={{ color: pFeatured ? T.warning : T.textDim, fontWeight: '700', fontSize: 12 }}>{t('catalog.featured')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.upsellCard, pFlash && { borderColor: T.primary }]} onPress={() => setPFlash(!pFlash)}>
                  <FontAwesome name="bolt" size={20} color={pFlash ? T.primary : T.textMuted} />
                  <Text style={{ color: pFlash ? T.primary : T.textDim, fontWeight: '700', fontSize: 12 }}>{t('catalog.flash')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.formSection, { marginTop: 20 }]}>{t('catalog.upsells')}</Text>
              {loadingUpsells ? (
                <ActivityIndicator size="small" color={T.primary} />
              ) : (
                pUpsells.map(renderUpsellItem)
              )}
              {!showUpsellForm ? (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 14, backgroundColor: 'rgba(230,69,69,0.08)', marginTop: 8, gap: 6 }}
                  onPress={() => setShowUpsellForm(true)}
                >
                  <FontAwesome name="plus" size={12} color={T.primary} />
                  <Text style={{ color: T.primary, fontWeight: '700', fontSize: 13 }}>{t('catalog.addRecommendation')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 16, marginTop: 8, gap: 10 }}>
                  <Text style={{ color: T.textDim, fontSize: 12, fontWeight: '700' }}>{t('catalog.suggestProduct')}</Text>
                  <View style={styles.searchBar}>
                    <FontAwesome name="search" size={14} color={T.textDim} />
                    <TextInput style={styles.searchInput} value={upsellTargetSearch} onChangeText={setUpsellTargetSearch} placeholder={t('catalog.selectProduct')} placeholderTextColor={T.textDim} />
                  </View>
                  {products
                    .filter(p => p.id !== editingProduct?.id && !pUpsells.find((u: any) => u.targetProductId === p.id) && (p.productStandard?.name || p.name || '').toLowerCase().includes(upsellTargetSearch.toLowerCase()))
                    .slice(0, 6)
                    .map(prod => (
                      <TouchableOpacity key={prod.id} style={[styles.pickerItem, upsellTargetId === prod.id && { borderColor: T.success }]} onPress={() => setUpsellTargetId(prod.id)}>
                        <FontAwesome name={upsellTargetId === prod.id ? 'check-circle' : 'circle'} size={16} color={upsellTargetId === prod.id ? T.success : T.textMuted} style={{ marginRight: 8 }} />
                        <Text style={{ flex: 1, color: T.textDim, fontSize: 13 }}>{prod.productStandard?.name || prod.name}</Text>
                      </TouchableOpacity>
                    ))}
                  {upsellTargetId && (
                    <>
                      <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent' }}>
                        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                          <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{t('catalog.quantity')}</Text>
                          <TextInput style={[styles.input, { height: 42 }]} value={upsellQty} onChangeText={setUpsellQty} keyboardType="numeric" placeholder="1" placeholderTextColor={T.textDim} />
                        </View>
                        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                          <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{t('catalog.discount')}</Text>
                          <TextInput style={[styles.input, { height: 42 }]} value={upsellDiscount} onChangeText={setUpsellDiscount} keyboardType="numeric" placeholder="0" placeholderTextColor={T.textDim} />
                        </View>
                      </View>
                      <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{t('catalog.pitchMessage')}</Text>
                      <TextInput style={[styles.input, { height: 42 }]} value={upsellText} onChangeText={setUpsellText} placeholder={t('catalog.pitchExample')} placeholderTextColor={T.textDim} />
                      <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent' }}>
                        <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }} onPress={() => { setShowUpsellForm(false); setUpsellTargetId(null); setUpsellTargetSearch(''); }}>
                          <Text style={{ color: T.textDim, fontWeight: '700', fontSize: 13 }}>{t('catalog.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: T.primary, alignItems: 'center' }} onPress={addUpsell}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('catalog.add')}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={saveProduct}>
                <Text style={styles.saveBtnText}>{editingProduct ? t('catalog.update') : t('catalog.addProduct')}</Text>
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
                <Text style={styles.modalTitle}>{editingBundle ? t('catalog.edit') : t('catalog.newBundle')} {t('catalog.bundle_singular')}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setBundleModalVisible(false)}><FontAwesome name="times" size={18} color={T.textDim} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formSection}>{t('catalog.productInfo')}</Text>
              <TextInput style={styles.input} value={bName} onChangeText={setBName} placeholder={t('catalog.bundleName') + ' *'} placeholderTextColor={T.textDim} />
              <TextInput style={[styles.input, { height: 80 }]} value={bDesc} onChangeText={setBDesc} multiline placeholder={t('catalog.description') + '...'} placeholderTextColor={T.textDim} />
              <TextInput style={styles.input} value={bPrice} onChangeText={setBPrice} keyboardType="numeric" placeholder={t('catalog.bundleSellingPrice')} placeholderTextColor={T.textDim} />

              <Text style={styles.formSection}>{t('catalog.photos')}</Text>
              {bImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8, backgroundColor: 'transparent' }}>
                    {bImages.map((img, idx) => (
                      <View key={idx} style={{ position: 'relative' }}>
                        <Image source={{ uri: ApiService.getFileUrl(img) || undefined }} style={{ width: 72, height: 72, borderRadius: 12 }} />
                        <TouchableOpacity
                          style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(230,69,69,0.9)', alignItems: 'center', justifyContent: 'center' }}
                          onPress={() => setBImages(bImages.filter((_, i) => i !== idx))}
                        >
                          <FontAwesome name="times" size={11} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent', marginBottom: 10 }}>
                <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(34,172,56,0.1)' }]} onPress={() => pickImage((uri) => setBImages([...bImages, uri]))}>
                  <FontAwesome name="photo" size={16} color={T.success} /><Text style={{ color: T.success, fontSize: 12, fontWeight: '700' }}> {t('catalog.gallery')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(20,112,204,0.1)' }]} onPress={() => takePhoto((uri) => setBImages([...bImages, uri]))}>
                  <FontAwesome name="camera" size={16} color="#1470cc" /><Text style={{ color: '#1470cc', fontSize: 12, fontWeight: '700' }}> {t('catalog.camera')}</Text>
                </TouchableOpacity>
                {bImages.length > 0 && (
                  <TouchableOpacity style={[styles.imgBtn, { backgroundColor: 'rgba(230,69,69,0.1)' }]} onPress={() => setBImages([])}>
                    <FontAwesome name="trash" size={16} color={T.primary} /><Text style={{ color: T.primary, fontSize: 12, fontWeight: '700' }}> {t('catalog.clearAll')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.formSection}>{t('catalog.bundleProducts')} ({bItems.length})</Text>
              {bItems.map((item, idx) => (
                <View key={idx} style={styles.bundleItemRow}>
                  <Text style={{ flex: 1, color: T.white, fontWeight: '600' }} numberOfLines={1}>{getProductName(item.vendorProductId)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                    <TouchableOpacity onPress={() => setBItems(bItems.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}>
                      <FontAwesome name="minus-circle" size={22} color={T.textDim} />
                    </TouchableOpacity>
                    <Text style={{ color: T.white, fontWeight: '800', minWidth: 20, textAlign: 'center' }}>{item.quantity}</Text>
                    <TouchableOpacity onPress={() => setBItems(bItems.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}>
                      <FontAwesome name="plus-circle" size={22} color={T.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => setBItems(bItems.filter((_, i) => i !== idx))} style={{ marginLeft: 8 }}>
                    <FontAwesome name="trash" size={16} color="rgba(230,69,69,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
              
              <Text style={styles.formSection}>{t('catalog.addBundleProduct')}</Text>
              <View style={styles.searchBar}>
                <FontAwesome name="search" size={14} color={T.textDim} />
                <TextInput style={styles.searchInput} value={bProductSearch} onChangeText={setBProductSearch} placeholder={t('catalog.searchShort')} placeholderTextColor={T.textDim} />
              </View>
              {filteredVendorProducts.slice(0, 10).map(prod => (
                <TouchableOpacity key={prod.id} style={styles.pickerItem} onPress={() => { setBItems([...bItems, { vendorProductId: prod.id, quantity: 1 }]); setBProductSearch(''); }}>
                  <Text style={{ flex: 1, color: T.textDim }}>{prod.productStandard?.name || prod.name}</Text>
                  <FontAwesome name="plus-circle" size={18} color={T.primary} />
                </TouchableOpacity>
              ))}

              <Text style={[styles.formSection, { marginTop: 24 }]}>{t('catalog.marketing')}</Text>
              <TouchableOpacity style={[styles.upsellCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setBFeatured(!bFeatured)}>
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={{ color: T.white, fontWeight: '700', fontSize: 14 }}>{t('catalog.featuredBundle')}</Text>
                  <Text style={{ color: T.textMuted, fontSize: 11 }}>{t('catalog.showFirst')}</Text>
                </View>
                <FontAwesome name={bFeatured ? 'toggle-on' : 'toggle-off'} size={36} color={bFeatured ? T.primary : T.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={saveBundle}>
                <Text style={styles.saveBtnText}>{editingBundle ? t('catalog.update') : t('catalog.createBundle')}</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: 'transparent' },
  title: { fontSize: 26, fontWeight: '900', color: T.white },
  headerSub: { color: T.textMuted, fontSize: 13, marginTop: 4, fontWeight: '500' },
  addBtn: { backgroundColor: T.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  subTabRow: { flexDirection: 'row', backgroundColor: T.sectionBg, borderRadius: 14, padding: 4, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  subTabActive: { backgroundColor: T.tabActiveBg },
  subTabText: { color: T.textDim, fontSize: 13, fontWeight: '600' },
  subTabTextActive: { color: T.primary },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBg, borderRadius: 14, paddingHorizontal: 14, height: 44, marginBottom: 14, gap: 8, borderWidth: 1, borderColor: T.inputBorder },
  searchInput: { flex: 1, color: T.white, fontSize: 14 },
  scrollBody: { paddingBottom: 40 },
  itemCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 10, backgroundColor: T.card, borderWidth: 1, borderColor: T.cardBorder },
  itemImage: { width: 56, height: 56, borderRadius: 14 },
  itemInfo: { flex: 1, marginLeft: 12, backgroundColor: 'transparent' },
  itemName: { color: T.white, fontSize: 15, fontWeight: '700' },
  itemPrice: { color: T.primary, fontSize: 14, fontWeight: '800', marginTop: 2 },
  itemMeta: { color: T.textMuted, fontSize: 11, marginTop: 1 },
  itemTags: { flexDirection: 'row', gap: 4, marginTop: 4, backgroundColor: 'transparent', flexWrap: 'wrap' },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  deleteBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(230,69,69,0.08)', marginLeft: 8 },
  emptyState: { alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' },
  emptyText: { color: T.textMuted, fontSize: 15, marginTop: 16, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: T.modalOverlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: T.modalBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '92%', borderTopWidth: 1, borderColor: T.cardBorder, marginHorizontal: Platform.OS === 'web' ? '5%' : (Platform.OS === 'ios' && (Platform as any).isPad ? 20 : 0) },
  modalHeader: { backgroundColor: T.modalHeaderBg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomWidth: 1, borderBottomColor: T.divider },
  modalTitle: { color: T.white, fontSize: 18, fontWeight: '900' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.sectionBg, alignItems: 'center', justifyContent: 'center' },
  formSection: { color: T.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  input: { backgroundColor: T.inputBg, borderRadius: 14, height: 50, paddingHorizontal: 16, color: T.white, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: T.inputBorder },
  stockChip: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: T.cardBorder, alignItems: 'center', backgroundColor: T.sectionBg },
  stockChipText: { color: T.textDim, fontSize: 11, fontWeight: '700' },
  imgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },
  upsellCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: T.sectionBg, borderWidth: 1, borderColor: T.inputBorder, gap: 8 },
  saveBtn: { backgroundColor: T.primary, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 24, shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  bundleItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.sectionBg, padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: T.divider },
  pickerItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 4, backgroundColor: T.sectionBg, borderWidth: 1, borderColor: T.divider },
});
}
