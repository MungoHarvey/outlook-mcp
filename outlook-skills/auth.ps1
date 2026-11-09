# =============================================================================
# outlook-skills/auth.ps1
# PowerShell thin launcher for Azure OAuth authentication.
# Delegates entirely to auth-server.js — no state resolution or .env checks here.
#
# Usage:
#   .\outlook-skills\auth.ps1            # full auth flow
#   .\outlook-skills\auth.ps1 -Status    # check token validity
#   .\outlook-skills\auth.ps1 -Reauth    # force re-authentication
#   .\outlook-skills\auth.ps1 -Revoke    # revoke and delete all tokens
#   .\outlook-skills\auth.ps1 -Where     # print state directory info as JSON
# =============================================================================

param(
    [switch]$Status,
    [switch]$Reauth,
    [switch]$Revoke,
    [switch]$Where
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AuthServer = Join-Path $ScriptDir "auth-server.js"

# -- Check Node.js is available ---------------------------------------------
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Error "Node.js is required but not found. Install from: https://nodejs.org/"
    exit 1
}

# -- Build arguments: map PowerShell flags to auth-server.js flags ----------
$rawArgs = $MyInvocation.UnboundArguments
$nodeArgs = @($AuthServer)

# Map PowerShell-style (-Status) and bash-style (--status) to auth-server flags
$isStatus = $Status -or ($rawArgs -contains "--status")
$isReauth = $Reauth -or ($rawArgs -contains "--reauth")
$isRevoke = $Revoke -or ($rawArgs -contains "--revoke")
$isWhere = $Where -or ($rawArgs -contains "--where")

if ($isStatus) { $nodeArgs += "--status" }
if ($isReauth) { $nodeArgs += "--reauth" }
if ($isRevoke) { $nodeArgs += "--revoke" }
if ($isWhere) { $nodeArgs += "--where" }

# -- Delegate to auth-server.js ---------------------------------------------
node @nodeArgs
exit $LASTEXITCODE
