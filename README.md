# Journey Minder (TransitWake) - Smart Commute Alert & RTO Fare Guide

Journey Minder (TransitWake) is a premium interactive web application and simulator designed for public transit commuters. It resolves common commute issues such as missing stops due to sleeping or unfamiliarity with routes, and protects users from auto/cab fare overcharging.

Live project can be viewed here:
👉 **[https://journey-minder.vercel.app/](https://journey-minder.vercel.app/)**

---

## 🚀 Key Features
1. **Interactive Mobile App Preview**: Styled like a modern smartphone with dynamic screens (Setup, Snooze Tracking, Alarm Alert, and Fare Estimator).
2. **Nagpur Presets & GPS Simulator**: Real-time simulation of transit coordinates along the Nagpur Metro Orange Line and Starbus Route 4.
3. **Mute-Bypassing Audio Synthesizers**: Generates alarm melodies via the **Web Audio API** and calls the **Web Speech API** to read approaching stops out loud.
4. **Nagpur RTO Fare Engine**: Computes official auto/cab fares using standard tariff rates (including day/night tariff changes and luggage charges).
5. **Feasibility & Challenges Hub**: Evaluates mobile OS restrictions (autoplay, background GPS sleep) and business viability risks.

---

## 🛠️ Technology Stack
- **Frontend**: HTML5, CSS3 (Backdrop Filters, Radial Gradients), Vanilla JavaScript (ES6+)
- **Map Visuals**: HTML5 `<canvas>` rendering transit nodes and geofence radii.
- **Audio & Haptics**: Web Audio API (oscillators), Web Speech API (SpeechSynthesis), Vibration API (`navigator.vibrate`)

---

## 📦 Sandbox Restrictions & Native Solutions
Web browsers run inside strict sandboxes. Running this app as a pure web page faces critical constraints:
- **Autoplay Policies**: Browsers block audio streams until the user taps the screen once.
- **Background Execution**: Browsers pause JavaScript execution when the screen locks.
- **Hardware Mute Switch**: Browsers cannot override physical volume buttons.

**Native wrapper solution (Capacitor/Cordova)**:
Wrapping the app in a native shell allows it to run foreground location services and trigger native alarm notifications that bypass silent/DND modes.

---

## 🚕 Nagpur RTO Fare Engine Formula
Calculations follow official Maharashtra RTO guidelines for Nagpur district:
- **Base Rate (Auto)**: ₹23.00 for the first 1.5 km.
- **Subsequent Rate**: ₹15.33 per km.
- **Night Charge**: +25% surcharge applies automatically between 11:00 PM and 5:00 AM.
- **Luggage Fee**: ₹3.00 per piece for large suitcases.

---

## ⚡ How to Run
1. Open `index.html` directly in any web browser.
2. Select your Nagpur transit route and destination inside the phone UI.
3. Click **Start Safe Snooze**.
4. Click **Play Journey** in the simulator to watch the vehicle move stop by stop.
5. Navigate to **Fare Guard** to compute standard rates and generate a verification ticket.
