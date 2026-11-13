$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

$Python = ".\.venv-ml\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    py -m venv .venv-ml
}

& $Python -m pip install -r requirements-ml.txt
& $Python scripts\ml\build_congestion_dataset.py
& $Python scripts\ml\train_congestion_models.py
& $Python scripts\ml\plot_congestion_results.py
try {
    & $Python scripts\ml\create_congestion_report_docx.py
} catch {
    Write-Warning "DOCX report generation was skipped or failed. Close the DOCX if it is open and run create_congestion_report_docx.py again."
}

Write-Host "Congestion ML pipeline completed. Outputs: exports\ml"
