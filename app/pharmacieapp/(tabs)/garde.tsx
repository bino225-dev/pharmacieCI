import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, TextInput,
  Modal, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_AD_ID } from '@/hooks/ads';

interface City {
  id: string;
  name: string;
}

interface OnDutyPharmacy {
  id: string;
  name: string;
  city: string;
  zone: string;
  phones: string[];
  distance: number;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (ts.toDate) return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}

export default function GardeScreen() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [nearbyModalVisible, setNearbyModalVisible] = useState(false);
  const [nearbyGardes, setNearbyGardes] = useState<OnDutyPharmacy[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchCities = async () => {
    try {
      const snap = await getDocs(collection(db, 'cities'));
      const data = snap.docs.map(d => ({ id: d.id, name: d.data().name || '' }));
      setCities(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('Erreur chargement villes:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCities();
  }, []);

  const filtered = cities.filter(c => {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleLocate = async () => {
    setLocating(true);
    setLocationError(null);
    setNearbyGardes([]);
    setNearbyModalVisible(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission de localisation refusee. Activez-la dans les reglages.');
        setLocating(false);
        return;
      }

      const userLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: userLat, longitude: userLon } = userLocation.coords;

      const gardeSnap = await getDocs(collection(db, 'pharmacies_de_garde'));
      const now = Date.now();

      const activePharmacyIds = new Set<string>();
      const pharmacyMeta = new Map<string, { name: string; zone: string; phones: string[] }>();

      gardeSnap.docs.forEach(d => {
        const raw = d.data();
        const start = toMs(raw.startDate);
        const end = toMs(raw.endDate);
        if (start <= now && now <= end) {
          (raw.pharmacies || []).forEach((p: any) => {
            if (p.pharmacyId) {
              activePharmacyIds.add(p.pharmacyId);
              pharmacyMeta.set(p.pharmacyId, {
                name: p.name || '',
                zone: p.zone || '',
                phones: p.phones || [],
              });
            }
          });
        }
      });

      if (activePharmacyIds.size === 0) {
        setNearbyGardes([]);
        setLocating(false);
        return;
      }

      const pharmacyDocs = await Promise.all(
        Array.from(activePharmacyIds).map(id => getDoc(doc(db, 'pharmacies', id)))
      );

      const withDistance: OnDutyPharmacy[] = [];
      pharmacyDocs.forEach(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const loc = data.location;
        if (!loc?.latitude || !loc?.longitude) return;

        const meta = pharmacyMeta.get(snap.id);
        withDistance.push({
          id: snap.id,
          name: meta?.name || data.name || '',
          city: data.city || '',
          zone: meta?.zone || data.zone || '',
          phones: meta?.phones || data.phones || [],
          distance: getDistanceKm(userLat, userLon, loc.latitude, loc.longitude),
        });
      });

      withDistance.sort((a, b) => a.distance - b.distance);

      let results = withDistance.filter(p => p.distance <= 5);
      if (results.length < 3) {
        results = withDistance.filter(p => p.distance <= 10);
      }
      if (results.length === 0) {
        results = withDistance.slice(0, 10);
      }

      setNearbyGardes(results);
    } catch (e) {
      console.error('Erreur localisation garde:', e);
      setLocationError('Impossible de recuperer votre position. Verifiez que le GPS est active.');
    } finally {
      setLocating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="moon" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {/* Background decorative icons */}
        <View style={styles.headerBgIcons} pointerEvents="none">
          <Ionicons name="moon" size={40} color={Colors.accent} style={[styles.bgIcon, { top: -2, right: 25, transform: [{ rotate: '-12deg' }] }]} />
          <Ionicons name="medical" size={30} color={Colors.accent} style={[styles.bgIcon, { top: 10, right: 85, transform: [{ rotate: '18deg' }] }]} />
          <Ionicons name="time" size={34} color={Colors.accent} style={[styles.bgIcon, { bottom: 10, right: 8, transform: [{ rotate: '10deg' }] }]} />
          <Ionicons name="shield-checkmark" size={26} color={Colors.accent} style={[styles.bgIcon, { bottom: 6, right: 60, transform: [{ rotate: '-15deg' }] }]} />
          <Ionicons name="alarm" size={30} color={Colors.accent} style={[styles.bgIcon, { top: 0, right: 145, transform: [{ rotate: '22deg' }] }]} />
        </View>

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.labelCaps}>PHARMACIES</Text>
            <Text style={styles.title}>De Garde</Text>
          </View>
          <View style={styles.statBadge}>
            <Ionicons name="business-outline" size={14} color={Colors.accent} />
            <Text style={styles.statText}>{cities.length}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une ville..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* City List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cityCard}
            onPress={() => router.push(`/pharmacieapp/garde/${encodeURIComponent(item.id)}?name=${encodeURIComponent(item.name)}`)}
            activeOpacity={0.7}
          >
            <View style={styles.cityInitial}>
              <Text style={styles.cityInitialText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={styles.cityInfo}>
              <Text style={styles.cityName}>{item.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.borderLight} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={36} color={Colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Aucune ville trouvee</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Essayez un autre terme' : 'Les villes apparaitront ici'}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.adContainer}>
            <BannerAd unitId={BANNER_AD_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
          </View>
        }
        contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleLocate}
        activeOpacity={0.85}
      >
        <View style={styles.fabIcon}>
          <Ionicons name="locate" size={18} color={'#FFFFFF'} />
        </View>
        <Text style={styles.fabText}>Pharmacie proche</Text>
      </TouchableOpacity>

      {/* Nearby Modal */}
      <Modal
        visible={nearbyModalVisible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setNearbyModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalLabelCaps}>DE GARDE</Text>
                <Text style={styles.modalTitle}>Proches de vous</Text>
                {!locating && !locationError && nearbyGardes.length > 0 && (
                  <Text style={styles.modalSubtitle}>
                    {nearbyGardes.length} pharmacie{nearbyGardes.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setNearbyModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {locating && (
            <View style={styles.modalCentered}>
              <View style={styles.locatingRing}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
              <Text style={styles.modalLoadingText}>Recherche en cours...</Text>
              <Text style={styles.modalLoadingHint}>Pharmacies de garde a proximite</Text>
            </View>
          )}

          {locationError && (
            <View style={styles.modalCentered}>
              <View style={styles.modalErrorIcon}>
                <Ionicons name="location-outline" size={36} color={Colors.error} />
              </View>
              <Text style={styles.modalErrorTitle}>Localisation impossible</Text>
              <Text style={styles.modalErrorText}>{locationError}</Text>
              <TouchableOpacity
                style={styles.modalRetryBtn}
                onPress={handleLocate}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.modalRetryText}>Reessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {!locating && !locationError && (
            <FlatList
              data={nearbyGardes}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.nearbyCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    setNearbyModalVisible(false);
                    setTimeout(() => router.push(`/pharmacieapp/pharmacy/${item.id}`), 300);
                  }}
                >
                  <View style={styles.nearbyCardIcon}>
                    <Ionicons name="medical" size={20} color={'#FFFFFF'} />
                  </View>
                  <View style={styles.nearbyCardInfo}>
                    <Text style={styles.nearbyCardName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.nearbyCardLocation} numberOfLines={1}>
                        {item.zone || '—'} • {item.city || '—'}
                      </Text>
                    </View>
                    <View style={styles.distanceBadge}>
                      <Ionicons name="navigate" size={11} color={Colors.accent} />
                      <Text style={styles.distanceText}>
                        {item.distance < 1
                          ? `${Math.round(item.distance * 1000)} m`
                          : `${item.distance.toFixed(1)} km`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.borderLight} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="moon-outline" size={36} color={Colors.accent} />
                  </View>
                  <Text style={styles.emptyTitle}>Aucune pharmacie de garde</Text>
                  <Text style={styles.emptySubtitle}>
                    Aucune pharmacie de garde trouvee a proximite
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  // Header
  header: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(253,129,0,0.15)',
    overflow: 'hidden',
    position: 'relative',
  },
  headerBgIcons: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgIcon: {
    position: 'absolute',
    opacity: 0.07,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  labelCaps: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.accent,
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.accentContainer,
    letterSpacing: -0.3,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(253,129,0,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginTop: 8,
  },
  statText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentContainer,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },

  // City cards
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.15)',
    ...Shadows.sm,
  },
  cityInitial: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityInitialText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.accent,
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingLeft: 14,
    paddingRight: 20,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    ...Shadows.lg,
    shadowColor: Colors.accent,
  },
  fabIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceContainerHigh,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  modalLabelCaps: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.accent,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.accentContainer,
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 3,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xxxl,
  },
  locatingRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalLoadingText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  modalLoadingHint: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  modalErrorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.errorContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalErrorText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  modalRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    marginTop: 12,
  },
  modalRetryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Nearby cards
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.15)',
    ...Shadows.sm,
  },
  nearbyCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearbyCardInfo: {
    flex: 1,
    gap: 4,
  },
  nearbyCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nearbyCardLocation: {
    fontSize: 13,
    color: Colors.textMuted,
    flexShrink: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentContainer,
  },
  adContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
});
