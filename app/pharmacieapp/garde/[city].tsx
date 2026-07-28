import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

interface Zone {
  id: string;
  name: string;
}

interface GardeEntry {
  id: string;
  city: string;
  zone: string;
  startDate: any;
  endDate: any;
  pharmacies: { pharmacyId: string; name: string; phones?: string[]; zone?: string }[];
}

export default function GardeCityScreen() {
  const { city, name, zone: selectedZone } = useLocalSearchParams<{ city: string; name: string; zone?: string }>();
  const router = useRouter();

  const [zones, setZones] = useState<Zone[]>([]);
  const [gardes, setGardes] = useState<GardeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasZones, setHasZones] = useState(false);
  const [searchZone, setSearchZone] = useState('');

  const cityId = city || '';
  const cityName = decodeURIComponent(name || '');
  const zoneName = selectedZone ? decodeURIComponent(selectedZone) : null;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (zoneName) {
          // Mode: afficher les gardes pour une zone specifique
          await fetchGardes();
        } else {
          // Verifier si la ville a des zones/communes
          const zonesSnap = await getDocs(
            query(collection(db, 'zones'), where('cityId', '==', cityId))
          );
          if (zonesSnap.size > 0) {
            const zonesData = zonesSnap.docs
              .map(d => ({ id: d.id, name: d.data().name || '' }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setZones(zonesData);
            setHasZones(true);
          } else {
            // Pas de zones → afficher directement les gardes
            await fetchGardes();
          }
        }
      } catch (e) {
        console.error('Erreur:', e);
      } finally {
        setLoading(false);
      }
    };

    const fetchGardes = async () => {
      const snap = await getDocs(collection(db, 'pharmacies_de_garde'));
      const all = snap.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          city: raw.city || '',
          zone: raw.zone || raw.commune || '',
          startDate: raw.startDate,
          endDate: raw.endDate,
          pharmacies: raw.pharmacies || [],
        } as GardeEntry;
      });

      // Filtrer par nom de ville
      let filtered = all.filter(g => g.city.toUpperCase() === cityName.toUpperCase());

      // Si une zone est selectionnee, filtrer aussi par zone
      if (zoneName) {
        filtered = filtered.filter(g => {
          // Verifier la zone du document ou les zones des pharmacies
          if (g.zone.toUpperCase() === zoneName.toUpperCase()) return true;
          return g.pharmacies.some(p => (p.zone || '').toUpperCase() === zoneName.toUpperCase());
        });
      }

      setGardes(filtered);
    };

    if (cityId) fetchData();
  }, [cityId, zoneName]);

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const isCurrentlyActive = (startDate: any, endDate: any) => {
    const now = Date.now();
    const toMs = (ts: any) => {
      if (!ts) return 0;
      if (ts.toDate) return ts.toDate().getTime();
      if (ts.seconds) return ts.seconds * 1000;
      return new Date(ts).getTime();
    };
    return toMs(startDate) <= now && now <= toMs(endDate);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // === MODE ZONES (communes) ===
  if (hasZones && !zoneName) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{cityName}</Text>
            <Text style={styles.headerSubtitle}>{zones.length} commune{zones.length > 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une commune..."
              placeholderTextColor={Colors.textMuted}
              value={searchZone}
              onChangeText={setSearchZone}
              returnKeyType="search"
            />
            {searchZone.length > 0 && (
              <TouchableOpacity onPress={() => setSearchZone('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={zones.filter(z => !searchZone || z.name.toLowerCase().includes(searchZone.toLowerCase()))}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.zoneCard}
              onPress={() => router.push(
                `/pharmacieapp/garde/${encodeURIComponent(cityId)}?name=${encodeURIComponent(cityName)}&zone=${encodeURIComponent(item.name)}`
              )}
              activeOpacity={0.6}
            >
              <View style={styles.zoneIcon}>
                <Ionicons name="navigate" size={20} color={Colors.primary} />
              </View>
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>{item.name}</Text>
              </View>
              <View style={styles.chevron}>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  // === MODE GARDES ===
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {zoneName || cityName}
          </Text>
          <Text style={styles.headerSubtitle}>
            {zoneName ? cityName + ' • ' : ''}Pharmacies de garde
          </Text>
        </View>
      </View>

      <FlatList
        data={gardes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const active = isCurrentlyActive(item.startDate, item.endDate);
          return (
            <View style={[styles.gardeCard, active && styles.gardeCardActive]}>
              {/* Periode */}
              <View style={styles.periodRow}>
                <View style={[styles.periodBadge, active && styles.periodBadgeActive]}>
                  <Ionicons name="calendar" size={14} color={active ? Colors.surface : Colors.primary} />
                  <Text style={[styles.periodText, active && styles.periodTextActive]}>
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </Text>
                </View>
                {active && (
                  <View style={styles.liveIndicator}>
                    <View style={styles.livePulse} />
                    <Text style={styles.liveText}>En cours</Text>
                  </View>
                )}
              </View>

              {/* Pharmacies */}
              <View style={styles.pharmaciesList}>
                {item.pharmacies.map((p, idx) => (
                  <TouchableOpacity
                    key={p.pharmacyId || idx}
                    style={styles.pharmacyCard}
                    activeOpacity={0.6}
                    onPress={() => p.pharmacyId && router.push(`/pharmacieapp/pharmacy/${p.pharmacyId}`)}
                  >
                    <View style={styles.pharmacyIcon}>
                      <Ionicons name="medical" size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.pharmacyInfo}>
                      <Text style={styles.pharmacyName} numberOfLines={1}>{p.name}</Text>
                      {p.zone && <Text style={styles.pharmacyZone}>{p.zone}</Text>}
                    </View>
                    <View style={styles.pharmacyChevron}>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="moon-outline" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Aucune pharmacie de garde</Text>
            <Text style={styles.emptySubtitle}>
              Pas de garde actuellement pour {zoneName || cityName}
            </Text>
          </View>
        }
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 30, gap: 14 }}
        showsVerticalScrollIndicator={false}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 1,
  },
  // Search
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  // Zone cards
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  zoneIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Garde cards
  gardeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  gardeCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  periodBadgeActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  periodTextActive: {
    color: Colors.surface,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  pharmaciesList: {
    gap: 0,
  },
  pharmacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pharmacyIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmacyInfo: {
    flex: 1,
    gap: 2,
  },
  pharmacyName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  pharmacyZone: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pharmacyChevron: {
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
});
