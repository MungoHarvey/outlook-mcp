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

# 2. Copy skill folders and rewrite paths to point to this repo
$proxy = ($InstallDir + "\scripts\graph_call.py") -replace '\\', '/'
$auth  = ($InstallDir + "\outlook-skills\auth.sh")  -replace '\\', '/'

Get-ChildItem "$RootDir\.claude\skills" -Directory |
    Where-Object { $_.Name -like "outlook-*" } |
    ForEach-Object {
        $dest = Join-Path $SkillsDir $_.Name
        Copy-Item -Recurse -Force $_.FullName $dest
        Get-ChildItem $dest -Recurse -Filter "*.md" | ForEach-Object {
            (Get-Content $_.FullName -Raw).
                Replace('python3 scripts/graph_call.py', "python3 $proxy").
                Replace('bash outlook-skills/auth.sh', "bash $auth") |
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
