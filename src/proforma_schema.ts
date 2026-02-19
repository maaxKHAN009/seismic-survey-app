// Auto-generated schema from Building Specific Proforma
// This is purely additive - admin can still edit all field and section properties

export const PROFORMA_SECTIONS = [
  {
    id: "identification",
    title: "1. IDENTIFICATION & LOCATION",
    fields: [
      { id: "building_id", label: "Building ID", type: "text" as const, tooltip: "Unique identifier", required: true },
      { id: "survey_date", label: "Survey Date", type: "text" as const, tooltip: "DD/MM/YYYY", autoDate: true, required: true },
      { id: "surveyor_name", label: "Surveyor Name", type: "text" as const, tooltip: "Name of surveyor", required: true },
      { id: "district", label: "District / Tehsil", type: "text" as const, tooltip: "" },
      { id: "village", label: "Village / Locality", type: "text" as const, tooltip: "" },
      { id: "gps_coords", label: "GPS Coordinates", type: "text" as const, tooltip: "Latitude, Longitude" },
      { id: "ground_type", label: "Building is constructed on:", type: "select" as const, options: ["Flat ground", "Gentle slope", "Steep slope", "Valley"], tooltip: "" },
      { id: "adjacent_buildings", label: "Surrounded by adjacent buildings?", type: "select" as const, options: ["Yes, attached on one or more sides", "No, detached building"], tooltip: "" },
      { id: "natural_hazards", label: "Exposed to natural hazards? (Select all)", type: "multi_select" as const, options: ["Earthquake", "Flood", "Landslide"], tooltip: "" },
      { id: "construction_period", label: "Construction period relative to 2005 Kashmir Earthquake:", type: "select" as const, options: ["Post Kashmir EQ (after 2005)", "Pre-Kashmir EQ (before 2005)"], tooltip: "" },
      { id: "current_use", label: "Current Use of the building:", type: "select" as const, options: ["Residential", "Commercial", "Religious", "Mixed", "Public", "Storage", "Other"], tooltip: "" },
      { id: "construction_age", label: "Estimated Construction Age:", type: "select" as const, options: ["<10 yrs", "10–30 yrs", "30–60 yrs", "60–100 yrs", ">100 yrs"], tooltip: "" },
      { id: "occupancy_status", label: "Occupancy Status:", type: "select" as const, options: ["Occupied", "Partial", "Vacant", "Seasonal"], tooltip: "" }
    ]
  },
  {
    id: "structural_system",
    title: "2. STRUCTURAL SYSTEM & TYPOLOGY",
    fields: [
      { id: "longitudinal_length", label: "Longitudinal direction (longest side) [ft]", type: "number" as const, tooltip: "" },
      { id: "transverse_length", label: "Transverse direction (shorter side) [ft]", type: "number" as const, tooltip: "" },
      { id: "openings_longitudinal", label: "Total openings (doors + windows) in longitudinal walls:", type: "number" as const, tooltip: "" },
      { id: "openings_transverse", label: "Total openings (doors + windows) in transverse walls:", type: "number" as const, tooltip: "" },
      { id: "total_covered_area", label: "Total covered area [sq ft]", type: "number" as const, tooltip: "" },
      { id: "lateral_resisting_system", label: "Primary Lateral Resisting System:", type: "select" as const, options: ["URM masonry", "Confined masonry", "RC Frame", "Other"], tooltip: "" },
      { id: "wall_junction_toothing", label: "Wall Junction Toothing:", type: "select" as const, options: ["Proper", "Partial", "None", "Not visible"], tooltip: "" },
      { id: "no_of_stories", label: "No. of Stories:", type: "select" as const, options: ["Single", "Double", "Other"], tooltip: "" },
      { id: "plan_shape", label: "Plan Shape:", type: "select" as const, options: ["Rectangular", "Square", "L-shape", "Irregular"], tooltip: "" }
    ]
  },
  {
    id: "wall_system",
    title: "3. WALL SYSTEM",
    fields: [
      { id: "external_wall_thickness", label: "External Wall thickness [inches]", type: "number" as const, tooltip: "" },
      { id: "internal_wall_thickness", label: "Internal Wall thickness [inches]", type: "number" as const, tooltip: "" },
      { id: "main_wall_material", label: "Main material used to build the walls:", type: "select" as const, options: ["Random Rubble Stone", "Course Rubble Stone", "Semi-Dressed stone", "Solid block", "Hollow block", "Adobe", "Other"], tooltip: "" },
      { id: "mortar_type", label: "Type of mortar used:", type: "select" as const, options: ["Mud mortar", "Lime mortar", "Cement sand mortar", "Other"], tooltip: "" },
      { id: "mortar_condition", label: "Condition of the Mortar:", type: "select" as const, options: ["Good", "Weathered", "Eroded", "Missing"], tooltip: "" },
      { id: "through_stones", label: "Provision of through stones in the wall:", type: "select" as const, options: ["Regular", "Irregular", "None", "N/A"], tooltip: "" }
    ]
  },
  {
    id: "openings",
    title: "4. OPENINGS",
    fields: [
      { id: "lintel_type", label: "Lintel type:", type: "select" as const, options: ["Timber", "Stone", "RC", "None", "NA"], tooltip: "" },
      { id: "opening_alignment", label: "Opening alignment in vertical direction:", type: "select" as const, options: ["Aligned", "Staggered"], tooltip: "" }
    ]
  },
  {
    id: "horizontal_bands",
    title: "5. HORIZONTAL BANDS",
    fields: [
      { id: "bands_present", label: "Which bands are present? (Select all)", type: "multi_select" as const, options: ["Plinth band", "Sill band", "Lintel band", "Roof band", "None"], tooltip: "" },
      { id: "bands_material", label: "Material used in bands:", type: "select" as const, options: ["Reinforced concrete (RCC)", "Wood", "Steel", "Mixed", "N/A"], tooltip: "" }
    ]
  },
  {
    id: "structural_connections",
    title: "6. STRUCTURAL CONNECTIONS",
    fields: [
      { id: "roof_wall_connection", label: "Roof-to-wall Connection:", type: "select" as const, options: ["Bearing (simply resting on wall)", "Adequately anchored (nailed/bolted/wired down)", "Not anchored (loose)"], tooltip: "" },
      { id: "floor_wall_connection", label: "Floor-to-wall:", type: "select" as const, options: ["Bearing (simply resting on wall)", "Adequately anchored (nailed/bolted/wired down)", "Not anchored (loose)"], tooltip: "" },
      { id: "wall_wall_connection", label: "Wall-to-wall connection:", type: "select" as const, options: ["Proper", "Partial", "Poor"], tooltip: "" }
    ]
  },
  {
    id: "floor_system",
    title: "7. FLOOR SYSTEM",
    fields: [
      { id: "floor_material", label: "Floor Material:", type: "select" as const, options: ["Earth", "Timber", "RC", "Other"], tooltip: "" }
    ]
  },
  {
    id: "roof_system",
    title: "8. ROOF SYSTEM",
    fields: [
      { id: "roof_type", label: "Roof Type:", type: "select" as const, options: ["Flat", "Sloped", "Gable"], tooltip: "" },
      { id: "roof_material", label: "Roof Material:", type: "select" as const, options: ["Timber + mud", "RC slab", "Wooden truss", "Steel truss", "Inverted T roof with brick", "Mixed"], tooltip: "" }
    ]
  },
  {
    id: "non_structural",
    title: "9. NON-STRUCTURAL ELEMENTS",
    fields: [
      { id: "parapet_wall", label: "Does the building have a parapet wall?", type: "select" as const, options: ["Yes", "No"], tooltip: "" },
      { id: "parapet_height", label: "If yes, parapet wall height [inches]:", type: "number" as const, tooltip: "" },
      { id: "parapet_thickness", label: "If yes, parapet wall thickness [inches]:", type: "number" as const, tooltip: "" },
      { id: "parapet_material", label: "If yes, parapet wall material:", type: "select" as const, options: ["Same as main wall", "Brick", "Stone", "Other"], tooltip: "" },
      { id: "boundary_wall", label: "Does the building have a boundary wall?", type: "select" as const, options: ["Yes", "No"], tooltip: "" }
    ]
  },
  {
    id: "foundation_plinth",
    title: "10. FOUNDATION & PLINTH",
    fields: [
      { id: "foundation_type", label: "Foundation Type:", type: "select" as const, options: ["Strip footing", "Isolated footing", "Stone plinth", "Rubble trench", "Stepped foundation", "RCC raft", "Not visible"], tooltip: "" },
      { id: "foundation_material", label: "Foundation Material:", type: "select" as const, options: ["Random rubble masonry", "Coursed rubble masonry", "Brick masonry", "RC", "PCC", "Mixed", "Not visible"], tooltip: "" },
      { id: "foundation_depth", label: "Foundation Depth below Ground Level [ft]:", type: "number" as const, tooltip: "" },
      { id: "foundation_width", label: "Foundation Width (at base) [inches]:", type: "number" as const, tooltip: "" },
      { id: "foundation_condition", label: "Foundation Condition:", type: "select" as const, options: ["Sound / No visible distress", "Minor cracking", "Major cracking", "Settlement observed", "Scour / erosion visible", "Vegetation growth", "Not visible"], tooltip: "" },
      { id: "plinth_material", label: "Plinth / Base Material:", type: "select" as const, options: ["Stone masonry", "Brick masonry", "RCC", "PCC", "Mixed"], tooltip: "" },
      { id: "plinth_height", label: "Plinth Height Above Ground Level [inches]:", type: "number" as const, tooltip: "" },
      { id: "dpc_present", label: "Damp Proof Course (DPC) Present?", type: "select" as const, options: ["Yes", "No"], tooltip: "" },
      { id: "dpc_material", label: "If DPC present, Material:", type: "select" as const, options: ["Bitumen", "Plastic sheet", "Cement mortar", "Stone slab", "Other"], tooltip: "" },
      { id: "soil_type", label: "Soil Type around Foundation:", type: "select" as const, options: ["Rocky", "Gravel", "Sandy", "Clayey", "Silty", "Mixed"], tooltip: "" },
      { id: "slope_drainage", label: "Slope / Drainage around Foundation:", type: "select" as const, options: ["Proper drainage away from building", "Water pooling near foundation", "Erosion visible", "Not applicable (flat site)"], tooltip: "" },
      { id: "foundation_erosion", label: "Is foundation exposed / vulnerable to erosion?", type: "select" as const, options: ["Yes", "No"], tooltip: "" },
      { id: "foundation_remarks", label: "Remarks on foundation:", type: "text" as const, tooltip: "", allowComments: true }
    ]
  },
  {
    id: "past_intervention",
    title: "11. PAST INTERVENTION AND DAMAGES",
    fields: [
      { id: "past_intervention", label: "Has the building undergone any past intervention/repair?", type: "select" as const, options: ["Yes", "No"], tooltip: "" },
      { id: "intervention_details", label: "If yes, Specify:", type: "text" as const, tooltip: "" },
      { id: "observed_damages", label: "Observed damage type(s): (Select all)", type: "multi_select" as const, options: ["Foundation settlement", "Corner separation", "Wall cracking", "Wall bulging", "Roof damage", "Other"], tooltip: "" }
    ]
  },
  {
    id: "documentation",
    title: "12. DOCUMENTATION",
    fields: [
      { id: "sketch_attached", label: "Sketch attached", type: "checkbox" as const, tooltip: "" },
      { id: "elevations_attached", label: "Elevations attached", type: "checkbox" as const, tooltip: "" },
      { id: "photos_captured", label: "Photos captured", type: "checkbox" as const, tooltip: "" }
    ]
  },
  {
    id: "remarks",
    title: "13. REMARKS",
    fields: [
      { id: "general_remarks", label: "General Remarks:", type: "text" as const, tooltip: "", allowComments: true }
    ]
  }
];
