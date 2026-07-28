# Architecture — App Mobile Pharmacie

Application mobile grand public avec **2 onglets** pour consulter les pharmacies et les pharmacies de garde.

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────┐
│              App Pharmacie              │
├───────────────────┬─────────────────────┤
│   Tab Annuaire    │  Tab Garde          │
│                   │                     │
│ - Liste toutes    │ - Liste villes /    │
│   les pharmacies  │   communes          │
│ - Recherche par   │ - Clic → affiche    │
│   nom, commune,   │   pharmacies de     │
│   ville           │   garde associees   │
│ - Bouton appeler  │ - Details periode   │
│                   │   + telephones      │
└───────────────────┴─────────────────────┘
```

---

## 2. Structure des fichiers a creer

Tout se passe dans un nouveau dossier `app/pharmacieapp/` :

```
app/
├── _layout.tsx                          # (existant) — ajouter la route pharmacieapp
├── pharmacieapp/
│   ├── _layout.tsx                      # Layout avec Bottom Tabs (2 onglets)
│   ├── (tabs)/
│   │   ├── _layout.tsx                  # Configuration des 2 tabs
│   │   ├── annuaire.tsx                 # Tab 1 : Annuaire pharmacies
│   │   └── garde.tsx                    # Tab 2 : Pharmacies de garde
│   └── garde/
│       └── [city].tsx                   # Detail : pharmacies de garde d'une ville/commune
```

**Total : 5 fichiers a creer + 1 fichier a modifier**

---

## 3. Collections Firestore utilisees

### `pharmacies`
```js
{
  name: "Pharmacie du Centre",     // string — nom
  city: "Abidjan",                 // string — ville
  zone: "Cocody",                  // string — commune / quartier
  phones: ["07 68 66 82 16"],      // string[] — numeros de telephone
  is_on_duty: false,               // boolean
  location: { lat, lng },          // GeoPoint (optionnel)
  description: "...",              // string
  image: "https://...",            // string — URL image
  assurances: ["CNAM", ...],      // string[]
  doctor_name: "Dr. Konan"        // string
}
```

### `pharmacies_de_garde`
```js
{
  city: "Abidjan",                 // string — ville
  zone: "Cocody",                  // string — commune (peut etre vide)
  startDate: Timestamp,            // debut de la periode de garde
  endDate: Timestamp,              // fin de la periode de garde
  pharmacies: [                    // liste des pharmacies de garde
    {
      pharmacyId: "abc123",
      name: "Pharmacie du Centre",
      phones: ["07 68 66 82 16"],
      zone: "Cocody"
    }
  ],
  createdAt: Timestamp
}
```

### `cities`
```js
{ name: "Abidjan" }               // string — nom de la ville
```

### `zones`
```js
{ name: "Cocody" }                 // string — nom de la commune/zone
```

---

## 4. Integration pas a pas

### Etape 1 — Modifier le layout racine

**Fichier : `app/_layout.tsx`**

Ajouter la route `pharmacieapp` dans le Stack existant :

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { Provider } from 'react-redux';
import { store } from '@/store';

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: '#4CAF50', background: '#ffffff' },
};

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PaperProvider theme={theme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="pharmacieapp" options={{ headerShown: false }} />
          <Stack.Screen name="restrictmode" options={{ headerShown: false }} />
          <Stack.Screen name="admin1987" options={{ headerShown: false }} />
          <Stack.Screen name="unauthorized" options={{ headerShown: false }} />
          <Stack.Screen name="assistance" options={{ headerShown: false }} />
        </Stack>
      </PaperProvider>
    </Provider>
  );
}
```

---

### Etape 2 — Creer le layout principal de l'app

**Fichier : `app/pharmacieapp/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function PharmacieAppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

### Etape 3 — Creer le layout avec Bottom Tabs

**Fichier : `app/pharmacieapp/(tabs)/_layout.tsx`**

C'est ici que les 2 onglets sont definis. La dependance `@react-navigation/bottom-tabs` est deja installee.

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#27AE60',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="annuaire"
        options={{
          title: 'Annuaire',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="garde"
        options={{
          title: 'De Garde',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="moon" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

### Etape 4 — Tab Annuaire (liste + recherche + appel)

**Fichier : `app/pharmacieapp/(tabs)/annuaire.tsx`**

Fonctionnalites :
- Charge toutes les pharmacies depuis Firestore (`pharmacies`)
- Barre de recherche qui filtre par **nom**, **commune** (zone) ou **ville** (city)
- Chaque pharmacie affiche : nom, commune, ville
- Bouton **Appeler** devant chaque pharmacie (ouvre le dialer avec `Linking.openURL('tel:...')`)

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

interface Pharmacy {
  id: string;
  name: string;
  city: string;
  zone: string;
  phones: string[];
}

export default function AnnuaireScreen() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'pharmacies'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Pharmacy));
      setPharmacies(data.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    };
    fetch();
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

  const handleCall = (phone: string) => {
    const cleaned = phone.replace(/\s/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#27AE60" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Annuaire Pharmacies</Text>
        <Text style={styles.subtitle}>{pharmacies.length} pharmacies</Text>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom, commune ou ville..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.pharmacyName}>{item.name}</Text>
              <Text style={styles.pharmacyLocation}>
                {item.zone || '—'} • {item.city || '—'}
              </Text>
            </View>
            {item.phones && item.phones.length > 0 && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(item.phones[0])}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.callText}>Appeler</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Aucune pharmacie trouvee</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12, backgroundColor: '#f5f5f5',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#333' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  cardInfo: { flex: 1 },
  pharmacyName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  pharmacyLocation: { fontSize: 13, color: '#888', marginTop: 2 },
  callButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#27AE60', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  callText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#999' },
});
```

---

### Etape 5 — Tab Pharmacies de Garde (liste villes/communes)

**Fichier : `app/pharmacieapp/(tabs)/garde.tsx`**

Fonctionnalites :
- Charge les entrees de `pharmacies_de_garde` actives (ou `startDate <= maintenant <= endDate`)
- Affiche la liste des villes/communes disponibles
- Clic sur une ville/commune → navigue vers le detail

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface GardeEntry {
  id: string;
  city: string;
  zone: string;
  startDate: any;
  endDate: any;
  pharmacies: { pharmacyId: string; name: string; phones?: string[]; zone?: string }[];
}

export default function GardeScreen() {
  const router = useRouter();
  const [gardes, setGardes] = useState<GardeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const q = query(collection(db, 'pharmacies_de_garde'), orderBy('startDate', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as GardeEntry));
      setGardes(data);
      setLoading(false);
    };
    fetch();
  }, []);

  // Grouper par ville avec le nombre de pharmacies de garde
  const cityMap = new Map<string, { count: number; zones: Set<string> }>();
  gardes.forEach(g => {
    const key = g.city;
    if (!cityMap.has(key)) {
      cityMap.set(key, { count: 0, zones: new Set() });
    }
    const entry = cityMap.get(key)!;
    entry.count += g.pharmacies.length;
    if (g.zone) entry.zones.add(g.zone);
  });

  const cityList = [...cityMap.entries()]
    .map(([city, info]) => ({
      city,
      pharmacyCount: info.count,
      zones: [...info.zones].sort(),
    }))
    .sort((a, b) => a.city.localeCompare(b.city));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#27AE60" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pharmacies de Garde</Text>
        <Text style={styles.subtitle}>
          Selectionnez une ville pour voir les pharmacies de garde
        </Text>
      </View>

      <FlatList
        data={cityList}
        keyExtractor={item => item.city}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cityCard}
            onPress={() => router.push(`/pharmacieapp/garde/${encodeURIComponent(item.city)}`)}
            activeOpacity={0.7}
          >
            <View style={styles.cityIcon}>
              <Ionicons name="location" size={22} color="#27AE60" />
            </View>
            <View style={styles.cityInfo}>
              <Text style={styles.cityName}>{item.city}</Text>
              <Text style={styles.cityDetail}>
                {item.pharmacyCount} pharmacie{item.pharmacyCount > 1 ? 's' : ''} de garde
                {item.zones.length > 0 ? ` • ${item.zones.join(', ')}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="moon-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Aucune pharmacie de garde actuellement</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  cityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  cityIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center',
  },
  cityInfo: { flex: 1 },
  cityName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  cityDetail: { fontSize: 13, color: '#888', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#999' },
});
```

---

### Etape 6 — Page detail : pharmacies de garde par ville

**Fichier : `app/pharmacieapp/garde/[city].tsx`**

Fonctionnalites :
- Recoit le nom de la ville via le parametre dynamique `[city]`
- Charge les gardes filtrees par cette ville
- Affiche les periodes avec la liste des pharmacies + boutons appeler

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/hooks/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

interface GardeEntry {
  id: string;
  city: string;
  zone: string;
  startDate: any;
  endDate: any;
  pharmacies: { pharmacyId: string; name: string; phones?: string[]; zone?: string }[];
}

export default function GardeCityScreen() {
  const { city } = useLocalSearchParams<{ city: string }>();
  const router = useRouter();
  const [gardes, setGardes] = useState<GardeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const decodedCity = decodeURIComponent(city || '');

  useEffect(() => {
    const fetch = async () => {
      const q = query(
        collection(db, 'pharmacies_de_garde'),
        where('city', '==', decodedCity),
        orderBy('startDate', 'desc')
      );
      const snap = await getDocs(q);
      setGardes(snap.docs.map(d => ({ id: d.id, ...d.data() } as GardeEntry)));
      setLoading(false);
    };
    if (decodedCity) fetch();
  }, [decodedCity]);

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#27AE60" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header avec bouton retour */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{decodedCity}</Text>
          <Text style={styles.subtitle}>Pharmacies de garde</Text>
        </View>
      </View>

      <FlatList
        data={gardes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.gardeCard}>
            {/* Periode */}
            <View style={styles.periodBadge}>
              <Ionicons name="calendar" size={14} color="#27AE60" />
              <Text style={styles.periodText}>
                {formatDate(item.startDate)} au {formatDate(item.endDate)}
              </Text>
            </View>
            {item.zone ? (
              <Text style={styles.zoneText}>{item.zone}</Text>
            ) : null}

            {/* Pharmacies */}
            {item.pharmacies.map((p, idx) => (
              <View key={p.pharmacyId || idx} style={styles.pharmacyRow}>
                <View style={styles.dot} />
                <View style={styles.pharmacyInfo}>
                  <Text style={styles.pharmacyName}>{p.name}</Text>
                  <Text style={styles.pharmacyZone}>{p.zone || '—'}</Text>
                </View>
                {p.phones && p.phones.length > 0 && (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => handleCall(p.phones![0])}
                  >
                    <Ionicons name="call" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="moon-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Aucune garde pour {decodedCity}</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#999' },
  gardeCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  periodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8F5E9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 10,
  },
  periodText: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  zoneText: { fontSize: 14, color: '#666', fontWeight: '500', marginBottom: 10 },
  pharmacyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#27AE60',
  },
  pharmacyInfo: { flex: 1 },
  pharmacyName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  pharmacyZone: { fontSize: 12, color: '#888', marginTop: 1 },
  callBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#27AE60', justifyContent: 'center', alignItems: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#999' },
});
```

---

## 5. Schema de navigation

```
app/_layout.tsx (Stack)
 │
 ├── /index                       → Page d'accueil marketing
 ├── /pharmacieapp                → App mobile pharmacie
 │    └── (tabs)/_layout.tsx      → Bottom Tabs
 │         ├── /annuaire          → Liste + recherche + appel
 │         └── /garde             → Liste villes/communes
 │              └── /garde/[city] → Detail pharmacies de garde
 ├── /admin1987                   → Panel admin (existant)
 └── /restrictmode                → Mode restreint (existant)
```

**Acces a l'app** : depuis la page d'accueil, ajouter un bouton qui navigue vers `/pharmacieapp`

```tsx
// Exemple sur la page d'accueil (app/index.tsx)
<TouchableOpacity onPress={() => router.push('/pharmacieapp')}>
  <Text>Ouvrir l'app Pharmacie</Text>
</TouchableOpacity>
```

---

## 6. Dependances

Toutes les dependances necessaires sont **deja installees** dans le projet :

| Package | Usage |
|---------|-------|
| `expo-router` | Routing / Tabs |
| `@react-navigation/bottom-tabs` | Bottom tab navigation |
| `firebase` | Firestore queries |
| `@expo/vector-icons` (Ionicons) | Icones |
| `react-native` (Linking) | Ouvrir le dialer telephone |
| `expo-image` | Afficher les images pharmacies |

**Aucune nouvelle dependance a installer.**

---

## 7. Resume des fichiers

| Action | Fichier | Description |
|--------|---------|-------------|
| Modifier | `app/_layout.tsx` | Ajouter route `pharmacieapp` |
| Creer | `app/pharmacieapp/_layout.tsx` | Stack layout |
| Creer | `app/pharmacieapp/(tabs)/_layout.tsx` | Bottom Tabs (Annuaire + Garde) |
| Creer | `app/pharmacieapp/(tabs)/annuaire.tsx` | Liste pharmacies + recherche + appel |
| Creer | `app/pharmacieapp/(tabs)/garde.tsx` | Liste villes/communes |
| Creer | `app/pharmacieapp/garde/[city].tsx` | Detail garde par ville |
| Optionnel | `app/index.tsx` | Ajouter bouton vers `/pharmacieapp` |
