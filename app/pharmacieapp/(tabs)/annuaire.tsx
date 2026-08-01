import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Platform,
  RefreshControl, Modal,
} from 'react-native';
import * as Location from 'expo-location';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_AD_ID, showInterstitial } from '@/hooks/ads';

interface Pharmacy {
  id: string;
  name: string;
  city: string;
  zone: string;
  phones: string[];
  is_on_duty: boolean;
  description?: string;
  doctor_name?: string;
  assurances?: string[];
  location?: { latitude: number; longitude: number };
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (ts.toDate) return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
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

export default function AnnuaireScreen() {
  const router = useRouter();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyModalVisible, setNearbyModalVisible] = useState(false);
  const [nearbyPharmacies, setNearbyPharmacies] = useState<(Pharmacy & { distance: number })[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [onDutyIds, setOnDutyIds] = useState<Set<string>>(new Set());
  const clickCount = useRef(0);

  const fetchPharmacies = async () => {
    try {
      const [pharmaSnap, gardeSnap] = await Promise.all([
        getDocs(collection(db, 'pharmacies')),
        getDocs(collection(db, 'pharmacies_de_garde')),
      ]);

      const data = pharmaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Pharmacy));
      setPharmacies(data.sort((a, b) => a.name.localeCompare(b.name)));

      // Extraire les pharmacyIds actuellement de garde
      const now = Date.now();
      const activeIds = new Set<string>();
      gardeSnap.docs.forEach(d => {
        const raw = d.data();
        if (toMs(raw.startDate) <= now && now <= toMs(raw.endDate)) {
          (raw.pharmacies || []).forEach((p: any) => {
            if (p.pharmacyId) activeIds.add(p.pharmacyId);
          });
        }
      });
      setOnDutyIds(activeIds);
    } catch (e) {
      console.error('Erreur chargement pharmacies:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPharmacies();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPharmacies();
  }, []);

  const filtered = pharmacies.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.zone || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q)
    );
  });

  const onDutyCount = onDutyIds.size;

  const handleCall = (phone: string) => {
    const cleaned = phone.replace(/\s/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  const handleLocate = async () => {
    setLocating(true);
    setLocationError(null);
    setNearbyPharmacies([]);
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

      const withDistance = pharmacies
        .filter(p => p.location?.latitude && p.location?.longitude)
        .map(p => ({
          ...p,
          distance: getDistanceKm(userLat, userLon, p.location!.latitude, p.location!.longitude),
        }))
        .sort((a, b) => a.distance - b.distance);

      let results = withDistance.filter(p => p.distance <= 5);
      if (results.length < 3) {
        results = withDistance.filter(p => p.distance <= 10);
      }
      if (results.length === 0) {
        results = withDistance.slice(0, 10);
      }

      setNearbyPharmacies(results);
    } catch (e) {
      console.error('Erreur localisation:', e);
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
            <Ionicons name="medical" size={28} color={Colors.primary} />
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
          <Ionicons name="medical" size={44} color={Colors.primary} style={[styles.bgIcon, { top: -4, right: 30, transform: [{ rotate: '15deg' }] }]} />
          <Ionicons name="heart" size={28} color={Colors.primary} style={[styles.bgIcon, { top: 8, right: 90, transform: [{ rotate: '-10deg' }] }]} />
          <Ionicons name="fitness" size={32} color={Colors.primary} style={[styles.bgIcon, { bottom: 12, right: 10, transform: [{ rotate: '25deg' }] }]} />
          <Ionicons name="bandage" size={26} color={Colors.primary} style={[styles.bgIcon, { bottom: 4, right: 65, transform: [{ rotate: '-20deg' }] }]} />
          <Ionicons name="pulse" size={36} color={Colors.primary} style={[styles.bgIcon, { top: 2, right: 140, transform: [{ rotate: '8deg' }] }]} />
        </View>

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.labelCaps}>ANNUAIRE</Text>
            <Text style={styles.title}>Pharmacies</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statNumber}>{pharmacies.length}</Text>
            </View>
            {onDutyCount > 0 && (
              <View style={styles.statBadgeGarde}>
                <View style={styles.liveDot} />
                <Text style={styles.statTextGarde}>{onDutyCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nom, commune ou ville..."
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

        {search.length > 0 && (
          <Text style={styles.resultCount}>
            {filtered.length} resultat{filtered.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => {
              clickCount.current += 1;
              if (clickCount.current % 3 === 0) {
                showInterstitial();
              }
              router.push(`/pharmacieapp/pharmacy/${item.id}`);
            }}
          >
            <View style={[styles.cardIcon, onDutyIds.has(item.id) && styles.cardIconActive]}>
              <Ionicons
                name="medical"
                size={20}
                color={onDutyIds.has(item.id) ? '#FFFFFF' : Colors.primary}
              />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                {onDutyIds.has(item.id) && (
                  <View style={styles.onDutyBadge}>
                    <View style={styles.onDutyDot} />
                    <Text style={styles.onDutyText}>GARDE</Text>
                  </View>
                )}
                <Text style={styles.pharmacyName} numberOfLines={1}>{item.name}</Text>
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.pharmacyLocation} numberOfLines={1}>
                  {item.zone || '—'} • {item.city || '—'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.borderLight} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="medical-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Aucune pharmacie trouvee</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Essayez un autre terme de recherche' : 'Les pharmacies apparaitront ici'}
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
                <Text style={styles.modalLabelCaps}>A PROXIMITE</Text>
                <Text style={styles.modalTitle}>Pharmacies proches</Text>
                {!locating && !locationError && nearbyPharmacies.length > 0 && (
                  <Text style={styles.modalSubtitle}>
                    {nearbyPharmacies.length} resultat{nearbyPharmacies.length > 1 ? 's' : ''}
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
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
              <Text style={styles.modalLoadingText}>Recherche en cours...</Text>
              <Text style={styles.modalLoadingHint}>Activation du GPS</Text>
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
              data={nearbyPharmacies}
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
                  <View style={[styles.cardIcon, onDutyIds.has(item.id) && styles.cardIconActive]}>
                    <Ionicons
                      name="medical"
                      size={20}
                      color={onDutyIds.has(item.id) ? '#FFFFFF' : Colors.primary}
                    />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      {onDutyIds.has(item.id) && (
                        <View style={styles.onDutyBadge}>
                          <View style={styles.onDutyDot} />
                          <Text style={styles.onDutyText}>GARDE</Text>
                        </View>
                      )}
                      <Text style={styles.pharmacyName} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.pharmacyLocation} numberOfLines={1}>
                        {item.zone || '—'} • {item.city || '—'}
                      </Text>
                    </View>
                    <View style={styles.distanceBadge}>
                      <Ionicons name="navigate" size={11} color={Colors.primary} />
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
                    <Ionicons name="location-outline" size={36} color={Colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>Aucune pharmacie a proximite</Text>
                  <Text style={styles.emptySubtitle}>
                    Aucune pharmacie trouvee dans un rayon de 10 km
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
    backgroundColor: Colors.primaryLight,
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
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,107,47,0.1)',
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
    opacity: 0.06,
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
    color: Colors.primary,
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: -0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statBadge: {
    backgroundColor: 'rgba(0,107,47,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  statNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  statBadgeGarde: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  statTextGarde: {
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
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  resultCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: 0.3,
  },

  // Cards
  card: {
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
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconActive: {
    backgroundColor: Colors.primaryContainer,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pharmacyName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  onDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  onDutyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  onDutyText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pharmacyLocation: {
    fontSize: 13,
    color: Colors.textMuted,
    flexShrink: 1,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 10,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
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
    textAlign: 'center',
    paddingHorizontal: Spacing.xxxl,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    paddingLeft: 14,
    paddingRight: 20,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    ...Shadows.lg,
    shadowColor: Colors.primary,
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
    color: Colors.primary,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primaryDark,
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
    backgroundColor: Colors.primaryLight,
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
    lineHeight: 18,
  },
  modalRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
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

  // Nearby card
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
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  adContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
});
