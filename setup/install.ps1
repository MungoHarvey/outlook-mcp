# =============================================================================
# setup/install.ps1
# Copies Outlook skill folders to the Claude skills directory and rewrites
# relative paths to point to this repo (auth system and Graph API proxy).
#
# Usage:
#   .\setup\install.ps1
#
# Override skills destination or auth/proxy location:
#   .\setup\install.ps1 -SkillsDir "D:\my\skills" -InstallDir "D:\my\repo"
# =============================================================================

param(
    [string]$InstallDir = "",
    [string]$SkillsDir  = "$env:USERPROFILE\.claude\skills"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir

# Default: auth and proxy live in this repo (self-contained developer workflow).
if (-not $InstallDir) { $InstallDir = $RootDir }

# 1. Create skills directory
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null

# 2. Copy skill folders and rewrite ${CLAUDE_PLUGIN_ROOT} paths to this repo
$proxy  = ($InstallDir + "\scripts\graph_call.py")          -replace '\\', '/'
$authSh = ($InstallDir + "\outlook-skills\auth.sh")         -replace '\\', '/'
$authPs = ($InstallDir + "\outlook-skills\auth.ps1")        -replace '\\', '/'
$guide  = ($InstallDir + "\setup\azure-setup-guide.html")   -replace '\\', '/'

Get-ChildItem "$RootDir\skills" -Directory |
    Where-Object { $_.Name -like "outlook-*" } |
    ForEach-Object {
        $dest = Join-Path $SkillsDir $_.Name
        Copy-Item -Recurse -Force $_.FullName $dest
        Get-ChildItem $dest -Recurse -Filter "*.md" | ForEach-Object {
            (Get-Content $_.FullName -Raw).
                Replace('${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py', $proxy).
                Replace('${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh', $authSh).
                Replace('${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.ps1', $authPs).
                Replace('${CLAUDE_PLUGIN_ROOT}/setup/azure-setup-guide.html', $guide) |
            Set-Content $_.FullName -Encoding UTF8 -NoNewline
        }
    }

Write-Host "Outlook skills installed"
Write-Host "  Skills: $SkillsDir\outlook-*"
Write-Host "  Proxy:  $InstallDir\scripts\graph_call.py"
Write-Host ""
Write-Host "Next step -- authenticate. Choose one:"
Write-Host "  PowerShell:             .\outlook-skills\auth.ps1"
Write-Host "  Git Bash / MSYS2 / WSL: bash $auth"
