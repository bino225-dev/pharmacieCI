import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';

// Always use test IDs for now — switch to real IDs when going to production
export const BANNER_AD_ID = TestIds.BANNER;
const INTERSTITIAL_AD_ID = TestIds.INTERSTITIAL;

// Production IDs (uncomment when ready):
// export const BANNER_AD_ID = 'ca-app-pub-6521217912797881/9015929946';
// const INTERSTITIAL_AD_ID = 'ca-app-pub-6521217912797881/4077749877';

let initialized = false;
let interstitial: InterstitialAd | null = null;
let isInterstitialLoaded = false;

export async function initAds() {
  if (initialized) return;
  try {
    await mobileAds().initialize();
    initialized = true;
    setupInterstitial();
  } catch (e) {
    console.warn('AdMob init error:', e);
  }
}

function setupInterstitial() {
  interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_ID);

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    isInterstitialLoaded = true;
  });

  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    isInterstitialLoaded = false;
    interstitial?.load();
  });

  interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
    isInterstitialLoaded = false;
    console.warn('Interstitial error:', error);
  });

  interstitial.load();
}

export function loadInterstitial() {
  if (interstitial && !isInterstitialLoaded) {
    interstitial.load();
  }
}

export function showInterstitial(): boolean {
  if (interstitial && isInterstitialLoaded) {
    interstitial.show();
    return true;
  }
  return false;
}
