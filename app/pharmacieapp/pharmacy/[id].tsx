import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, ActivityIndicator, Linking, Image, Platform, Share,
  StatusBar, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_AD_ID } from '@/hooks/ads';

const HERO_HEIGHT = 300;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [assuranceNames, setAssuranceNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchPharmacy = async () => {
      try {
        const [snap, gardeSnap] = await Promise.all([
          getDoc(doc(db, 'pharmacies', id || '')),
          getDocs(collection(db, 'pharmacies_de_garde')),
        ]);
        if (snap.exists()) {
          const pharmaData = { id: snap.id, ...snap.data() } as Pharmacy;
          setPharmacy(pharmaData);

          if (pharmaData.assurances && pharmaData.assurances.length > 0) {
            const assurDocs = await Promise.all(
              pharmaData.assurances.map(aId => getDoc(doc(db, 'insurances', aId)))
            );
            const names = assurDocs
              .filter(d => d.exists())
              .map(d => d.data()?.name || d.id);
            setAssuranceNames(names);
          }
        }
        const now = Date.now();
        const toMs = (ts: any) => {
          if (!ts) return 0;
          if (ts.toDate) return ts.toDate().getTime();
          if (ts.seconds) return ts.seconds * 1000;
          return new Date(ts).getTime();
        };
        const onDuty = gardeSnap.docs.some(d => {
          const raw = d.data();
          if (toMs(raw.startDate) <= now && now <= toMs(raw.endDate)) {
            return (raw.pharmacies || []).some((p: any) => p.pharmacyId === id);
          }
          return false;
        });
        setIsOnDuty(onDuty);
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

  const handleDirections = () => {
    if (!pharmacy?.location) return;
    const { latitude, longitude } = pharmacy.location;
    const label = encodeURIComponent(pharmacy.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url!);
  };

  const handleShare = async () => {
    if (!pharmacy) return;
    try {
      await Share.share({
        message: `${pharmacy.name} — ${pharmacy.zone || ''}, ${pharmacy.city || ''}\n${pharmacy.phones?.[0] ? 'Tel: ' + pharmacy.phones[0] : ''}`,
      });
    } catch (_) {}
  };

  // Parallax transforms
  const heroTranslateY = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
    outputRange: [-HERO_HEIGHT / 2, 0, HERO_HEIGHT * 0.4],
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0],
    outputRange: [2, 1],
    extrapolateRight: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.6],
    outputRange: [1, 0.3],
    extrapolate: 'clamp',
  });
  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.5],
    outputRange: [0.4, 0.8],
    extrapolate: 'clamp',
  });
  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.5],
    outputRange: [0, -30],
    extrapolate: 'clamp',
  });
  const backBtnOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!pharmacy) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.floatingHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={[styles.floatingTitle, { color: Colors.text }]}>Pharmacie introuvable</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Parallax Hero */}
      <Animated.View
        style={[
          styles.heroContainer,
          {
            transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
          },
        ]}
      >
        {pharmacy.image ? (
          <Animated.Image
            source={{ uri: pharmacy.image }}
            style={[styles.heroImage, { opacity: heroOpacity }]}
            resizeMode="cover"
          />
        ) : (
          <Animated.View style={[styles.heroPlaceholder, { opacity: heroOpacity }]}>
            <View style={styles.heroPlaceholderBg} pointerEvents="none">
              <Ionicons name="medical" size={80} color={Colors.primary} style={{ opacity: 0.08, position: 'absolute', top: 40, left: 30, transform: [{ rotate: '15deg' }] }} />
              <Ionicons name="heart" size={50} color={Colors.primary} style={{ opacity: 0.06, position: 'absolute', top: 80, right: 40, transform: [{ rotate: '-10deg' }] }} />
              <Ionicons name="fitness" size={60} color={Colors.primary} style={{ opacity: 0.05, position: 'absolute', bottom: 50, left: 60, transform: [{ rotate: '25deg' }] }} />
              <Ionicons name="pulse" size={55} color={Colors.primary} style={{ opacity: 0.07, position: 'absolute', bottom: 40, right: 80, transform: [{ rotate: '8deg' }] }} />
            </View>
            <View style={styles.heroPlaceholderIcon}>
              <Ionicons name="medical" size={44} color={Colors.primary} />
            </View>
          </Animated.View>
        )}
        {/* Google attribution */}
        {pharmacy.image && (
          <View style={styles.googleBadge}>
            <Text style={styles.googleBadgeText}>Image générée par Google</Text>
          </View>
        )}

        {/* Dark gradient overlay */}
        <Animated.View style={[styles.heroOverlay, { opacity: overlayOpacity }]} />

        {/* Hero content */}
        <Animated.View
          style={[
            styles.heroContent,
            { paddingBottom: 24, transform: [{ translateY: titleTranslateY }] },
          ]}
        >
          {isOnDuty && (
            <View style={styles.heroBadge}>
              <Ionicons name="moon" size={12} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>DE GARDE</Text>
            </View>
          )}
          <Text style={styles.heroName} numberOfLines={2}>{pharmacy.name}</Text>
          <View style={styles.heroLocationRow}>
            <Ionicons name="location" size={15} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroLocationText}>
              {pharmacy.zone || '—'}, {pharmacy.city || '—'}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Floating back button */}
      <Animated.View style={[styles.floatingBackBtn, { top: insets.top + 8, opacity: backBtnOpacity }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Scrollable content */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: HERO_HEIGHT, paddingBottom: 40 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <View style={styles.scrollContent}>
        {/* On duty banner */}
        {isOnDuty && (
          <View style={styles.onDutyBanner}>
            <View style={styles.onDutyBannerDot} />
            <Ionicons name="moon" size={14} color={Colors.accent} />
            <Text style={styles.onDutyBannerText}>Pharmacie de garde</Text>
          </View>
        )}

        {/* Call Button - Full Width */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.callBtn}
            activeOpacity={0.8}
            onPress={() => pharmacy.phones?.[0] && handleCall(pharmacy.phones[0])}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" />
            <Text style={styles.callBtnText}>Appeler</Text>
            {pharmacy.phones?.[0] && (
              <Text style={styles.callBtnPhone}>{pharmacy.phones[0]}</Text>
            )}
          </TouchableOpacity>

          {/* Secondary actions */}
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={handleDirections}
              disabled={!pharmacy.location}
            >
              <View style={[styles.actionCircle, !pharmacy.location && styles.actionCircleDisabled]}>
                <Ionicons name="navigate" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Itinéraire</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={handleShare}
            >
              <View style={styles.actionCircle}>
                <Ionicons name="share-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Partager</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Map Section */}
        {pharmacy.location && pharmacy.location.latitude != null && pharmacy.location.longitude != null && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LOCALISATION</Text>
            <TouchableOpacity
              style={styles.mapCard}
              activeOpacity={0.8}
              onPress={handleDirections}
            >
              <View style={styles.mapPreview}>
                <View style={styles.mapGrid}>
                  <View style={styles.mapGridLine} />
                  <View style={[styles.mapGridLine, { transform: [{ rotate: '90deg' }] }]} />
                  <View style={[styles.mapGridLine, { transform: [{ rotate: '45deg' }] }]} />
                  <View style={[styles.mapGridLine, { transform: [{ rotate: '135deg' }] }]} />
                </View>
                <View style={styles.mapPin}>
                  <Ionicons name="location" size={22} color={'#FFFFFF'} />
                </View>
                <Text style={styles.mapCoords}>
                  {pharmacy.location.latitude.toFixed(4)}, {pharmacy.location.longitude.toFixed(4)}
                </Text>
              </View>
              <View style={styles.mapFooter}>
                <View style={styles.mapFooterLeft}>
                  <Ionicons name="navigate" size={14} color={Colors.primary} />
                  <Text style={styles.mapFooterText}>Ouvrir dans Maps</Text>
                </View>
                <Ionicons name="open-outline" size={14} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Phones */}
        {pharmacy.phones && pharmacy.phones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TELEPHONES</Text>
            <View style={styles.phonesList}>
              {pharmacy.phones.map((phone, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.phoneCard}
                  onPress={() => handleCall(phone)}
                  activeOpacity={0.7}
                >
                  <View style={styles.phoneIconContainer}>
                    <Ionicons name="call" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.phoneInfo}>
                    <Text style={styles.phoneLabel}>Ligne {idx + 1}</Text>
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
            <Text style={styles.sectionLabel}>PHARMACIEN</Text>
            <View style={styles.infoCard}>
              <View style={styles.doctorAvatar}>
                <Ionicons name="person" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.doctorName}>{pharmacy.doctor_name}</Text>
            </View>
          </View>
        ) : null}

        {/* Assurances */}
        {assuranceNames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ASSURANCES ACCEPTEES</Text>
            <View style={styles.tagsList}>
              {assuranceNames.map((name, idx) => (
                <View key={idx} style={styles.tag}>
                  <Ionicons name="shield-checkmark" size={13} color={Colors.primary} />
                  <Text style={styles.tagText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {pharmacy.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <View style={styles.descCard}>
              <Text style={styles.descText}>{pharmacy.description}</Text>
            </View>
          </View>
        ) : null}

        {/* Banner Ad */}
        <View style={styles.adContainer}>
          <BannerAd
            unitId={BANNER_AD_ID}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          />
        </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    backgroundColor: Colors.background,
    minHeight: '100%',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // Floating header (not found state)
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  floatingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },

  // Floating back button
  floatingBackBtn: {
    position: 'absolute',
    left: Spacing.lg,
    zIndex: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero parallax
  heroContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: Colors.primaryLight,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPlaceholderBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  heroPlaceholderIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: '#000',
  },
  googleBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 5,
  },
  googleBadgeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginBottom: 10,
    ...Shadows.md,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroLocationText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },

  // On duty banner
  onDutyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  onDutyBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  onDutyBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accentContainer,
  },

  // Action buttons grid
  actionsContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 12,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    ...Shadows.md,
  },
  callBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  callBtnPhone: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.2)',
    ...Shadows.sm,
  },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCircleDisabled: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 12,
  },

  // Map
  mapCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.2)',
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.sm,
  },
  mapPreview: {
    height: 150,
    backgroundColor: Colors.surfaceContainerLow,
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
    opacity: 0.08,
  },
  mapGridLine: {
    position: 'absolute',
    width: '150%',
    height: 1,
    backgroundColor: Colors.primary,
  },
  mapPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
    marginBottom: 6,
  },
  mapCoords: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
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

  // Phones
  phonesList: {
    gap: 8,
  },
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.2)',
    ...Shadows.sm,
  },
  phoneIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInfo: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  phoneAction: {
    marginLeft: 8,
  },

  // Doctor
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.2)',
    ...Shadows.sm,
  },
  doctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },

  // Tags
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.2)',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },

  // Description
  descCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(189,202,186,0.2)',
    ...Shadows.sm,
  },
  descText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  adContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
});
