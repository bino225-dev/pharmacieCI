import React, { useEffect, useState, useCallback } from 'react';
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
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

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

  const fetchPharmacies = async () => {
    try {
      const snap = await getDocs(collection(db, 'pharmacies'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Pharmacy));
      setPharmacies(data.sort((a, b) => a.name.localeCompare(b.name)));
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

  const onDutyCount = pharmacies.filter(p => p.is_on_duty).length;

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
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement des pharmacies...</Text>
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
            <Text style={styles.title}>Annuaire</Text>
            <Text style={styles.subtitle}>Pharmacies</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Ionicons name="medical" size={14} color={Colors.primary} />
              <Text style={styles.statText}>{pharmacies.length}</Text>
            </View>
            {onDutyCount > 0 && (
              <View style={[styles.statBadge, styles.statBadgeActive]}>
                <View style={styles.liveDot} />
                <Text style={[styles.statText, { color: '#059669' }]}>{onDutyCount} de garde</Text>
              </View>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par nom, commune ou ville..."
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
            activeOpacity={0.6}
            onPress={() => router.push(`/pharmacieapp/pharmacy/${item.id}`)}
          >
            <View style={[styles.cardIcon, item.is_on_duty && styles.cardIconActive]}>
              <Ionicons
                name="medical"
                size={20}
                color={item.is_on_duty ? Colors.surface : Colors.primary}
              />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.pharmacyName} numberOfLines={1}>{item.name}</Text>
                {item.is_on_duty && (
                  <View style={styles.onDutyBadge}>
                    <Text style={styles.onDutyText}>De garde</Text>
                  </View>
                )}
              </View>
              <Text style={styles.pharmacyLocation} numberOfLines={1}>
                {item.zone || '—'} • {item.city || '—'}
              </Text>
            </View>
            <View style={styles.chevronContainer}>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="medical-outline" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Aucune pharmacie trouvee</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Essayez un autre terme de recherche' : 'Les pharmacies apparaitront ici'}
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

      {/* Nearby Pharmacies Modal */}
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
                <Text style={styles.modalTitle}>Pharmacies proches</Text>
                {!locating && !locationError && nearbyPharmacies.length > 0 && (
                  <Text style={styles.modalSubtitle}>
                    {nearbyPharmacies.length} pharmacie{nearbyPharmacies.length > 1 ? 's' : ''} trouvee{nearbyPharmacies.length > 1 ? 's' : ''}
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
              <Text style={styles.modalLoadingText}>Recherche de votre position...</Text>
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
              data={nearbyPharmacies}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.6}
                  onPress={() => {
                    setNearbyModalVisible(false);
                    setTimeout(() => router.push(`/pharmacieapp/pharmacy/${item.id}`), 300);
                  }}
                >
                  <View style={[styles.cardIcon, item.is_on_duty && styles.cardIconActive]}>
                    <Ionicons
                      name="medical"
                      size={20}
                      color={item.is_on_duty ? Colors.surface : Colors.primary}
                    />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.pharmacyName} numberOfLines={1}>{item.name}</Text>
                      {item.is_on_duty && (
                        <View style={styles.onDutyBadge}>
                          <Text style={styles.onDutyText}>De garde</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.pharmacyLocation} numberOfLines={1}>
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
                    <Ionicons name="location-outline" size={40} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>Aucune pharmacie a proximite</Text>
                  <Text style={styles.emptySubtitle}>
                    Aucune pharmacie trouvee dans un rayon de 10 km
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  statBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  searchContainer: {
    marginBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
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
  resultCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconActive: {
    backgroundColor: Colors.primary,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
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
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  onDutyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pharmacyLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
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
