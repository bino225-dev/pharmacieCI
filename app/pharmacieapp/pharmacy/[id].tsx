import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Image, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

interface Pharmacy {
  id: string;
  name: string;
  city: string;
  zone: string;
  phones: string[];
  is_on_duty: boolean;
  description: string;
  doctor_name: string;
  image: string;
  assurances: string[];
  location?: { latitude: number; longitude: number };
}

export default function PharmacyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPharmacy = async () => {
      try {
        const snap = await getDoc(doc(db, 'pharmacies', id || ''));
        if (snap.exists()) {
          setPharmacy({ id: snap.id, ...snap.data() } as Pharmacy);
        }
      } catch (e) {
        console.error('Erreur chargement pharmacie:', e);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPharmacy();
  }, [id]);

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

  if (!pharmacy) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pharmacie introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>Details</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{pharmacy.name}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Image */}
        {pharmacy.image ? (
          <Image source={{ uri: pharmacy.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="medical" size={48} color={Colors.textMuted} />
          </View>
        )}

        {/* Name + Status */}
        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{pharmacy.name}</Text>
            {pharmacy.is_on_duty && (
              <View style={styles.onDutyBadge}>
                <View style={styles.onDutyDot} />
                <Text style={styles.onDutyText}>De garde</Text>
              </View>
            )}
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.locationText}>
              {pharmacy.zone || '—'} • {pharmacy.city || '—'}
            </Text>
          </View>
        </View>

        {/* Mini Map */}
        {pharmacy.location && pharmacy.location.latitude && pharmacy.location.longitude && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Localisation</Text>
            <TouchableOpacity
              style={styles.mapContainer}
              activeOpacity={0.8}
              onPress={() => {
                const { latitude, longitude } = pharmacy.location!;
                const label = encodeURIComponent(pharmacy.name);
                const url = Platform.select({
                  ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
                  android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
                  default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
                });
                Linking.openURL(url!);
              }}
            >
              <View style={styles.mapPreview}>
                <View style={styles.mapGrid}>
                  <View style={styles.mapGridLine} />
                  <View style={[styles.mapGridLine, { transform: [{ rotate: '90deg' }] }]} />
                  <View style={[styles.mapGridLine, { transform: [{ rotate: '45deg' }] }]} />
                  <View style={[styles.mapGridLine, { transform: [{ rotate: '135deg' }] }]} />
                </View>
                <View style={styles.mapPin}>
                  <Ionicons name="location" size={24} color={Colors.surface} />
                </View>
                <Text style={styles.mapCoords}>
                  {pharmacy.location.latitude.toFixed(4)}, {pharmacy.location.longitude.toFixed(4)}
                </Text>
              </View>
              <View style={styles.mapFooter}>
                <View style={styles.mapFooterLeft}>
                  <Ionicons name="navigate" size={16} color={Colors.primary} />
                  <Text style={styles.mapFooterText}>Ouvrir dans Maps</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Phones */}
        {pharmacy.phones && pharmacy.phones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Telephones</Text>
            <View style={styles.phonesList}>
              {pharmacy.phones.map((phone, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.phoneCard}
                  onPress={() => handleCall(phone)}
                  activeOpacity={0.7}
                >
                  <View style={styles.phoneIcon}>
                    <Ionicons name="call" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.phoneInfo}>
                    <Text style={styles.phoneLabel}>Numero {idx + 1}</Text>
                    <Text style={styles.phoneNumber}>{phone}</Text>
                  </View>
                  <View style={styles.phoneAction}>
                    <Ionicons name="arrow-forward-circle" size={24} color={Colors.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Doctor */}
        {pharmacy.doctor_name ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pharmacien</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="person" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.infoText}>{pharmacy.doctor_name}</Text>
            </View>
          </View>
        ) : null}

        {/* Assurances */}
        {pharmacy.assurances && pharmacy.assurances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assurances acceptees</Text>
            <View style={styles.tagsList}>
              {pharmacy.assurances.map((a, idx) => (
                <View key={idx} style={styles.tag}>
                  <Ionicons name="shield-checkmark" size={13} color={Colors.primary} />
                  <Text style={styles.tagText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {pharmacy.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.descCard}>
              <Text style={styles.descText}>{pharmacy.description}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
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
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 1,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.borderLight,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameSection: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  onDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  onDutyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  onDutyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  mapContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  mapPreview: {
    height: 160,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapGrid: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.15,
  },
  mapGridLine: {
    position: 'absolute',
    width: '150%',
    height: 1,
    backgroundColor: Colors.primary,
  },
  mapPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 6,
  },
  mapCoords: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mapFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  phonesList: {
    gap: 8,
  },
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phoneIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInfo: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 1,
  },
  phoneAction: {
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  descCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
