import os
import sys

pdf_path = r"A:\\Building Specific Survey _ UET x EPFL.pdf"
out_dir = r"A:\\seismic-survey-app\\.tmp\\pdf_review"
os.makedirs(out_dir, exist_ok=True)

try:
    import fitz  # PyMuPDF
except Exception:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pymupdf"])
    import fitz

doc = fitz.open(pdf_path)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pix.save(os.path.join(out_dir, f"page_{i+1:03d}.png"))
print(f"Rendered {len(doc)} pages to {out_dir}")
