# Seismic Building Vulnerability Analyzer - Deployment & User Guide

## 📦 What You Have

### 1. **Standalone Executable** ✅
- **Location:** `dist/SeismicAnalyzer_Pro/SeismicAnalyzer_Pro.exe`
- **Size:** ~500MB (includes Python + all dependencies)
- **System Requirements:** Windows 7+ (64-bit)
- **No Installation Needed:** Just run the .exe file

### 2. **Python Source Code**
- **Main Script:** `analysis_gui_v2.py` (1700+ lines)
- **Launcher:** `run_analysis_v2.py`
- **Requirements:** `requirements.txt` (11 packages)
- **Integration:** Button in `analysis_gui.py` to launch v2 analyzer

---

## 🚀 Quick Start

### Option A: Run EXE (Easiest - No Python Needed)
```powershell
.\dist\SeismicAnalyzer_Pro\SeismicAnalyzer_Pro.exe
```

### Option B: Run Python Version (Requires 3.8+)
```powershell
# Activate venv first
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run analyzer
python analysis_gui_v2.py
```

### Option C: From Original App
Click **"🚀 Open Advanced Analyzer"** button in the sidebar of `analysis_gui.py`.

---

## 📊 Features Overview

### Core Analysis
- ✅ **Vulnerability Index**: Building-specific scoring (0-100)
  - Age-based risk (modern vs pre-1980)
  - Material type assessment
  - Foundation quality evaluation
  - Height/amplification factor
  - Current condition & damage analysis

### Smart Parsing
- ✅ **Comments Analysis**: CommentAnalyzer extracts keywords like:
  - "severe", "cracking", "collapse" → Higher risk
  - Parses surveyor comments for qualitative clues
  - Combines textual and structural data

### Clustering & Anomalies
- ✅ **KMeans Clustering**: Groups similar buildings
- ✅ **IsolationForest**: Detects unusual buildings (outliers)
- ✅ **Typology Classification**: Identifies building categories:
  - Early Unreinforced (~70% risk)
  - Transition Era (~45% risk)
  - Modern Code (~25% risk)
  - High-Rise (~40% risk)

### Visualization & Export
- 📊 Risk distribution charts
- 🗂️ Age vs. risk correlation
- 📍 Material vulnerability analysis
- 🗺️ Interactive geo-spatial maps (GeoJSON → QGIS)
- 📄 PDF risk reports
- 📘 Building passports (Word documents)
- 📊 CSV export for further analysis

---

## 📖 User Guide

### Load Data (Step 1)
1. Click **"📂 Load Excel File"**
2. Select your building survey Excel file
   - Should have columns: Building ID, Material, Age, Stories, Foundation, Damage
   - App auto-detects seismic indicator columns
3. Status shows: "filename.xlsx (123 buildings loaded)"

### Calculate Vulnerability (Step 2)
1. Click **"🔬 Calculate Vulnerability"** in sidebar
2. App analyzes all buildings using composite index
3. Watch progress in status bar

### Explore Results (Step 3)
Choose a tab:

**📊 Vulnerability Dashboard**
- Overview stats (Critical, High, Moderate, Low)
- Risk distribution chart
- Age vs. risk correlation
- Material vulnerability analysis

**🗂️ All Buildings**
- Card-based view of each building
- Color-coded by risk level (Red=Critical, Orange=High, Yellow=Moderate, Green=Low)
- Shows all 5 vulnerability components
- Action recommendations for each building

**⚖️ Compare**
- Side-by-side comparison of two buildings
- Risk score breakdown
- Component-by-component difference highlight

**🎯 Typology Analysis**
- Groups buildings by type (age + material)
- Shows average vulnerability per cluster
- KMeans clustering summary
- Anomaly detection (unusual buildings)

**🗺️ Map View**
- Interactive map of all buildings
- Color-coded pins (red=critical, yellow=high, green=low)
- Click pins for building details
- Saves as `seismic_vulnerability_map.html`

### Filter Data (Quick Filter)
Left sidebar query builder:
1. Select column (Building ID, Risk Level, Age, Material, etc.)
2. Choose operator (=, !=, >, <, contains)
3. Enter value (e.g., "CRITICAL", "40", "stone")
4. Click **Apply**
5. All tabs update automatically

### Export Results

**📘 Passports + Risk**
- Generates Word document per building
- Includes: vulnerability score, components, photos, recommendations
- Perfect for stakeholder reports

**📄 Risk Report PDF**
- Summary statistics
- Risk distribution charts
- Top 5 most vulnerable buildings
- Ready to print or email

**📊 Export CSV**
- All data + vulnerability scores
- Open in Excel/Google Sheets
- Further analysis or dashboards

**🌍 To QGIS (GeoJSON)**
- Spatial format for GIS software
- Map buildings on customized basemaps
- Overlay with hazard zones, infrastructure, etc.

---

## 🎯 Risk Level Interpretation

| Level | Score | Interpretation | Action |
|-------|-------|-----------------|--------|
| 🟢 **MINIMAL** | 0-15 | Modern, code-compliant building | 5-year review |
| 🟡 **LOW** | 15-35 | Relatively safe, minor concerns | 2-year inspection |
| 🟠 **MODERATE** | 35-55 | Noticeable vulnerabilities | Detailed assessment |
| 🔴 **HIGH** | 55-75 | Significant risk, intervention needed | Retrofit planning |
| 🔴🔴 **CRITICAL** | 75-100 | Emergency risk, immediate action | Urgent retrofit, possible evacuation |

---

## 💡 Example Workflows

### Scenario 1: Identify Priority Buildings for Retrofit
1. Load your building database
2. Calculate vulnerability
3. Filter: Risk Level = "CRITICAL"
4. Export to PDF → Share with engineers for retrofit planning
5. Use typology analysis to prioritize by type

### Scenario 2: Geographic Risk Assessment
1. Load buildings with Lat/Lon columns
2. Calculate vulnerability
3. Go to "Map View" → Generate map
4. Open in QGIS → Overlay with seismic hazard zones
5. Identify high-risk geographic clusters

### Scenario 3: Damage Assessment After Earthquake
1. Update Excel with post-earthquake survey data
2. Add damage notes in comments field
3. Load updated file
4. Calculate → Anomaly detection finds unexpected/worse buildings
5. Passports show before/after comparison

### Scenario 4: Merge Data from Multiple Survey Campaigns
1. Click **"🔗 Merge Datasets"**
2. Select folder with multiple Excel files
3. App combines and deduplicates
4. Continue with analysis

---

## ⚙️ Technical Details

### Architecture
- **Frontend:** CustomTkinter (modern tkinter)
- **Data:** pandas (handling) + numpy (calculations)
- **ML:** scikit-learn (KMeans, IsolationForest)
- **Visualization:** matplotlib, folium
- **Export:** python-docx, reportlab, GeoJSON

### Data Flow
```
Excel → Load → Parse → Type Conversion → 
  ↓
Risk Calculators (5 parallel) → Composite Index →
  ↓
Vulnerability Cache → UI Tabs (Dashboard, Inspector, Comparison, Clustering, Map)
  ↓
Export (PDF, CSV, GeoJSON, Word)
```

### Field Mapping
The app auto-detects these Excel column names (flexible):
- Building ID: "id", "building_id", "bid", "code"
- Age: "year", "age", "construction", "built"
- Material: "material", "concrete", "stone", "brick", "wood"
- Stories: "stories", "floors", "levels", "height"
- Foundation: "foundation", "footing", "base"
- Damage: "damage", "crack", "condition", "deterioration"
- Location: "latitude", "longitude"

---

## 🔧 Troubleshooting

### Exe Won't Start
- **Windows Defender:** Executive might be quarantined, add to exclusions
- **Missing MSVC Runtime:** Install from Microsoft
- **Old Windows:** Requires Windows 7+ (64-bit)

### Data Not Loading
- Ensure Excel file is closed in Excel
- Check column names match expected keywords
- Verify numeric columns (Age, Stories, Lat, Lon) have numbers not text

### Map Not Working
- Ensure "Latitude" and "Longitude" columns exist
- Values must be numeric decimals (-90 to 90 for lat, -180 to 180 for lon)
- Install folium: `pip install folium`

### Slow Performance on Large Datasets
- Filter to subset before generating charts
- Export to CSV and use a BI tool (Tableau, Power BI) for advanced analytics
- Clustering works best with <10,000 buildings

---

## 📝 Input Data Template

Recommended Excel columns:

```
Building ID | Year Built | Material Type        | Stories | Foundation Type | Damage Level | Latitude | Longitude | Surveyor Comments
B001        | 1978       | Unreinforced Stone  | 3       | Shallow         | Moderate     | 28.1234  | 84.5678  | Visible cracking on south wall
B002        | 2010       | Reinforced Concrete | 5       | Deep Pile       | None         | 28.1235  | 84.5679  | Good condition, modern
```

---

## 🎓 Methodology

**Vulnerability Index = Weighted Sum of 5 Components:**

1. **Age Risk** (35% weight)
   - Pre-1980: +35 points
   - 1980-2000: +20 points
   - Post-2000: +10 points

2. **Material Risk** (25% weight)
   - Unreinforced: +40 points
   - Stone/Brick: +30-35 points
   - RC/Steel: +5-10 points

3. **Foundation Risk** (20% weight)
   - Unknown/Poor: +30 points
   - Adequate: +15 points
   - Deep/Piled: +5-10 points

4. **Height Risk** (10% weight)
   - >7 stories: +25 points
   - 4-7 stories: +15 points
   - <4 stories: +5 points

5. **Condition Risk** (10% weight)
   - Critical/Severe: +25 points
   - Moderate: +15 points
   - Fair/Good: +5-10 points

**Final Score:** Min(100, sum of weighted components)

---

## 📧 Support & Improvements

The analyzer is built on:
- Your BuildingForm.tsx survey schema
- OpenDRI/World Bank seismic risk methodology
- Best practices from UN-HABITAT, GFDRR

For questions or improvements:
- Check the **"❓ Help & Guide"** tab in the app
- Review the comprehensive guide at top of Help tab
- Contact project team with feature requests

---

## 🎉 You're Ready!

**To get started:**
1. Double-click `SeismicAnalyzer_Pro.exe`
2. Click "Load Excel File"
3. Click "Calculate Vulnerability"
4. Explore the Dashboard, All Buildings, Map View
5. Export passports or PDF for stakeholders

**Enjoy powerful seismic risk analysis!**
