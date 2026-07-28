# Pharmacie CI

Application mobile pour localiser et consulter les pharmacies en Cote d'Ivoire. Trouvez rapidement une pharmacie proche, consultez les pharmacies de garde et accedez aux informations detaillees de chaque etablissement.

## Fonctionnalites

### Annuaire des pharmacies
- Liste complete de toutes les pharmacies enregistrees
- Recherche par nom, commune ou ville
- Indicateur visuel des pharmacies actuellement de garde
- Pull-to-refresh pour actualiser les donnees
- Navigation vers la fiche detaillee de chaque pharmacie

### Pharmacies de garde
- Liste des villes disponibles avec recherche
- Navigation par commune (pour les villes qui en ont, ex: Abidjan)
- Affichage des periodes de garde avec dates de debut et de fin
- Indicateur "En cours" pour les gardes actives

### Localisation GPS
- Bouton flottant "Localiser" sur les onglets Annuaire et De Garde
- Detection automatique de la position de l'utilisateur
- Affichage des pharmacies les plus proches triees par distance
- Rayon de recherche adaptatif (5 km, 10 km, puis top 10)
- Distance affichee en metres ou kilometres

### Fiche pharmacie detaillee
- Photo de la pharmacie (si disponible)
- Nom, statut de garde, zone et ville
- Mini carte avec coordonnees GPS et lien vers l'application Maps native
- Numeros de telephone avec appel direct (support multi-numeros)
- Nom du pharmacien
- Assurances acceptees
- Description

## Stack technique

| Technologie | Version | Usage |
|---|---|---|
| React Native | 0.86 | Framework mobile cross-platform |
| Expo | SDK 57 | Toolchain et services |
| Expo Router | 6.x | Navigation file-based |
| TypeScript | 6.x | Typage statique |
| Firebase Firestore | 12.x | Base de donnees temps reel |
| Redux Toolkit | 2.x | Gestion d'etat |
| React Native Paper | 5.x | Composants UI Material |
| expo-location | - | Geolocalisation GPS |

## Structure du projet

```
pharmacieCI/
├── app/
│   ├── _layout.tsx                          # Layout racine (Redux + Paper providers)
│   ├── index.tsx                            # Redirection vers les tabs
│   └── pharmacieapp/
│       ├── _layout.tsx                      # Stack navigator
│       ├── (tabs)/
│       │   ├── _layout.tsx                  # Bottom tabs (Annuaire + De Garde)
│       │   ├── annuaire.tsx                 # Liste des pharmacies + FAB localiser
│       │   └── garde.tsx                    # Liste des villes de garde + FAB localiser
│       ├── garde/
│       │   └── [city].tsx                   # Communes et gardes par ville
│       └── pharmacy/
│           └── [id].tsx                     # Detail d'une pharmacie
├── constants/
│   └── theme.ts                            # Couleurs, espacements, border radius
├── hooks/
│   └── firebaseConfig.js                   # Configuration Firebase
├── store/
│   ├── index.js                            # Store Redux
│   └── userSlice.js                        # Slice utilisateur
├── assets/                                 # Icones et images
├── app.json                                # Configuration Expo
├── package.json                            # Dependances
└── tsconfig.json                           # Configuration TypeScript
```

## Collections Firestore

| Collection | Description | Champs principaux |
|---|---|---|
| `pharmacies` | Toutes les pharmacies | `name`, `city`, `zone`, `phones[]`, `is_on_duty`, `location{lat,lng}`, `doctor_name`, `assurances[]`, `description`, `image` |
| `pharmacies_de_garde` | Periodes de garde | `city`, `zone`, `startDate`, `endDate`, `pharmacies[{pharmacyId, name, phones, zone}]` |
| `cities` | Villes disponibles | `name` |
| `zones` | Communes par ville | `name`, `cityId` |

## Installation

### Prerequisites
- Node.js 18+
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Xcode (pour iOS) ou Android Studio (pour Android)

### Etapes

```bash
# Cloner le depot
git clone https://github.com/bino225-dev/pharmacieCI.git
cd pharmacieCI

# Installer les dependances
npm install --legacy-peer-deps

# Lancer en mode developpement (web)
npx expo start --web

# Lancer sur iOS Simulator
npx expo prebuild --platform ios
npx expo run:ios

# Lancer sur Android
npx expo prebuild --platform android
npx expo run:android
```

### Configuration Firebase

Le fichier `hooks/firebaseConfig.js` contient la configuration Firebase. Pour utiliser votre propre projet Firebase :

1. Creez un projet sur [Firebase Console](https://console.firebase.google.com)
2. Activez Firestore Database
3. Remplacez les valeurs dans `hooks/firebaseConfig.js`
4. Creez les collections necessaires (voir section Collections Firestore)

## Navigation

```
Ecran d'accueil
├── Onglet Annuaire
│   ├── Liste des pharmacies (recherche + filtre)
│   ├── [FAB Localiser] → Modal pharmacies proches
│   └── Clic pharmacie → Detail pharmacie
│       ├── Informations generales
│       ├── Mini carte → Ouvrir dans Maps
│       ├── Telephones → Appel direct
│       └── Assurances, description
└── Onglet De Garde
    ├── Liste des villes (recherche)
    ├── [FAB Localiser] → Modal pharmacies de garde proches
    └── Clic ville → Communes (si applicable)
        └── Clic commune → Periodes de garde
            └── Clic pharmacie → Detail pharmacie
```

## Theme

L'application utilise un theme vert coherent defini dans `constants/theme.ts` :

- **Couleur primaire** : `#27AE60` (vert)
- **Background** : `#FAFBFC`
- **Surface** : `#FFFFFF`
- **Texte** : `#1A1A2E`

## Licence

Projet prive.
