param(
    [string]$InstallDir = "",
    [string]$SkillsDir  = "$env:USERPROFILE\.claude\skills"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir

# Default: auth and proxy live in the cloned repo (self-contained developer workflow).
# Override: .\setup\install.ps1 -InstallDir "D:\other\path"
if (-not $InstallDir) { $InstallDir = $RootDir }

# 1. Create skills directory
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null

# 2. Install skill folders -- rewrite relative paths to repo locations
$proxy = ($InstallDir + "\scripts\graph_call.py") -replace '\\', '/'
$auth  = ($InstallDir + "\outlook-skills\auth.sh") -replace '\\', '/'

Get-ChildItem "$RootDir\.claude\skills" -Directory | Where-Object { $_.Name -like "outlook-*" } | ForEach-Object {
    $dest = "$SkillsDir\$($_.Name)"
    Copy-Item -Recurse -Force $_.FullName $dest
    Get-ChildItem $dest -Recurse -Filter "*.md" | ForEach-Object {
        (Get-Content $_.FullName).
            Replace('python3 scripts/graph_call.py', "python3 $proxy").
            Replace('bash outlook-skills/auth.sh', "bash $auth") |
        Set-Content $_.FullName
    }
}

# 3. Bootstrap venv (no-op if already done)
bash ($InstallDir + "/outlook-skills/auth.sh") --status 2>$null

Write-Host "Outlook skills installed"
Write-Host "  Skills: $SkillsDir\outlook-*"
Write-Host "  Proxy:  $InstallDir\scripts\graph_call.py"
Write-Host ""
Write-Host "Next step -- authenticate (run in Git Bash / MSYS2 / WSL):"
Write-Host "  bash $auth"
