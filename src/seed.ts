// One-off seed script. Not imported by the app — nothing in src/ references
// this file, and App.tsx must never do so, so it is not in the bundle and
// seedTheses() is not reachable as a global. To run it (docs/03 §8), on the dev
// server, signed in as an account already promoted to STAFF, in the browser
// devtools console:
//
//   const m = await import("/src/seed.ts"); await m.seedTheses();
//
// Safe to re-run: theses whose title already exists are skipped. If an older
// version of this script ran twice, removeDuplicateTheses() cleans up.
//
// It writes documents the way the app will, using the same shapes and the same
// server clock, so the seeded archive ranks identically to a real one.
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { AccountRole, Thesis } from "./types";

/**
 * What goes into a `theses` document, minus the two fields Firestore owns:
 * `id` is the document id, `registeredAt` is a serverTimestamp().
 *
 * `status` stays ThesisStatus by virtue of coming off Thesis, so a typo or a
 * lowercase value here is a compile error rather than a document that no badge,
 * filter or isPending() call will ever match.
 *
 * No `driveFileId` here. That field belongs to the Step 06 Drive-link parsing,
 * and adding it now would mean writing an empty value into every seeded
 * document for a field the app has not started reading.
 */
type ThesisToSeed = Omit<Thesis, "id" | "registeredAt">;

/** 21 records: the prototype's 8, plus 13 written so BM25 has a corpus worth
 *  ranking. All ten departments appear, so the department filter has something
 *  to filter and status is spread across all three values. */
const THESES_TO_SEED: ThesisToSeed[] = [
  {
    title: "Biodiversity Assessment of Macro-invertebrates in Cagayan River Tributaries of Isabela Province",
    abstract: "This study assessed the biodiversity of macro-invertebrates in selected tributaries of the Cagayan River within Isabela Province. Using standard sampling protocols, 47 taxa were identified across 12 sampling stations. Shannon diversity index values ranged from 1.84 to 3.21, with upstream stations showing significantly higher diversity. Results indicate that agricultural runoff and sedimentation are primary stressors affecting macroinvertebrate communities. The study recommends targeted riparian buffer restoration and agricultural best management practices to improve water quality and ecological integrity in the region.",
    keywords: ["biodiversity", "macroinvertebrates", "Cagayan River", "water quality", "ecological assessment"],
    department: "Biology",
    year: 2024,
    adviser: "Dr. Maria Santos",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Precision Agriculture Using IoT-Based Soil Moisture Monitoring for Rice Cultivation in Echague Valley",
    abstract: "This research developed and validated an IoT-based soil moisture monitoring system tailored for rice cultivation in the Echague Valley. Sixteen sensor nodes deployed across four rice paddies transmitted real-time soil moisture data via LoRaWAN to a cloud dashboard. Irrigation scheduling based on sensor data reduced water usage by 34% compared to traditional flood irrigation while maintaining comparable yields of 6.2 t/ha. The system achieved 94.7% uptime over a 120-day growing season, demonstrating viability for smallholder farmers with minimal technical overhead.",
    keywords: ["IoT", "precision agriculture", "soil moisture", "rice cultivation", "LoRaWAN", "irrigation"],
    department: "Agriculture",
    year: 2024,
    adviser: "Engr. Jose Reyes",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Machine Learning-Based Early Detection of Blast Disease in Lowland Rice Using Hyperspectral Imaging",
    abstract: "A convolutional neural network model was developed to detect early-stage rice blast disease (Magnaporthe oryzae) using hyperspectral images captured by UAV-mounted sensors. The model achieved 96.3% accuracy in distinguishing blast-infected from healthy leaf tissue at 3-5 days pre-symptomatic stage. Transfer learning from ResNet-50 backbone reduced training requirements to 1,200 labeled samples. Field validation across three municipalities in Isabela demonstrated 89.1% precision under variable lighting conditions.",
    keywords: ["machine learning", "rice blast", "hyperspectral imaging", "CNN", "UAV", "plant disease detection"],
    department: "Computer Science",
    year: 2024,
    adviser: "Dr. Anna Cruz",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Community-Based Agroforestry Practices and Their Impact on Carbon Sequestration in Upland Isabela",
    abstract: "This study quantified carbon sequestration potential of community-based agroforestry systems in upland Isabela using allometric equations and field measurements across 85 plots in 12 barangays. Agroforestry systems stored an average of 47.3 Mg C/ha compared to 12.1 Mg C/ha in monoculture corn. Integration of timber species such as Gmelina arborea with perennial crops significantly enhanced above-ground biomass accumulation. Socioeconomic analysis revealed that participating households earned 28% higher net income.",
    keywords: ["agroforestry", "carbon sequestration", "upland farming", "biomass", "Isabela", "sustainable agriculture"],
    department: "Forestry",
    year: 2023,
    adviser: "Dr. Roberto Dela Cruz",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Development of Cassava-Based Bioethanol as Alternative Fuel Source for Rural Communities in Cagayan Valley",
    abstract: "This research optimized fermentation conditions for bioethanol production from locally-sourced cassava starch in Cagayan Valley. Using Saccharomyces cerevisiae under controlled pH (4.5-5.0) and temperature (30-32 degrees C), maximum ethanol yield of 0.48 g/g was achieved at 72-hour fermentation. Life cycle assessment indicated 67% reduction in greenhouse gas emissions compared to conventional gasoline, with raw material costs of PHP 18.40 per liter making it economically viable for rural energy cooperatives.",
    keywords: ["bioethanol", "cassava", "fermentation", "biofuel", "Cagayan Valley", "renewable energy"],
    department: "Chemical Engineering",
    year: 2024,
    adviser: "Engr. Liza Pagulayan",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Watershed Management Plan for Pinacanauan River Using GIS-Based Hydrological Modeling",
    abstract: "A comprehensive watershed management plan was formulated for the Pinacanauan River watershed using GIS-integrated SWAT hydrological modeling. Land use/land cover analysis revealed 23% forest cover loss over 15 years, contributing to elevated peak discharge and sediment loads. Simulated intervention scenarios indicated that reforestation of 8,000 ha of critical watershed areas would reduce peak flows by 31% and sediment yield by 44%. The study provides spatial prioritization maps for intervention and a governance framework involving 24 barangays across three municipalities.",
    keywords: ["watershed management", "GIS", "hydrological modeling", "SWAT", "Pinacanauan River", "reforestation"],
    department: "Environmental Science",
    year: 2023,
    adviser: "Dr. Carmen Villanueva",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "DRAFT",
    registeredBy: "",
  },
  {
    title: "Effectiveness of Project-Based Learning on Student Academic Performance in STEM Education",
    abstract: "This quasi-experimental study evaluated the effectiveness of project-based learning (PBL) on academic performance among Grade 11 STEM students in Echague, Isabela. Using a pretest-posttest control group design with 120 participants, the PBL group demonstrated significantly higher posttest scores (mean = 84.2) compared to the traditional instruction group (mean = 76.5). Qualitative interviews revealed increased engagement, self-directed learning, and collaborative skills among PBL participants. The study recommends integration of PBL approaches across STEM disciplines in senior high school programs.",
    keywords: ["project-based learning", "STEM education", "academic performance", "senior high school", "Isabela"],
    department: "Education",
    year: 2024,
    adviser: "Prof. Elena Bulan",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Impact of E-Commerce Adoption on the Revenue Growth of Micro-Enterprises in Echague Municipality",
    abstract: "This descriptive-correlational study examined the impact of e-commerce adoption on revenue growth among 180 registered micro-enterprises in Echague, Isabela. Findings revealed a statistically significant positive correlation (r = 0.67, p < 0.01) between e-commerce usage and quarterly revenue growth. Facebook Marketplace and Shopee were the most widely used platforms, while internet connectivity and digital literacy remained primary adoption barriers. Recommendations include targeted digital training programs and municipal Wi-Fi infrastructure development.",
    keywords: ["e-commerce", "micro-enterprises", "revenue growth", "digital commerce", "Echague", "business administration"],
    department: "Business Administration",
    year: 2023,
    adviser: "Dr. Paulo Mendoza",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "NEEDS_REVIEW",
    registeredBy: "",
  },

  // --- 12 added so BM25 has a corpus worth ranking ---
  {
    title: "Heavy Metal Contamination of Irrigation Water and Its Effect on Vegetable Yields in Echague",
    abstract: "Surface irrigation water serving vegetable farms in Echague, Isabela was analyzed for lead, cadmium, arsenic and chromium across nine sampling points and two cropping seasons. Lead and cadmium exceeded the Philippine drinking water guideline values in the two channels closest to urban runoff. Lettuce and pechay grown in the affected plots accumulated lead at levels 2.4 times higher than produce from the control site, with no visible symptoms of phytotoxicity. Recommendations include liming of acidic soils, intermittent irrigation scheduling and routine water quality monitoring by the municipal agriculture office.",
    keywords: ["heavy metals", "contamination", "irrigation water", "vegetable yield", "Echague", "food safety"],
    department: "Environmental Science",
    year: 2024,
    adviser: "Dr. Carmen Villanueva",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Design and Load Testing of a Low-Cost Footbridge for Rural Barangay Access",
    abstract: "A low-cost timber footbridge spanning the 18-meter wide tributaries of Echague was designed to national structural code standards using locally available materials. The prototype used coconut trunk poles, bamboo reinforcement and a compacted earth approach fill, targeting a design live load of 2.0 kN/m2. Static load testing to 1.5 times design capacity showed maximum midspan deflection of 14.2 mm, within the serviceability limit of 25 mm, and no visible failure of connections after 40,000 cycles of dynamic loading. Estimated construction cost is 62% below a conventional concrete bridge of equal span.",
    keywords: ["footbridge", "structural design", "load testing", "bamboo", "low-cost construction", "rural infrastructure"],
    department: "Civil Engineering",
    year: 2024,
    adviser: "Engr. Divina Grace Ochoa",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Flood Risk Mapping of Low-Lying Barangays Using LiDAR Elevation and GIS",
    abstract: "LiDAR-derived elevation data at 0.5-meter resolution was combined with hydrologic modeling to produce flood inundation maps for 14 low-lying barangays in Echague, Isabela. Simulations for a 20-year return period storm showed that 2,310 households and 18.4 km of road network are exposed, with depths exceeding 1.0 meter in the areas nearest the Pinacanauan tributary. The output identifies 63 priority locations for drainage improvement. Results are intended for local government use in land use planning and pre-emptive evacuation, and the methodology is transferable to other flood-prone municipalities in Cagayan Valley.",
    keywords: ["flood risk", "LiDAR", "GIS", "elevation mapping", "disaster preparedness", "hydrology"],
    department: "Civil Engineering",
    year: 2025,
    adviser: "Engr. Divina Grace Ochoa",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "NEEDS_REVIEW",
    registeredBy: "",
  },
  {
    title: "Community Health Nurse-Led Hypertension Management in Rural Isabela",
    abstract: "A quasi-experimental evaluation of a community health nurse-led hypertension management program was conducted across eight barangays in Echague, Isabela. The intervention combined monthly home visits, home blood pressure monitoring, medication adherence counseling and referral pathways, delivered to 214 adults with uncontrolled hypertension. Mean systolic blood pressure among participants fell by 18.4 mmHg over 12 months, against a 6.1 mmHg reduction in the comparison group. Control rates rose from 21% to 64%. Findings support the feasibility of task-shifting hypertension care to community health nurses in barangay health stations with sustained funding.",
    keywords: ["community health nursing", "hypertension", "health education", "primary care", "barangay health station", "nursing intervention"],
    department: "Nursing",
    year: 2025,
    adviser: "Prof. Liza Tiangson",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Nursing Students' Readiness for Clinical Practice: A Cross-Sectional Study",
    abstract: "A descriptive cross-sectional survey measured perceived clinical readiness among 186 nursing students at Isabela State University Echague Campus prior to their first clinical rotation. Readiness was assessed on competency confidence, knowledge of hospital protocols, infection control practice and exposure to clinical procedures. Only 43% of respondents met the composite readiness threshold. Students who had completed a structured skills laboratory rotation scored significantly higher than those who had not, suggesting that simulation-based practice is the strongest available preparation. The study recommends a mandatory pre-clinical skills assessment and a bridging course for students entering rotation.",
    keywords: ["nursing education", "clinical readiness", "nursing students", "skills laboratory", "competency-based education"],
    department: "Nursing",
    year: 2024,
    adviser: "Prof. Liza Tiangson",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Internet-Based Learning Platforms and Student Engagement in Rural Secondary Schools",
    abstract: "This correlational study examined the relationship between use of internet-based learning platforms and student engagement among 312 junior high school students in four schools in Isabela. Engagement was measured through a validated classroom engagement scale and corroborated with platform analytics. Frequency of platform use correlated moderately with behavioral, emotional and cognitive engagement (r = 0.48, p < 0.01), but the relationship weakened substantially when home internet access and device availability were controlled for. Results indicate that connectivity, not platform preference, is the binding constraint, and recommend prioritizing device sharing schemes and offline-capable content over further platform adoption.",
    keywords: ["e-learning", "student engagement", "ICT in education", "digital divide", "secondary education"],
    department: "Education",
    year: 2025,
    adviser: "Prof. Elena Bulan",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Entrepreneurial Orientation and Business Performance of Agritourism Cooperatives",
    abstract: "Using structural equation modeling, this study tested how innovation propensity, risk-taking propensity and proactiveness predict performance among 24 agritourism cooperatives in Echague, Isabela. Data from 192 cooperative members and managers showed that innovation propensity was the strongest direct predictor of business performance (beta = 0.47), while risk-taking and proactiveness operated indirectly through perceived market opportunity. Cooperatives that adopted value-added processing of rice and corn products reported 41% higher average revenue than those trading raw produce. Policy recommendations focus on shared processing facilities and market linkage programs at the municipal level.",
    keywords: ["agritourism", "entrepreneurial orientation", "cooperative", "business performance", "structural equation modeling"],
    department: "Business Administration",
    year: 2025,
    adviser: "Dr. Paulo Mendoza",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Growth Performance of Indigenous Timber Species in Restored Agroforestry Plots",
    abstract: "Field measurement over 36 months compared height, diameter and basal area growth of three indigenous timber species, namely Acacia mangium, Gmelina arborea and Santalum album, in restored agroforestry plots in Echague. Gmelina arborea recorded the highest volume increment at 12.8 m3/ha/year, while Santalum album showed slower early growth offset by rising unit value. Survival rates ranged from 71% to 88%, with Acacia mangium losses concentrated in waterlogged plots. The findings support mixed-species planting with site selection for drainage, and indicate that smallholder farmers can expect merchantable returns by year 12.",
    keywords: ["agroforestry", "timber species", "reforestation", "growth performance", "Gmelina arborea", "Isabela"],
    department: "Forestry",
    year: 2025,
    adviser: "Dr. Roberto Dela Cruz",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "DRAFT",
    registeredBy: "",
  },
  {
    title: "Extraction and Characterization of Bioactive Compounds from Mango Peel Waste",
    abstract: "Mango peel waste generated by processors in Isabela was valorized through solvent extraction and phytochemical screening. Total phenolic content of 84.2 mg GAE/g was obtained from the acetone extract, with antioxidant activity of 92.4% in the DPPH assay. HPLC analysis identified mangiferin, quercetin and chlorogenic acid as principal compounds. Microwave-assisted extraction reduced solvent consumption by 60% while raising yield by 11%, indicating energy-efficient scale-up is feasible. The work supports a circular economy approach to a significant agricultural waste stream and identifies potential inputs for functional food and cosmetic formulation.",
    keywords: ["waste valorization", "bioactive compounds", "mango peel", "antioxidant activity", "HPLC", "chemical engineering"],
    department: "Chemical Engineering",
    year: 2025,
    adviser: "Engr. Liza Pagulayan",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "NEEDS_REVIEW",
    registeredBy: "",
  },
  {
    title: "A Mobile Application for Local Rice Price Monitoring and Farmer Decision Support",
    abstract: "A prototype mobile application was developed and field-tested with 96 rice farmers in Echague, Isabela to deliver daily wholesale price information and variety-specific recommendations. The system aggregates trader-reported prices over a mobile data channel and displays seven-day price trends and buying volume by municipality. Usability testing recorded a System Usability Scale score of 82.5, above the acceptable threshold of 70. Farmers who consulted price trends before deciding to sell reported 14% higher realized price on average. A public API and SMS fallback channel are recommended as the next iteration to widen coverage beyond smartphone owners.",
    keywords: ["mobile application", "rice prices", "decision support", "mobile computing", "farmer information systems", "software development"],
    department: "Computer Science",
    year: 2025,
    adviser: "Dr. Anna Cruz",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Antagonistic Bacillus subtilis Strains for Biological Control of Rice Sheath Blight",
    abstract: "Bacterial strains isolated from rice rhizosphere soil in Echague were screened for antagonism against Rhizoctonia solani, the causal agent of rice sheath blight. Two isolates, BS-04 and BS-11, inhibited fungal growth by 62% and 55% respectively in dual culture assay, and produced clear inhibition zones of 14.2 mm and 11.8 mm on agar. Greenhouse challenge tests reduced disease incidence by 48% and lesion length by 39% when applied as a foliar spray at 10^8 cfu/mL. The isolates were identified by 16S rRNA sequencing. Biocontrol offers a lower-input alternative to fungicide application for sheath blight management in Isabela rice fields.",
    keywords: ["biological control", "Bacillus subtilis", "sheath blight", "rice", "biocontrol agent", "plant pathology"],
    department: "Biology",
    year: 2025,
    adviser: "Dr. Maria Santos",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED",
    registeredBy: "",
  },
  {
    title: "Intercropping Legumes with Corn in Isabela Smallholder Systems",
    abstract: "A two-season field experiment compared maize-legume intercropping ratios against sole maize cropping in Echague, Isabela. Treatments included maize with mungbean, peanut and cowpea at 2:1 and 1:2 row arrangements. Land equivalent ratio exceeded 1.0 for all intercropping treatments, peaking at 1.31 for maize with mungbean at 2:1. Intercropped plots required 32% less synthetic nitrogen, while legume residue contributed an estimated 24 kg N/ha to the following rice crop. Economic analysis showed a 19% increase in gross income per hectare, supporting intercropping as a low-risk diversification option for smallholder farmers in the region.",
    keywords: ["intercropping", "legumes", "maize", "land equivalent ratio", "smallholder farming", "crop diversification"],
    department: "Agriculture",
    year: 2025,
    adviser: "Engr. Jose Reyes",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "NEEDS_REVIEW",
    registeredBy: "",
  },
  {
    title: "Household Food Security and Coping Strategies in Isabela Fishing Communities",
    abstract: "This cross-sectional study assessed household food security and coping strategies among 240 households in six coastal and riverside barangays in Isabela. Using the Household Food Insecurity Access Scale, 52% of households were classified as food insecure, with fishing households reporting the highest prevalence at 63%. Coping strategies centered on borrowing food, reducing meal size and casual labor, and were associated with household debt. Seasonal variation followed the lean months preceding the fishing closure. Results point to the need for livelihood diversification and targeted food assistance timed to the closure period rather than delivered year-round.",
    keywords: ["food security", "livelihood", "fishing communities", "household coping strategies", "Isabela"],
    department: "Biology",
    year: 2024,
    adviser: "Dr. Maria Santos",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "DRAFT",
    registeredBy: "",
  },
];

/**
 * Write every thesis in THESES_TO_SEED. Returns how many were written.
 *
 * Sequential on purpose. A Promise.all over 20 addDoc calls is faster but
 * throws on the first rejection, leaving you unsure how many landed — and this
 * is a one-off script where a clear answer matters more than speed.
 */
export async function seedTheses(): Promise<number> {
  // Skip titles already in the archive, so running this twice cannot
  // duplicate the corpus (every duplicate would show up twice in search).
  const existing = new Set((await getDocs(collection(db, "theses"))).docs.map(d => normTitle(d.data().title)));
  let written = 0;
  for (const t of THESES_TO_SEED) {
    if (existing.has(normTitle(t.title))) continue;
    const { status, ...rest } = t;
    await addDoc(collection(db, "theses"), {
      ...rest,
      // Read from the list, never passed in by a caller. The type on
      // THESES_TO_SEED already guarantees it is one of STATUSES.
      status,
      // The server's clock, not the client's. "This Month" and newest-first
      // sorting are only correct if we do not trust browser clocks.
      registeredAt: serverTimestamp(),
    });
    written++;
  }
  return written;
}

function normTitle(title: unknown): string {
  return String(title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Delete extra copies of any thesis whose title appears more than once,
 * keeping one. Returns how many were deleted. Staff only (rules). Run from
 * devtools like seedTheses():
 *
 *   const m = await import("/src/seed.ts"); await m.removeDuplicateTheses();
 */
export async function removeDuplicateTheses(): Promise<number> {
  const seen = new Set<string>();
  let deleted = 0;
  for (const d of (await getDocs(collection(db, "theses"))).docs) {
    const key = normTitle(d.data().title);
    if (seen.has(key)) {
      await deleteDoc(d.ref);
      deleted++;
    } else {
      seen.add(key);
    }
  }
  return deleted;
}


/**
 * Set a user's role and department.
 *
 * NOT a way to promote real accounts. This runs in the browser, under
 * firestore.rules, and the rules forbid changing `role` — so once the rules are
 * published this call is denied, which is the protection working. Promote staff
 * in the Firebase console instead (docs/03 §8). Kept for the Rules Playground
 * and the emulator. `department` must be one of DEPARTMENTS, or "".
 */
export async function setMyRole(
  uid: string,
  role: AccountRole,
  department = "",
): Promise<void> {
  await setDoc(doc(db, "users", uid), { role, department }, { merge: true });
}
