import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlert } from '@/components/AlertContext';
import { useTheme } from '@/components/useTheme';
import { useT } from '@/constants/translations';

export default function BundlesScreen() {
  const T = useTheme();
  const styles = createStyles(T);
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bundles, setBundles] = useState<any[]>([]);
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Modal States
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.000');
  const [selectedItems, setSelectedItems] = useState<{ vendorProductId: string; quantity: number }[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const fetchData = useCallback(async (vid: string) => {
    try {
      const [bundlesData, productsData] = await Promise.all([
        ApiService.get(`/management/vendor/bundles/${vid}`).catch(e => { console.error("Bundles fetch error:", e); return []; }),
        ApiService.get(`/management/marketplace/products?vendorId=${vid}`).catch(e => { console.error("Products fetch error:", e); return []; })
      ]);
      
      setBundles(Array.isArray(bundlesData) ? bundlesData : []);
      setVendorProducts(Array.isArray(productsData) ? productsData : []);
    } catch (error) {
      console.error("Failed to fetch bundles data:", error);
      showAlert({ title: t('general.error'), message: t('bundles.loadError'), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (session?.user?.vendorId) {
        setVendorId(session.user.vendorId);
        fetchData(session.user.vendorId);
      }
    });
  }, [fetchData]);

  const t = useT();

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('0.000');
    setSelectedItems([]);
    setImages([]);
    setEditingBundle(null);
    setIsFeatured(false);
    setProductSearch('');
  };

  const handleOpenModal = (bundle?: any) => {
    if (bundle) {
      setEditingBundle(bundle);
      setName(bundle.name);
      setDescription(bundle.description || '');
      setPrice(String(bundle.price));
      setIsFeatured(bundle.isFeatured || false);
      setSelectedItems(bundle.items?.map((it: any) => ({ 
        vendorProductId: it.vendorProductId, 
        quantity: Number(it.quantity) 
      })) || []);
      setImages(bundle.images || []);
    } else {
      resetForm();
    }
    setIsModalVisible(true);
  };

  const computedPrice = selectedItems.reduce((sum, item) => {
    const prod = vendorProducts.find(p => p.id === item.vendorProductId);
    return sum + (prod ? Number(prod.price) * item.quantity : 0);
  }, 0);

  const handleSave = async () => {
    if (!name) return showAlert({ title: t('general.error'), message: t('catalog.bundleNameRequired'), type: 'error' });
    if (selectedItems.length === 0) return showAlert({ title: t('general.error'), message: t('catalog.addProductRequired'), type: 'error' });
    try {
      const payload = {
        name,
        description,
        price: Number(price),
        items: selectedItems,
        images,
        isActive: true,
        isFeatured,
      };

      if (editingBundle) {
        await ApiService.put(`/management/vendor/bundles/${editingBundle.id}`, payload);
        showAlert({ title: t('general.success'), message: t('catalog.bundleUpdated'), type: 'success' });
      } else {
        await ApiService.post(`/management/vendor/bundles/${vendorId}`, payload);
        showAlert({ title: t('general.success'), message: t('catalog.bundleCreated'), type: 'success' });
      }
      setIsModalVisible(false);
      if (vendorId) fetchData(vendorId);
    } catch (error) {
      showAlert({ title: t('general.error'), message: t('bundles.saveError'), type: 'error' });
    }
  };

  const handleDelete = (bundle: any) => {
    showAlert({
      title: t('bundles.deleteTitle'),
      message: `${t('catalog.delete')} "${bundle.name}" ? ${t('bundles.deleteWarning')}`,
      type: 'warning',
      buttons: [
        { text: t('catalog.cancel'), style: 'cancel' },
        {
          text: t('catalog.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(bundle.id);
            try {
              await ApiService.delete(`/management/vendor/bundles/${bundle.id}`);
              if (vendorId) fetchData(vendorId);
              showAlert({ title: t('general.success'), message: t('catalog.bundleDeleted'), type: 'success' });
            } catch {
              showAlert({ title: t('general.error'), message: t('catalog.deleteError'), type: 'error' });
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    });
  };

  const addProductToBundle = (productId: string) => {
    if (selectedItems.find(it => it.vendorProductId === productId)) return;
    setSelectedItems([...selectedItems, { vendorProductId: productId, quantity: 1 }]);
  };

  const updateItemQty = (productId: string, qty: number) => {
    setSelectedItems(selectedItems.map(it => 
      it.vendorProductId === productId ? { ...it, quantity: Math.max(1, qty) } : it
    ));
  };

  const removeItemFromBundle = (productId: string) => {
    setSelectedItems(selectedItems.filter(it => it.vendorProductId !== productId));
  };

  const addImage = () => {
    if (newImageUrl) {
      setImages([...images, newImageUrl]);
      setNewImageUrl('');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({ title: t('general.accessDenied'), message: t('products.photosAccessRequired'), type: 'warning' });
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
      showAlert({ title: t('general.error'), message: t('catalog.cameraDenied'), type: 'error' });
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
        setImages([...images, res.url]);
      } else {
        throw new Error('No URL returned');
      }
    } catch (error) {
      console.error("Bundle upload error:", error);
      showAlert({ title: t('general.error'), message: t('catalog.uploadError'), type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const getProductName = (prodId: string) => {
    const prod = vendorProducts.find(p => p.id === prodId);
    return prod?.productStandard?.name || prod?.name || t('catalog.unknown');
  };

  const getProductPrice = (prodId: string) => {
    const prod = vendorProducts.find(p => p.id === prodId);
    return prod ? Number(prod.price) : 0;
  };

  const filteredProducts = vendorProducts.filter(p => {
    const name = p.productStandard?.name || p.name || '';
    const alreadySelected = selectedItems.find(it => it.vendorProductId === p.id);
    return !alreadySelected && name.toLowerCase().includes(productSearch.toLowerCase());
  });

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={T.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollBody, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => vendorId && fetchData(vendorId)} tintColor={T.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ backgroundColor: 'transparent' }}>
            <Text style={styles.title}>{t('bundles.myBundles')}</Text>
            <Text style={styles.headerSub}>{bundles.length} {bundles.length !== 1 ? t('catalog.bundles').toLowerCase() : t('catalog.bundle_singular')}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenModal()}>
            <FontAwesome name="plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}> {t('bundles.create')}</Text>
          </TouchableOpacity>
        </View>

        {bundles.map((bundle) => {
          const totalValue = bundle.items?.reduce((sum: number, it: any) => {
            const prod = vendorProducts.find(p => p.id === it.vendorProductId);
            return sum + (prod ? Number(prod.price) * Number(it.quantity) : 0);
          }, 0) || 0;

          return (
            <TouchableOpacity
              key={bundle.id}
              style={styles.bundleCard}
              activeOpacity={0.7}
              onPress={() => handleOpenModal(bundle)}
            >
              {bundle.images?.length > 0 ? (
                <Image source={{ uri: ApiService.getFileUrl(bundle.images[0]) || undefined }} style={styles.bundleImage} />
              ) : (
                <View style={[styles.bundleImage, styles.bundleImagePlaceholder]}>
                  <FontAwesome name="gift" size={28} color={T.textMuted} />
                </View>
              )}
              <View style={styles.bundleInfo}>
                <Text style={styles.bundleName} numberOfLines={1}>{bundle.name}</Text>
                <Text style={styles.bundleDetails}>
                  {bundle.items?.length || 0} {bundle.items?.length !== 1 ? t('catalog.products').toLowerCase() : t('catalog.product_singular')}
                </Text>
                <Text style={styles.bundlePrice}>{Number(bundle.price).toFixed(3)} DT</Text>
                {totalValue > 0 && (
                  <Text style={styles.bundleValue}>
                    {t('bundles.value')}: {totalValue.toFixed(3)} DT
                  </Text>
                )}
                {bundle.isFeatured && (
                  <View style={styles.bundleFeaturedTag}>
                    <FontAwesome name="star" size={10} color={T.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.bundleFeaturedText}>{t('catalog.featured')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.bundleActions}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(bundle)}
                >
                  {deletingId === bundle.id ? (
                    <ActivityIndicator size="small" color={T.danger} />
                  ) : (
                    <FontAwesome name="trash" size={16} color="rgba(239,68,68,0.4)" />
                  )}
                </TouchableOpacity>
                <FontAwesome name="chevron-right" size={14} color={T.textMuted} style={{ marginTop: 8 }} />
              </View>
            </TouchableOpacity>
          );
        })}

        {bundles.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FontAwesome name="gift" size={40} color="rgba(255,255,255,0.06)" />
            </View>
            <Text style={styles.emptyText}>{t('bundles.noBundles')}</Text>
            <Text style={styles.emptySubText}>{t('bundles.emptySubtext')}</Text>
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Compose Bundle Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ backgroundColor: 'transparent' }}>
                <Text style={styles.modalTitle}>{editingBundle ? t('bundles.edit') : t('bundles.compose')}</Text>
                <Text style={styles.modalSub}>{editingBundle ? t('bundles.editSub') : t('bundles.composeSub')}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsModalVisible(false)}>
                <FontAwesome name="times" size={18} color={T.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Informations */}
              <Text style={styles.formSectionTitle}>{t('bundles.bundleInfo')}</Text>

              <Text style={styles.label}>{t('bundles.name')} *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('bundles.namePlaceholder')}
                placeholderTextColor={T.textDim}
              />
              
              <Text style={styles.label}>{t('catalog.description')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder={t('bundles.descPlaceholder')}
                placeholderTextColor={T.textDim}
              />

              <Text style={styles.label}>{t('bundles.price')}</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="0.000"
                placeholderTextColor={T.textDim}
              />

              {/* Prix total calculé */}
              {selectedItems.length > 0 && (
                <View style={styles.valueCard}>
                  <View style={{ backgroundColor: 'transparent', flex: 1 }}>
                    <Text style={styles.valueLabel}>{t('bundles.totalValue')}</Text>
                    <Text style={styles.valueAmount}>{computedPrice.toFixed(3)} DT</Text>
                  </View>
                  <FontAwesome name="calculator" size={20} color={T.primary} />
                </View>
              )}

              {/* Images */}
              <Text style={styles.formSectionTitle}>{t('catalog.photos')}</Text>

              <View style={styles.imageActions}>
                <TouchableOpacity style={[styles.imageActionBtn, { backgroundColor: T.glassGreen }]} onPress={pickImage}>
                  <FontAwesome name="photo" size={16} color={T.success} />
                  <Text style={[styles.imageActionText, { color: T.success }]}>{t('catalog.gallery')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imageActionBtn, { backgroundColor: T.glassBlue }]} onPress={takePhoto}>
                  <FontAwesome name="camera" size={16} color={T.info} />
                  <Text style={[styles.imageActionText, { color: T.info }]}>{t('catalog.camera')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.imageUrlRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newImageUrl}
                  onChangeText={setNewImageUrl}
                  placeholder={t('bundles.imageUrlPlaceholder')}
                  placeholderTextColor={T.textDim}
                />
                <TouchableOpacity style={styles.imageUrlAddBtn} onPress={addImage}>
                  <FontAwesome name="plus" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {uploading && (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color={T.primary} />
                  <Text style={{ color: T.primary, fontSize: 13 }}>{t('general.loading')}</Text>
                </View>
              )}

              {images.length > 0 && (
                <ScrollView horizontal style={styles.imagePreviewRow} showsHorizontalScrollIndicator={false}>
                  {images.map((img, idx) => (
                    <View key={idx} style={styles.imagePreviewWrapper}>
                      <Image source={{ uri: ApiService.getFileUrl(img) || undefined }} style={styles.imagePreview} />
                      <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(idx)}>
                        <FontAwesome name="times-circle" size={22} color={T.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Produits sélectionnés */}
              <Text style={styles.formSectionTitle}>
                {t('bundles.products')} ({selectedItems.length})
              </Text>

              {selectedItems.map((item, idx) => (
                <View key={idx} style={styles.selectedItemRow}>
                  <View style={styles.selectedItemInfo}>
                    <Text style={styles.selectedItemName} numberOfLines={1}>{getProductName(item.vendorProductId)}</Text>
                    <Text style={styles.selectedItemPrice}>{getProductPrice(item.vendorProductId).toFixed(3)} DT</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateItemQty(item.vendorProductId, item.quantity - 1)}
                    >
                      <FontAwesome name="minus" size={14} color={T.textDim} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, styles.qtyBtnActive]}
                      onPress={() => updateItemQty(item.vendorProductId, item.quantity + 1)}
                    >
                      <FontAwesome name="plus" size={14} color={T.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.removeItemBtn} onPress={() => removeItemFromBundle(item.vendorProductId)}>
                    <FontAwesome name="trash" size={16} color="rgba(239,68,68,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Ajouter des produits */}
              <Text style={styles.formSectionTitle}>{t('bundles.addProducts')}</Text>

              <View style={styles.productSearchBar}>
                <FontAwesome name="search" size={14} color={T.textDim} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.productSearchInput}
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholder={t('catalog.search')}
                  placeholderTextColor={T.textDim}
                />
                {productSearch ? (
                  <TouchableOpacity onPress={() => setProductSearch('')}>
                    <FontAwesome name="times-circle" size={16} color={T.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.productPicker}>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(prod => (
                    <TouchableOpacity
                      key={prod.id}
                      style={styles.pickerItem}
                      onPress={() => addProductToBundle(prod.id)}
                    >
                      <View style={styles.pickerItemLeft}>
                        {prod.images?.length > 0 ? (
                          <Image source={{ uri: ApiService.getFileUrl(prod.images[0]) || undefined }} style={styles.pickerItemImage} />
                        ) : (
                          <View style={[styles.pickerItemImage, { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }]}>
                            <FontAwesome name="cube" size={12} color={T.textMuted} />
                          </View>
                        )}
                        <View style={{ backgroundColor: 'transparent' }}>
                          <Text style={styles.pickerItemText}>{prod.productStandard?.name || prod.name}</Text>
                          <Text style={styles.pickerItemPrice}>{Number(prod.price).toFixed(3)} DT</Text>
                        </View>
                      </View>
                      <FontAwesome name="plus-circle" size={22} color={T.primary} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noProducts}>
                    {productSearch
                      ? t('catalog.noProducts')
                      : vendorProducts.length === 0
                        ? t('bundles.createProductsFirst')
                        : t('bundles.allProductsAdded')}
                  </Text>
                )}
              </View>

              {/* Upsell toggle */}
              <View style={styles.upsellRow}>
                <View style={{ backgroundColor: 'transparent', flex: 1 }}>
                  <Text style={styles.upsellRowLabel}>{t('bundles.featuredToggle')}</Text>
                  <Text style={styles.upsellRowDesc}>{t('bundles.featuredToggleDesc')}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsFeatured(!isFeatured)}>
                  <FontAwesome
                    name={isFeatured ? "toggle-on" : "toggle-off"}
                    size={40}
                    color={isFeatured ? T.primary : T.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <FontAwesome name="check" size={18} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.saveBtnText}>
                  {editingBundle ? t('catalog.update') : t('bundles.publish')}
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
  container: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bg },
  scrollBody: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, backgroundColor: 'transparent' },
  title: { fontSize: 26, fontWeight: '900', color: T.white },
  headerSub: { color: T.textMuted, fontSize: 13, marginTop: 4, fontWeight: '500' },
  addBtn: {
    backgroundColor: T.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  bundleCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  bundleImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  bundleImagePlaceholder: {
    backgroundColor: T.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleInfo: { flex: 1, marginLeft: 14, backgroundColor: 'transparent' },
  bundleName: { fontSize: 17, fontWeight: '700', color: T.white },
  bundleDetails: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  bundlePrice: { fontSize: 15, fontWeight: '800', color: T.primary, marginTop: 4 },
  bundleValue: { fontSize: 11, color: T.textMuted, marginTop: 1 },
  bundleFeaturedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.glassRed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(230,69,69,0.2)',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  bundleFeaturedText: { color: T.primary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },

  bundleActions: { alignItems: 'center', justifyContent: 'center', marginLeft: 8, backgroundColor: 'transparent' },
  deleteBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)' },

  emptyState: { alignItems: 'center', marginTop: 80, backgroundColor: 'transparent' },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: T.sectionBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { color: T.textMuted, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: T.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center', opacity: 0.6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: T.modalOverlay, justifyContent: 'flex-end' },
  modalContent: {
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
  modalTitle: { fontSize: 20, fontWeight: '900', color: T.white },
  modalSub: { color: T.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.sectionBg, alignItems: 'center', justifyContent: 'center' },
  modalForm: { flex: 1 },

  formSectionTitle: {
    color: T.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: '700', color: T.white, marginBottom: 8, marginLeft: 5 },
  input: {
    backgroundColor: T.inputBg,
    borderWidth: 1,
    borderColor: T.inputBorder,
    borderRadius: 14,
    padding: 16,
    color: T.white,
    marginBottom: 12,
    fontSize: 15,
  },
  inputMultiline: { height: 80, paddingTop: 14, textAlignVertical: 'top' },

  valueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.glassGreen,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
    marginBottom: 8,
  },
  valueLabel: { color: T.textMuted, fontSize: 11, fontWeight: '600' },
  valueAmount: { color: T.success, fontSize: 18, fontWeight: '900', marginTop: 2 },

  // Images
  imageActions: { flexDirection: 'row', gap: 12, marginBottom: 12, backgroundColor: 'transparent' },
  imageActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 14 },
  imageActionText: { fontWeight: '700', fontSize: 13 },
  imageUrlRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: 'transparent', marginBottom: 10 },
  imageUrlAddBtn: { backgroundColor: T.primary, width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  uploadingRow: { marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'transparent' },
  imagePreviewRow: { flexDirection: 'row', marginBottom: 16, backgroundColor: 'transparent' },
  imagePreviewWrapper: { position: 'relative', marginRight: 14, backgroundColor: 'transparent' },
  imagePreview: { width: 72, height: 72, borderRadius: 14, borderWidth: 1, borderColor: T.cardBorder },
  imageRemoveBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: 'transparent' },

  // Selected products
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.sectionBg,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.divider,
  },
  selectedItemInfo: { flex: 1, backgroundColor: 'transparent' },
  selectedItemName: { color: T.white, fontWeight: '600', fontSize: 14 },
  selectedItemPrice: { color: T.textDim, fontSize: 12, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', marginRight: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.sectionBg, alignItems: 'center', justifyContent: 'center' },
  qtyBtnActive: { backgroundColor: 'rgba(245,158,11,0.12)' },
  qtyText: { color: T.white, fontWeight: '800', marginHorizontal: 12, minWidth: 20, textAlign: 'center', fontSize: 15 },
  removeItemBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)' },

  // Product picker
  productSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  productSearchInput: { flex: 1, color: T.white, fontSize: 14 },
  productPicker: { backgroundColor: 'transparent' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.sectionBg,
    padding: 12,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: T.divider,
  },
  pickerItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'transparent', flex: 1 },
  pickerItemImage: { width: 36, height: 36, borderRadius: 10 },
  pickerItemText: { color: T.textDim, fontSize: 14, fontWeight: '600' },
  pickerItemPrice: { color: T.textMuted, fontSize: 11, marginTop: 1 },
  noProducts: { color: T.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },

  // Upsell
  upsellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    marginTop: 24,
  },
  upsellRowLabel: { color: T.white, fontSize: 15, fontWeight: '700' },
  upsellRowDesc: { color: T.textMuted, fontSize: 11, marginTop: 2 },

  saveBtn: {
    backgroundColor: T.primary,
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
}
