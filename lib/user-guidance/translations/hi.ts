import type { GuidanceCopy } from "../types";

const hi: GuidanceCopy = {
  ui: {
    pageTitle: "उपयोगकर्ता मार्गदर्शिका",
    pageSubtitle:
      "लोकेशन, कैमरा और Jwork HRMS ऐप इंस्टॉल करने के लिए चरण-दर-चरण सहायता।",
    languageLabel: "भाषा",
    platformLabel: "डिवाइस गाइड",
    platformAuto: "ऑटो (यह डिवाइस)",
    platformIos: "iPhone / iPad",
    platformAndroid: "Android फ़ोन",
    platformDesktop: "कंप्यूटर (Chrome / Edge)",
    viewingOn: "इनके लिए चरण दिखाए जा रहे हैं",
    tipsTitle: "उपयोगी सुझाव",
    locationTab: "लोकेशन अनुमति",
    cameraTab: "कैमरा अनुमति",
    installTab: "ऐप इंस्टॉल",
    backToLogin: "लॉगिन पर वापस",
    openInApp: "डैशबोर्ड खोलें",
  },
  topics: {
    location: {
      ios: {
        title: "iPhone / iPad पर लोकेशन अनुमति",
        description:
          "पंच इन और पंच आउट के लिए लोकेशन ज़रूरी है। Apple डिवाइस पर ये चरण अपनाएँ।",
        steps: [
          {
            title: "Location Services चालू करें",
            body: "Settings → Privacy & Security → Location Services → ON करें।",
          },
          {
            title: "Safari या Chrome की अनुमति",
            body: "Location Services में Safari (या Chrome) खोलें → While Using the App चुनें।",
          },
          {
            title: "वेबसाइट पर Allow करें",
            body: "Jwork साइट खोलें, Punch In/Out करें और Allow दबाएँ।",
          },
          {
            title: "Precise Location चालू करें",
            body: "यदि पूछा जाए तो Precise Location ON करें।",
          },
        ],
        tips: [
          "बाहर पंच करते समय GPS चालू रखें।",
          "पहले Deny किया हो तो Settings → Safari → Location से बदलें।",
        ],
      },
      android: {
        title: "Android पर लोकेशन अनुमति",
        description:
          "पंच इन और पंच आउट के लिए लोकेशन ज़रूरी है। Android फ़ोन पर ये चरण अपनाएँ।",
        steps: [
          {
            title: "फ़ोन GPS चालू करें",
            body: "Quick settings से Location / GPS ON करें।",
          },
          {
            title: "Chrome में अनुमति",
            body: "Chrome में address bar के lock आइकन → Permissions → Location → Allow।",
          },
          {
            title: "या Android Settings",
            body: "Settings → Apps → Chrome → Permissions → Location → Allow while using।",
          },
          {
            title: "पंच पर पुष्टि",
            body: "Jwork खोलें, Punch In/Out करें और Allow दबाएँ।",
          },
        ],
        tips: [
          "Android पर Chrome का उपयोग करें।",
          "High accuracy mode geo-tag के लिए बेहतर है।",
        ],
      },
      desktop: {
        title: "कंप्यूटर पर लोकेशन अनुमति",
        description:
          "लैपटॉप से पंच करने पर ब्राउज़र में लोकेशन Allow करें।",
        steps: [
          {
            title: "Lock आइकन पर क्लिक",
            body: "Chrome/Edge में address bar के बाएँ lock आइकन पर क्लिक करें।",
          },
          {
            title: "Location Allow करें",
            body: "Location को Block से Allow में बदलें।",
          },
          {
            title: "पेज रीलोड करें",
            body: "पेज रिफ्रेश करके Punch In/Out फिर से करें।",
          },
          {
            title: "Windows location",
            body: "Windows: Settings → Privacy → Location → ON करें।",
          },
        ],
        tips: [
          "ज़्यादातर कर्मचारी मोबाइल से पंच करते हैं।",
          "पहले ब्लॉक हो तो site permissions रीसेट करें।",
        ],
      },
    },
    camera: {
      ios: {
        title: "iPhone / iPad पर कैमरा अनुमति",
        description: "पंच इन/आउट के लिए सेल्फी ज़रूरी है।",
        steps: [
          {
            title: "Safari settings",
            body: "Settings → Safari → Camera → Ask या Allow सेट करें।",
          },
          {
            title: "साइट permission",
            body: "Safari में Jwork पेज पर aA → Website Settings → Camera → Allow।",
          },
          {
            title: "पंच पर Allow",
            body: "Punch In/Out करें और camera popup पर Allow दबाएँ।",
          },
          {
            title: "Chrome on iOS",
            body: "Settings → Chrome → Camera → Allow, फिर retry करें।",
          },
        ],
        tips: [
          "अच्छी रोशनी में फ़ोन आँख के सामने रखें।",
          "फेस detect न हो तो मास्क/टोपी हटाएँ।",
        ],
      },
      android: {
        title: "Android पर कैमरा अनुमति",
        description: "पंच इन/आउट के लिए सेल्फी ज़रूरी है।",
        steps: [
          {
            title: "Chrome permissions",
            body: "Lock आइकन → Permissions → Camera → Allow।",
          },
          {
            title: "App settings",
            body: "Settings → Apps → Chrome → Permissions → Camera → Allow while using।",
          },
          {
            title: "पंच पर Allow",
            body: "Punch In/Out शुरू करें और Allow दबाएँ।",
          },
          {
            title: "दूसरे camera apps बंद करें",
            body: "WhatsApp video आदि बंद करें जो camera उपयोग कर रहे हों।",
          },
        ],
        tips: [
          "फ्रंट कैमरा उपयोग करें, चेहरा फ्रेम में रखें।",
          "ब्लर हो तो lens साफ करें।",
        ],
      },
      desktop: {
        title: "कंप्यूटर पर कैमरा अनुमति",
        description: "डेस्कटॉप पर पंच के लिए वेबकैम सेल्फी ज़रूरी है।",
        steps: [
          {
            title: "Lock आइकन",
            body: "Chrome/Edge में address bar के lock आइकन पर क्लिक करें।",
          },
          {
            title: "Camera Allow",
            body: "Camera permission Allow सेट करें।",
          },
          {
            title: "सही webcam चुनें",
            body: "कई camera हों तो built-in webcam चुनें।",
          },
          {
            title: "Reload और retry",
            body: "पेज रिफ्रेश करके Punch In/Out फिर करें।",
          },
        ],
        tips: [
          "लैपटॉप camera ढका न हो।",
          "आधिकारिक HTTPS Jwork URL उपयोग करें।",
        ],
      },
    },
    install: {
      ios: {
        title: "iPhone / iPad पर Jwork इंस्टॉल",
        description:
          "होम स्क्रीन पर Jwork जोड़ें ताकि ऐप की तरह खुल सके।",
        steps: [
          {
            title: "Safari उपयोग करें",
            body: "Jwork वेबसाइट Safari में खोलें।",
          },
          {
            title: "Share दबाएँ",
            body: "Safari के नीचे Share बटन (तीर वाला वर्ग) दबाएँ।",
          },
          {
            title: "Add to Home Screen",
            body: "नीचे स्क्रॉल कर Add to Home Screen चुनें।",
          },
          {
            title: "Add पुष्टि",
            body: "Add दबाएँ। होम स्क्रीन से Jwork खोलें।",
          },
        ],
        tips: [
          "इंस्टॉल ऐप बिना browser bar के खुलता है।",
          "एक बार लॉगिन करें; लॉगआउट तक सेशन रहता है।",
        ],
      },
      android: {
        title: "Android पर Jwork इंस्टॉल",
        description:
          "तेज़ पंच के लिए होम स्क्रीन पर ऐप इंस्टॉल करें।",
        steps: [
          {
            title: "Chrome में खोलें",
            body: "Google Chrome में Jwork वेबसाइट खोलें।",
          },
          {
            title: "Install banner या menu",
            body: "Install popup दबाएँ, या menu (⋮) → Install app / Add to Home screen।",
          },
          {
            title: "Install पुष्टि",
            body: "फिर Install दबाएँ। होम स्क्रीन पर Jwork आइकन आएगा।",
          },
          {
            title: "होम स्क्रीन से खोलें",
            body: "नए आइकन से Jwork खोलें।",
          },
        ],
        tips: [
          "Install न दिखे तो Chrome अपडेट करें।",
          "टॉप बार में Install App बटन भी उपयोग कर सकते हैं।",
        ],
      },
      desktop: {
        title: "कंप्यूटर पर Jwork इंस्टॉल",
        description:
          "Chrome/Edge में Jwork को डेस्कटॉप ऐप की तरह इंस्टॉल करें।",
        steps: [
          {
            title: "Install आइकन",
            body: "Address bar में install आइकन (⊕) पर क्लिक करें।",
          },
          {
            title: "Header बटन",
            body: "या Jwork के ऊपर Install App बटन दबाएँ।",
          },
          {
            title: "Installation पुष्टि",
            body: "Install dialog में Install दबाएँ।",
          },
          {
            title: "Taskbar पर pin",
            body: "Taskbar आइकन → Pin to taskbar करें।",
          },
        ],
        tips: [
          "इंस्टॉल ऐप native program की तरह चलता है।",
          "नोटिफिकेशन इंस्टॉल ऐप में बेहतर काम करते हैं।",
        ],
      },
    },
  },
};

export default hi;
