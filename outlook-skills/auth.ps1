# =============================================================================
# outlook-skills/auth.ps1
# PowerShell entry point for Azure OAuth authentication setup.
# Parallel to auth.sh -- works on Windows without requiring bash or WSL.
#
# Credentials: outlook-skills\.env  (copy from .env.example)
# Venv:        outlook-skills\.venv (created here, never in Claude dirs)
# Tokens:      outlook-skills\tokens.json (gitignored)
#
# Usage:
#   .\outlook-skills\auth.ps1            # full auth flow
#   .\outlook-skills\auth.ps1 -Status    # check token validity
#   .\outlook-skills\auth.ps1 -Reauth    # force re-authentication
#   .\outlook-skills\auth.ps1 -Revoke    # revoke tokens
# =============================================================================

param(
    [switch]$Status,
    [switch]$Reauth,
    [switch]$Revoke
)

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir      = Join-Path $ScriptDir ".venv"
$Runner       = Join-Path $ScriptDir "auth_runner.py"
$Requirements = Join-Path $ScriptDir "requirements.txt"
$EnvFile      = Join-Path $ScriptDir ".env"
$EnvExample   = Join-Path $ScriptDir ".env.example"

Write-Host ""
Write-Host "Azure Skills Authentication"
Write-Host "  Credentials: $EnvFile"
Write-Host "  Venv:        $VenvDir"
Write-Host ""

# -- Validate .env exists (before bootstrap — fail fast) ----------------------
if (-not (Test-Path $EnvFile)) {
    Write-Host ""
    Write-Warning "No .env found at $EnvFile"
    Write-Host ""
    Write-Host "  Copy the template and fill in your Azure app credentials:"
    Write-Host "    Copy-Item '$EnvExample' '$EnvFile'"
    Write-Host "    notepad '$EnvFile'"
    Write-Host ""
    Write-Host "  Required: OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID"
    exit 1
}
Write-Host "  [ok]   Credentials file found"
Write-Host ""

# -- Bootstrap virtual environment --------------------------------------------
$useUv = $null -ne (Get-Command uv -ErrorAction SilentlyContinue)

if ($useUv) {
    Write-Host "  [info] Using uv"

    if (-not (Test-Path $VenvDir)) {
        Write-Host "  [info] Creating virtual environment..."
        uv venv $VenvDir
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create virtual environment"; exit 1 }
        Write-Host "  [ok]   Virtual environment created"
    }

    $activateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
    if (-not (Test-Path $activateScript)) {
        Write-Error "Cannot activate venv -- missing: $activateScript"
        exit 1
    }
    . $activateScript

    $needsInstall = $false
    try { python -c "import dotenv" 2>$null; if ($LASTEXITCODE -ne 0) { $needsInstall = $true } }
    catch { $needsInstall = $true }

    if ($needsInstall) {
        Write-Host "  [info] Installing dependencies (one-time)..."
        uv pip install --quiet -r $Requirements
        if ($LASTEXITCODE -ne 0) { Write-Error "Dependency installation failed"; exit 1 }
        Write-Host "  [ok]   Dependencies installed"
    }
} else {
    # Fallback: plain pip + python
    Write-Host "  [warn] uv not found -- falling back to pip"
    Write-Host "         Install uv for faster setup: https://docs.astral.sh/uv/getting-started/installation/"

    $python = $null
    foreach ($cmd in @("python3", "python")) {
        try {
            $ver = & $cmd --version 2>&1
            if ($ver -match "Python 3\.([89]|[1-9][0-9])") { $python = $cmd; break }
        } catch { }
    }
    if (-not $python) {
        Write-Error "Python 3.8+ required. Download from: https://www.python.org/downloads/"
        exit 1
    }

    if (-not (Test-Path $VenvDir)) {
        Write-Host "  [info] Creating virtual environment..."
        & $python -m venv $VenvDir
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create virtual environment"; exit 1 }
        Write-Host "  [ok]   Virtual environment created"
    }

    $activateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
    if (-not (Test-Path $activateScript)) { Write-Error "Cannot activate venv -- missing: $activateScript"; exit 1 }
    . $activateScript

    $needsInstall = $false
    try { python -c "import dotenv" 2>$null; if ($LASTEXITCODE -ne 0) { $needsInstall = $true } }
    catch { $needsInstall = $true }

    if ($needsInstall) {
        Write-Host "  [info] Installing dependencies (one-time)..."
        pip install --quiet --upgrade pip
        pip install --quiet -r $Requirements
        if ($LASTEXITCODE -ne 0) { Write-Error "Dependency installation failed"; exit 1 }
        Write-Host "  [ok]   Dependencies installed"
    }
}

# -- Delegate to auth_runner.py -----------------------------------------------
$runnerArgs = @()
if ($Status) { $runnerArgs += "--status" }
if ($Reauth) { $runnerArgs += "--reauth" }
if ($Revoke) { $runnerArgs += "--revoke" }

python $Runner @runnerArgs
exit $LASTEXITCODE
