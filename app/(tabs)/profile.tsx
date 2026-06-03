import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Text, View } from '@/components/Themed';
import { ApiService } from '@/services/api';
import { AuthService } from '@/services/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme, ThemeColors } from '@/components/useTheme';
import { useThemeContext } from '@/components/ThemeContext';
import { useLocaleContext } from '@/components/LocaleContext';
import { useT } from '@/constants/translations';

export default function ProfileScreen() {
  const T = useTheme();
  const styles = createStyles(T);
  const { toggleColorScheme, isDark } = useThemeContext();
  const { locale, toggleLang } = useLocaleContext();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [allSectors, setAllSectors] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: '',
    description: '',
    address: '',
    phone: '',
    lat: '',
    lng: '',
    mktSectors: [] as string[]
  });

  const fetchData = async (vid: string) => {
    try {
      const [profileData, sectorsData] = await Promise.all([
        ApiService.get(`/management/vendor/profile/${vid}`),
        ApiService.get('/management/marketplace/sectors')
      ]);
      
      setProfile(profileData);
      setAllSectors(sectorsData);
      setForm({
        companyName: profileData.companyName || '',
        description: profileData.description || '',
        address: profileData.address || '',
        phone: profileData.phone || '',
        lat: String(profileData.lat || ''),
        lng: String(profileData.lng || ''),
        mktSectors: profileData.mktSectors?.map((s: any) => s.id) || []
      });
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      };
      await ApiService.put(`/management/vendor/profile/${vendorId}`, payload);
      Alert.alert("Succès", "Votre profil a été mis à jour.");
    } catch (error) {
      Alert.alert("Erreur", "Impossible de sauvegarder les modifications.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSector = (id: string) => {
    setForm(prev => ({
      ...prev,
      mktSectors: prev.mktSectors.includes(id) 
        ? prev.mktSectors.filter(sid => sid !== id)
        : [...prev.mktSectors, id]
    }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.warning} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollBody, { paddingTop: Platform.OS === 'android' ? insets.top + 20 : 60 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('profile.title')}</Text>
        
        {/* Basic Info */}
        <View style={[styles.card, styles.glassEffect]}>
          <Text style={styles.cardHeader}>{t('profile.generalInfo')}</Text>
          
          <Text style={styles.label}>{t('profile.companyName')}</Text>
          <TextInput 
            style={styles.input} 
            value={form.companyName} 
            onChangeText={(t) => setForm({...form, companyName: t})}
            placeholder={t('profile.companyPlaceholder')}
            placeholderTextColor={T.textMuted}
          />

          <Text style={styles.label}>{t('profile.descMarketplace')}</Text>
          <TextInput 
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
            value={form.description} 
            onChangeText={(t) => setForm({...form, description: t})}
            multiline
            placeholder={t('profile.descPlaceholder')}
            placeholderTextColor={T.textMuted}
          />
        </View>

        {/* Contact & Map */}
        <View style={[styles.card, styles.glassEffect]}>
          <Text style={styles.cardHeader}>{t('profile.coords')}</Text>
          
          <Text style={styles.label}>{t('profile.address')}</Text>
          <TextInput 
            style={styles.input} 
            value={form.address} 
            onChangeText={(t) => setForm({...form, address: t})}
            placeholder={t('profile.addressPlaceholder')}
            placeholderTextColor={T.textMuted}
          />

          <Text style={styles.label}>{t('profile.phone')}</Text>
          <TextInput 
            style={styles.input} 
            value={form.phone} 
            onChangeText={(t) => setForm({...form, phone: t})}
            keyboardType="phone-pad"
            placeholderTextColor={T.textMuted}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <Text style={styles.label}>{t('profile.lat')}</Text>
              <TextInput 
                style={styles.input} 
                value={form.lat} 
                onChangeText={(t) => setForm({...form, lat: t})}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 20, backgroundColor: 'transparent' }} />
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <Text style={styles.label}>{t('profile.lng')}</Text>
              <TextInput 
                style={styles.input} 
                value={form.lng} 
                onChangeText={(t) => setForm({...form, lng: t})}
                keyboardType="numeric"
              />
            </View>
          </View>
          <TouchableOpacity style={styles.mapHint}>
            <FontAwesome name="map-marker" size={14} color={Colors.warning} />
            <Text style={styles.mapHintText}>{t('profile.useLocation')}</Text>
          </TouchableOpacity>
        </View>

        {/* Theme Toggle */}
        <View style={[styles.card, styles.glassEffect]}>
          <Text style={styles.cardHeader}>{t('profile.display')}</Text>
          <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
            <View style={{ backgroundColor: 'transparent', flex: 1 }}>
              <Text style={[styles.label, { marginBottom: 0 }]}>{t('profile.darkMode')}</Text>
              <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{t('profile.darkModeDesc')}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleColorScheme}
              trackColor={{ false: '#767577', true: Colors.warning }}
              thumbColor={isDark ? '#fff' : '#f4f3f4'}
            />
          </View>
          <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }]}>
            <View style={{ backgroundColor: 'transparent', flex: 1 }}>
              <Text style={[styles.label, { marginBottom: 0 }]}>{t('profile.language')}</Text>
              <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{t('profile.languageDesc')}</Text>
            </View>
            <Switch
              value={locale === 'ar'}
              onValueChange={toggleLang}
              trackColor={{ false: '#767577', true: Colors.warning }}
              thumbColor={locale === 'ar' ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Sectors */}
        <Text style={styles.sectionSubtitle}>{t('profile.sectors')}</Text>
        <View style={styles.sectorsGrid}>
          {allSectors.map((sector) => (
            <TouchableOpacity 
              key={sector.id} 
              style={[
                styles.sectorItem, 
                form.mktSectors.includes(sector.id) && styles.sectorItemActive
              ]}
              onPress={() => toggleSector(sector.id)}
            >
              <Text style={[
                styles.sectorText,
                form.mktSectors.includes(sector.id) && styles.sectorTextActive
              ]}>{sector.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving 
            ? <ActivityIndicator color={T.white} />
            : <Text style={styles.saveBtnText}>{t('profile.save')}</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
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
  },
  scrollBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: T.text,
    marginBottom: 25,
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.text,
    marginTop: 20,
    marginBottom: 15,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
  },
  glassEffect: {
    backgroundColor: T.glassCard,
    borderWidth: 1,
    borderColor: T.glassBorder,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: T.textMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: T.inputBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 12,
    padding: 15,
    color: T.text,
    fontSize: 15,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  mapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    backgroundColor: 'transparent',
  },
  mapHintText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  sectorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
    marginBottom: 30,
  },
  sectorItem: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: T.sectionBg,
    borderWidth: 1,
    borderColor: T.glassBorder,
  },
  sectorItemActive: {
    backgroundColor: Colors.glass.orange,
    borderColor: Colors.warning,
  },
  sectorText: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sectorTextActive: {
    color: Colors.warning,
    fontWeight: '800',
  },
  saveBtn: {
    backgroundColor: Colors.warning,
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnText: {
    color: T.text,
    fontSize: 16,
    fontWeight: '900',
  },
});
}
