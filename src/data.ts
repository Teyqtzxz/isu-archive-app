// Hardcoded sample data. Replaced by Firestore in steps 02/03 —
// this is the only module that should ever hold fake data.
import type { Thesis } from "./types";

export const SAMPLE_THESES: Thesis[] = [
  {
    id: "1",
    title: "Biodiversity Assessment of Macro-invertebrates in Cagayan River Tributaries of Isabela Province",
    department: "Biology",
    year: 2024,
    adviser: "Dr. Maria Santos",
    abstract: "This study assessed the biodiversity of macro-invertebrates in selected tributaries of the Cagayan River within Isabela Province. Using standard sampling protocols, 47 taxa were identified across 12 sampling stations. Shannon diversity index values ranged from 1.84 to 3.21, with upstream stations showing significantly higher diversity. Results indicate that agricultural runoff and sedimentation are primary stressors affecting macroinvertebrate communities. The study recommends targeted riparian buffer restoration and agricultural best management practices to improve water quality and ecological integrity in the region.",
    keywords: ["biodiversity", "macroinvertebrates", "Cagayan River", "water quality", "ecological assessment"],
    status: "ARCHIVED",
    registeredBy: "", registeredAt: "2024-11-15T00:00:00.000Z",
    driveLink: "#",
  },
  {
    id: "2",
    title: "Precision Agriculture Using IoT-Based Soil Moisture Monitoring for Rice Cultivation in Echague Valley",
    department: "Agriculture",
    year: 2024,
    adviser: "Engr. Jose Reyes",
    abstract: "This research developed and validated an IoT-based soil moisture monitoring system tailored for rice cultivation in the Echague Valley. Sixteen sensor nodes deployed across four rice paddies transmitted real-time soil moisture data via LoRaWAN to a cloud dashboard. Irrigation scheduling based on sensor data reduced water usage by 34% compared to traditional flood irrigation while maintaining comparable yields of 6.2 t/ha. The system achieved 94.7% uptime over a 120-day growing season, demonstrating viability for smallholder farmers with minimal technical overhead.",
    keywords: ["IoT", "precision agriculture", "soil moisture", "rice cultivation", "LoRaWAN", "irrigation"],
    status: "ARCHIVED",
    registeredBy: "", registeredAt: "2024-10-28T00:00:00.000Z",
    driveLink: "#",
  },
  {
    id: "3",
    title: "Machine Learning-Based Early Detection of Blast Disease in Lowland Rice Using Hyperspectral Imaging",
    department: "Computer Science",
    year: 2024,
    adviser: "Dr. Anna Cruz",
    abstract: "A convolutional neural network model was developed to detect early-stage rice blast disease (Magnaporthe oryzae) using hyperspectral images captured by UAV-mounted sensors. The model achieved 96.3% accuracy in distinguishing blast-infected from healthy leaf tissue at 3–5 days pre-symptomatic stage. Transfer learning from ResNet-50 backbone reduced training requirements to 1,200 labeled samples. Field validation across three municipalities in Isabela demonstrated 89.1% precision under variable lighting conditions.",
    keywords: ["machine learning", "rice blast", "hyperspectral imaging", "CNN", "UAV", "plant disease detection"],
    status: "ARCHIVED",
    registeredBy: "", registeredAt: "2024-09-12T00:00:00.000Z",
    driveLink: "#",
  },
  {
    id: "4",
    title: "Community-Based Agroforestry Practices and Their Impact on Carbon Sequestration in Upland Isabela",
    department: "Forestry",
    year: 2023,
    adviser: "Dr. Roberto Dela Cruz",
    abstract: "This study quantified carbon sequestration potential of community-based agroforestry systems in upland Isabela using allometric equations and field measurements across 85 plots in 12 barangays. Agroforestry systems stored an average of 47.3 Mg C/ha compared to 12.1 Mg C/ha in monoculture corn. Integration of timber species such as Gmelina arborea with perennial crops significantly enhanced above-ground biomass accumulation. Socioeconomic analysis revealed that participating households earned 28% higher net income.",
    keywords: ["agroforestry", "carbon sequestration", "upland farming", "biomass", "Isabela", "sustainable agriculture"],
    status: "ARCHIVED",
    registeredBy: "", registeredAt: "2023-12-01T00:00:00.000Z",
    driveLink: "#",
  },
  {
    id: "5",
    title: "Development of Cassava-Based Bioethanol as Alternative Fuel Source for Rural Communities in Cagayan Valley",
    department: "Chemical Engineering",
    year: 2024,
    adviser: "Engr. Liza Pagulayan",
    abstract: "This research optimized fermentation conditions for bioethanol production from locally-sourced cassava starch in Cagayan Valley. Using Saccharomyces cerevisiae under controlled pH (4.5–5.0) and temperature (30–32°C), maximum ethanol yield of 0.48 g/g was achieved at 72-hour fermentation. Life cycle assessment indicated 67% reduction in greenhouse gas emissions compared to conventional gasoline, with raw material costs of PHP 18.40 per liter making it economically viable for rural energy cooperatives.",
    keywords: ["bioethanol", "cassava", "fermentation", "biofuel", "Cagayan Valley", "renewable energy"],
    status: "ARCHIVED",
    registeredBy: "", registeredAt: "2024-08-20T00:00:00.000Z",
    driveLink: "#",
  },
  {
    id: "6",
    title: "Watershed Management Plan for Pinacanauan River Using GIS-Based Hydrological Modeling",
    department: "Environmental Science",
    year: 2023,
    adviser: "Dr. Carmen Villanueva",
    abstract: "A comprehensive watershed management plan was formulated for the Pinacanauan River watershed using GIS-integrated SWAT hydrological modeling. Land use/land cover analysis revealed 23% forest cover loss over 15 years, contributing to elevated peak discharge and sediment loads. Simulated intervention scenarios indicated that reforestation of 8,000 ha of critical watershed areas would reduce peak flows by 31% and sediment yield by 44%. The study provides spatial prioritization maps for intervention and a governance framework involving 24 barangays across three municipalities.",
    keywords: ["watershed management", "GIS", "hydrological modeling", "SWAT", "Pinacanauan River", "reforestation"],
    status: "DRAFT",
    registeredBy: "", registeredAt: "2024-12-02T00:00:00.000Z",
    driveLink: "#",
  },
  {
    id: "7",
    title: "Effectiveness of Project-Based Learning on Student Academic Performance in STEM Education",
    department: "Education",
    year: 2024,
    adviser: "Prof. Elena Bulan",
    abstract: "This quasi-experimental study evaluated the effectiveness of project-based learning (PBL) on academic performance among Grade 11 STEM students in Echague, Isabela. Using a pretest-posttest control group design with 120 participants, the PBL group demonstrated significantly higher posttest scores (mean = 84.2) compared to the traditional instruction group (mean = 76.5). Qualitative interviews revealed increased engagement, self-directed learning, and collaborative skills among PBL participants. The study recommends integration of PBL approaches across STEM disciplines in senior high school programs.",
    keywords: ["project-based learning", "STEM education", "academic performance", "senior high school", "Isabela"],
    status: "ARCHIVED",
    registeredBy: "", registeredAt: "2024-07-18T00:00:00.000Z",
    driveLink: "#",
  },
  {
    id: "8",
    title: "Impact of E-Commerce Adoption on the Revenue Growth of Micro-Enterprises in Echague Municipality",
    department: "Business Administration",
    year: 2023,
    adviser: "Dr. Paulo Mendoza",
    abstract: "This descriptive-correlational study examined the impact of e-commerce adoption on revenue growth among 180 registered micro-enterprises in Echague, Isabela. Findings revealed a statistically significant positive correlation (r = 0.67, p < 0.01) between e-commerce usage and quarterly revenue growth. Facebook Marketplace and Shopee were the most widely used platforms, while internet connectivity and digital literacy remained primary adoption barriers. Recommendations include targeted digital training programs and municipal Wi-Fi infrastructure development.",
    keywords: ["e-commerce", "micro-enterprises", "revenue growth", "digital commerce", "Echague", "business administration"],
    status: "NEEDS_REVIEW",
    registeredBy: "", registeredAt: "2024-12-05T00:00:00.000Z",
    driveLink: "#",
  },
];

// DEPARTMENTS moved to ../types — it is a filter-value constant, not sample
// data, and step 04 deletes this module. Importing it from types.ts keeps the
// filter values alive when the sample data goes.

export const ADVISERS = ["Dr. Maria Santos", "Engr. Jose Reyes", "Dr. Anna Cruz", "Dr. Roberto Dela Cruz", "Engr. Liza Pagulayan", "Dr. Carmen Villanueva", "Dr. Paulo Mendoza", "Prof. Elena Bulan"];

