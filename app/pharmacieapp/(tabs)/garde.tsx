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
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

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

      // 1. Fetch toutes les gardes
      const gardeSnap = await getDocs(collection(db, 'pharmacies_de_garde'));
      const now = Date.now();

      // 2. Filtrer les gardes actives et extraire les pharmacyIds uniques
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

      // 3. Fetch les coordonnees depuis la collection pharmacies
      const pharmacyDocs = await Promise.all(
        Array.from(activePharmacyIds).map(id => getDoc(doc(db, 'pharmacies', id)))
      );

      // 4. Calculer les distances
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
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des villes...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>De Garde</Text>
            <Text style={styles.subtitle}>Pharmacies</Text>
          </View>
          <View style={styles.statBadge}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{cities.length} villes</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cityCard}
            onPress={() => router.push(`/pharmacieapp/garde/${encodeURIComponent(item.id)}?name=${encodeURIComponent(item.name)}`)}
            activeOpacity={0.6}
          >
            <View style={styles.cityIcon}>
              <Ionicons name="location" size={22} color={Colors.primary} />
            </View>
            <View style={styles.cityInfo}>
              <Text style={styles.cityName}>{item.name}</Text>
            </View>
            <View style={styles.chevronContainer}>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Aucune ville trouvee</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Essayez un autre terme' : 'Les villes apparaitront ici'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Locate Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleLocate}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={24} color={Colors.surface} />
      </TouchableOpacity>

      {/* Nearby On-Duty Pharmacies Modal */}
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
                <Text style={styles.modalTitle}>De garde proches</Text>
                {!locating && !locationError && nearbyGardes.length > 0 && (
                  <Text style={styles.modalSubtitle}>
                    {nearbyGardes.length} pharmacie{nearbyGardes.length > 1 ? 's' : ''} trouvee{nearbyGardes.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setNearbyModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {locating && (
            <View style={styles.modalCentered}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.modalLoadingText}>Recherche des pharmacies de garde...</Text>
            </View>
          )}

          {locationError && (
            <View style={styles.modalCentered}>
              <View style={styles.modalErrorIcon}>
                <Ionicons name="location-outline" size={40} color={Colors.error} />
              </View>
              <Text style={styles.modalErrorTitle}>Localisation impossible</Text>
              <Text style={styles.modalErrorText}>{locationError}</Text>
              <TouchableOpacity
                style={styles.modalRetryBtn}
                onPress={handleLocate}
                activeOpacity={0.7}
              >
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
                  activeOpacity={0.6}
                  onPress={() => {
                    setNearbyModalVisible(false);
                    setTimeout(() => router.push(`/pharmacieapp/pharmacy/${item.id}`), 300);
                  }}
                >
                  <View style={styles.nearbyCardIcon}>
                    <Ionicons name="medical" size={20} color={Colors.surface} />
                  </View>
                  <View style={styles.nearbyCardInfo}>
                    <Text style={styles.nearbyCardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.nearbyCardLocation} numberOfLines={1}>
                      {item.zone || '—'} • {item.city || '—'}
                    </Text>
                    <View style={styles.distanceRow}>
                      <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
                      <Text style={styles.distanceText}>
                        {item.distance < 1
                          ? `${Math.round(item.distance * 1000)} m`
                          : `${item.distance.toFixed(1)} km`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.chevronContainer}>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="moon-outline" size={40} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>Aucune pharmacie de garde</Text>
                  <Text style={styles.emptySubtitle}>
                    Aucune pharmacie de garde trouvee a proximite
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cityIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.borderLight,
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
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
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
  modalLoadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  modalErrorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
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
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.sm,
    marginTop: 8,
  },
  modalRetryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surface,
  },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  nearbyCardIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearbyCardInfo: {
    flex: 1,
    gap: 2,
  },
  nearbyCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  nearbyCardLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
