import type { GuidanceCopy } from "../types";

const en: GuidanceCopy = {
  ui: {
    pageTitle: "User Guide",
    pageSubtitle:
      "Step-by-step help for location, camera, and installing the Jwork HRMS app on your device.",
    languageLabel: "Language",
    platformLabel: "Device guide",
    platformAuto: "Auto (this device)",
    platformIos: "iPhone / iPad",
    platformAndroid: "Android phone",
    platformDesktop: "Computer (Chrome / Edge)",
    viewingOn: "Showing steps for",
    tipsTitle: "Helpful tips",
    locationTab: "Location access",
    cameraTab: "Camera access",
    installTab: "Install app",
    backToLogin: "Back to login",
    openInApp: "Open dashboard",
  },
  topics: {
    location: {
      ios: {
        title: "Allow location on iPhone / iPad",
        description:
          "Location is required for Punch In and Punch Out. Follow these steps on your Apple device.",
        steps: [
          {
            title: "Turn on Location Services",
            body: "Open Settings → Privacy & Security → Location Services → switch ON.",
          },
          {
            title: "Allow Safari or Chrome",
            body: "In Location Services, open Safari (or Chrome) → select While Using the App or Ask Next Time.",
          },
          {
            title: "Allow on the website",
            body: "Open the Jwork site, tap Punch In/Out, and tap Allow when the browser asks for your location.",
          },
          {
            title: "Enable Precise Location",
            body: "If asked, turn ON Precise Location for better geo-tag accuracy.",
          },
        ],
        tips: [
          "Keep GPS on when punching attendance outdoors.",
          "If denied earlier, reset in Settings → Safari → Location.",
        ],
      },
      android: {
        title: "Allow location on Android",
        description:
          "Location is required for Punch In and Punch Out. Follow these steps on your Android phone.",
        steps: [
          {
            title: "Turn on phone GPS",
            body: "Pull down quick settings and enable Location / GPS.",
          },
          {
            title: "Allow Chrome permission",
            body: "In Chrome, tap the lock icon in the address bar → Permissions → Location → Allow.",
          },
          {
            title: "Or use Android Settings",
            body: "Settings → Apps → Chrome → Permissions → Location → Allow while using the app.",
          },
          {
            title: "Confirm on punch",
            body: "Open Jwork, start Punch In/Out, and tap Allow when prompted.",
          },
        ],
        tips: [
          "Use Chrome for best results on Android.",
          "High accuracy mode helps inside geo-fenced work areas.",
        ],
      },
      desktop: {
        title: "Allow location on computer",
        description:
          "If you punch from a laptop with GPS, allow location in the browser.",
        steps: [
          {
            title: "Click the lock icon",
            body: "In Chrome or Edge, click the lock icon left of the website address.",
          },
          {
            title: "Set Location to Allow",
            body: "Find Location and change it from Block to Allow.",
          },
          {
            title: "Reload the page",
            body: "Refresh the page and try Punch In/Out again.",
          },
          {
            title: "Windows location",
            body: "On Windows: Settings → Privacy & security → Location → Location services ON.",
          },
        ],
        tips: [
          "Most employees punch from mobile; desktop GPS may be unavailable.",
          "If blocked before, reset site permissions and try again.",
        ],
      },
    },
    camera: {
      ios: {
        title: "Allow camera on iPhone / iPad",
        description: "A selfie is required when you punch in or punch out.",
        steps: [
          {
            title: "Open Safari settings",
            body: "Settings → Safari → Camera → set to Ask or Allow.",
          },
          {
            title: "Check site permission",
            body: "In Safari on the Jwork page, tap aA → Website Settings → Camera → Allow.",
          },
          {
            title: "Allow when punching",
            body: "Tap Punch In/Out → Allow when the camera permission popup appears.",
          },
          {
            title: "If using Chrome on iOS",
            body: "Settings → Chrome → Camera → Allow, then retry punch.",
          },
        ],
        tips: [
          "Hold the phone at eye level with good lighting.",
          "Remove mask or cap if face detection fails.",
        ],
      },
      android: {
        title: "Allow camera on Android",
        description: "A selfie is required when you punch in or punch out.",
        steps: [
          {
            title: "Open Chrome permissions",
            body: "Tap the lock icon in the address bar → Permissions → Camera → Allow.",
          },
          {
            title: "Or use App settings",
            body: "Settings → Apps → Chrome → Permissions → Camera → Allow only while using.",
          },
          {
            title: "Allow on punch",
            body: "Start Punch In/Out and tap Allow on the camera popup.",
          },
          {
            title: "Close other camera apps",
            body: "Close WhatsApp video or other apps that may be using the camera.",
          },
        ],
        tips: [
          "Use the front camera and keep your face inside the frame.",
          "Clean the camera lens if the preview is blurry.",
        ],
      },
      desktop: {
        title: "Allow camera on computer",
        description: "A webcam selfie is required for punch in/out on desktop.",
        steps: [
          {
            title: "Click the lock icon",
            body: "In Chrome or Edge, click the lock icon next to the address bar.",
          },
          {
            title: "Allow Camera",
            body: "Set Camera permission to Allow for this site.",
          },
          {
            title: "Select the correct webcam",
            body: "If multiple cameras exist, pick the built-in webcam when prompted.",
          },
          {
            title: "Reload and retry",
            body: "Refresh the page and open Punch In/Out again.",
          },
        ],
        tips: [
          "Laptop camera must not be covered.",
          "Browser needs HTTPS — use the official Jwork website URL.",
        ],
      },
    },
    install: {
      ios: {
        title: "Install Jwork on iPhone / iPad",
        description:
          "Add Jwork to your home screen for quick access like a mobile app.",
        steps: [
          {
            title: "Use Safari browser",
            body: "Open the Jwork website in Safari (install works best in Safari).",
          },
          {
            title: "Tap Share",
            body: "Tap the Share button at the bottom of Safari (square with arrow).",
          },
          {
            title: "Add to Home Screen",
            body: "Scroll and tap Add to Home Screen.",
          },
          {
            title: "Confirm Add",
            body: "Edit the name if needed, then tap Add. Open Jwork from your home screen.",
          },
        ],
        tips: [
          "Installed app opens full screen without browser bars.",
          "Log in once; your session stays until you log out.",
        ],
      },
      android: {
        title: "Install Jwork on Android",
        description:
          "Install the app on your home screen for faster punch and attendance.",
        steps: [
          {
            title: "Open in Chrome",
            body: "Visit the Jwork website using Google Chrome.",
          },
          {
            title: "Install banner or menu",
            body: "Tap Install on the popup, or tap menu (⋮) → Install app / Add to Home screen.",
          },
          {
            title: "Confirm install",
            body: "Tap Install again. The Jwork icon appears on your home screen.",
          },
          {
            title: "Open from home screen",
            body: "Launch Jwork from the new icon for the best mobile experience.",
          },
        ],
        tips: [
          "If no install option appears, update Chrome to the latest version.",
          "You can also use the Install App button in the top bar when visible.",
        ],
      },
      desktop: {
        title: "Install Jwork on computer",
        description:
          "Install Jwork as a desktop app in Chrome or Edge for quick launch.",
        steps: [
          {
            title: "Look for install icon",
            body: "In Chrome/Edge address bar, click the install icon (⊕ or monitor).",
          },
          {
            title: "Use header button",
            body: "Or click Install App in the top-right of Jwork when it appears.",
          },
          {
            title: "Confirm installation",
            body: "Click Install in the dialog. Jwork opens in its own window.",
          },
          {
            title: "Pin to taskbar",
            body: "Right-click the app icon on the taskbar → Pin to taskbar for quick access.",
          },
        ],
        tips: [
          "Installed desktop app works like a native program.",
          "Notifications work better when the app is installed.",
        ],
      },
    },
  },
};

export default en;
