// ─── Chennai One style transit data (mock, realistic) ────────────────────────

export type MetroStation = {
  name: string;
  line: "Blue" | "Green";
  interchange?: boolean;
};

export const METRO_LINE_1: MetroStation[] = [
  { name: "Wimco Nagar Depot", line: "Blue" },
  { name: "Wimco Nagar", line: "Blue" },
  { name: "Tiruvottriyur", line: "Blue" },
  { name: "Tiruvottriyur Theradi", line: "Blue" },
  { name: "Kaladipet", line: "Blue" },
  { name: "Tollgate", line: "Blue" },
  { name: "New Washermanpet", line: "Blue" },
  { name: "Tondiarpet", line: "Blue" },
  { name: "Sir Theagaraya College", line: "Blue" },
  { name: "Washermanpet", line: "Blue" },
  { name: "Mannadi", line: "Blue" },
  { name: "High Court", line: "Blue" },
  { name: "Central Metro", line: "Blue", interchange: true },
  { name: "Government Estate", line: "Blue" },
  { name: "LIC", line: "Blue" },
  { name: "Thousand Lights", line: "Blue" },
  { name: "AG-DMS", line: "Blue" },
  { name: "Teynampet", line: "Blue" },
  { name: "Nandanam", line: "Blue" },
  { name: "Saidapet", line: "Blue" },
  { name: "Little Mount", line: "Blue" },
  { name: "Guindy", line: "Blue" },
  { name: "Alandur", line: "Blue", interchange: true },
  { name: "Nanganallur Road", line: "Blue" },
  { name: "Meenambakkam", line: "Blue" },
  { name: "Airport", line: "Blue" },
];

export const METRO_LINE_2: MetroStation[] = [
  { name: "Central Metro", line: "Green", interchange: true },
  { name: "Egmore", line: "Green" },
  { name: "Nehru Park", line: "Green" },
  { name: "Pachaiyappa's College", line: "Green" },
  { name: "Kilpauk", line: "Green" },
  { name: "Shenoy Nagar", line: "Green" },
  { name: "Anna Nagar East", line: "Green" },
  { name: "Anna Nagar Tower", line: "Green" },
  { name: "Thirumangalam", line: "Green" },
  { name: "Koyambedu", line: "Green" },
  { name: "CMBT", line: "Green" },
  { name: "Arumbakkam", line: "Green" },
  { name: "Vadapalani", line: "Green" },
  { name: "Ashok Nagar", line: "Green" },
  { name: "Ekkattuthangal", line: "Green" },
  { name: "Alandur", line: "Green", interchange: true },
  { name: "St. Thomas Mount", line: "Green" },
];

export type JourneySummary = {
  fare: number;
  stations: number;
  minutes: number;
  km: number;
  firstTrain: string;
  lastTrain: string;
  trains: { time: string; code: string }[];
};

// Meenambakkam → Government Estate (via Line 1)
export const SAMPLE_METRO_JOURNEY: JourneySummary = {
  fare: 40,
  stations: 10,
  minutes: 29,
  km: 14.72,
  firstTrain: "04:53",
  lastTrain: "23:10",
  trains: [
    { time: "05:00", code: "P2" },
    { time: "05:04", code: "P2" },
    { time: "05:07", code: "P2" },
    { time: "05:14", code: "P2" },
  ],
};

export const METRO_ROUTE_INFO: string[] = [
  "Meenambakkam",
  "Nanganallur Road",
  "Alandur",
  "Saidapet",
  "Nandanam",
  "Teynampet",
  "AG-DMS",
  "Thousand Lights",
  "LIC",
  "Government Estate",
];

// ─── MTC buses ───────────────────────────────────────────────────────────────

export type LiveBus = {
  routeNo: string;
  name: string;
  via: string;
  destination: string;
  arrivalTime: string;
  etaMin: number;
  status: "On Time" | "Delayed" | "Approaching" | "Arriving";
  stopsAway: number;
  occupancy: "Low" | "Moderate" | "High";
  fare: number;
  type: "Ordinary" | "Express" | "Deluxe" | "AC";
};

export const LIVE_BUSES: LiveBus[] = [
  {
    routeNo: "578",
    name: "Sriperumbudur Bus",
    via: "Via Chennai - Bengaluru Hwy",
    destination: "Sriperumbudur Bus Stop",
    arrivalTime: "4:35 PM",
    etaMin: 22,
    status: "On Time",
    stopsAway: 7,
    occupancy: "Moderate",
    fare: 35,
    type: "Deluxe",
  },
  {
    routeNo: "21G",
    name: "GST Road Express",
    via: "Via GST Road",
    destination: "Tambaram Sanatorium",
    arrivalTime: "4:52 PM",
    etaMin: 14,
    status: "Approaching",
    stopsAway: 3,
    occupancy: "High",
    fare: 25,
    type: "Express",
  },
  {
    routeNo: "1A",
    name: "Marina Beach Rider",
    via: "Via Kamarajar Salai",
    destination: "Thiruvanmiyur",
    arrivalTime: "5:04 PM",
    etaMin: 26,
    status: "Delayed",
    stopsAway: 11,
    occupancy: "Moderate",
    fare: 15,
    type: "Ordinary",
  },
  {
    routeNo: "570",
    name: "Oragadam IT Corridor",
    via: "Via Outer Ring Rd",
    destination: "Sriperumbudur",
    arrivalTime: "5:18 PM",
    etaMin: 40,
    status: "On Time",
    stopsAway: 15,
    occupancy: "Low",
    fare: 45,
    type: "AC",
  },
];

export const BUS_STOPS_578: { name: string; eta?: string; passed?: boolean }[] = [
  { name: "CMBT Koyambedu", eta: "4:13 PM", passed: true },
  { name: "Maduravoyal", eta: "4:19 PM", passed: true },
  { name: "Porur Junction", eta: "4:24 PM", passed: true },
  { name: "Mount Poonamallee", eta: "4:27 PM", passed: true },
  { name: "Poonamallee Terminus", eta: "4:31 PM", passed: false },
  { name: "Thirumazhisai", eta: "4:33 PM", passed: false },
  { name: "Nazarethpettai", eta: "4:34 PM", passed: false },
  { name: "Irungattukottai", eta: "4:35 PM", passed: false },
  { name: "Sriperumbudur Bus Stop", eta: "4:47 PM", passed: false },
];

export const BUS_ALERTS: { icon: string; title: string; time: string; body: string }[] = [
  {
    icon: "bus",
    title: "Route 578 departed Poonamallee",
    time: "2 min ago",
    body: "Bus is running on schedule. Next stop: Thirumazhisai.",
  },
  {
    icon: "clock",
    title: "Peak hour notice",
    time: "15 min ago",
    body: "Expect moderate crowding on NH4 corridor between 4 PM - 7 PM.",
  },
  {
    icon: "shield",
    title: "Safety ride enabled",
    time: "1 hr ago",
    body: "Live location sharing is ON for this journey with your trusted contacts.",
  },
];

// ─── Explore places ──────────────────────────────────────────────────────────

export type Place = {
  name: string;
  area: string;
  category: "Heritage" | "Museum" | "Park" | "Beach" | "Temple";
  distance: string;
  rating: number;
  art: "fort" | "museum" | "park" | "beach" | "temple" | "vivek" | "planet";
  blurb: string;
};

export const EXPLORE_PLACES: Place[] = [
  { name: "Fort St. George", area: "Rajaji Salai, George Town", category: "Heritage", distance: "3.2 km", rating: 4.5, art: "fort", blurb: "1644 fortress, seat of Tamil Nadu's government" },
  { name: "Kapaleeshwarar Temple", area: "Mylapore", category: "Temple", distance: "5.8 km", rating: 4.7, art: "temple", blurb: "7th-century Dravidian temple with towering gopuram" },
  { name: "San Thome Basilica", area: "Santhome", category: "Heritage", distance: "6.1 km", rating: 4.6, art: "vivek", blurb: "Neo-Gothic cathedral by the Marina shore" },
  { name: "Government Museum", area: "Pantheon Rd, Egmore", category: "Museum", distance: "2.4 km", rating: 4.3, art: "museum", blurb: "1851 museum with bronze gallery & artefacts" },
  { name: "Birla Planetarium", area: "Gandhi Mandapam Rd", category: "Museum", distance: "7.5 km", rating: 4.4, art: "planet", blurb: "Dome theatre with cosmic sky shows" },
  { name: "Guindy National Park", area: "Sardar Patel Rd", category: "Park", distance: "9.8 km", rating: 4.4, art: "park", blurb: "City forest with blackbucks & snake park" },
  { name: "Semmozhi Poonga", area: "Cathedral Rd", category: "Park", distance: "4.0 km", rating: 4.5, art: "park", blurb: "20-acre botanical garden in the heart of the city" },
  { name: "Marina Beach", area: "Kamarajar Salai", category: "Beach", distance: "3.9 km", rating: 4.6, art: "beach", blurb: "India's longest urban beach promenade" },
];

// ─── GCC city services ───────────────────────────────────────────────────────

export type CityService = {
  name: string;
  desc: string;
  icon: string;
  color: string; // tailwind bg for icon chip
  badge?: string;
};

export const CITY_SERVICES: CityService[] = [
  { name: "CUMTA Datasets", desc: "Open GTFS data", icon: "database", color: "bg-blue-100 text-blue-700", badge: "Open" },
  { name: "Property Tax", desc: "Pay & receipts", icon: "building", color: "bg-rose-100 text-rose-600", badge: "Due" },
  { name: "Water & Sewage", desc: "Metro water bill", icon: "droplet", color: "bg-sky-100 text-sky-600" },
  { name: "Birth Certificate", desc: "Apply & download", icon: "baby", color: "bg-amber-100 text-amber-600" },
  { name: "Death Certificate", desc: "Apply & download", icon: "file", color: "bg-slate-100 text-slate-600" },
  { name: "Trade License", desc: "Renew & track", icon: "store", color: "bg-emerald-100 text-emerald-600" },
  { name: "Grievance", desc: "Lodge complaint", icon: "megaphone", color: "bg-orange-100 text-orange-600" },
  { name: "Marriage Reg.", desc: "Certificates", icon: "heart", color: "bg-pink-100 text-pink-600" },
  { name: "Building Plan", desc: "Approvals", icon: "ruler", color: "bg-indigo-100 text-indigo-600" },
  { name: "Street Lights", desc: "Fault reporting", icon: "lamp", color: "bg-yellow-100 text-yellow-700" },
  { name: "Garbage", desc: "Solid waste", icon: "trash", color: "bg-teal-100 text-teal-600" },
  { name: "Public Health", desc: "Clinics & camps", icon: "health", color: "bg-red-100 text-red-600" },
  { name: "Parks & Play", desc: "Facilities", icon: "tree", color: "bg-green-100 text-green-700" },
];

// ─── Promo carousel ──────────────────────────────────────────────────────────

export type Promo = {
  title: string;
  subtitle: string;
  cta: string;
  action: "safety" | "live" | "ticket";
  art: "sos" | "bus" | "qr";
};

export const PROMOS: Promo[] = [
  { title: "Setup Safety Now!", subtitle: "Safe and Reliable Rides", cta: "Set up", action: "safety", art: "sos" },
  { title: "Track Buses Live", subtitle: "Real-time arrivals on the map", cta: "Track", action: "live", art: "bus" },
  { title: "Scan & Book Tickets", subtitle: "QR ticketing across MTC buses", cta: "Book", action: "ticket", art: "qr" },
];

// ─── Tickets ─────────────────────────────────────────────────────────────────

export type ActiveTicket = {
  id: string;
  mode: "bus" | "metro";
  from: string;
  to: string;
  passengers: number;
  fare: number;
  validTill: string;
  issued: string;
};

export const ACTIVE_TICKET: ActiveTicket = {
  id: "MTX-8821-4402",
  mode: "metro",
  from: "Government Estate",
  to: "Meenambakkam",
  passengers: 1,
  fare: 40,
  validTill: "Today, 9:45 PM",
  issued: "3:47 PM",
};

export const TICKET_HISTORY: { id: string; mode: "bus" | "metro" | "pass"; title: string; sub: string; fare: number; date: string }[] = [
  { id: "MTB-7710-9931", mode: "bus", title: "Bus 21G · Parrys → Tambaram", sub: "1 passenger · Ordinary", fare: 25, date: "Yesterday" },
  { id: "MTX-6604-8120", mode: "metro", title: "Metro · Guindy → Central", sub: "2 passengers", fare: 60, date: "Nov 2" },
  { id: "PAS-2291-0047", mode: "pass", title: "Metro Monthly Pass", sub: "Valid Oct 1 – Oct 31", fare: 1000, date: "Oct 1" },
  { id: "MTB-5543-2210", mode: "bus", title: "Bus 578 · CMBT → Sriperumbudur", sub: "1 passenger · Deluxe", fare: 35, date: "Sep 29" },
];

// ─── Safety ──────────────────────────────────────────────────────────────────

export const EMERGENCY_NUMBERS: { label: string; number: string; icon: string }[] = [
  { label: "Police", number: "100", icon: "shield" },
  { label: "Ambulance", number: "108", icon: "health" },
  { label: "Fire & Rescue", number: "101", icon: "flame" },
  { label: "Women Helpline", number: "1091", icon: "phone" },
  { label: "Child Helpline", number: "1098", icon: "baby" },
  { label: "Metro Help", number: "044-2345 5100", icon: "metro" },
];

export const TRUSTED_CONTACTS: { name: string; relation: string; phone: string }[] = [
  { name: "Priya Kumar", relation: "Sister", phone: "+91 98407 22114" },
  { name: "Rahul Menon", relation: "Friend", phone: "+91 90031 58420" },
];

// ─── Chennai One v3 · CUMTA redesign (home + map) ─────────────────────────────

export const USER_AREA = "Ramapuram";
export const NEARBY_STOP = "Ramapuram Srm University";

/** Home position — SRM Easwari Engineering College area, Ramapuram. */
export const USER_LOCATION = { lat: 13.032, lon: 80.1755 };

/** Bus route 578 (CMBT → Sriperumbudur along NH4) with real-world coords. */
export const BUS_ROUTE_578_GEO: { name: string; lat: number; lon: number; passed?: boolean }[] = [
  { name: "CMBT Koyambedu", lat: 13.0674, lon: 80.1945, passed: true },
  { name: "Maduravoyal", lat: 13.0716, lon: 80.1718, passed: true },
  { name: "Porur Junction", lat: 13.0356, lon: 80.156, passed: true },
  { name: "Mount Poonamallee", lat: 13.0243, lon: 80.1285, passed: true },
  { name: "Poonamallee Terminus", lat: 13.0485, lon: 80.0962, passed: false },
  { name: "Thirumazhisai", lat: 13.0404, lon: 80.0589, passed: false },
  { name: "Nazarethpettai", lat: 13.0325, lon: 80.0335, passed: false },
  { name: "Irungattukottai", lat: 12.9956, lon: 79.9881, passed: false },
  { name: "Sriperumbudur Bus Stop", lat: 12.9682, lon: 79.952, passed: false },
];

/** Metro Blue Line journey (Meenambakkam → Government Estate) coords from CUMTA GTFS. */
export const METRO_JOURNEY_GEO: { name: string; lat: number; lon: number }[] = [
  { name: "Meenambakkam", lat: 12.9877, lon: 80.1764 },
  { name: "Nanganallur Road", lat: 12.9997, lon: 80.194 },
  { name: "Alandur", lat: 13.0043, lon: 80.2016 },
  { name: "Saidapet", lat: 13.0238, lon: 80.2283 },
  { name: "Nandanam", lat: 13.0315, lon: 80.2407 },
  { name: "Teynampet", lat: 13.0372, lon: 80.2465 },
  { name: "AG-DMS", lat: 13.0452, lon: 80.2482 },
  { name: "Thousand Lights", lat: 13.0585, lon: 80.2587 },
  { name: "LIC", lat: 13.0647, lon: 80.2663 },
  { name: "Government Estate", lat: 13.0697, lon: 80.2728 },
];

export type ModeCardId = "bus" | "metro" | "train" | "auto" | "taxi";
export const MODE_CARDS: { id: ModeCardId; label: string; sub: string }[] = [
  { id: "bus", label: "Bus", sub: "MTC · live tracking" },
  { id: "metro", label: "Metro", sub: "CMRL · QR tickets" },
  { id: "train", label: "Train", sub: "Suburban rail" },
  { id: "auto", label: "Auto", sub: "Namma Yatri" },
  { id: "taxi", label: "Taxi", sub: "Last-mile cabs" },
];

export type NearbyRouteRow = {
  code: string;
  to: string;
  kind: "live" | "scheduled";
  eta?: string;
  time?: string;
};
export type NearbyRouteGroup = { towards: string; routes: NearbyRouteRow[] };

export const NEARBY_ROUTES: NearbyRouteGroup[] = [
  {
    towards: "RAMAPURAM",
    routes: [
      { code: "S26", to: "To Valasaravakkam", kind: "live", eta: "15 MIN" },
      { code: "S20", to: "To Broadway", kind: "scheduled", time: "EXP · 5:25 PM" },
      { code: "88C", to: "To Kundrathur", kind: "scheduled", time: "5:40 PM" },
    ],
  },
  {
    towards: "PORUR",
    routes: [
      { code: "578", to: "To Sriperumbudur", kind: "live", eta: "22 MIN" },
      { code: "54P", to: "To Poonamallee", kind: "scheduled", time: "5:32 PM" },
    ],
  },
];

// Nearby map pins with real-world coordinates around Ramapuram.
export type MapPin = { name: string; lat: number; lon: number; active?: boolean };

export const MAP_BUS_STOPS: MapPin[] = [
  { name: "Ramapuram SRM University", lat: 13.032, lon: 80.1755, active: true },
  { name: "Ramapuram Signal", lat: 13.029, lon: 80.179, active: true },
  { name: "L&T Back Gate", lat: 13.0168, lon: 80.1785, active: true },
  { name: "Manapakkam", lat: 13.0151, lon: 80.1675 },
  { name: "Porur Junction", lat: 13.0356, lon: 80.156 },
  { name: "Kattupakkam", lat: 13.0628, lon: 80.1438 },
  { name: "Maduravoyal", lat: 13.0716, lon: 80.1718 },
  { name: "Koyambedu CMBT", lat: 13.0674, lon: 80.1945 },
];

export const MAP_METRO_STATIONS: MapPin[] = [
  { name: "CMBT", lat: 13.0684, lon: 80.204 },
  { name: "Vadapalani", lat: 13.0509, lon: 80.212 },
  { name: "Ashok Nagar", lat: 13.0354, lon: 80.211 },
  { name: "Ekkattuthangal", lat: 13.0171, lon: 80.2055 },
  { name: "Alandur", lat: 13.0043, lon: 80.2016 },
  { name: "Guindy", lat: 13.0091, lon: 80.2131 },
  { name: "St. Thomas Mount", lat: 12.9949, lon: 80.1977 },
];

export const MAP_RAILWAY_STATIONS: MapPin[] = [
  { name: "Mambalam", lat: 13.0387, lon: 80.2279 },
  { name: "Saidapet", lat: 13.0213, lon: 80.2232 },
  { name: "Guindy", lat: 13.0087, lon: 80.2131 },
  { name: "St. Thomas Mount", lat: 12.9938, lon: 80.1962 },
  { name: "Tambaram", lat: 12.9257, lon: 80.1174 },
  { name: "Chennai Beach", lat: 13.0917, lon: 80.2921 },
  { name: "Chennai Central", lat: 13.0832, lon: 80.2755 },
  { name: "Chennai Egmore", lat: 13.0777, lon: 80.2614 },
];

// ─── Travel passes ───────────────────────────────────────────────────────────

export type TravelPass = {
  id: string;
  name: string;
  operator: string;
  price: number;
  validity: string;
  note?: string;
  color: string;
  icon: "metro" | "bus" | "student" | "tourist";
  active?: boolean;
};

export const TRAVEL_PASSES: TravelPass[] = [
  {
    id: "metro-monthly",
    name: "Metro Monthly Pass",
    operator: "CMRL · Blue & Green Lines",
    price: 1000,
    validity: "Valid 1 Nov – 30 Nov",
    note: "Auto-renews on 30 Nov",
    color: "#1A6FE0",
    icon: "metro",
    active: true,
  },
  { id: "bus-monthly", name: "MTC Monthly Pass", operator: "MTC · Ordinary & Deluxe", price: 1200, validity: "30 days from purchase", color: "#B07818", icon: "bus" },
  { id: "student", name: "Student Concession", operator: "MTC · School & College", price: 300, validity: "Full academic year", color: "#1E9E5A", icon: "student" },
  { id: "tourist", name: "Tourist Day Pass", operator: "Bus + Metro + Train", price: 150, validity: "1 day · unlimited rides", color: "#E8442E", icon: "tourist" },
];
