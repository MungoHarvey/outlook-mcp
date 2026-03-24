# =============================================================================
# outlook-skills/auth.ps1
# PowerShell entry point for Azure OAuth authentication.
# Delegates to auth-server.js (Node.js) — same approach as the MCP servers.
#
# Credentials: outlook-skills\.env  (copy from .env.example)
# Tokens:      outlook-skills\tokens.json (gitignored)
#
# Usage:
#   .\outlook-skills\auth.ps1            # full auth flow
#   .\outlook-skills\auth.ps1 -Status    # check token validity
#   .\outlook-skills\auth.ps1 -Reauth    # force re-authentication
# =============================================================================

param(
    [switch]$Status,
    [switch]$Reauth
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AuthServer = Join-Path $ScriptDir "auth-server.js"
$EnvFile = Join-Path $ScriptDir ".env"

Write-Host ""
Write-Host "Azure Skills Authentication"
Write-Host "  Credentials: $EnvFile"
Write-Host ""

# -- Validate .env exists ---------------------------------------------------
if (-not (Test-Path $EnvFile)) {
    Write-Warning "No .env found at $EnvFile"
    Write-Host ""
    Write-Host "  Copy the template and fill in your Azure app credentials:"
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

$nodeArgs = @($AuthServer)
if ($isStatus) { $nodeArgs += "--status" }
if ($isReauth) { $nodeArgs += "--reauth" }

node @nodeArgs
exit $LASTEXITCODE
