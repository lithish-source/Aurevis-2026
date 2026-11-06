// ─────────────────────────────────────────────────────────────────────────────
// Chennai place-name gazetteer + fuzzy geocoder for social-post geoparsing.
//
// Social posts almost never carry GPS. Instead we extract place mentions
// (either via the LLM classifier or by scanning the raw text) and resolve them
// against this curated list of metro stations, bus termini, neighbourhoods,
// junctions and corridors — each with real-world coordinates.
//
// Matching is token-boundary based (case/punctuation insensitive) with aliases
// ("Mount Road" → Anna Salai, "OMR" → Rajiv Gandhi Salai, …). Priority ranks
// which match wins when several places appear in one post (a junction or
// station beats a broad neighbourhood; a corridor is only a fallback).

export type GazetteerKind = "metro" | "terminus" | "junction" | "landmark" | "neighbourhood" | "corridor";

export type GazetteerEntry = {
  name: string;
  lat: number;
  lon: number;
  kind: GazetteerKind;
  aliases?: string[];
};

// Higher = preferred when several places match one text.
const PRIORITY: Record<GazetteerKind, number> = {
  metro: 5,
  terminus: 4,
  junction: 4,
  landmark: 3,
  neighbourhood: 2,
  corridor: 1,
};

export const CHENNAI_CENTER = { lat: 13.05, lon: 80.25 };

export const GAZETTEER: GazetteerEntry[] = [
  // ── Metro stations (Blue & Green lines) · CUMTA GTFS official coordinates ─
  { name: "Wimco Nagar Depot Metro", lat: 13.1843, lon: 80.3091, kind: "metro", aliases: ["wimco nagar depot"] },
  { name: "Wimco Nagar Metro", lat: 13.1787, lon: 80.3072, kind: "metro", aliases: ["wimco nagar"] },
  { name: "Tiruvottiyur Metro", lat: 13.1723, lon: 80.3054, kind: "metro", aliases: ["tiruvottiyur", "thiruvottiyur", "thiruvottriyur"] },
  { name: "Tiruvottriyur Theradi Metro", lat: 13.1599, lon: 80.3024, kind: "metro", aliases: ["theradi", "tiruvottiyur theradi"] },
  { name: "Kaladipet Metro", lat: 13.1508, lon: 80.2994, kind: "metro", aliases: ["kaladipet"] },
  { name: "Tollgate Metro", lat: 13.1435, lon: 80.2964, kind: "metro", aliases: ["tollgate"] },
  { name: "New Washermanpet Metro", lat: 13.1343, lon: 80.2929, kind: "metro", aliases: ["new washermanpet"] },
  { name: "Tondiarpet Metro", lat: 13.1241, lon: 80.2884, kind: "metro", aliases: ["tondiarpet"] },
  { name: "Sir Theagaraya College Metro", lat: 13.1165, lon: 80.2847, kind: "metro", aliases: ["sir theagaraya college", "theagaraya college"] },
  { name: "Washermanpet Metro", lat: 13.1074, lon: 80.2809, kind: "metro", aliases: ["washermanpet"] },
  { name: "Mannadi Metro", lat: 13.0953, lon: 80.286, kind: "metro", aliases: ["mannadi"] },
  { name: "High Court Metro", lat: 13.0874, lon: 80.2849, kind: "metro", aliases: ["high court"] },
  { name: "Central Metro", lat: 13.0817, lon: 80.2737, kind: "metro", aliases: ["chennai central metro", "central station metro", "puratchi thalaivar dr mgr central metro", "puratchi thalaivar dr mgr central", "puratchi thalaivar dr. mgr central", "சென்னை சென்ட்ரல்", "சென்ட்ரல்"] },
  { name: "Government Estate Metro", lat: 13.0697, lon: 80.2728, kind: "metro", aliases: ["government estate", "govt estate", "ஓமந்தூரார்"] },
  { name: "LIC Metro", lat: 13.0647, lon: 80.2663, kind: "metro", aliases: ["lic", "எல்ஐசி"] },
  { name: "Thousand Lights Metro", lat: 13.0585, lon: 80.2587, kind: "metro", aliases: ["thousand lights", "ஆயிரம் விளக்கு"] },
  { name: "AG-DMS Metro", lat: 13.0452, lon: 80.2482, kind: "metro", aliases: ["ag-dms", "dms", "டிஎம்எஸ்"] },
  { name: "Teynampet Metro", lat: 13.0372, lon: 80.2465, kind: "metro", aliases: ["teynampet", "தேனாம்பேட்டை"] },
  { name: "Nandanam Metro", lat: 13.0315, lon: 80.2407, kind: "metro", aliases: ["nandanam", "நந்தனம்"] },
  { name: "Saidapet Metro", lat: 13.0238, lon: 80.2283, kind: "metro", aliases: ["saidapet", "சைதாப்பேட்டை"] },
  { name: "Little Mount Metro", lat: 13.0147, lon: 80.2241, kind: "metro", aliases: ["little mount", "சின்னமலை"] },
  { name: "Guindy Metro", lat: 13.0091, lon: 80.2131, kind: "metro", aliases: ["guindy", "கிண்டி"] },
  { name: "Alandur Metro", lat: 13.0043, lon: 80.2016, kind: "metro", aliases: ["alandur", "arignar anna alandur", "ஆலந்தூர்"] },
  { name: "Nanganallur Road Metro", lat: 12.9997, lon: 80.194, kind: "metro", aliases: ["nanganallur", "nanganallur road", "நங்கநல்லூர்"] },
  { name: "Meenambakkam Metro", lat: 12.9877, lon: 80.1764, kind: "metro", aliases: ["meenambakkam", "மீனம்பாக்கம்"] },
  { name: "Airport Metro", lat: 12.9811, lon: 80.1641, kind: "metro", aliases: ["chennai airport", "airport", "airport metro", "விமான நிலையம்", "ஏர்போர்ட்"] },
  { name: "Egmore Metro", lat: 13.079, lon: 80.2611, kind: "metro", aliases: ["egmore", "எழும்பூர்"] },
  { name: "Nehru Park Metro", lat: 13.0787, lon: 80.2501, kind: "metro", aliases: ["nehru park", "நேரு பூங்கா"] },
  { name: "Pachaiyappa's College Metro", lat: 13.0755, lon: 80.2327, kind: "metro", aliases: ["pachaiyappa s college", "pachaiyappa", "பச்சையப்பன்"] },
  { name: "Kilpauk Metro", lat: 13.0776, lon: 80.2427, kind: "metro", aliases: ["kilpauk", "கீழ்ப்பாக்கம்"] },
  { name: "Shenoy Nagar Metro", lat: 13.0787, lon: 80.2251, kind: "metro", aliases: ["shenoy nagar", "செனாய் நகர்"] },
  { name: "Anna Nagar East Metro", lat: 13.0846, lon: 80.2189, kind: "metro", aliases: ["anna nagar east", "அண்ணா நகர் கிழக்கு"] },
  { name: "Anna Nagar Tower Metro", lat: 13.085, lon: 80.209, kind: "metro", aliases: ["anna nagar tower", "அண்ணா நகர் டவர்", "அண்ணா நகர்"] },
  { name: "Thirumangalam Metro", lat: 13.0852, lon: 80.2018, kind: "metro", aliases: ["thirumangalam", "திருமங்கலம்"] },
  { name: "Koyambedu Metro", lat: 13.0738, lon: 80.195, kind: "metro", aliases: ["koyambedu", "கோயம்பேடு"] },
  { name: "CMBT Metro", lat: 13.0684, lon: 80.204, kind: "metro", aliases: ["cmbt metro", "puratchi thalaivi dr j jayalalithaa cmbt metro", "சிஎம்பிடி"] },
  { name: "Arumbakkam Metro", lat: 13.0617, lon: 80.2117, kind: "metro", aliases: ["arumbakkam", "அரும்பாக்கம்"] },
  { name: "Vadapalani Metro", lat: 13.0509, lon: 80.212, kind: "metro", aliases: ["vadapalani", "வடபழனி"] },
  { name: "Ashok Nagar Metro", lat: 13.0354, lon: 80.211, kind: "metro", aliases: ["ashok nagar", "அசோக் நகர்"] },
  { name: "Ekkattuthangal Metro", lat: 13.0171, lon: 80.2055, kind: "metro", aliases: ["ekkattuthangal", "ஈக்காட்டுத்தாங்கல்"] },
  { name: "St. Thomas Mount Metro", lat: 12.9949, lon: 80.1977, kind: "metro", aliases: ["st thomas mount", "saint thomas mount", "parangimalai", "பரங்கிமலை"] },

  // ── Bus termini & railway · CUMTA GTFS official stations ────────────────
  { name: "CMBT Koyambedu", lat: 13.0674, lon: 80.1945, kind: "terminus", aliases: ["cmbt", "koyambedu", "chennai mofussil bus terminus", "koyambedu market", "கோயம்பேடு பேருந்து நிலையம்"] },
  { name: "Chennai Central", lat: 13.0832, lon: 80.2755, kind: "terminus", aliases: ["central station", "park town", "puratchi thalaivar mgr central", "mas", "சென்ட்ரல் ரயில் நிலையம்"] },
  { name: "Chennai Egmore", lat: 13.0777, lon: 80.2614, kind: "terminus", aliases: ["egmore station", "ms", "எழும்பூர் ரயில் நிலையம்"] },
  { name: "Chennai Beach Station", lat: 13.0917, lon: 80.2921, kind: "terminus", aliases: ["beach station", "msb", "கடற்கரை ரயில் நிலையம்"] },
  { name: "Poonamallee Terminus", lat: 13.0467, lon: 80.0942, kind: "terminus", aliases: ["poonamallee", "பூந்தமல்லி"] },
  { name: "Poonamallee Bypass Junction", lat: 13.0455, lon: 80.0985, kind: "junction", aliases: ["poonamallee bypass", "bypass junction poonamallee", "பூந்தமல்லி பைபாஸ்"] },
  { name: "Kumananchavadi", lat: 13.0503, lon: 80.1072, kind: "junction", aliases: ["kumananchavadi", "குமணன்சாவடி"] },
  { name: "Thirumazhisai", lat: 13.0497, lon: 80.0689, kind: "neighbourhood", aliases: ["thirumazhisai", "திருமழிசை"] },
  { name: "Sri Ramachandra Hospital", lat: 13.0357, lon: 80.1427, kind: "landmark", aliases: ["sri ramachandra", "sri ramachandra medical centre", "srmc", "ராமச்சந்திரா"] },
  { name: "Broadway Bus Stand", lat: 13.0872, lon: 80.2839, kind: "terminus", aliases: ["parrys", "parrys corner", "broadway", "broadway bus terminus", "பாரிமுனை"] },
  { name: "Tambaram Sanatorium", lat: 12.933, lon: 80.1135, kind: "terminus", aliases: ["tambaram sanatorium", "தாம்பரம் சானடோரியம்"] },
  { name: "Tambaram", lat: 12.9257, lon: 80.1174, kind: "terminus", aliases: ["tbm", "tambaram railway", "tambaram station", "தாம்பரம்"] },
  { name: "Avadi", lat: 13.1182, lon: 80.1018, kind: "neighbourhood", aliases: ["avadi station", "avd", "ஆவடி"] },
  { name: "Perambur", lat: 13.1077, lon: 80.2444, kind: "neighbourhood", aliases: ["perambur station", "per", "பெரம்பூர்"] },
  { name: "Mambalam Railway", lat: 13.0387, lon: 80.2279, kind: "landmark", aliases: ["mambalam", "west mambalam", "mbm", "மாம்பலம்"] },
  { name: "Kodambakkam Railway", lat: 13.0522, lon: 80.2307, kind: "landmark", aliases: ["kodambakkam", "mkk", "கோடம்பாக்கம்"] },
  { name: "Velachery Railway", lat: 12.9673, lon: 80.2193, kind: "terminus", aliases: ["velachery", "vlcy", "mrts velachery", "வேளச்சேரி"] },
  { name: "Chromepet Railway", lat: 12.9518, lon: 80.1411, kind: "landmark", aliases: ["chromepet", "cmp", "குரோம்பேட்டை"] },
  { name: "Pallavaram Railway", lat: 12.9683, lon: 80.1525, kind: "landmark", aliases: ["pallavaram", "pv", "பல்லாவரம்"] },
  { name: "Villivakkam Railway", lat: 13.1103, lon: 80.2091, kind: "landmark", aliases: ["villivakkam", "vlk", "வில்லிவாக்கம்"] },
  { name: "Tiruvallur Railway", lat: 13.1165, lon: 79.9143, kind: "terminus", aliases: ["tiruvallur", "trl"] },
  { name: "Chengalpattu", lat: 12.6936, lon: 79.9809, kind: "terminus", aliases: ["chengalpattu", "cgl", "chengalpet"] },

  // ── Junctions & flyovers ─────────────────────────────────────────────────
  { name: "Kathipara Junction", lat: 13.0072, lon: 80.2013, kind: "junction", aliases: ["kathipara", "kathipara flyover", "kathipara interchange", "கத்திப்பாரா", "கத்திப்பாரா சந்திப்பு"] },
  { name: "Madhya Kailash Junction", lat: 13.0098, lon: 80.2482, kind: "junction", aliases: ["madhya kailash", "mk junction", "மத்திய கைலாஷ்"] },
  { name: "Anna Flyover", lat: 13.0609, lon: 80.2506, kind: "junction", aliases: ["anna flyover", "gemini flyover", "gemini", "அண்ணா மேம்பாலம்"] },
  { name: "Padi Junction", lat: 13.0954, lon: 80.1917, kind: "junction", aliases: ["padi", "padi flyover", "பாடி"] },
  { name: "Porur Junction", lat: 13.0356, lon: 80.156, kind: "junction", aliases: ["porur", "போரூர்"] },
  { name: "Koyambedu Roundtana", lat: 13.0693, lon: 80.1948, kind: "junction", aliases: ["koyambedu roundtana", "ரவுண்டானா"] },
  { name: "Tidel Park Junction", lat: 12.9912, lon: 80.2463, kind: "junction", aliases: ["tidel park", "tidel", "டைடல் பார்க்"] },
  { name: "Ashok Pillar", lat: 13.0347, lon: 80.2128, kind: "junction", aliases: ["அசோக் பில்லர்"] },
  { name: "Halda Junction", lat: 12.9825, lon: 80.2005, kind: "junction", aliases: ["halda", "haldia junction"] },
  { name: "Moolakkadai Junction", lat: 13.1131, lon: 80.2615, kind: "junction", aliases: ["moolakkadai", "மூலக்கடை"] },
  { name: "Anna Square / Marina", lat: 13.055, lon: 80.2926, kind: "junction", aliases: ["anna square", "அண்ணா சதுக்கம்"] },

  // ── Landmarks ────────────────────────────────────────────────────────────
  { name: "Marina Beach", lat: 13.05, lon: 80.2824, kind: "landmark", aliases: ["marina", "மெரினா", "மெரினா கடற்கரை"] },
  { name: "Elliot's Beach", lat: 13.0002, lon: 80.2668, kind: "landmark", aliases: ["besant nagar", "bessy beach", "bessy"] },
  { name: "Fort St George", lat: 13.0878, lon: 80.2859, kind: "landmark", aliases: ["fort st george"] },
  { name: "Madras High Court", lat: 13.0885, lon: 80.287, kind: "landmark", aliases: ["high court"] },
  { name: "Ripon Building", lat: 13.0885, lon: 80.2767, kind: "landmark", aliases: ["ripon", "gcc headquarters", "greater chennai corporation"] },
  { name: "Valluvar Kottam", lat: 13.0621, lon: 80.2482, kind: "landmark" },
  { name: "Spencer Plaza", lat: 13.067, lon: 80.2521, kind: "landmark", aliases: ["spencers", "spencer"] },
  { name: "Express Avenue Mall", lat: 13.0615, lon: 80.2623, kind: "landmark", aliases: ["express avenue", "ea mall"] },
  { name: "Phoenix MarketCity Velachery", lat: 12.9826, lon: 80.2187, kind: "landmark", aliases: ["phoenix mall", "phoenix", "phoenix marketcity"] },
  { name: "Guindy National Park", lat: 13.0069, lon: 80.2376, kind: "landmark", aliases: ["guindy park", "national park"] },
  { name: "IIT Madras", lat: 13.0107, lon: 80.237, kind: "landmark", aliases: ["iit m", "iitm"] },
  { name: "Chennai Trade Centre", lat: 13.0653, lon: 80.1996, kind: "landmark", aliases: ["trade centre", "ctc"] },
  { name: "LIC Building", lat: 13.0638, lon: 80.2648, kind: "landmark", aliases: ["lic tower"] },

  // ── Neighbourhoods ───────────────────────────────────────────────────────
  { name: "T Nagar", lat: 13.0418, lon: 80.2341, kind: "neighbourhood", aliases: ["thyagaraya nagar", "pondy bazaar", "usman road", "ranganathan street"] },
  { name: "Nungambakkam", lat: 13.0569, lon: 80.2425, kind: "neighbourhood" },
  { name: "Kodambakkam", lat: 13.0494, lon: 80.2258, kind: "neighbourhood" },
  { name: "Chetpet", lat: 13.0732, lon: 80.245, kind: "neighbourhood" },
  { name: "Choolaimedu", lat: 13.0547, lon: 80.226, kind: "neighbourhood" },
  { name: "Purasaiwalkam", lat: 13.0866, lon: 80.2526, kind: "neighbourhood", aliases: ["purasawalkam"] },
  { name: "Egmore", lat: 13.0732, lon: 80.2609, kind: "neighbourhood" },
  { name: "Anna Nagar", lat: 13.085, lon: 80.21, kind: "neighbourhood", aliases: ["anna nagar west", "anna nagar east"] },
  { name: "Kolathur", lat: 13.125, lon: 80.205, kind: "neighbourhood" },
  { name: "Villivakkam", lat: 13.104, lon: 80.2061, kind: "neighbourhood" },
  { name: "Korattur", lat: 13.1118, lon: 80.181, kind: "neighbourhood" },
  { name: "Ambattur", lat: 13.1143, lon: 80.1548, kind: "neighbourhood", aliases: ["ambattur estate"] },
  { name: "Madhavaram", lat: 13.1482, lon: 80.2382, kind: "neighbourhood" },
  { name: "Puzhal", lat: 13.1952, lon: 80.2006, kind: "neighbourhood" },
  { name: "Red Hills", lat: 13.19, lon: 80.18, kind: "neighbourhood", aliases: ["redhills"] },
  { name: "Manali", lat: 13.17, lon: 80.26, kind: "neighbourhood" },
  { name: "Ennore", lat: 13.2197, lon: 80.3205, kind: "neighbourhood" },
  { name: "Mylapore", lat: 13.0338, lon: 80.2687, kind: "neighbourhood" },
  { name: "Royapettah", lat: 13.0556, lon: 80.2615, kind: "neighbourhood" },
  { name: "Triplicane", lat: 13.0543, lon: 80.2752, kind: "neighbourhood", aliases: ["thiruvallikeni"] },
  { name: "Chepauk", lat: 13.0622, lon: 80.2795, kind: "neighbourhood" },
  { name: "Adyar", lat: 13.0063, lon: 80.2574, kind: "neighbourhood" },
  { name: "Kotturpuram", lat: 13.0093, lon: 80.2442, kind: "neighbourhood" },
  { name: "Raja Annamalaipuram", lat: 13.0216, lon: 80.2635, kind: "neighbourhood", aliases: ["ra puram"] },
  { name: "Thiruvanmiyur", lat: 12.9829, lon: 80.2588, kind: "neighbourhood", aliases: ["tvmyr"] },
  { name: "Kottivakkam", lat: 12.9702, lon: 80.2651, kind: "neighbourhood" },
  { name: "Palavakkam", lat: 12.9607, lon: 80.2682, kind: "neighbourhood" },
  { name: "Neelankarai", lat: 12.9495, lon: 80.2705, kind: "neighbourhood" },
  { name: "Injambakkam", lat: 12.9371, lon: 80.2732, kind: "neighbourhood" },
  { name: "Taramani", lat: 12.9933, lon: 80.2433, kind: "neighbourhood" },
  { name: "Velachery", lat: 12.9791, lon: 80.2209, kind: "neighbourhood" },
  { name: "Madipakkam", lat: 12.9613, lon: 80.1978, kind: "neighbourhood" },
  { name: "Keelkattalai", lat: 12.935, lon: 80.18, kind: "neighbourhood" },
  { name: "Pallikaranai", lat: 12.933, lon: 80.209, kind: "neighbourhood" },
  { name: "Medavakkam", lat: 12.9188, lon: 80.1904, kind: "neighbourhood" },
  { name: "Perumbakkam", lat: 12.908, lon: 80.205, kind: "neighbourhood" },
  { name: "Perungudi", lat: 12.9657, lon: 80.2432, kind: "neighbourhood", aliases: ["perungudi omr"] },
  { name: "Thoraipakkam", lat: 12.9398, lon: 80.2337, kind: "neighbourhood" },
  { name: "Karapakkam", lat: 12.916, lon: 80.229, kind: "neighbourhood" },
  { name: "Sholinganallur", lat: 12.9016, lon: 80.2279, kind: "neighbourhood", aliases: ["shozhinganallur", "sholingnallur"] },
  { name: "Navalur", lat: 12.8437, lon: 80.2263, kind: "neighbourhood" },
  { name: "Siruseri", lat: 12.823, lon: 80.23, kind: "neighbourhood" },
  { name: "Kelambakkam", lat: 12.786, lon: 80.218, kind: "neighbourhood" },
  { name: "Pallavaram", lat: 12.9675, lon: 80.149, kind: "neighbourhood" },
  { name: "Chromepet", lat: 12.9516, lon: 80.1462, kind: "neighbourhood" },
  { name: "Selaiyur", lat: 12.899, lon: 80.127, kind: "neighbourhood" },
  { name: "Pazhavanthangal", lat: 12.9848, lon: 80.1798, kind: "neighbourhood" },
  { name: "Jafferkhanpet", lat: 13.0163, lon: 80.2081, kind: "neighbourhood", aliases: ["jaffer khan pet"] },
  { name: "Ashok Nagar", lat: 13.0356, lon: 80.2158, kind: "neighbourhood" },
  { name: "KK Nagar", lat: 13.041, lon: 80.2013, kind: "neighbourhood", aliases: ["k k nagar"] },
  { name: "Valasaravakkam", lat: 13.048, lon: 80.17, kind: "neighbourhood" },
  { name: "Maduravoyal", lat: 13.0716, lon: 80.1718, kind: "neighbourhood" },
  { name: "Ramapuram", lat: 13.032, lon: 80.1755, kind: "neighbourhood" },
  { name: "Manapakkam", lat: 13.0151, lon: 80.1675, kind: "neighbourhood" },
  { name: "Iyappanthangal", lat: 13.053, lon: 80.132, kind: "neighbourhood", aliases: ["iyyappanthangal"] },
  { name: "Vandalur", lat: 12.892, lon: 80.082, kind: "neighbourhood" },
  { name: "Tirusulam", lat: 12.982, lon: 80.16, kind: "neighbourhood", aliases: ["trisulam"] },

  // ── Corridors (fallback only — broad "OMR/ECR/Anna Salai" mentions) ──────
  { name: "OMR (Rajiv Gandhi Salai)", lat: 12.9657, lon: 80.2432, kind: "corridor", aliases: ["omr", "old mahabalipuram road", "rajiv gandhi salai", "it corridor", "omr road"] },
  { name: "ECR (East Coast Road)", lat: 12.98, lon: 80.262, kind: "corridor", aliases: ["ecr", "east coast road"] },
  { name: "Anna Salai", lat: 13.05, lon: 80.25, kind: "corridor", aliases: ["mount road"] },
  { name: "GST Road", lat: 12.96, lon: 80.13, kind: "corridor", aliases: ["gst road", "grand southern trunk road", "gst"] },
  { name: "Mount Poonamallee Road", lat: 13.049, lon: 80.1325, kind: "corridor", aliases: ["mount poonamallee road", "mount poonamallee", "mount-poonamallee"] },
  { name: "Poonamallee High Road", lat: 13.075, lon: 80.235, kind: "corridor", aliases: ["ph road", "evr periyar salai", "evr road"] },
  { name: "Inner Ring Road", lat: 13.02, lon: 80.19, kind: "corridor", aliases: ["irr", "inner ring road chennai"] },
];

// ── helpers ─────────────────────────────────────────────────────────────────

/** distance between two lat/lon points in km (haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalize(s: string): string {
  return ` ${s
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function mentionsAt(haystack: string, needle: string): number {
  const n = needle.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
  if (!n) return -1;
  // Match standalone or with colloquial Tanglish/Tamil suffixes (-la, -le, -il, -kitta, -pakkam)
  const re = new RegExp(`(^| )(${n.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})(la|le|il|kitta|pakkam| |$)`, "u");
  const m = re.exec(haystack);
  return m ? m.index + m[1].length : -1;
}

export type GazetteerMatch = {
  name: string;
  lat: number;
  lon: number;
  kind: GazetteerKind;
  priority: number;
  /** character position of the first mention in the text (lower = earlier). */
  pos: number;
  /** 2 when introduced by a locative preposition (at/near/before/…). */
  prep?: number;
};

/** Scan one or more text fragments for gazetteer place mentions. */
export function matchPlaces(text: string, extraMentions: string[] = []): GazetteerMatch[] {
  const fragments = [text, ...extraMentions].map(normalize).join(" | ");
  const found: GazetteerMatch[] = [];
  const seen = new Set<string>();
  for (const entry of GAZETTEER) {
    const names = [entry.name, ...(entry.aliases ?? [])];
    let bestPos = Infinity;
    for (const n of names) {
      const m = mentionsAt(fragments, n);
      if (m >= 0 && m < bestPos) bestPos = m;
    }
    if (bestPos < Infinity && !seen.has(entry.name)) {
      seen.add(entry.name);
      // Preposition bonus: a place introduced by at/near/before/towards… is
      // where the event happens; earlier mentions are often just context
      // ("Route 54 Broadway bus stuck before the Poonamallee bypass" →
      // Poonamallee wins over Broadway, the route destination).
      const prefix = fragments.slice(Math.max(0, bestPos - 18), bestPos);
      const prep = /(^| )(at|in|on|near|before|after|towards|toward|outside|opposite|around|via|front of|kitta|pakkam|la|le|varaikkum|அருகில்|பக்கத்தில்|இல்)( the)? $/i.test(prefix) ? 2 : 0;
      found.push({ ...entry, priority: PRIORITY[entry.kind], pos: bestPos, prep });
    }
  }
  // Primary = preposition-introduced place first (the incident location),
  // then earliest mention, then kind priority / name specificity.
  return found.sort(
    (a, b) => (b.prep ?? 0) - (a.prep ?? 0) || a.pos - b.pos || b.priority - a.priority || b.name.length - a.name.length,
  );
}

export type GeoResolution = {
  primary: GazetteerMatch | null;
  matches: GazetteerMatch[];
  /** true when the resolved location is implausibly far from Chennai. */
  outOfRegion: boolean;
};

/** Nearest known place to a GPS fix — the reverse of geocodePost. Used by the
 *  citizen report flow to turn auto-detected coordinates into a place label
 *  ("Porur Junction") so reports read like the social-pipeline ones. */
export function reverseGeocode(
  lat: number,
  lon: number,
  maxKm = 5,
): { name: string; kind: GazetteerKind; km: number } | null {
  let best: { name: string; kind: GazetteerKind; km: number } | null = null;
  for (const e of GAZETTEER) {
    const km = distanceKm({ lat, lon }, e);
    if (km <= maxKm && (best == null || km < best.km)) {
      best = { name: e.name, kind: e.kind, km };
    }
  }
  return best;
}

/** Resolve a post to coordinates from its text (plus optional LLM-extracted
 *  place mentions, which get scanned with the same gazetteer). */
export function geocodePost(text: string, extractedLocations: string[] = []): GeoResolution {
  const matches = matchPlaces(text, extractedLocations);
  const primary = matches[0] ?? null;
  const outOfRegion = primary ? distanceKm(primary, CHENNAI_CENTER) > 60 : false;
  return { primary, matches, outOfRegion };
}
