# =============================================================================
# outlook-skills/auth.ps1
# PowerShell entry point for Azure OAuth authentication.
# Delegates to auth-server.js (Node.js) — same approach as the MCP servers.
#
# Credentials: <state-dir>\.env  (copy from .env.example)
# Tokens:      <state-dir>\tokens.json (never committed)
#
# State dir resolution: $env:OUTLOOK_SKILLS_HOME if set, else this script's
# own directory when it already holds .env/tokens.json (cloned-repo layout),
# else ~\.outlook-skills (survives plugin cache updates).
#
# Usage:
#   .\outlook-skills\auth.ps1            # full auth flow
#   .\outlook-skills\auth.ps1 -Status    # check token validity
#   .\outlook-skills\auth.ps1 -Reauth    # force re-authentication
#   .\outlook-skills\auth.ps1 -Revoke    # revoke and delete all tokens
# =============================================================================

param(
    [switch]$Status,
    [switch]$Reauth,
    [switch]$Revoke
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AuthServer = Join-Path $ScriptDir "auth-server.js"

# -- Resolve state dir (must match auth-server.js / token_helper.py) --------
if ($env:OUTLOOK_SKILLS_HOME) {
    $StateDir = $env:OUTLOOK_SKILLS_HOME
} elseif ((Test-Path (Join-Path $ScriptDir ".env")) -or (Test-Path (Join-Path $ScriptDir "tokens.json"))) {
    $StateDir = $ScriptDir
} else {
    $StateDir = Join-Path $env:USERPROFILE ".outlook-skills"
}
$EnvFile = Join-Path $StateDir ".env"

Write-Host ""
Write-Host "Azure Skills Authentication"
Write-Host "  Credentials: $EnvFile"
Write-Host ""

# -- Validate .env exists ---------------------------------------------------
if (-not (Test-Path $EnvFile)) {
    Write-Warning "No .env found at $EnvFile"
    Write-Host ""
    Write-Host "  Copy the template and fill in your Azure app credentials:"
    Write-Host "    New-Item -ItemType Directory -Force '$StateDir' | Out-Null"
    Write-Host "    Copy-Item '$( Join-Path $ScriptDir ".env.example" )' '$EnvFile'"
    Write-Host "    notepad '$EnvFile'"
    Write-Host ""
    exit 1
}
Write-Host "  [ok] Credentials file found"

# -- Check Node.js is available ---------------------------------------------
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Error "Node.js is required but not found. Install from: https://nodejs.org/"
    exit 1
}
Write-Host "  [ok] Node.js found: $(node --version)"
Write-Host ""

# -- Build arguments and run ------------------------------------------------
# Support both PowerShell-style (-Reauth) and bash-style (--reauth) flags
$rawArgs = $MyInvocation.UnboundArguments
$isReauth = $Reauth -or ($rawArgs -contains "--reauth")
$isStatus = $Status -or ($rawArgs -contains "--status")
$isRevoke = $Revoke -or ($rawArgs -contains "--revoke")

$nodeArgs = @($AuthServer)
if ($isStatus) { $nodeArgs += "--status" }
if ($isReauth) { $nodeArgs += "--reauth" }
if ($isRevoke) { $nodeArgs += "--revoke" }

node @nodeArgs
exit $LASTEXITCODE
