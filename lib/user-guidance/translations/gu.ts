import type { GuidanceCopy } from "../types";

const gu: GuidanceCopy = {
  ui: {
    pageTitle: "વપરાશકર્તા માર્ગદર્શિકા",
    pageSubtitle:
      "લોકેશન, કેમેરા અને Jwork HRMS એપ ઇન્સ્ટોલ કરવા માટે પગલું-દર-પગલું મદદ.",
    languageLabel: "ભાષા",
    platformLabel: "ડિવાઇસ ગાઇડ",
    platformAuto: "ઓટો (આ ડિવાઇસ)",
    platformIos: "iPhone / iPad",
    platformAndroid: "Android ફોન",
    platformDesktop: "કમ્પ્યુટર (Chrome / Edge)",
    viewingOn: "આ માટે પગલાં બતાવવામાં આવે છે",
    tipsTitle: "ઉપયોગી સૂચનો",
    locationTab: "લોકેશન પરવાનગી",
    cameraTab: "કેમેરા પરવાનગી",
    installTab: "એપ ઇન્સ્ટોલ",
    backToLogin: "લૉગિન પર પાછા",
    openInApp: "ડેશબોર્ડ ખોલો",
  },
  topics: {
    location: {
      ios: {
        title: "iPhone / iPad પર લોકેશન પરવાનગી",
        description:
          "પંચ ઇન અને પંચ આઉટ માટે લોકેશન જરૂરી છે. Apple ડિવાઇસ પર આ પગલાં અપનાવો.",
        steps: [
          {
            title: "Location Services ચાલુ કરો",
            body: "Settings → Privacy & Security → Location Services → ON કરો.",
          },
          {
            title: "Safari અથવા Chrome પરવાનગી",
            body: "Location Services માં Safari (અથવા Chrome) → While Using the App પસંદ કરો.",
          },
          {
            title: "વેબસાઇટ પર Allow",
            body: "Jwork સાઇટ ખોલો, Punch In/Out કરો અને Allow દબાવો.",
          },
          {
            title: "Precise Location ચાલુ કરો",
            body: "પૂછવામાં આવે તો Precise Location ON કરો.",
          },
        ],
        tips: [
          "બહાર પંચ કરતી વખતે GPS ચાલુ રાખો.",
          "પહેલાં Deny કર્યું હોય તો Settings → Safari → Location બદલો.",
        ],
      },
      android: {
        title: "Android પર લોકેશન પરવાનગી",
        description:
          "પંચ ઇન અને પંચ આઉટ માટે લોકેશન જરૂરી છે. Android ફોન પર આ પગલાં અપનાવો.",
        steps: [
          {
            title: "ફોન GPS ચાલુ કરો",
            body: "Quick settings માંથી Location / GPS ON કરો.",
          },
          {
            title: "Chrome પરવાનગી",
            body: "Chrome માં address bar નું lock આઇકન → Permissions → Location → Allow.",
          },
          {
            title: "અથવા Android Settings",
            body: "Settings → Apps → Chrome → Permissions → Location → Allow while using.",
          },
          {
            title: "પંચ પર પુષ્ટિ",
            body: "Jwork ખોલો, Punch In/Out કરો અને Allow દબાવો.",
          },
        ],
        tips: [
          "Android પર Chrome વાપરો.",
          "High accuracy mode geo-tag માટે સારું છે.",
        ],
      },
      desktop: {
        title: "કમ્પ્યુટર પર લોકેશન પરવાનગી",
        description:
          "લેપટોપથી પંચ કરો તો બ્રાઉઝરમાં લોકેશન Allow કરો.",
        steps: [
          {
            title: "Lock આઇકન ક્લિક",
            body: "Chrome/Edge માં address bar ની ડાબી બાજુ lock આઇકન ક્લિક કરો.",
          },
          {
            title: "Location Allow કરો",
            body: "Location ને Block થી Allow માં બદલો.",
          },
          {
            title: "પેજ રીલોડ",
            body: "પેજ રિફ્રેશ કરી Punch In/Out ફરી કરો.",
          },
          {
            title: "Windows location",
            body: "Windows: Settings → Privacy → Location → ON કરો.",
          },
        ],
        tips: [
          "વધારે કર્મચારીઓ મોબાઇલથી પંચ કરે છે.",
          "પહેલાં બ્લોક હોય તો site permissions રીસેટ કરો.",
        ],
      },
    },
    camera: {
      ios: {
        title: "iPhone / iPad પર કેમેરા પરવાનગી",
        description: "પંચ ઇન/આઉટ માટે સેલ્ફી જરૂરી છે.",
        steps: [
          {
            title: "Safari settings",
            body: "Settings → Safari → Camera → Ask અથવા Allow સેટ કરો.",
          },
          {
            title: "સાઇટ permission",
            body: "Safari માં Jwork પેજ પર aA → Website Settings → Camera → Allow.",
          },
          {
            title: "પંચ પર Allow",
            body: "Punch In/Out કરો અને camera popup પર Allow દબાવો.",
          },
          {
            title: "Chrome on iOS",
            body: "Settings → Chrome → Camera → Allow, પછી retry કરો.",
          },
        ],
        tips: [
          "સારી રોશનીમાં ફોન આંખની સામે રાખો.",
          "ચહેરો detect ન થાય તો માસ્ક/ટોપી કાઢો.",
        ],
      },
      android: {
        title: "Android પર કેમેરા પરવાનગી",
        description: "પંચ ઇન/આઉટ માટે સેલ્ફી જરૂરી છે.",
        steps: [
          {
            title: "Chrome permissions",
            body: "Lock આઇકન → Permissions → Camera → Allow.",
          },
          {
            title: "App settings",
            body: "Settings → Apps → Chrome → Permissions → Camera → Allow while using.",
          },
          {
            title: "પંચ પર Allow",
            body: "Punch In/Out શરૂ કરો અને Allow દબાવો.",
          },
          {
            title: "બીજા camera apps બંધ કરો",
            body: "WhatsApp video વગેરે બંધ કરો જે camera વાપરે છે.",
          },
        ],
        tips: [
          "ફ્રન્ટ કેમેરા વાપરો, ચહેરો ફ્રેમમાં રાખો.",
          "બ્લર હોય તો lens સાફ કરો.",
        ],
      },
      desktop: {
        title: "કમ્પ્યુટર પર કેમેરા પરવાનગી",
        description: "ડેસ્કટોપ પર પંચ માટે વેબકેમ સેલ્ફી જરૂરી છે.",
        steps: [
          {
            title: "Lock આઇકન",
            body: "Chrome/Edge માં address bar નું lock આઇકન ક્લિક કરો.",
          },
          {
            title: "Camera Allow",
            body: "Camera permission Allow સેટ કરો.",
          },
          {
            title: "સાચું webcam પસંદ કરો",
            body: "ઘણા camera હોય તો built-in webcam પસંદ કરો.",
          },
          {
            title: "Reload અને retry",
            body: "પેજ રિફ્રેશ કરી Punch In/Out ફરી કરો.",
          },
        ],
        tips: [
          "લેપટોપ camera ઢંકાયેલ ન હોવો જોઈએ.",
          "અધિકૃત HTTPS Jwork URL વાપરો.",
        ],
      },
    },
    install: {
      ios: {
        title: "iPhone / iPad પર Jwork ઇન્સ્ટોલ",
        description:
          "હોમ સ્ક્રીન પર Jwork ઉમેરો જેથી એપ જેવું ખુલે.",
        steps: [
          {
            title: "Safari વાપરો",
            body: "Jwork વેબસાઇટ Safari માં ખોલો.",
          },
          {
            title: "Share દબાવો",
            body: "Safari ની નીચે Share બટન (તીર વાળો ચોરસ) દબાવો.",
          },
          {
            title: "Add to Home Screen",
            body: "નીચે સ્ક્રોલ કરી Add to Home Screen પસંદ કરો.",
          },
          {
            title: "Add પુષ્ટિ",
            body: "Add દબાવો. હોમ સ્ક્રીનથી Jwork ખોલો.",
          },
        ],
        tips: [
          "ઇન્સ્ટોલ એપ browser bar વગર ખુલે છે.",
          "એક વાર લૉગિન કરો; લૉગઆઉટ સુધી સેશન રહે છે.",
        ],
      },
      android: {
        title: "Android પર Jwork ઇન્સ્ટોલ",
        description:
          "ઝડપી પંચ માટે હોમ સ્ક્રીન પર એપ ઇન્સ્ટોલ કરો.",
        steps: [
          {
            title: "Chrome માં ખોલો",
            body: "Google Chrome માં Jwork વેબસાઇટ ખોલો.",
          },
          {
            title: "Install banner અથવા menu",
            body: "Install popup દબાવો, અથવા menu (⋮) → Install app / Add to Home screen.",
          },
          {
            title: "Install પુષ્ટિ",
            body: "ફરી Install દબાવો. હોમ સ્ક્રીન પર Jwork આઇકન આવશે.",
          },
          {
            title: "હોમ સ્ક્રીનથી ખોલો",
            body: "નવા આઇકનથી Jwork ખોલો.",
          },
        ],
        tips: [
          "Install ન દેખાય તો Chrome અપડેટ કરો.",
          "ટોપ બારમાં Install App બટન પણ વાપરી શકો.",
        ],
      },
      desktop: {
        title: "કમ્પ્યુટર પર Jwork ઇન્સ્ટોલ",
        description:
          "Chrome/Edge માં Jwork ને ડેસ્કટોપ એપ તરીકે ઇન્સ્ટોલ કરો.",
        steps: [
          {
            title: "Install આઇકન",
            body: "Address bar માં install આઇકન (⊕) ક્લિક કરો.",
          },
          {
            title: "Header બટન",
            body: "અથવા Jwork ની ઉપર Install App બટન દબાવો.",
          },
          {
            title: "Installation પુષ્ટિ",
            body: "Install dialog માં Install દબાવો.",
          },
          {
            title: "Taskbar પર pin",
            body: "Taskbar આઇકન → Pin to taskbar કરો.",
          },
        ],
        tips: [
          "ઇન્સ્ટોલ એપ native program જેવું ચાલે છે.",
          "નોટિફિકેશન ઇન્સ્ટોલ એપમાં સારી રીતે કામ કરે છે.",
        ],
      },
    },
  },
};

export default gu;
