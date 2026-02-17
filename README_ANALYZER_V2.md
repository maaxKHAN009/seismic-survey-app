Seismic Analyzer - Advanced Edition (analysis_gui_v2)

Quick start

1. Create and activate a Python virtual environment (Windows PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Run the analyzer:

```powershell
python analysis_gui_v2.py
```

Notes & Tips

- The app uses `customtkinter` for UI and `pandas` for data handling. Ensure you have a display environment on Windows.
- Recommended workflow: load your Building-specific Excel (from BuildingForm) then click `Calculate Vulnerability`.
- If you plan to use the mapping features, install `folium` (already in requirements) and ensure `Latitude`/`Longitude` columns exist.

Troubleshooting

- If GUI doesn't start, ensure `customtkinter` is installed and your Python is 3.8+.
- For large datasets, increase memory or work with filtered subsets.

Files added

- `analysis_gui_v2.py` : New advanced analyzer (already in repo)
- `requirements.txt` : Python dependencies
- `README_ANALYZER_V2.md` : This quick-start guide

Next steps

- I can run basic static checks on the analyzer and add lightweight NLP and clustering next. Would you like me to proceed with NLP parsing now?