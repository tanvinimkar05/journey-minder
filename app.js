// TransitWake - Application Logic (Alerts & Fare Engine)

// ----------------------------------------------------
// PRESET NAGPUR ROUTES & CONFIGURATION DATA
// ----------------------------------------------------
const transitRoutes = {
  bus: {
    id: "bus-route-4",
    name: "Starbus Route 4 (Sitabuldi to Hingna)",
    distance: 12.2, // km
    vehicleType: "bus",
    stops: [
      { name: "Sitabuldi Terminal", x: 100, y: 70 },
      { name: "Jhansi Rani Square", x: 150, y: 75 },
      { name: "Dharampeth", x: 200, y: 80 },
      { name: "VNIT Gate", x: 260, y: 95 },
      { name: "Subhash Nagar", x: 330, y: 110 },
      { name: "Lokmanya Nagar", x: 410, y: 130 },
      { name: "Hingna MIDC", x: 480, y: 160 }
    ]
  },
  metro: {
    id: "metro-orange",
    name: "Metro Orange Line (Khapri to Sitabuldi)",
    distance: 10.5, // km
    vehicleType: "metro",
    stops: [
      { name: "Khapri Metro Station", x: 80, y: 190 },
      { name: "Airport Metro Station", x: 160, y: 170 },
      { name: "Ujwal Nagar", x: 220, y: 150 },
      { name: "Jaiprakash Nagar", x: 280, y: 130 },
      { name: "Congress Nagar", x: 340, y: 100 },
      { name: "Sitabuldi Interchange", x: 440, y: 60 }
    ]
  },
  cab: {
    id: "cab-custom",
    name: "Auto/Cab Ride (Nagpur Junction to IT Park)",
    distance: 8.5, // km
    vehicleType: "cab",
    stops: [
      { name: "Nagpur Junction Stn", x: 70, y: 50 },
      { name: "Ram Jhula", x: 140, y: 60 },
      { name: "Zero Mile", x: 210, y: 70 },
      { name: "Sitabuldi", x: 280, y: 90 },
      { name: "Deekshabhoomi", x: 360, y: 120 },
      { name: "IT Park Gayatri Nagar", x: 460, y: 160 }
    ]
  }
};

// Official Nagpur RTO Tariff Policies
const rtoRates = {
  auto: {
    baseKm: 1.5,
    baseFare: 23.0,
    perKm: 15.33,
    nightSurchargePct: 25, // +25% between 11 PM to 5 AM
    luggageCharge: 3.0 // Per item exceeding standard hand bag
  },
  "cab-mini": {
    baseKm: 2.0,
    baseFare: 40.0,
    perKm: 18.00,
    nightSurchargePct: 25,
    luggageCharge: 5.0
  },
  "cab-sedan": {
    baseKm: 2.0,
    baseFare: 50.0,
    perKm: 22.00,
    nightSurchargePct: 25,
    luggageCharge: 5.0
  }
};

// Popular routes standard distances for Nagpur guide helper
const popularDistances = {
  "station-vnit": 6.8,
  "sitabuldi-hingna": 11.2,
  "airport-itpark": 5.2,
  "ramjhula-sambhaji": 9.0
};

// ----------------------------------------------------
// STATE VARIABLES
// ----------------------------------------------------
let activeMode = 'bus';
let currentRoute = null;
let currentDestinationIndex = -1;
let alertBufferStops = 2;
let napProfile = 'deep';
let selectedRingtone = 'melody';

// Simulator Engine Variables
let isSimRunning = false;
let simInterval = null;
let simProgress = 0; // 0 to 100% of route segment
let currentStopIndex = 0;
let simSpeedMultiplier = 3; // default multiplier
let logCount = 0;

// Web Audio API context for synthetic alarms
let audioCtx = null;
let alarmOscillator = null;
let alarmGainNode = null;
let isAlarmSounding = false;
let syntheticMelodyTimer = null;

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Sync phone time
  updatePhoneTime();
  setInterval(updatePhoneTime, 30000);

  // Initialize Route preset dropdowns
  loadTransitModeDropdowns();

  // Draw Initial Canvas Map
  initMapCanvas();

  // Run initial calculations
  calculateFare();
  recomputeRisk();

  // Add event listener for ringtone test sample stop when selector changes
  document.getElementById("alarm-ringtone").addEventListener("change", (e) => {
    selectedRingtone = e.target.value;
    stopAlarmSound();
  });
});

// Update Simulated Device Time
function updatePhoneTime() {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  hours = hours < 10 ? '0' + hours : hours;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  const timeStr = hours + ':' + minutes;
  const phoneTimeEl = document.getElementById("phone-time");
  if (phoneTimeEl) phoneTimeEl.textContent = timeStr;
}

// ----------------------------------------------------
// PHONE APP NAVIGATION & ROUTE LOADER
// ----------------------------------------------------
function phoneNavigate(screenId) {
  // Update nav highlight
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  
  if (screenId === 'home') {
    document.getElementById("nav-home").classList.add("active");
    showScreen("screen-home");
  } else if (screenId === 'fare') {
    document.getElementById("nav-fare").classList.add("active");
    showScreen("screen-fare");
    calculateFare();
  }
}

function showScreen(screenId) {
  document.querySelectorAll(".app-screen").forEach(screen => {
    screen.classList.remove("active");
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

function switchTransitMode(mode) {
  activeMode = mode;
  
  // Highlight correct sub mode button
  document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));
  if (mode === 'bus') document.getElementById("mode-bus-btn").classList.add("active");
  if (mode === 'metro') document.getElementById("mode-metro-btn").classList.add("active");
  if (mode === 'cab') document.getElementById("mode-cab-btn").classList.add("active");

  loadTransitModeDropdowns();
  
  // Log update
  addConsoleLog(`Changed vehicle mode to: ${mode.toUpperCase()}`, 'system');
}

function loadTransitModeDropdowns() {
  const routeSelect = document.getElementById("phone-route-select");
  const destSelect = document.getElementById("phone-destination-select");
  
  // Clear select elements
  routeSelect.innerHTML = "";
  destSelect.innerHTML = "";

  // Populate routes
  for (const key in transitRoutes) {
    if (transitRoutes[key].vehicleType === activeMode || (activeMode === 'cab' && key === 'cab')) {
      const route = transitRoutes[key];
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = route.name;
      routeSelect.appendChild(opt);
    }
  }

  // Auto-load stops for the first match
  if (routeSelect.value) {
    loadPresetRoute(routeSelect.value);
  }
}

function loadPresetRoute(routeKey) {
  currentRoute = transitRoutes[routeKey];
  const destSelect = document.getElementById("phone-destination-select");
  destSelect.innerHTML = "";

  // Populate Destination stops
  currentRoute.stops.forEach((stop, index) => {
    // Cannot set first stop as destination
    if (index > 0) {
      const opt = document.createElement("option");
      opt.value = index;
      opt.textContent = `${stop.name} (Stop ${index + 1})`;
      
      // Auto select last stop as default destination
      if (index === currentRoute.stops.length - 1) {
        opt.selected = true;
      }
      destSelect.appendChild(opt);
    }
  });

  // Enable/Disable simulation play buttons
  document.getElementById("sim-play-pause-btn").disabled = true;
  document.getElementById("sim-reset-btn").disabled = true;

  // Redraw map
  drawMapState();
  updateTimelineUI();
  
  addConsoleLog(`Loaded route: ${currentRoute.name}. Total ${currentRoute.stops.length} stops.`, 'system');
}

function updateTimelineUI() {
  const timeline = document.getElementById("route-timeline-list");
  if (!currentRoute) return;

  timeline.innerHTML = "";
  const selectedDestVal = parseInt(document.getElementById("phone-destination-select").value) || (currentRoute.stops.length - 1);
  const bufferVal = parseInt(document.getElementById("alert-buffer-stops").value) || 2;
  const warningStopIndex = Math.max(0, selectedDestVal - bufferVal);

  currentRoute.stops.forEach((stop, index) => {
    const node = document.createElement("div");
    node.className = "timeline-node";
    
    // Add passed/current class depending on simulation state
    if (isSimRunning || simProgress > 0 || currentStopIndex > 0) {
      if (index < currentStopIndex) {
        node.classList.add("passed");
      } else if (index === currentStopIndex) {
        node.classList.add("current");
      }
    }

    // Highlight target destination and warning buffers
    if (index === selectedDestVal) {
      node.classList.add("target");
    }

    const circle = document.createElement("div");
    circle.className = "node-circle";
    
    // Icon badge inside node circle for specific states
    if (index === selectedDestVal) {
      circle.innerHTML = '<i class="fa-solid fa-flag-checkered" style="font-size: 8px; color: var(--gold); margin-bottom: 2px;"></i>';
      circle.title = "Target Destination Stop";
    } else if (index === warningStopIndex && index < selectedDestVal) {
      circle.innerHTML = '<i class="fa-solid fa-bell" style="font-size: 8px; color: var(--cyan); margin-bottom: 2px;"></i>';
      circle.title = "Warning Zone Begins";
    }

    const label = document.createElement("span");
    // Shorten long names slightly
    let displayName = stop.name.replace("Station", "Stn").replace("Interchange", "Int");
    label.textContent = displayName;

    node.appendChild(circle);
    node.appendChild(label);
    timeline.appendChild(node);
  });
}

// ----------------------------------------------------
// SIMULATION ENGINE (Trip Controller)
// ----------------------------------------------------
function startTrackingTrip() {
  // Collect UI settings
  const destSelect = document.getElementById("phone-destination-select");
  currentDestinationIndex = parseInt(destSelect.value);
  alertBufferStops = parseInt(document.getElementById("alert-buffer-stops").value);
  napProfile = document.getElementById("alarm-profile").value;
  selectedRingtone = document.getElementById("alarm-ringtone").value;

  if (currentDestinationIndex === -1 || !currentRoute) {
    alert("Please select a route and destination first.");
    return;
  }

  // Setup screen active elements
  showScreen("screen-tracking");
  
  // Set values on phone tracking UI
  document.getElementById("track-route-title").textContent = currentRoute.name;
  
  // Initialize simulation tracking states
  currentStopIndex = 0;
  simProgress = 0;
  isSimRunning = true;
  
  // Enable engine controls
  document.getElementById("sim-play-pause-btn").disabled = false;
  document.getElementById("sim-play-pause-btn").innerHTML = '<i class="fa-solid fa-pause"></i> Pause Journey';
  document.getElementById("sim-reset-btn").disabled = false;

  // Set initial estimation values
  updatePhoneTrackingUI();

  // Clear previous alarm/synthesizers
  stopAlarmSound();

  // Hide toast, display GPS signal lock
  const toast = document.getElementById("sim-toast");
  toast.classList.add("hidden");

  // Run Sim loop
  startSimInterval();

  addConsoleLog(`--- TRIP STARTED ---`, 'info');
  addConsoleLog(`Destination: ${currentRoute.stops[currentDestinationIndex].name}`, 'info');
  addConsoleLog(`Pre-alert configured for ${alertBufferStops} stops before destination.`, 'info');
  addConsoleLog(`GPS lock established. Monitoring coordinates...`, 'gps');
}

function startSimInterval() {
  if (simInterval) clearInterval(simInterval);
  
  const tickMs = 1500 / simSpeedMultiplier; // Time per transition step
  simInterval = setInterval(() => {
    if (!isSimRunning) return;
    
    // Simulate motion along route segment
    simProgress += 10;
    
    if (simProgress >= 100) {
      simProgress = 0;
      currentStopIndex++;
      
      // Notify stop arrived
      if (currentStopIndex < currentRoute.stops.length) {
        addConsoleLog(`Arrived at Stop: ${currentRoute.stops[currentStopIndex].name}`, 'gps');
      }
      
      // Evaluate geofence alerts
      checkGeofenceTrigger();
    }
    
    // Update map drawing & progress stats
    drawMapState();
    updatePhoneTrackingUI();
    updateTimelineUI();
    
  }, tickMs);
}

function updatePhoneTrackingUI() {
  if (!currentRoute) return;

  const totalSegments = currentDestinationIndex; 
  // Compute total percentage completed
  let currentSegmentVal = currentStopIndex + (simProgress / 100);
  let totalPct = Math.min(100, Math.round((currentSegmentVal / totalSegments) * 100));
  
  // Prevent division failures if at destination already
  if (currentStopIndex >= currentDestinationIndex) {
    totalPct = 100;
  }

  // Update ring dash array
  const circle = document.getElementById("tracking-progress-circle");
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (totalPct / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  // Update text
  document.getElementById("tracking-pct-text").textContent = `${totalPct}%`;
  
  // Calculate remaining stops
  const stopsLeft = Math.max(0, currentDestinationIndex - currentStopIndex);
  document.getElementById("track-stops-left").textContent = stopsLeft;
  
  // Estimate ETA (approx 3 mins per stop remaining)
  const etaMins = Math.max(0, Math.ceil(stopsLeft * 2.5 - (simProgress / 100 * 2.5)));
  document.getElementById("track-eta-min").textContent = etaMins;

  // Next Stop indicator
  let nextStopName = "Destination Reached";
  if (currentStopIndex + 1 < currentRoute.stops.length) {
    nextStopName = currentRoute.stops[currentStopIndex + 1].name;
  }
  document.getElementById("track-next-stop").textContent = nextStopName;
}

function toggleSimPlayPause() {
  isSimRunning = !isSimRunning;
  const playBtn = document.getElementById("sim-play-pause-btn");
  if (isSimRunning) {
    playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Journey';
    playBtn.classList.remove("reset-btn");
    playBtn.classList.add("start-btn");
    addConsoleLog("Simulation resumed.", "system");
  } else {
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume Journey';
    playBtn.classList.remove("start-btn");
    playBtn.classList.add("reset-btn");
    addConsoleLog("Simulation paused.", "system");
  }
}

function updateSimSpeed(val) {
  simSpeedMultiplier = parseInt(val);
  document.getElementById("sim-speed-lbl").textContent = `${val}x Speed`;
  
  if (isSimRunning) {
    // Restart interval with new timings
    startSimInterval();
  }
}

function resetSim() {
  isSimRunning = false;
  if (simInterval) clearInterval(simInterval);
  
  currentStopIndex = 0;
  simProgress = 0;
  
  // Abort alarm audio
  stopAlarmSound();
  
  // Screen reset
  showScreen("screen-home");
  
  // Reset engine button states
  document.getElementById("sim-play-pause-btn").disabled = true;
  document.getElementById("sim-play-pause-btn").innerHTML = '<i class="fa-solid fa-play"></i> Play Journey';
  document.getElementById("sim-reset-btn").disabled = true;

  // Show Toast
  const toast = document.getElementById("sim-toast");
  toast.classList.remove("hidden");
  toast.querySelector("span").textContent = "Select a route and tap 'Start Safe Snooze' on the phone app.";

  drawMapState();
  updateTimelineUI();
  addConsoleLog("Simulator reset to starting terminal.", "system");
}

function abortTrip() {
  addConsoleLog("Commuter cancelled tracking alert.", "warning");
  resetSim();
}

// ----------------------------------------------------
// GEOFENCE EVALUATOR & ALARM TRIGGERS
// ----------------------------------------------------
function checkGeofenceTrigger() {
  if (!currentRoute) return;

  const stopsLeft = currentDestinationIndex - currentStopIndex;
  
  // Trigger 1: WARNING ALARM (N stops ahead buffer)
  if (stopsLeft === alertBufferStops && simProgress === 0) {
    addConsoleLog(`[ALERT] Commuter is ${alertBufferStops} stops away from destination!`, 'alarm');
    triggerAlarmUI(false); // warning alarm
  }
  
  // Trigger 2: FINAL ARRIVAL ALARM (0 stops left - Geofence Entered)
  if (currentStopIndex >= currentDestinationIndex) {
    addConsoleLog(`[CRITICAL] Geofence entered for destination stop: ${currentRoute.stops[currentDestinationIndex].name}!`, 'alarm');
    triggerAlarmUI(true); // final alarm
    
    // Stop simulation movement
    isSimRunning = false;
    if (simInterval) clearInterval(simInterval);
    document.getElementById("sim-play-pause-btn").disabled = true;
  }
}

// Force immediate Alarm trigger (simulation test button)
function triggerImmediateAlertSim() {
  if (!currentRoute) {
    // If no route active, pick default first
    loadPresetRoute('bus');
    startTrackingTrip();
  }
  
  addConsoleLog("[TEST] Direct manual alarm simulation triggered.", 'warning');
  triggerAlarmUI(true);
}

// Draw Alert Screen and start synthesis audio
function triggerAlarmUI(isFinalArrival) {
  showScreen("screen-alarm");

  const mainMsgEl = document.getElementById("alarm-main-msg");
  const subMsgEl = document.getElementById("alarm-sub-msg");
  
  const destName = currentRoute ? currentRoute.stops[currentDestinationIndex].name : "Your Destination";

  if (isFinalArrival) {
    mainMsgEl.textContent = "WAKE UP!";
    subMsgEl.textContent = `You have arrived at your destination stop: "${destName}".`;
  } else {
    mainMsgEl.textContent = "PRE-ALERT WAKEUP";
    subMsgEl.textContent = `You are ${alertBufferStops} stops away from "${destName}". Prepare to exit.`;
  }

  // Shake warning banner/alert
  showGlobalBanner(`ALERT: Approaching ${destName}!`);

  // Start Sound synthesis (Web Audio API)
  playAlarmSound(selectedRingtone);

  // Start TTS Speech synthesis
  speakWakeUpPhrase(destName, isFinalArrival);

  // Trigger browser device vibration (Navigator API)
  if (navigator.vibrate) {
    navigator.vibrate([500, 300, 500, 300, 500]);
  }
}

// Dismiss alarm
function dismissAlarm() {
  addConsoleLog("Alarm dismissed by user.", 'info');
  stopAlarmSound();
  
  if (currentStopIndex >= currentDestinationIndex) {
    // Journey fully finished
    showScreen("screen-home");
    resetSim();
  } else {
    // Warn zone snooze - return to tracking
    showScreen("screen-tracking");
  }
}

// Snooze alarm for 1 minute (simulated by backing off warning parameter)
function snoozeAlarm() {
  addConsoleLog("User snoozed the alarm for 1 minute.", 'warning');
  stopAlarmSound();
  
  // Return to tracking, will trigger alert again upon next check if conditions met
  showScreen("screen-tracking");
  
  // Temporary bypass buffer decrement to trigger again shortly
  if (currentStopIndex < currentDestinationIndex) {
    // Push the warning threshold forward
    alertBufferStops = Math.max(0, alertBufferStops - 1);
    addConsoleLog(`Snooze adjusted. Alarm will re-trigger ${alertBufferStops} stops before destination.`, 'system');
  }
}

// ----------------------------------------------------
// WEB AUDIO & SPEECH SYNTHESIZERS (Mute bypass mock)
// ----------------------------------------------------
function speakWakeUpPhrase(stopName, isFinal) {
  if (!('speechSynthesis' in window)) {
    addConsoleLog("[Speech API] TTS not supported in this browser.", 'warning');
    return;
  }

  // Cancel current speakings
  window.speechSynthesis.cancel();

  // Create wake text (Nagpur local accent support description)
  let text = `Wake up, passenger. Your stop ${stopName} is approaching. Please wake up.`;
  if (isFinal) {
    text = `Wake up! Wake up! You have arrived at your destination stop: ${stopName}. Please collect your belongings and exit the vehicle.`;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95; // slightly slower for clarity inside transit noise
  utterance.pitch = 1.1; // higher tone to catch attention
  
  // Use local voice if available
  const voices = window.speechSynthesis.getVoices();
  const indianVoice = voices.find(voice => voice.lang.includes('IN') || voice.name.includes('India'));
  if (indianVoice) utterance.voice = indianVoice;

  window.speechSynthesis.speak(utterance);
  addConsoleLog("[Speech API] Text-To-Speech announcement active.", 'system');
}

function playSampleSound() {
  const playIcon = document.getElementById("sample-play-icon");
  
  if (isAlarmSounding) {
    stopAlarmSound();
    playIcon.className = "fa-solid fa-play";
  } else {
    selectedRingtone = document.getElementById("alarm-ringtone").value;
    playAlarmSound(selectedRingtone);
    playIcon.className = "fa-solid fa-square";
    
    // Auto-stop sample after 5 seconds
    setTimeout(() => {
      if (playIcon.className === "fa-solid fa-square") {
        stopAlarmSound();
        playIcon.className = "fa-solid fa-play";
      }
    }, 5000);
  }
}

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy security lock bypass requirement)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playAlarmSound(type) {
  try {
    initAudioContext();
    stopAlarmSound(); // Clear any playing oscillation loops

    isAlarmSounding = true;
    
    // Create Nodes
    alarmOscillator = audioCtx.createOscillator();
    alarmGainNode = audioCtx.createGain();
    
    alarmOscillator.connect(alarmGainNode);
    alarmGainNode.connect(audioCtx.destination);

    // Initial Volume setup (Max bypass mock)
    alarmGainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);

    const now = audioCtx.currentTime;

    if (type === 'melody') {
      // Gentle waking arpeggio loop: C4 -> E4 -> G4 -> C5
      alarmOscillator.type = 'sine';
      alarmOscillator.frequency.setValueAtTime(261.63, now); // C4
      alarmOscillator.start(now);
      
      let noteIndex = 0;
      const freqs = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C
      
      syntheticMelodyTimer = setInterval(() => {
        if (!isAlarmSounding || !alarmOscillator) return;
        noteIndex = (noteIndex + 1) % freqs.length;
        alarmOscillator.frequency.setValueAtTime(freqs[noteIndex], audioCtx.currentTime);
      }, 250);
      
    } else if (type === 'siren') {
      // Rapid sweeping pitch oscillator for high-energy alarms
      alarmOscillator.type = 'sawtooth';
      alarmOscillator.frequency.setValueAtTime(400, now);
      alarmOscillator.start(now);
      
      let goingUp = true;
      syntheticMelodyTimer = setInterval(() => {
        if (!isAlarmSounding || !alarmOscillator) return;
        let currFreq = alarmOscillator.frequency.value;
        if (goingUp) {
          currFreq += 40;
          if (currFreq >= 900) goingUp = false;
        } else {
          currFreq -= 40;
          if (currFreq <= 400) goingUp = true;
        }
        alarmOscillator.frequency.setValueAtTime(currFreq, audioCtx.currentTime);
      }, 20);

    } else if (type === 'chime') {
      // Gentle repeating bells
      alarmOscillator.type = 'triangle';
      alarmOscillator.frequency.setValueAtTime(880.00, now); // A5
      alarmOscillator.start(now);
      
      syntheticMelodyTimer = setInterval(() => {
        if (!isAlarmSounding || !alarmGainNode) return;
        // Ring envelope effect (strike and decay)
        alarmGainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        alarmGainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      }, 1000);

    } else { // Custom Riff
      // Fast pulsing beeper (typical alarm sound bypassing silence switches)
      alarmOscillator.type = 'square';
      alarmOscillator.frequency.setValueAtTime(1000, now); // 1kHz sharp frequency
      alarmOscillator.start(now);
      
      syntheticMelodyTimer = setInterval(() => {
        if (!isAlarmSounding || !alarmGainNode) return;
        let currentVol = alarmGainNode.gain.value;
        alarmGainNode.gain.setValueAtTime(currentVol > 0.05 ? 0.001 : 0.5, audioCtx.currentTime);
      }, 150);
    }

    addConsoleLog(`[Audio Synth] Alarm ringing: tone profile "${type.toUpperCase()}"`, 'alarm');

  } catch (err) {
    console.error("Audio Context initialization failed", err);
    addConsoleLog("Failed to initiate audio context (Click on page to authorize autoplay).", "warning");
  }
}

function stopAlarmSound() {
  isAlarmSounding = false;
  if (syntheticMelodyTimer) {
    clearInterval(syntheticMelodyTimer);
    syntheticMelodyTimer = null;
  }
  
  if (alarmOscillator) {
    try {
      alarmOscillator.stop();
      alarmOscillator.disconnect();
    } catch(e) {}
    alarmOscillator = null;
  }

  if (alarmGainNode) {
    alarmGainNode.disconnect();
    alarmGainNode = null;
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ----------------------------------------------------
// RTO FARE GUARD ENGINE
// ----------------------------------------------------
let isNightFareActive = false;

function setFareNight(isNight) {
  isNightFareActive = isNight;
  
  document.getElementById("btn-day-fare").classList.toggle("active", !isNight);
  document.getElementById("btn-night-fare").classList.toggle("active", isNight);
  
  calculateFare();
}

function calculateFare() {
  const vehicle = document.getElementById("fare-travel-type").value;
  const distance = parseFloat(document.getElementById("fare-distance").value) || 0;
  const luggageCount = parseInt(document.getElementById("fare-luggage").value) || 0;

  const rates = rtoRates[vehicle];
  if (!rates) return;

  // Base km deduction
  let computedFare = rates.baseFare;
  
  if (distance > rates.baseKm) {
    const extraDistance = distance - rates.baseKm;
    computedFare += extraDistance * rates.perKm;
  }

  // Apply night surcharge if active
  let nightSurcharge = 0;
  if (isNightFareActive) {
    nightSurcharge = computedFare * (rates.nightSurchargePct / 100);
  }

  // Luggage charges
  const luggageFare = luggageCount * rates.luggageCharge;

  // Total
  const finalFare = Math.round(computedFare + nightSurcharge + luggageFare);

  // Update UI display
  document.getElementById("rec-base-fare").textContent = `₹${rates.baseFare.toFixed(2)}`;
  document.getElementById("rec-km-lbl").textContent = Math.max(0, distance - rates.baseKm).toFixed(1);
  
  const distFareVal = Math.max(0, distance - rates.baseKm) * rates.perKm;
  document.getElementById("rec-dist-fare").textContent = `₹${distFareVal.toFixed(2)}`;
  document.getElementById("rec-night-surcharge").textContent = `₹${nightSurcharge.toFixed(2)}`;
  document.getElementById("rec-luggage-fare").textContent = `₹${luggageFare.toFixed(2)}`;
  document.getElementById("rec-total-fare").textContent = `₹${finalFare}.00`;

  // Standard Driver Demanded Quote estimations (often 50% to 100% higher)
  const minQuote = Math.round(finalFare * 1.4);
  const maxQuote = Math.round(finalFare * 1.8 + 20);
  document.getElementById("rec-driver-quote").textContent = `₹${minQuote} - ₹${maxQuote}`;
}

function showHomeScreen() {
  phoneNavigate('home');
}

function simulateFareReceiptShare() {
  const vehicleName = document.getElementById("fare-travel-type").options[document.getElementById("fare-travel-type").selectedIndex].text;
  const dist = document.getElementById("fare-distance").value;
  const total = document.getElementById("rec-total-fare").textContent;
  
  const body = document.getElementById("modal-receipt-body");
  body.innerHTML = `
    <div class="receipt-card" style="border-top: 4px solid var(--gold); padding: 1.5rem 1rem;">
      <div class="receipt-header" style="margin-bottom: 1rem;">
        <i class="fa-solid fa-shield-halved" style="font-size: 2.2rem; color: var(--gold); margin-bottom: 0.5rem;"></i>
        <h4 style="font-family: 'Outfit', sans-serif; font-size: 1rem; color: #fff;">NAGPUR RTO FARE VERIFIED</h4>
        <span style="font-size: 0.65rem;">Generated by TransitWake FareSentry</span>
      </div>
      <div class="receipt-divider" style="border-top: 1px dashed rgba(255,255,255,0.15); margin: 0.8rem 0;"></div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; font-size: 0.75rem; margin-bottom: 0.5rem;">
        <span>Vehicle Class:</span>
        <strong style="color: #fff;">${vehicleName}</strong>
      </div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; font-size: 0.75rem; margin-bottom: 0.5rem;">
        <span>Distance Computed:</span>
        <strong style="color: #fff;">${dist} KM</strong>
      </div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; font-size: 0.75rem; margin-bottom: 0.5rem;">
        <span>Rate Profile:</span>
        <strong style="color: #fff;">${isNightFareActive ? 'Night Tariff (1.25x)' : 'Day Tariff (Normal)'}</strong>
      </div>
      <div class="receipt-divider" style="border-top: 1px dashed rgba(255,255,255,0.15); margin: 0.8rem 0;"></div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; font-size: 0.9rem; font-weight: bold; margin-top: 0.5rem;">
        <span style="color: var(--gold);">Legal Fare Limit:</span>
        <span style="color: var(--gold); font-size: 1.1rem;">${total}</span>
      </div>
      <p style="font-size: 0.65rem; color: var(--text-secondary); line-height: 1.4; margin-top: 1rem; font-style: italic; background: rgba(0,240,255,0.05); padding: 0.5rem; border-radius: 6px;">
        * Under Maharashtra RTO Rule 14, passengers are obligated to pay ONLY standard tariff card metrics. Drivers demanding excess charges can be prosecuted.
      </p>
    </div>
  `;

  openModal('receipt-modal');
  addConsoleLog(`Generated RTO rate receipt for ${dist} km journey (${total}).`, 'info');
}

// ----------------------------------------------------
// DYNAMIC RISK & FEASIBILITY ANALYSIS DIALS
// ----------------------------------------------------
function recomputeRisk() {
  const gpsVal = parseInt(document.getElementById("risk-slider-gps").value);
  const batteryVal = parseInt(document.getElementById("risk-slider-battery").value);
  const driverVal = parseInt(document.getElementById("risk-slider-driver").value);

  // Label mappings
  const valLabels = { 1: "Low", 2: "Medium", 3: "High / Aggressive" };
  document.getElementById("risk-val-gps").textContent = valLabels[gpsVal];
  document.getElementById("risk-val-battery").textContent = valLabels[batteryVal];
  document.getElementById("risk-val-driver").textContent = valLabels[driverVal];

  // Feasibility Math
  // More restrictions = lower feasibility score
  const baseScore = 100;
  const gpsPenalty = (3 - gpsVal) * 8; // Max 16
  const batteryPenalty = (3 - batteryVal) * 12; // Max 24
  const driverPenalty = (3 - driverVal) * 10; // Max 20
  
  // Total score starts lower when restrictions are High
  // High slider values represents higher problems
  const totalScoreVal = 100 - (gpsVal * 8) - (batteryVal * 10) - (driverVal * 10);
  const finalScore = Math.max(10, Math.min(95, totalScoreVal));

  document.getElementById("feasibility-pct").textContent = `${finalScore}%`;

  // Set visual color badges and warning desc
  const badge = document.getElementById("feasibility-badge");
  const lossDesc = document.getElementById("feasibility-loss-desc");

  if (finalScore >= 75) {
    badge.textContent = "High Viability";
    badge.className = "badge neon-blue-badge";
    lossDesc.textContent = "Excellent feasibility. Lower obstacles make this app a low-risk project with high customer retention potential. Background execution can be easily managed if battery restrictions are weak.";
  } else if (finalScore >= 50) {
    badge.textContent = "Moderate Risk";
    badge.className = "badge badge-warning";
    lossDesc.textContent = "Nagpur's transit conditions present real hurdles. Operating background GPS tracking drains battery, while strict iOS background execution policies make mute-bypassing alarm loops difficult to build in web sandboxes, necessitating hybrid wrappers (Capacitor/Cordova).";
  } else {
    badge.textContent = "High Risk / Critical";
    badge.className = "badge";
    badge.style.backgroundColor = "rgba(255, 56, 96, 0.15)";
    badge.style.color = "var(--red)";
    badge.style.border = "1px solid rgba(255, 56, 96, 0.3)";
    
    lossDesc.textContent = "CRITICAL VIABILITY WARNING: High chance of commercial failure. Severe driver pushback on rate cards and aggressive battery throttling from Android/iOS will kill the background thread frequently. Missing even 1 stop will lead to immediate app uninstalls.";
  }
}

function switchAnalyticsTab(tabId) {
  // Reset tabs
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

  // Make active
  document.getElementById(tabId).classList.add("active");
  
  if (tabId === 'tab-restrictions') document.getElementById("tab-btn-restrictions").classList.add("active");
  if (tabId === 'tab-feasibility') document.getElementById("tab-btn-feasibility").classList.add("active");
  if (tabId === 'tab-nagpur') document.getElementById("tab-btn-nagpur").classList.add("active");
}

// ----------------------------------------------------
// DIALOGS & SHARING
// ----------------------------------------------------
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

function simulateShareSOS() {
  openModal('share-modal');
  addConsoleLog("Safety Live tracking link shared with SOS contacts.", "info");
}

function copyClipboard() {
  const copyText = document.getElementById("clipboard-link");
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(copyText.value);

  const btn = document.querySelector(".btn-copy");
  btn.textContent = "Copied!";
  btn.style.background = "var(--green)";
  btn.style.color = "#fff";
  
  setTimeout(() => {
    btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
    btn.style.background = "var(--cyan)";
    btn.style.color = "#0b0d19";
  }, 2000);
}

// ----------------------------------------------------
// CANVAS MAP RENDERER (SVG replacement for reliability)
// ----------------------------------------------------
let canvas = null;
let ctx = null;

function initMapCanvas() {
  canvas = document.getElementById("nagpur-map");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  drawMapState();
}

function drawMapState() {
  if (!canvas || !ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background grid lines (cyber styling)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  ctx.lineWidth = 1;
  const gridSize = 30;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  if (!currentRoute) return;

  const stops = currentRoute.stops;

  // 1. Draw Route line segments
  ctx.beginPath();
  ctx.moveTo(stops[0].x, stops[0].y);
  for (let i = 1; i < stops.length; i++) {
    ctx.lineTo(stops[i].x, stops[i].y);
  }
  ctx.strokeStyle = activeMode === 'metro' ? "var(--purple)" : activeMode === 'cab' ? "var(--gold)" : "var(--cyan)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Glow shadow for path line
  ctx.strokeStyle = activeMode === 'metro' ? "rgba(191, 85, 236, 0.4)" : activeMode === 'cab' ? "rgba(255, 215, 0, 0.4)" : "rgba(0, 240, 255, 0.4)";
  ctx.lineWidth = 10;
  ctx.stroke();

  // 2. Draw Geofence radius circle around target destination
  const selectedDestVal = parseInt(document.getElementById("phone-destination-select").value) || (stops.length - 1);
  if (selectedDestVal < stops.length) {
    const destStop = stops[selectedDestVal];
    ctx.beginPath();
    ctx.arc(destStop.x, destStop.y, 45, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(255, 215, 0, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 215, 0, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]); // dashed fence boundary
    ctx.stroke();
    ctx.setLineDash([]); // clear dash
    
    // Label geofence
    ctx.font = "8px monospace";
    ctx.fillStyle = "var(--gold)";
    ctx.textAlign = "center";
    ctx.fillText("Wakeup Geofence", destStop.x, destStop.y - 50);
  }

  // 3. Draw Route Nodes (Stops)
  stops.forEach((stop, index) => {
    ctx.beginPath();
    ctx.arc(stop.x, stop.y, index === selectedDestVal ? 7 : 5, 0, 2 * Math.PI);
    
    // Node coloring
    if (index === selectedDestVal) {
      ctx.fillStyle = "var(--gold)"; // Destination
    } else if (index === currentStopIndex) {
      ctx.fillStyle = "var(--purple)"; // Current position stop
    } else if (index < currentStopIndex) {
      ctx.fillStyle = activeMode === 'metro' ? "var(--purple)" : activeMode === 'cab' ? "var(--gold)" : "var(--cyan)"; // Passed
    } else {
      ctx.fillStyle = "#1b203c"; // Unvisited
    }
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = index === selectedDestVal ? 2 : 1;
    ctx.stroke();

    // Node Names (Top or Bottom offsets to prevent overlap)
    ctx.font = "9px Inter, sans-serif";
    ctx.fillStyle = index === selectedDestVal ? "var(--gold)" : index === currentStopIndex ? "#ffffff" : "var(--text-secondary)";
    ctx.textAlign = "center";
    const offset = (index % 2 === 0) ? -12 : 16;
    ctx.fillText(stop.name.replace("Station", ""), stop.x, stop.y + offset);
  });

  // 4. Draw Simulated Vehicle
  if (currentStopIndex < stops.length) {
    let vehX = stops[currentStopIndex].x;
    let vehY = stops[currentStopIndex].y;

    // Linearly interpolate coordinates between current and next stop based on segment progress
    if (simProgress > 0 && currentStopIndex + 1 < stops.length) {
      const nextStop = stops[currentStopIndex + 1];
      const ratio = simProgress / 100;
      vehX = vehX + (nextStop.x - vehX) * ratio;
      vehY = vehY + (nextStop.y - vehY) * ratio;
    }

    // Vehicle circle dot wrapper
    ctx.beginPath();
    ctx.arc(vehX, vehY, 11, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.fill();
    ctx.shadowBlur = 0; // reset shadow

    // Inner vehicle type icon representation
    ctx.fillStyle = "#000000";
    ctx.font = "10px FontAwesome";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    let vehIcon = "\uf207"; // default bus icon
    if (activeMode === 'metro') vehIcon = "\uf238"; // metro train
    if (activeMode === 'cab') vehIcon = "\uf1b9"; // cab auto
    
    ctx.fillText(vehIcon, vehX, vehY);
    ctx.textBaseline = "alphabetic"; // reset baseline
  }
}

// ----------------------------------------------------
// DIAGNOSTIC LOG CONSOLE
// ----------------------------------------------------
function addConsoleLog(text, type = 'info') {
  const consoleEl = document.getElementById("console-log");
  if (!consoleEl) return;

  logCount++;
  const line = document.createElement("div");
  line.className = `log-line ${type}-line`;
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = `[${time}] ${text}`;
  
  consoleEl.appendChild(line);
  
  // Auto scroll to bottom
  consoleEl.scrollTop = consoleEl.scrollHeight;

  // Cap lines count
  if (consoleEl.children.length > 50) {
    consoleEl.removeChild(consoleEl.firstChild);
  }
}

function clearConsole() {
  const consoleEl = document.getElementById("console-log");
  if (consoleEl) {
    consoleEl.innerHTML = '<div class="log-line system-line">[SYSTEM] Logs cleared. Waiting for actions...</div>';
  }
}

// ----------------------------------------------------
// ALERTS & TOASTS
// ----------------------------------------------------
function showGlobalBanner(text) {
  const banner = document.getElementById("global-alert-banner");
  const txt = document.getElementById("global-alert-text");
  
  txt.textContent = text;
  banner.classList.add("active");
  
  setTimeout(() => {
    banner.classList.remove("active");
  }, 4500);
}
