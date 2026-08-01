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
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

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
          await fetchGardes();
        } else {
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

      let filtered = all.filter(g => {
        if (g.city.toUpperCase() === cityName.toUpperCase()) return true;
        if (g.zone.toUpperCase() === cityName.toUpperCase()) return true;
        return g.pharmacies.some(p => (p.zone || '').toUpperCase() === cityName.toUpperCase());
      });

      if (zoneName) {
        filtered = filtered.filter(g => {
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

  // === MODE ZONES ===
  if (hasZones && !zoneName) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerLabelCaps}>COMMUNES</Text>
            <Text style={styles.headerTitle}>{cityName}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{zones.length}</Text>
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
              activeOpacity={0.7}
            >
              <View style={styles.zoneInitial}>
                <Text style={styles.zoneInitialText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>{item.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.borderLight} />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 20 }}
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
          <Text style={styles.headerLabelCaps}>
            {zoneName ? cityName : 'PHARMACIES DE GARDE'}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {zoneName || cityName}
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
              {/* Period */}
              <View style={styles.periodRow}>
                <View style={[styles.periodBadge, active && styles.periodBadgeActive]}>
                  <Ionicons name="calendar-outline" size={13} color={active ? '#FFFFFF' : Colors.textSecondary} />
                  <Text style={[styles.periodText, active && styles.periodTextActive]}>
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </Text>
                </View>
                {active && (
                  <View style={styles.liveIndicator}>
                    <View style={styles.livePulse} />
                    <Text style={styles.liveText}>EN COURS</Text>
                  </View>
                )}
              </View>

              {/* Pharmacies */}
              <View style={styles.pharmaciesList}>
                {item.pharmacies.map((p, idx) => (
                  <TouchableOpacity
                    key={p.pharmacyId || idx}
                    style={[
                      styles.pharmacyCard,
                      idx === item.pharmacies.length - 1 && styles.pharmacyCardLast,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => p.pharmacyId && router.push(`/pharmacieapp/pharmacy/${p.pharmacyId}`)}
                  >
                    <View style={[styles.pharmacyIcon, active && styles.pharmacyIconActive]}>
                      <Ionicons name="medical" size={18} color={active ? '#FFFFFF' : Colors.primary} />
                    </View>
                    <View style={styles.pharmacyInfo}>
                      <Text style={styles.pharmacyName} numberOfLines={1}>{p.name}</Text>
                      {p.zone && <Text style={styles.pharmacyZone}>{p.zone}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.borderLight} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="moon-outline" size={36} color={Colors.textMuted} />
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerLabelCaps: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.accent,
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerBadge: {
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceContainerLow,
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
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.15)',
    ...Shadows.sm,
  },
  zoneInitial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneInitialText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },

  // Garde cards
  gardeCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.15)',
    ...Shadows.sm,
  },
  gardeCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 1,
  },
  periodBadgeActive: {
    backgroundColor: Colors.primaryContainer,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  periodTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 8,
  },
  livePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  pharmaciesList: {
    gap: 0,
  },
  pharmacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pharmacyCardLast: {
    borderBottomWidth: 0,
  },
  pharmacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmacyIconActive: {
    backgroundColor: Colors.primaryContainer,
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
    color: Colors.textMuted,
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
    backgroundColor: Colors.surfaceContainerHigh,
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
